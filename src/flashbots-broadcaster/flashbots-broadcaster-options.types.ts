import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import { providers, Wallet } from 'ethers/lib/ethers';
import { TxPool } from './tx-pool.interface';

export interface FlashbotsBroadcasterOptions {
  /**
   * auth signer used by Flashbots to identify the sender
   */
  authSigner: {
    privateKey: string;
  };

  /**
   * signer used to sign all transactions
   */
  transactionSigner: {
    privateKey: string;
  };

  provider: providers.BaseProvider;

  /**
   * number of blocks in the future to submit transactions for
   * default: 2
   */
  blocksInFuture?: number;

  /**
   * priority fee to use for transactions (in gwei)
   * default: 3.5
   */
  priorityFee?: number;

  /**
   * bundles will first be simulated then submitted
   * if `filterSimulationReverts` is true then reverts detected
   * during simulation will be filtered out before being submitted
   * default: true
   */
  filterSimulationReverts?: boolean;

  /**
   * whether to allow any transaction request to revert
   * default: false
   */
  allowReverts?: boolean;
}

export type FlashbotsBroadcasterSettings = Required<
  Pick<FlashbotsBroadcasterOptions, 'blocksInFuture' | 'allowReverts' | 'filterSimulationReverts' | 'priorityFee'>
>;

export interface FlashbotsBroadcasterInternalOptions extends FlashbotsBroadcasterSettings {
  flashbotsProvider: FlashbotsBundleProvider;

  provider: providers.BaseProvider;

  authSigner: Wallet;

  signer: Wallet;

  network: providers.Network;

  txPool: TxPool;
}
