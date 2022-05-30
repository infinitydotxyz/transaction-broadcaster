import { TransactionRequest } from '@ethersproject/abstract-provider';

export interface TxPool<T> {
  add(id: string, txRequest: T): void;

  delete(id: string): void;

  getTransactions(options: { maxGasFeeGwei: number }): Promise<TransactionRequest[]>;
}
