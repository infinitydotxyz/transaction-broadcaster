import { TransactionRequest } from '@ethersproject/abstract-provider';
import { BundleEncoder, BundleItem, BundleType } from './bundle.types';
import { TokenTransfer } from './flashbots-broadcaster-emitter.types';
import { TxPool } from './tx-pool.interface';

export interface TxBundlerPoolOptions {
  /**
   * bundles must be at least this size for a transaction 
   * to be created
   */
  minBundleSize: Record<BundleType, number>;
}

export class TxBundlerPool implements TxPool<BundleItem> {
  private bundlePool: Map<BundleType, Map<string, BundleItem>>;
  private transferIdToBundleId = new Map<string, string>();
  private idToBundleType: Map<string, BundleType>;

  constructor(private encode: Record<BundleType, BundleEncoder[BundleType]>, private options: TxBundlerPoolOptions) {
    this.bundlePool = new Map();
    this.idToBundleType = new Map();
  }

  add(item: BundleItem): void {
    const bundleType = item.bundleType;
    let bundle = this.bundlePool.get(bundleType);
    if (!bundle) {
      bundle = new Map();
      this.bundlePool.set(bundleType, bundle);
    }
    bundle.set(item.id, item);
    this.idToBundleType.set(item.id, bundleType);
    const transferIds = this.getTransferIdsFromBundle(item);
    for(const transferId of transferIds) {
      this.transferIdToBundleId.set(transferId, item.id);
    }
  }

  remove(id: string): void {
    const bundleType = this.idToBundleType.get(id);
    if (bundleType) {
      const bundle = this.bundlePool.get(bundleType);
      const bundleItem = bundle?.get(id);
      bundle?.delete(id);
      if(bundleItem) {
        const transferIds = this.getTransferIdsFromBundle(bundleItem);
        for(const transferId of transferIds) {
          this.transferIdToBundleId.delete(transferId);
        }
      }
    }
    this.idToBundleType.delete(id);
  }

  getBundleFromTransfer(transfer: TokenTransfer): BundleItem | undefined {
    const transferId = this.getTransferIdFromTransfer(transfer);
    const bundleId = this.transferIdToBundleId.get(transferId);
    if(!bundleId) {
      return undefined;
    }

    const bundleType = this.idToBundleType.get(bundleId);
    if(!bundleType) {
      return undefined;
    }

    const bundle = this.bundlePool.get(bundleType);
    if(!bundle) {
      return undefined;
    }
    
    const bundleItem = bundle.get(bundleId);
    if(!bundleItem) {
      return undefined;
    }

    return bundleItem;
  }

  async getTransactions(options: { maxGasFeeGwei: number }): Promise<TransactionRequest[]> {
    const bundleTypes = Array.from(this.bundlePool.entries());
    let txRequests: TransactionRequest[] = [];
    for (const [bundleType, bundle] of bundleTypes) {
      const bundleItems = Array.from(bundle.values()).filter(
        (item) => item.maxGasPriceGwei === undefined || item.maxGasPriceGwei > options.maxGasFeeGwei
      );

      const bundleSizeValid = bundleItems.length >= this.options.minBundleSize[bundleType];

      const encoder = this.encode[bundleType];
      if (bundleSizeValid && encoder && typeof encoder === 'function') {
        const bundleTxnRequests = await encoder(bundleItems);
        txRequests = [...txRequests, ...bundleTxnRequests];
      }
    }
    return txRequests;
  }

  private getTransferIdsFromBundle(bundleItem: BundleItem): string[] {
    const ids = new Set<string>();
    for(const nft of bundleItem.constructed.nfts) {
      const collection = nft.collection;
      for(const token of nft.tokens) {
        const amount = token.numTokens
        const tokenId = token.tokenId;
        const from = bundleItem.sell.signer;
        const to = bundleItem.buy.signer;
        const transfer: TokenTransfer = {
          address: collection,
          from,
          to,
          amount,
          tokenId
        };
        const transferId = this.getTransferIdFromTransfer(transfer);
        ids.add(transferId);
      }
    }
    return Array.from(ids);
  }

  private getTransferIdFromTransfer(transfer: TokenTransfer): string {
    const collection = transfer.address;
    const tokenId = transfer.tokenId;
    const amount = transfer.amount;
    const parts = [collection, tokenId, amount, transfer.from, transfer.to];
    return parts.join(':');
  }
}
