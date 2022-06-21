import { TransactionRequest } from '@ethersproject/abstract-provider';
import { NftTransfer } from '../utils/log.types';

export interface TxPool<T extends { id: string }> {
  add(item: T): void;

  remove(id: string): void;

  getTransactions(options: { maxGasFeeGwei: number }): Promise<{ txRequests: TransactionRequest[]; invalid?: T[] }>;

  getBundleFromTransfer(transfer: NftTransfer): T | undefined;
}
