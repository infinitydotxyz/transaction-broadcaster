import { TransactionRequest } from '@ethersproject/abstract-provider';
import { BigNumber } from '@ethersproject/bignumber/lib/bignumber';
import { ChainId, FirestoreOrderMatchMethod } from '@infinityxyz/lib/types/core';
import { ChainNFTs, ChainOBOrder, MakerOrder } from '@infinityxyz/lib/types/core/OBOrder';

export enum BundleType {
  MatchOrders = 'matchOrders',
  MatchOrdersOneToOne = 'matchOrdersOneToOne',
  MatchOrdersOneToMany = 'matchOrdersOneToMany'
}

export const orderMatchMethodToBundleType = {
  [FirestoreOrderMatchMethod.MatchOrders]: BundleType.MatchOrders,
  [FirestoreOrderMatchMethod.MatchOneToOneOrders]: BundleType.MatchOrdersOneToOne,
  [FirestoreOrderMatchMethod.MatchOneToManyOrders]: BundleType.MatchOrdersOneToMany
};

export interface BaseBundleItem {
  id: string;
  bundleType: BundleType;
  maxGasPriceGwei: number;
  chainId: ChainId;
  exchangeAddress: string;
}

export interface OneToOneBundleItem extends BaseBundleItem {
  sell: ChainOBOrder;
  buy: ChainOBOrder;
  sellOrderHash: string;
  buyOrderHash: string;
}

export interface MatchOrdersOneToOneBundleItem extends OneToOneBundleItem {
  bundleType: BundleType.MatchOrdersOneToOne;
}

export interface MatchOrdersBundleItem extends OneToOneBundleItem {
  bundleType: BundleType.MatchOrders;
  constructed: ChainOBOrder;
}

export interface MatchOrdersOneToManyBundleItem extends BaseBundleItem {
  bundleType: BundleType.MatchOrdersOneToMany;
  order: ChainOBOrder;
  manyOrders: ChainOBOrder[];
  orderHash: string;
  manyOrderHashes: string[];
}

export type BundleItem = MatchOrdersBundleItem | MatchOrdersOneToOneBundleItem | MatchOrdersOneToManyBundleItem;

type CurrentPrice = { currentPrice: BigNumber };
export type BundleItemWithCurrentPrice =
  | (MatchOrdersBundleItem & CurrentPrice)
  | (MatchOrdersOneToOneBundleItem & CurrentPrice)
  | (MatchOrdersOneToManyBundleItem & CurrentPrice);

export type BundleVerifier<T extends BundleItem> = (
  bundleItems: T[],
  chainId: ChainId
) => Promise<{ validBundleItems: BundleItemWithCurrentPrice[]; invalidBundleItems: T[] }>;
export type BundleCallDataEncoder<Args extends Array<unknown>> = (args: Args, chainId: ChainId) => string;
export type BundleItemsToArgsTransformer<BundleItem, Args extends Array<unknown>> = (
  bundleItems: BundleItem[],
  numBundles: number
) => Args[];

export type BundleOrdersEncoder<T> = (
  bundleItems: T[],
  minBundleSize: number
) => Promise<{ txRequests: TransactionRequest[]; invalidBundleItems: InvalidTransactionRequest<T>[] }>;

export type BundleEncoder = {
  [BundleType.MatchOrders]: BundleOrdersEncoder<MatchOrdersBundleItem>;
  [BundleType.MatchOrdersOneToOne]: BundleOrdersEncoder<MatchOrdersOneToOneBundleItem>;
  [BundleType.MatchOrdersOneToMany]: BundleOrdersEncoder<MatchOrdersOneToManyBundleItem>;
};

export type BundleTypeToBundleItem = {
  [BundleType.MatchOrders]: MatchOrdersBundleItem;
  [BundleType.MatchOrdersOneToOne]: MatchOrdersOneToOneBundleItem;
  [BundleType.MatchOrdersOneToMany]: MatchOrdersOneToManyBundleItem;
};

export type MatchOrdersArgs = [MakerOrder[], MakerOrder[], ChainNFTs[][]];
export type MatchOrdersOneToOneArgs = [MakerOrder[], MakerOrder[]];
export type MatchOrdersOneToManyArgs = [MakerOrder, MakerOrder[]];


export interface InvalidTransactionRequest<T> {
  item: T;
  code: number;
  error: string;
}