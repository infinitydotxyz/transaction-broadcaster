import { TransactionRequest } from '@ethersproject/abstract-provider';
import { BigNumber } from 'ethers';

export class TxPool {
  private pool: Map<string, TransactionRequest>;

  constructor() {
    this.pool = new Map();
  }

  add(id: string, tx: TransactionRequest): void {
    this.pool.set(id, tx);
  }

  delete(id: string): void {
    this.pool.delete(id);
  }

  getTransactions(options: { minMaxFeePerGasGwei: number }): { id: string; tx: TransactionRequest }[] {
    return Array.from(this.pool.entries())
      .map(([id, tx]: [string, TransactionRequest]) => {
        return { id, tx };
      })
      .filter(({ tx }) => {
        if (tx.maxFeePerGas !== undefined) {
          try {
            return BigNumber.from(tx.maxFeePerGas).gte(BigNumber.from(options.minMaxFeePerGasGwei));
          } catch (err) {
            return false;
          }
        }
        return true;
      });
  }
}
