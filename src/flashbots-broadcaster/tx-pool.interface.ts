import { TransactionRequest } from '@ethersproject/abstract-provider';
import { TokenTransfer } from './flashbots-broadcaster-emitter.types';

export interface TxPool<T extends { id: string }> {
  add(item: T): void;

  remove(id: string): void;

  getTransactions(options: { maxGasFeeGwei: number }): Promise<{ txRequests: TransactionRequest[], invalid?: T[]}>;

  getBundleFromTransfer(transfer: TokenTransfer): T | undefined;
}
