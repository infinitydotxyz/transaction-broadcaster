import { TransactionRequest } from '@ethersproject/abstract-provider';

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

  getTransactions(options: { minMaxGasFeeGwei: number }): { id: string; tx: TransactionRequest }[] {
    return Array.from(this.pool.entries())
      .map(([id, tx]: [string, TransactionRequest]) => {
        return { id, tx };
      })
      .filter(({ tx }) => {
        if (tx.maxFeePerGas !== undefined) {
          try {
            const txMaxFeePerGas = typeof tx.maxFeePerGas === 'number' ? tx.maxFeePerGas : Number(tx.maxFeePerGas);
            return txMaxFeePerGas > options.minMaxGasFeeGwei;
          } catch (err) {
            console.log(err);
            return false;
          }
        }
        return true;
      });
  }
}
