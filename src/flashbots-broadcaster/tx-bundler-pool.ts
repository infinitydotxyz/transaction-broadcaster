import { TransactionRequest } from '@ethersproject/abstract-provider';
import { ChainOBOrder } from '@infinityxyz/lib/types/core';
import { TxPool } from './tx-pool.interface';

export enum BundleType {
  MatchOrders = 'matchOrders'
}

interface BaseBundleItem {
  id: string;
  bundleType: BundleType;
  maxGasPriceGwei?: number;
}

interface MatchOrdersBundle extends BaseBundleItem {
  bundleType: BundleType.MatchOrders;
  exchangeAddress: string;
  sell: ChainOBOrder;
  buy: ChainOBOrder;
  constructed: ChainOBOrder;
}

type BundleItem = MatchOrdersBundle;
type MatchOrdersEncoder = (args: BundleItem[]) => Promise<TransactionRequest[]>;

export class TxBundlerPool implements TxPool<BundleItem> {
  private bundlePool: Map<BundleType, Map<string, BundleItem>>;

  private idToBundleType: Map<string, BundleType>;

  constructor(private encode: Record<BundleType, MatchOrdersEncoder>) {
    this.bundlePool = new Map();
    this.idToBundleType = new Map();
  }

  add(id: string, item: BundleItem): void {
    const bundleType = item.bundleType;
    let bundle = this.bundlePool.get(bundleType);
    if (!bundle) {
      bundle = new Map();
      this.bundlePool.set(bundleType, bundle);
    }
    bundle.set(id, item);
    this.idToBundleType.set(id, bundleType);
  }

  delete(id: string): void {
    const bundleType = this.idToBundleType.get(id);
    if (bundleType) {
      const bundle = this.bundlePool.get(bundleType);
      bundle?.delete(id);
    }
    this.idToBundleType.delete(id);
  }

  async getTransactions(options: { maxGasFeeGwei: number }): Promise<{ id: string; tx: TransactionRequest }[]> {
    const bundleTypes = Array.from(this.bundlePool.entries());
    let txRequests: TransactionRequest[] = [];
    for (const [bundleType, bundle] of bundleTypes) {
      const bundleItems = Array.from(bundle.values()).filter(
        (item) => item.maxGasPriceGwei === undefined || item.maxGasPriceGwei > options.maxGasFeeGwei
      );
      const encoder = this.encode[bundleType];
      if (encoder && typeof encoder === 'function') {
        const bundleTxnRequests = await encoder(bundleItems);
        
        txRequests = [...txRequests, ...bundleTxnRequests];
      }
    }
    return txRequests;
  }
}
