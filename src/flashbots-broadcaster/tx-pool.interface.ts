import { TransactionRequest } from '@ethersproject/abstract-provider';
import { BundleItem } from './bundle.types';
import { TokenTransfer } from './flashbots-broadcaster-emitter.types';

export interface TxPool<T> {
  add(id: string, txRequest: T): void;

  delete(id: string): void;

  getTransactions(options: { maxGasFeeGwei: number }): Promise<TransactionRequest[]>;

  getBundleItemByTransfer(transfer: TokenTransfer): { id: string, bundleItem: BundleItem } | undefined;
}
