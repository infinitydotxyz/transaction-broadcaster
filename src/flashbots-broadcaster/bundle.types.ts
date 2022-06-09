import { TransactionRequest } from '@ethersproject/abstract-provider';
import { BigNumber } from '@ethersproject/bignumber/lib/bignumber';
import { ChainId, FirestoreOrderMatchMethod } from '@infinityxyz/lib/types/core';
import { ChainNFTs, ChainOBOrder, MakerOrder } from '@infinityxyz/lib/types/core/OBOrder';

export enum BundleType {
  MatchOrders = 'matchOrders'
  // MatchOrdersOneToOne = 'matchOrdersOneToOne', // TODO add support for one to one
  // MatchOrdersOneToMany =  'matchOrdersOneToMany' // TODO add support for one to many
}

export const orderMatchMethodToBundleType = {
  [FirestoreOrderMatchMethod.MatchOrders]: BundleType.MatchOrders
  // [FirestoreOrderMatchMethod.MatchOneToOneOrders]: BundleType.MatchOrdersOneToOne,
  // [FirestoreOrderMatchMethod.MatchOneToManyOrders]: BundleType.MatchOrdersOneToMany
};

export interface BaseBundleItem {
  id: string;
  bundleType: BundleType;
  maxGasPriceGwei?: number;
  chainId: ChainId;
}

export interface MatchOrdersBundleItem extends BaseBundleItem {
  bundleType: BundleType.MatchOrders;
  exchangeAddress: string;
  sell: ChainOBOrder;
  buy: ChainOBOrder;
  sellOrderHash: string;
  buyOrderHash: string;
  constructed: ChainOBOrder;
}

// export interface MatchOrdersOneToOneBundle extends BaseBundleItem {
//   bundleType: BundleType.MatchOrdersOneToOne;
//   exchangeAddress: string;
//   sell: ChainOBOrder;
//   buy: ChainOBOrder;
//   sellOrderHash: string;
//   buyOrderHash: string;
// }

export type BundleItem = MatchOrdersBundleItem;

export type BundleItemWithCurrentPrice = BundleItem & { currentPrice: BigNumber };

export type BundleVerifier<T> = (
  bundleItems: T[],
  chainId: ChainId
) => Promise<{ validBundleItems: (T & { currentPrice: BigNumber })[]; invalidBundleItems: T[] }>;
export type BundleCallDataEncoder<Args extends Array<unknown>> = (args: Args, chainId: ChainId) => string;
export type BundleItemsToArgsTransformer<BundleItem, Args extends Array<unknown>> = (
  bundleItems: BundleItem[],
  numBundles: number
) => Args[];
export type BundleOrdersEncoder<T> = (
  bundleItems: T[],
  minBundleSize: number
) => Promise<{ txRequests: TransactionRequest[]; invalidBundleItems: T[] }>;

export type BundleEncoder = {
  [BundleType.MatchOrders]: BundleOrdersEncoder<MatchOrdersBundleItem>;
};

export type MatchOrdersArgs = [MakerOrder[], MakerOrder[], ChainNFTs[][]];
