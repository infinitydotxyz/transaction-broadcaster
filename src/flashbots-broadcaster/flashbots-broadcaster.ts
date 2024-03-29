import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { BigNumber, providers, Wallet } from 'ethers';
import * as EventEmitter from 'events';
import { TxPool } from './tx-pool.interface';
import { getFeesAtTarget, getFlashbotsEndpoint, gweiToWei } from '../utils/general';
import {
  BlockEvent,
  FlashbotsBroadcasterEvent,
  FlashbotsBroadcasterEventTypes,
  FailedBundleSubmission,
  GetEventType,
  getFailedBundleSubmissionReason,
  RelayErrorEvent,
  SimulatedEvent,
  StartedEvent,
  SubmittingBundleEvent,
  SuccessfulBundleSubmission,
  RevertReason
} from './flashbots-broadcaster-emitter.types';
import {
  FlashbotsBroadcasterSettings,
  FlashbotsBroadcasterInternalOptions,
  FlashbotsBroadcasterOptions
} from './flashbots-broadcaster-options.types';
import { ChainId, MatchOrderFulfilledEvent } from '@infinityxyz/lib/types/core';
import { decodeErc20Transfer, decodeMatchOrderFulfilled, decodeNftTransfer } from '../utils/log-decoders';
import { Erc20Transfer, NftTransfer } from '../utils/log.types';
import { BundleItem } from './bundle.types';

export class FlashbotsBroadcaster<T extends { id: string }> {
  public readonly chainId: ChainId;
  private authSigner: Wallet;
  private signer: Wallet;
  private provider: providers.StaticJsonRpcProvider;
  private flashbotsProvider: FlashbotsBundleProvider;
  private txPool: TxPool<T>;
  public readonly network: providers.Network;
  private readonly settings: FlashbotsBroadcasterSettings;
  private shutdown?: () => Promise<void>;
  private emitter: EventEmitter;

  static async create<T extends { id: string }>(txPool: TxPool<T>, options: FlashbotsBroadcasterOptions) {
    const authSigner = new Wallet(options.authSigner.privateKey, options.provider);
    const signer = new Wallet(options.transactionSigner.privateKey, options.provider);
    const network = await options.provider.getNetwork();
    const connectionUrl = getFlashbotsEndpoint(network);
    const flashbotsProvider = await FlashbotsBundleProvider.create(options.provider, authSigner, connectionUrl);
    return new FlashbotsBroadcaster<T>({
      authSigner,
      provider: options.provider,
      flashbotsProvider,
      signer,
      blocksInFuture: options.blocksInFuture ?? 2,
      network,
      allowReverts: options.allowReverts ?? false,
      filterSimulationReverts: options.filterSimulationReverts ?? true,
      priorityFee: options.priorityFee ?? 3.5,
      txPool
    });
  }

  /**
   * use the create method to create a new FlashbotsBroadcaster instance
   */
  private constructor(options: FlashbotsBroadcasterInternalOptions<T>) {
    this.authSigner = options.authSigner;
    this.signer = options.signer;
    this.provider = options.provider;
    this.flashbotsProvider = options.flashbotsProvider;
    this.settings = {
      blocksInFuture: options.blocksInFuture,
      allowReverts: options.allowReverts,
      filterSimulationReverts: options.filterSimulationReverts,
      priorityFee: options.priorityFee
    };
    this.network = options.network;
    this.emitter = new EventEmitter();
    this.txPool = options.txPool;
    this.chainId = `${this.network.chainId}` as ChainId;
  }

  /**
   * start the FlashbotsBroadcaster to begin submitting transactions
   * and monitoring blocks/gas prices
   */
  start() {
    this.shutdown = this.setup();
    const startedEvent: StartedEvent = {
      settings: this.settings,
      network: this.network,
      authSignerAddress: this.authSigner.address,
      signerAddress: this.signer.address
    };
    this.emit(FlashbotsBroadcasterEvent.Started, startedEvent);
  }

  /**
   * stop the FlashbotsBroadcaster
   */
  async stop() {
    this.emit(FlashbotsBroadcasterEvent.Stopping, {});
    if (this.shutdown && typeof this.shutdown === 'function') {
      await this.shutdown();
    }
    this.emit(FlashbotsBroadcasterEvent.Stopped, {});
  }

  add(item: T) {
    this.txPool.add(item);
  }

  remove(id: string) {
    this.txPool.remove(id);
  }

  on<Event extends FlashbotsBroadcasterEvent>(event: Event, listener: (data: GetEventType[Event]) => void) {
    this.emitter.on(event, listener);
  }

  off<Event extends FlashbotsBroadcasterEvent>(event: Event, listener: (data: GetEventType[Event]) => void) {
    this.emitter.off(event, listener);
  }

  private setup(): () => Promise<void> {
    const stopMonitoringBlocks = this.monitorBlocks();
    const shutdown = () => {
      return new Promise<void>((resolve) => {
        stopMonitoringBlocks();
        resolve();
      });
    };
    return shutdown;
  }

  private monitorBlocks() {
    const handler = this.onBlock.bind(this);
    this.provider.on('block', handler);
    return () => this.provider.off('block', handler);
  }

  private async onBlock(blockNumber: number) {
    try {
      const [block, baseFee] = await Promise.all([this.provider.getBlock(blockNumber), this.provider.getGasPrice()]);
      const timestamp = block.timestamp;
      const blockEvent: BlockEvent = {
        blockNumber,
        gasPrice: baseFee.toString(),
        txPoolSizes: this.txPool.sizes
      };
      this.emit(FlashbotsBroadcasterEvent.Block, blockEvent);
      await this.execute({ blockNumber, timestamp, baseFee });
    } catch (err) {
      console.error(err);
    }
  }

  private async execute(currentBlock: { blockNumber: number; timestamp: number; baseFee: BigNumber }) {
    // eslint-disable-next-line prefer-const
    let { transactions, targetBlockNumber, minTimestamp, maxTimestamp, bundleItems } = await this.getTransactions(
      currentBlock
    );
    if (transactions.length === 0) {
      return;
    }

    const simulationResult = await this.simulateBundle(transactions, currentBlock.blockNumber);
    if (this.settings.filterSimulationReverts) {
      transactions = simulationResult.successfulTransactions;
    }

    if (transactions.length === 0) {
      return;
    }

    const updatedSignedBundle = await this.getSignedBundle(transactions);
    if (updatedSignedBundle.length === 0) {
      return;
    }

    const submittingEvent: SubmittingBundleEvent = {
      blockNumber: targetBlockNumber,
      minTimestamp,
      maxTimestamp,
      transactions
    };
    this.emit(FlashbotsBroadcasterEvent.SubmittingBundle, submittingEvent);

    const bundleResponse = await this.flashbotsProvider.sendRawBundle(updatedSignedBundle, targetBlockNumber, {
      minTimestamp,
      maxTimestamp,
      revertingTxHashes: this.settings.allowReverts ? updatedSignedBundle : []
    });

    if ('error' in bundleResponse) {
      const relayError: RelayErrorEvent = {
        blockNumber: currentBlock.blockNumber,
        message: bundleResponse.error.message,
        code: bundleResponse.error.code
      };
      this.emit(FlashbotsBroadcasterEvent.RelayError, relayError);
      return;
    }

    const bundleResolution = await bundleResponse.wait();
    switch (bundleResolution) {
      case FlashbotsBundleResolution.BundleIncluded: {
        const receipts = await bundleResponse.receipts();
        const bundleTransactions = receipts.map((receipt, i) => {
          const index = receipt?.transactionIndex ?? i;
          const transaction = transactions[index];
          return {
            receipt,
            tx: transaction,
            successful: receipt?.status === 1
          };
        });
        const totalGasUsed = bundleTransactions.reduce((acc, curr) => {
          return acc.add(curr.receipt.gasUsed);
        }, BigNumber.from(0));

        const logs = bundleTransactions
          .flatMap(({ receipt }) => receipt.logs)
          .flatMap((log) => [...decodeNftTransfer(log), ...decodeErc20Transfer(log), ...decodeMatchOrderFulfilled(log)])
          .map((item) => {
            return { ...item, chainId: this.chainId };
          });

        const logsByType = logs.reduce(
          (
            acc: {
              nftTransfers: NftTransfer[];
              erc20Transfers: Erc20Transfer[];
              matchOrdersFulfilled: MatchOrderFulfilledEvent[];
            },
            log
          ) => {
            if ('tokenId' in log) {
              return {
                ...acc,
                nftTransfers: [...acc.nftTransfers, log]
              };
            } else if ('currency' in log) {
              return {
                ...acc,
                erc20Transfers: [...acc.erc20Transfers, log]
              };
            } else if ('sellOrderHash' in log) {
              return {
                ...acc,
                matchOrdersFulfilled: [...acc.matchOrdersFulfilled, log]
              };
            } else {
              return acc;
            }
          },
          { nftTransfers: [], erc20Transfers: [], matchOrdersFulfilled: [] }
        );

        const bundleItemsSubmitted = (bundleItems as unknown as BundleItem[]).filter((bundleItem) => {
          const item = logsByType.matchOrdersFulfilled.find((item) => bundleItem.orderIds.includes(item.buyOrderHash));
          return !!item;
        });

        const successfulBundleSubmission: SuccessfulBundleSubmission = {
          transactions: bundleTransactions,
          blockNumber: targetBlockNumber,
          totalGasUsed,
          nftTransfers: logsByType.nftTransfers,
          erc20Transfers: logsByType.erc20Transfers,
          matchOrdersFulfilled: logsByType.matchOrdersFulfilled,
          matchExecutor: this.signer.address.toLowerCase(),
          bundleItems: bundleItemsSubmitted
        };

        this.emit(FlashbotsBroadcasterEvent.BundleResult, successfulBundleSubmission);
        break;
      }
      case FlashbotsBundleResolution.BlockPassedWithoutInclusion:
      case FlashbotsBundleResolution.AccountNonceTooHigh: {
        const failedBundleSubmission: FailedBundleSubmission = {
          blockNumber: targetBlockNumber,
          reason: getFailedBundleSubmissionReason[bundleResolution]
        };
        this.emit(FlashbotsBroadcasterEvent.BundleResult, failedBundleSubmission);
        break;
      }
    }
  }

  private async getTransactions(currentBlock: {
    timestamp: number;
    blockNumber: number;
    baseFee: BigNumber;
  }): Promise<{
    transactions: providers.TransactionRequest[];
    minTimestamp: number;
    maxTimestamp: number;
    targetBlockNumber: number;
    bundleItems: T[];
  }> {
    const minTimestamp = currentBlock.timestamp;
    const maxTimestamp = minTimestamp + 120;
    const targetBlockNumber = currentBlock.blockNumber + this.settings.blocksInFuture;
    const { maxBaseFeeGwei } = getFeesAtTarget(currentBlock.baseFee, this.settings.blocksInFuture);
    const maxFeePerGasGwei = Math.ceil(maxBaseFeeGwei + this.settings.priorityFee);
    const maxFeePerGas = gweiToWei(maxBaseFeeGwei);

    const { txRequests, invalid, valid } = await this.txPool.getTransactions({ maxGasFeeGwei: maxFeePerGasGwei });
    if (invalid && invalid.length > 0) {
      this.emit(FlashbotsBroadcasterEvent.InvalidBundleItems, {
        invalidBundleItems: invalid,
        blockNumber: currentBlock.blockNumber
      });
    }

    this.emit(FlashbotsBroadcasterEvent.ValidBundleItems, {
      validBundleItems: valid,
      blockNumber: currentBlock.blockNumber
    });

    const transactions = txRequests.map((tx) => {
      const txRequest: providers.TransactionRequest = {
        ...tx,
        chainId: this.network.chainId,
        type: 2,
        maxPriorityFeePerGas: gweiToWei(this.settings.priorityFee).toString(),
        maxFeePerGas
      };
      return txRequest;
    });

    return {
      transactions,
      minTimestamp,
      maxTimestamp,
      targetBlockNumber,
      bundleItems: valid
    };
  }

  private async getSignedBundle(transactions: providers.TransactionRequest[]): Promise<string[]> {
    const signedBundle = await this.flashbotsProvider.signBundle(
      transactions.map((tx) => {
        return {
          signer: this.signer,
          transaction: tx
        };
      })
    );
    return signedBundle;
  }

  private async simulateBundle(
    transactions: providers.TransactionRequest[],
    blockNumber: number
  ): Promise<SimulatedEvent> {
    const signedBundle = await this.getSignedBundle(transactions);
    const simulationResult = await this.flashbotsProvider.simulate(signedBundle, 'latest');

    if ('error' in simulationResult) {
      const relayError: RelayErrorEvent = {
        blockNumber: blockNumber,
        message: simulationResult.error.message,
        code: simulationResult.error.code
      };
      this.emit(FlashbotsBroadcasterEvent.RelayError, relayError);
      throw new Error(simulationResult.error.message);
    }

    const totalGasUsed = simulationResult.totalGasUsed;
    const simulatedMaxFeePerGas = simulationResult.coinbaseDiff.div(totalGasUsed);

    const successful: providers.TransactionRequest[] = [];
    const reverted: { tx: providers.TransactionRequest; reason: string }[] = [];
    for (let index = 0; index < simulationResult.results.length; index += 1) {
      const txSim = simulationResult.results[index];
      const tx = transactions[index];
      if ('error' in txSim) {
        const insufficientAllowance = txSim.revert?.includes('insufficient allowance');
        const reason = (insufficientAllowance ? RevertReason.InsufficientAllowance : txSim.revert) ?? txSim.error;
        reverted.push({ tx, reason });
      } else {
        successful.push(tx);
      }
    }

    const simulatedEvent: SimulatedEvent = {
      blockNumber: blockNumber,
      successfulTransactions: successful,
      revertedTransactions: reverted,
      gasPrice: simulatedMaxFeePerGas,
      totalGasUsed: simulationResult.totalGasUsed
    };
    this.emit(FlashbotsBroadcasterEvent.Simulated, simulatedEvent);

    return simulatedEvent;
  }

  private emit(event: FlashbotsBroadcasterEvent, data: FlashbotsBroadcasterEventTypes) {
    this.emitter.emit(event, data);
  }
}
