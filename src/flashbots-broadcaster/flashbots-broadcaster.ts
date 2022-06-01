import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { BigNumber, providers, Wallet } from 'ethers';
import * as EventEmitter from 'events';
import { TxPool } from './tx-pool.interface';
import { getFeesAtTarget, getFlashbotsEndpoint, gweiToWei } from '../utils';
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
  TokenTransfer,
  RevertReason,
  RelayErrorCode
} from './flashbots-broadcaster-emitter.types';
import {
  FlashbotsBroadcasterSettings,
  FlashbotsBroadcasterInternalOptions,
  FlashbotsBroadcasterOptions
} from './flashbots-broadcaster-options.types';
import { decodeTransfer } from '../ethers';
import { ChainId } from '@infinityxyz/lib/types/core';
import { EthWethSwapper, Token } from '../eth-weth-swapper';
import { ETHER, GWEI } from '../constants';

export class FlashbotsBroadcaster<T extends { id: string }> {
  public readonly chainId: ChainId;
  private authSigner: Wallet;
  private signer: Wallet;
  private provider: providers.JsonRpcProvider;
  private flashbotsProvider: FlashbotsBundleProvider;
  private txPool: TxPool<T>;
  private mutex: boolean;
  private readonly network: providers.Network;
  private readonly settings: FlashbotsBroadcasterSettings;
  private shutdown?: () => Promise<void>;
  private emitter: EventEmitter;

  private swapper: EthWethSwapper;

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
    this.mutex = false;
    this.txPool = options.txPool;
    this.chainId = `${this.network.chainId}` as ChainId;
    this.swapper = new EthWethSwapper(this.provider, this.signer);
  }

  /**
   * start the FlashbotsBroadcaster to begin submitting transactions
   * and monitoring blocks/gas prices
   */
  start() {
    if (this.mutex) {
      return;
    }
    this.shutdown = this.setup();
    this.mutex = true;
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
    this.mutex = false;
    this.emit(FlashbotsBroadcasterEvent.Stopped, {});
  }

  add(item: T) {
    this.txPool.add(item);
  }

  getBundleItemFromTransfer(transfer: TokenTransfer): T | undefined {
    return this.txPool.getBundleFromTransfer(transfer);
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
        gasPrice: baseFee
      };
      this.emit(FlashbotsBroadcasterEvent.Block, blockEvent);
      await this.execute({ blockNumber, timestamp, baseFee });
    } catch (err) {
      console.error(err);
    }
  }

  private async execute(currentBlock: { blockNumber: number; timestamp: number; baseFee: BigNumber }) {
    // eslint-disable-next-line prefer-const
    let { transactions, targetBlockNumber, minTimestamp, maxTimestamp } = await this.getTransactions(currentBlock);

    if (transactions.length === 0) {
      return;
    }

    const simulationResult = await this.simulateBundle(transactions);
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

        const transfers = bundleTransactions
          .flatMap(({ receipt }) => receipt.logs)
          .flatMap((log) => decodeTransfer(log));

        const successfulBundleSubmission: SuccessfulBundleSubmission = {
          transactions: bundleTransactions,
          blockNumber: targetBlockNumber,
          totalGasUsed,
          transfers
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

  private async getTransactions(currentBlock: { timestamp: number; blockNumber: number; baseFee: BigNumber }) {
    const minTimestamp = currentBlock.timestamp;
    const maxTimestamp = minTimestamp + 120;
    const targetBlockNumber = currentBlock.blockNumber + this.settings.blocksInFuture;
    const { maxBaseFeeGwei } = getFeesAtTarget(currentBlock.baseFee, this.settings.blocksInFuture);
    const gasPrice = maxBaseFeeGwei + this.settings.priorityFee;
    const transactions = (await this.txPool.getTransactions({ maxGasFeeGwei: gasPrice })).map((tx) => {
      const txRequest: providers.TransactionRequest = {
        gasLimit: 500_000, // required so that eth_estimateGas doesn't throw an error for invalid transactions
        ...tx,
        chainId: this.network.chainId,
        type: 2,
        maxPriorityFeePerGas: gweiToWei(this.settings.priorityFee),
        maxFeePerGas: gweiToWei(gasPrice)
      };
      return txRequest;
    });

    return {
      transactions,
      minTimestamp,
      maxTimestamp,
      targetBlockNumber
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

  private async simulateBundle(transactions: providers.TransactionRequest[], alreadySwapped = false): Promise<SimulatedEvent> {
    const signedBundle = await this.getSignedBundle(transactions);

    const simulationResult = await this.flashbotsProvider.simulate(signedBundle, 'latest');

    if ('error' in simulationResult) {
      /**
       * attempt to create a tx to swap weth for eth, place it at the beginning of the bundle 
       * and try again
       */
      if(simulationResult.error.code === RelayErrorCode.InsufficientFunds && !alreadySwapped) {
        console.log(`\n\nInsufficient funds, attempting to swap weth for eth\n\n`);
        const wethBalance = await this.swapper.checkBalance(Token.Weth);
        if(wethBalance.gte(ETHER.div(10))) {
          const transferRequest = await this.swapper.swapWethForEth(wethBalance.toString());
          transactions.unshift(transferRequest);
          return this.simulateBundle(transactions, true);
        }
      }
      const relayError: RelayErrorEvent = {
        message: simulationResult.error.message,
        code: simulationResult.error.code
      };
      this.emit(FlashbotsBroadcasterEvent.RelayError, relayError);
      throw new Error(simulationResult.error.message);
    }

    const totalGasUsed = simulationResult.totalGasUsed;
    const gasPrice = simulationResult.coinbaseDiff.div(totalGasUsed);

    const simulatedGasPrice = gasPrice;
    const successful: providers.TransactionRequest[] = [];
    const reverted: { tx: providers.TransactionRequest, reason: string }[] = [];
    for (let index = 0; index < simulationResult.results.length; index += 1) {
      const txSim = simulationResult.results[index];
      const tx = transactions[index];
      if ('error' in txSim) {
        const insufficientAllowance = txSim.revert.includes('insufficient allowance');
        const reason = insufficientAllowance ? RevertReason.InsufficientAllowance : txSim.revert;
        console.log(`\nTransaction failed: ${reason}`)
        reverted.push({ tx, reason });
      } else {
        successful.push(tx);
      }
    }

    const simulatedEvent: SimulatedEvent = {
      successfulTransactions: successful,
      revertedTransactions: reverted,
      gasPrice: simulatedGasPrice,
      totalGasUsed: simulationResult.totalGasUsed
    };
    this.emit(FlashbotsBroadcasterEvent.Simulated, simulatedEvent);

    return simulatedEvent;
  }

  private emit(event: FlashbotsBroadcasterEvent, data: FlashbotsBroadcasterEventTypes) {
    this.emitter.emit(event, data);
  }
}
