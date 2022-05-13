import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { BigNumber, providers, Wallet } from 'ethers';
import * as EventEmitter from 'events';
import { TxPool } from './tx-pool';
import { getFeesAtTarget } from '../../utils';
import {
  BlockEvent,
  ExecutorEvent,
  ExecutorEventTypes,
  FailedBundleSubmission,
  GetEventType,
  getFailedBundleSubmissionReason,
  RelayErrorEvent,
  SimulatedEvent,
  StartedEvent,
  SubmittingBundleEvent,
  SuccessfulBundleSubmission
} from './executor-emitter';
import { ExecutionSettings, ExecutorInternalOptions, ExecutorOptions } from './executor.types';

export class Executor {
  private authSigner: Wallet;
  private signer: Wallet;
  private provider: providers.BaseProvider;
  private flashbotsProvider: FlashbotsBundleProvider;
  private txPool: TxPool;
  private mutex: boolean;
  private readonly network: providers.Network;
  private readonly settings: ExecutionSettings;
  private shutdown?: () => Promise<void>;
  private emitter: EventEmitter;

  static async create(options: ExecutorOptions) {
    const authSigner = new Wallet(options.authSigner.privateKey);
    const flashbotsProvider = await FlashbotsBundleProvider.create(options.provider, authSigner);
    const signer = new Wallet(options.transactionSigner.privateKey);
    const network = await options.provider.getNetwork();
    return new Executor({
      authSigner,
      provider: options.provider,
      flashbotsProvider,
      signer,
      blocksInFuture: options.blocksInFuture ?? 2,
      network,
      allowReverts: options.allowReverts ?? false,
      filterSimulationReverts: options.filterSimulationReverts ?? true,
      priorityFee: options.priorityFee ?? 3.5
    });
  }

  /**
   * use the create method to create a new executor instance
   */
  private constructor(options: ExecutorInternalOptions) {
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
    this.txPool = new TxPool();
    this.emitter = new EventEmitter();
    this.mutex = false;
  }

  /**
   * start the executor to begin submitting transactions
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
    this.emit(ExecutorEvent.Started, startedEvent);
  }

  /**
   * stop the executor
   */
  async stop() {
    this.emit(ExecutorEvent.Stopping, {});
    if (this.shutdown && typeof this.shutdown === 'function') {
      await this.shutdown();
    }
    this.mutex = false;
    this.emit(ExecutorEvent.Stopped, {});
  }

  addTransactionRequest(id: string, tx: providers.TransactionRequest) {
    this.txPool.add(id, tx);
  }

  deleteTransactionRequest(id: string) {
    this.txPool.delete(id);
  }

  on<Event extends ExecutorEvent>(event: Event, listener: (data: GetEventType[Event]) => void) {
    this.emitter.on(event, listener);
  }

  off<Event extends ExecutorEvent>(event: Event, listener: (data: GetEventType[Event]) => void) {
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
      this.emit(ExecutorEvent.Block, blockEvent);
      await this.execute({ blockNumber, timestamp, baseFee });
    } catch (err) {
      console.error(err);
    }
  }

  private async execute(currentBlock: { blockNumber: number; timestamp: number; baseFee: BigNumber }) {
    const minTimestamp = currentBlock.timestamp;
    const maxTimestamp = minTimestamp + 120;
    const targetBlockNumber = currentBlock.blockNumber + this.settings.blocksInFuture;
    const { maxBaseFeeGwei } = getFeesAtTarget(currentBlock.baseFee, this.settings.blocksInFuture);
    const gasPrice = maxBaseFeeGwei + this.settings.priorityFee;

    const transactions = this.txPool.getTransactions({ minMaxFeePerGasGwei: gasPrice }).map(({ id, tx }) => {
      const txRequest: providers.TransactionRequest = {
        ...tx,
        from: this.signer.address,
        chainId: this.network.chainId,
        type: 2,
        maxPriorityFeePerGas: this.settings.priorityFee,
        maxFeePerGas: gasPrice
      };
      return {
        id,
        tx: txRequest
      };
    });

    if (transactions.length === 0) {
      return;
    }

    const signedBundle = await this.getSignedBundle(transactions);
    const simulationResult = await this.simulateBundle(signedBundle);
    const simulatedGasPrice = simulationResult.gasPrice;

    let successful: { id: string; tx: providers.TransactionRequest }[] = [];
    let reverted: { id: string; tx: providers.TransactionRequest }[] = [];
    for (let index = 0; index < simulationResult.results.length; index += 1) {
      const txSim = simulationResult.results[index];
      let tx = transactions[index];
      if ('error' in txSim) {
        if (this.settings.filterSimulationReverts) {
          transactions.splice(index, 1);
        }
        reverted.push(tx);
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
    this.emit(ExecutorEvent.Simulated, simulatedEvent);

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
    this.emit(ExecutorEvent.SubmittingBundle, submittingEvent);

    const bundleResponse = await this.flashbotsProvider.sendRawBundle(updatedSignedBundle, targetBlockNumber, {
      minTimestamp,
      maxTimestamp,
      revertingTxHashes: this.settings.allowReverts ? updatedSignedBundle : []
    });

    if ('error' in bundleResponse) {
      // relay error
      const relayError: RelayErrorEvent = {
        message: bundleResponse.error.message,
        code: bundleResponse.error.code
      };
      this.emit(ExecutorEvent.RelayError, relayError);
      return;
    }

    const bundleResolution = await bundleResponse.wait();
    switch (bundleResolution) {
      case FlashbotsBundleResolution.BundleIncluded:
        // remove transactions from pool
        const receipts = await bundleResponse.receipts();
        const bundle = receipts.map((receipt) => {
          const index = receipt.transactionIndex;
          const transaction = transactions[index];
          return {
            receipt,
            id: transaction.id,
            tx: transaction.tx,
            successful: receipt.status === 1
          };
        });
        const totalGasUsed = bundle.reduce((acc, curr) => {
          return acc.add(curr.receipt.gasUsed);
        }, BigNumber.from(0));

        const successfulBundleSubmission: SuccessfulBundleSubmission = {
          transactions: bundle,
          blockNumber: targetBlockNumber,
          totalGasUsed
        };
        this.emit(ExecutorEvent.BundleResult, successfulBundleSubmission);
        break;
      case FlashbotsBundleResolution.BlockPassedWithoutInclusion:
      case FlashbotsBundleResolution.AccountNonceTooHigh:
        const failedBundleSubmission: FailedBundleSubmission = {
          blockNumber: targetBlockNumber,
          reason: getFailedBundleSubmissionReason[bundleResolution]
        };
        this.emit(ExecutorEvent.BundleResult, failedBundleSubmission);
        break;
    }
  }

  private async getSignedBundle(transactions: { id: string; tx: providers.TransactionRequest }[]): Promise<string[]> {
    const signedBundle = await this.flashbotsProvider.signBundle(
      transactions.map(({ tx }) => {
        return {
          signer: this.signer,
          transaction: tx
        };
      })
    );
    return signedBundle;
  }

  private async simulateBundle(signedBundle: string[]) {
    const response = await this.flashbotsProvider.simulate(signedBundle, 'latest');

    if ('error' in response) {
      const relayError: RelayErrorEvent = {
        message: response.error.message,
        code: response.error.code
      };
      this.emit(ExecutorEvent.RelayError, relayError);
      throw new Error(response.error.message);
    }

    const totalGasUsed = response.totalGasUsed;
    const gasPrice = response.coinbaseDiff.div(totalGasUsed);

    return {
      ...response,
      gasPrice
    };
  }

  private emit(event: ExecutorEvent, data: ExecutorEventTypes) {
    this.emitter.emit(event, data);
  }
}
