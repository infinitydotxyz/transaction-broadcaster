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

  add(bundleItem: BundleItem): void {
    const bundleType = bundleItem.bundleType;
    let bundle = this.bundlePool.get(bundleType);
    if (!bundle) {
      bundle = new Map();
      this.bundlePool.set(bundleType, bundle);
    }
    bundle.set(bundleItem.id, bundleItem);
    this.idToBundleType.set(bundleItem.id, bundleType);
    const transferIds = this.getTransferIdsFromBundleItem(bundleItem);
    for (const transferId of transferIds) {
      this.transferIdToBundleId.set(transferId, bundleItem.id);
    }
  }

  remove(id: string): void {
    const bundleType = this.idToBundleType.get(id);
    if (bundleType) {
      const bundle = this.bundlePool.get(bundleType);
      const bundleItem = bundle?.get(id);
      bundle?.delete(id);
      if (bundleItem) {
        const transferIds = this.getTransferIdsFromBundleItem(bundleItem);
        for (const transferId of transferIds) {
          this.transferIdToBundleId.delete(transferId);
        }
      }
    }
    this.idToBundleType.delete(id);
  }

  getBundleFromTransfer(transfer: TokenTransfer): BundleItem | undefined {
    const transferId = this.getTransferIdFromTransfer(transfer);
    const bundleId = this.transferIdToBundleId.get(transferId);
    if (!bundleId) {
      return undefined;
    }

    const bundleType = this.idToBundleType.get(bundleId);
    if (!bundleType) {
      return undefined;
    }

    const bundle = this.bundlePool.get(bundleType);
    if (!bundle) {
      return undefined;
    }

    const bundleItem = bundle.get(bundleId);
    if (!bundleItem) {
      return undefined;
    }

    return bundleItem;
  }

  async getTransactions(options: { maxGasFeeGwei: number }): Promise<TransactionRequest[]> {
    const bundleTypes = Array.from(this.bundlePool.entries());
    let txRequests: TransactionRequest[] = [];
    for (const [bundleType, bundle] of bundleTypes) {
      const bundleItemsUnderUnderGasPrice = Array.from(bundle.values()).filter(
        (item) => item.maxGasPriceGwei === undefined || item.maxGasPriceGwei > options.maxGasFeeGwei
      );

      /**
       * don't return multiple bundle items that change the quantity of a token
       * for the same owner
       */
      let tokenIds = new Set<string>();
      const nonConflictingBundleItems = bundleItemsUnderUnderGasPrice.filter((bundleItem) => {
        const ids = this.getOwnerTokenIdsFromBundleItem(bundleItem);
        for (const id of ids) {
          if (tokenIds.has(id)) {
            return false;
          }
        }
        tokenIds = new Set([...tokenIds, ...ids]);
        return true;
      });

      const bundleItems = nonConflictingBundleItems;
      const encoder = this.encode[bundleType];
      if (encoder && typeof encoder === 'function') {
        const { txRequests: bundleTxRequests, invalidBundleItems } = await encoder(
          bundleItems,
          this.options.minBundleSize[bundleType]
        );
        // TODO handle invalid bundle items
        txRequests = [...txRequests, ...bundleTxRequests];
      }
    }
    return txRequests;
  }

  private getTransferIdsFromBundleItem(bundleItem: BundleItem): string[] {
    const ids = new Set<string>();
    for (const nft of bundleItem.constructed.nfts) {
      const collection = nft.collection;
      for (const token of nft.tokens) {
        const amount = token.numTokens;
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
    return [...ids];
  }

  /**
   * provides unique ids for each token/owner combination
   */
  private getOwnerTokenIdsFromBundleItem(bundleItem: BundleItem): string[] {
    const ids = new Set<string>();
    for (const nft of bundleItem.constructed.nfts) {
      const collection = nft.collection;
      for (const token of nft.tokens) {
        const tokenId = token.tokenId;
        const owner = bundleItem.sell.signer;
        const id = [collection, tokenId, owner].join(':');
        ids.add(id);
      }
    }
    return [...ids];
  }

  private getTransferIdFromTransfer(transfer: TokenTransfer): string {
    const collection = transfer.address;
    const tokenId = transfer.tokenId;
    const amount = transfer.amount;
    const parts = [collection, tokenId, amount, transfer.from, transfer.to];
    return parts.join(':');
  }
}
