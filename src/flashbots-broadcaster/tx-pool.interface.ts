import { TransactionRequest } from '@ethersproject/abstract-provider';
import { NftTransfer } from '../utils/log.types';
import { InvalidTransactionRequest } from './bundle.types';

export interface TxPool<T extends { id: string }> {
  add(item: T): void;

  remove(id: string): void;

  getTransactions(options: {
    maxGasFeeGwei: number;
  }): Promise<{ txRequests: TransactionRequest[]; invalid?: InvalidTransactionRequest<T>[] }>;

  getBundleFromTransfer(transfer: NftTransfer): T | undefined;
}
