import { TransactionRequest } from '@ethersproject/abstract-provider';
import { ChainNFTs } from '@infinityxyz/lib/types/core/OBOrder';
import { NftTransfer } from '../utils/log.types';
import {
  BundleEncoder,
  BundleItem,
  BundleOrdersEncoder,
  BundleType,
  BundleTypeToBundleItem,
  InvalidTransactionRequest
} from './bundle.types';
import { TxPool } from './tx-pool.interface';

export interface TxBundlerPoolOptions {
  /**
   * bundles must be at least this size for a transaction
   * to be created
   */
  minBundleSize: Record<BundleType, number>;
}

export class TxBundlerPool implements TxPool<BundleItem> {
  public get sizes() {
    const res: Record<BundleType, number> = {} as Record<BundleType, number>;
    for (const pool of this.bundlePool) {
      res[pool[0]] = pool[1].size;
    }
    return res;
  }

  private bundlePool: Map<BundleType, Map<string, BundleItem>>;
  private transferIdToBundleId = new Map<string, string>();
  private idToBundleType: Map<string, BundleType>;

  private getEncoder<Method extends BundleType>(
    bundleType: Method
  ): BundleOrdersEncoder<BundleTypeToBundleItem[Method]> {
    const encoder = this.encode[bundleType];
    return encoder as unknown as BundleOrdersEncoder<BundleTypeToBundleItem[Method]>;
  }

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

  getBundleFromTransfer(transfer: NftTransfer): BundleItem | undefined {
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

  async getTransactions(options: { maxGasFeeGwei: number }): Promise<{
    txRequests: TransactionRequest[];
    invalid: InvalidTransactionRequest<BundleItem>[];
    valid: BundleItem[];
  }> {
    const bundleTypes = Array.from(this.bundlePool.entries());
    let txRequests: TransactionRequest[] = [];
    let invalid: InvalidTransactionRequest<BundleItem>[] = [];
    let valid: BundleItem[] = [];
    for (const [bundleType, bundle] of bundleTypes) {
      const bundleItemsUnderUnderGasPrice = (
        Array.from(bundle.values()) as [BundleTypeToBundleItem[BundleType]]
      ).filter((item) => item.maxGasPriceGwei === undefined || item.maxGasPriceGwei > options.maxGasFeeGwei);

      /**
       * don't return multiple bundle items that change the quantity of a token
       * for the same owner
       */
      let tokenIds = new Set<string>();
      let nonConflictingBundleItems = bundleItemsUnderUnderGasPrice.filter((bundleItem) => {
        // TODO should we limit buyers to one transaction per bundle?
        // otherwise we need to check to make sure the buyers have enough currency across multiple orders
        const ids = this.getOwnerTokenIdsFromBundleItem(bundleItem);
        for (const id of ids) {
          if (tokenIds.has(id)) {
            return false;
          }
        }
        tokenIds = new Set([...tokenIds, ...ids]);
        return true;
      });

      /**
       * don't return bundle items with conflicting orders
       */
      let orderIds = new Set<string>();
      nonConflictingBundleItems = nonConflictingBundleItems.filter((bundleItem) => {
        for (const id of bundleItem.orderIds) {
          if (orderIds.has(id)) {
            return false;
          }
        }
        orderIds = new Set([...orderIds, ...bundleItem.orderIds]);
        return true;
      });

      const bundleItems = nonConflictingBundleItems;
      const encoder = this.getEncoder<BundleType>(bundleType);
      if (encoder && typeof encoder === 'function') {
        const {
          txRequests: bundleTxRequests,
          invalidBundleItems,
          validBundleItems
        } = await encoder(bundleItems, this.options.minBundleSize[bundleType]);

        txRequests = [...txRequests, ...bundleTxRequests];
        invalid = [...invalid, ...invalidBundleItems];
        valid = [...valid, ...validBundleItems];
      }
    }
    return { txRequests, invalid, valid };
  }

  private getTransferIdsFromBundleItem(bundleItem: BundleItem): string[] {
    const ids = new Set<string>();
    let tokens: { from: string; to: string; nfts: ChainNFTs[] }[] = [];
    if ('constructed' in bundleItem) {
      tokens = [{ from: bundleItem.sell.signer, to: bundleItem.buy.signer, nfts: bundleItem.constructed.nfts }]; // match orders
    } else if ('buy' in bundleItem) {
      tokens = [{ from: bundleItem.sell.signer, to: bundleItem.buy.signer, nfts: bundleItem.buy.nfts }]; // match orders
    } else {
      tokens = bundleItem.manyOrders.map((order) => {
        const [from, to] = bundleItem.order.isSellOrder
          ? [bundleItem.order.signer, order.signer]
          : [order.signer, bundleItem.order.signer];
        return {
          from,
          to,
          nfts: order.nfts
        };
      });
    }

    for (const { from, to, nfts } of tokens) {
      for (const nft of nfts) {
        const collection = nft.collection;
        for (const token of nft.tokens) {
          const amount = token.numTokens;
          const tokenId = token.tokenId;
          const transfer: NftTransfer = {
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
    }
    return [...ids];
  }

  /**
   * provides unique ids for each token/owner combination
   */
  private getOwnerTokenIdsFromBundleItem(bundleItem: BundleItem): string[] {
    const ids = new Set<string>();
    let tokens: { owner: string; nfts: ChainNFTs[] }[] = [];
    if ('constructed' in bundleItem) {
      tokens = [{ owner: bundleItem.sell.signer, nfts: bundleItem.constructed.nfts }]; // match orders
    } else if ('buy' in bundleItem) {
      tokens = [{ owner: bundleItem.sell.signer, nfts: bundleItem.buy.nfts }]; // match orders
    } else if (bundleItem.order.isSellOrder) {
      tokens = [{ owner: bundleItem.order.signer, nfts: bundleItem.order.nfts }]; // match orders
    } else {
      tokens = bundleItem.manyOrders.map((order) => {
        return {
          owner: order.signer,
          nfts: order.nfts
        };
      });
    }

    for (const { owner, nfts } of tokens) {
      for (const nft of nfts) {
        const collection = nft.collection;
        for (const token of nft.tokens) {
          const tokenId = token.tokenId;
          const id = [collection, tokenId, owner].join(':');
          ids.add(id);
        }
      }
    }
    return [...ids];
  }

  private getTransferIdFromTransfer(transfer: NftTransfer): string {
    const collection = transfer.address;
    const tokenId = transfer.tokenId;
    const amount = transfer.amount;
    const parts = [collection, tokenId, amount, transfer.from, transfer.to];
    return parts.join(':');
  }
}
