import { TransactionRequest } from '@ethersproject/abstract-provider';
import { BigNumber } from '@ethersproject/bignumber/lib/bignumber';
import { ChainId, FirestoreOrderMatchMethod } from '@infinityxyz/lib/types/core';
import { ChainNFTs, ChainOBOrder, MakerOrder } from '@infinityxyz/lib/types/core/OBOrder';

export enum BundleType {
  MatchOrders = 'matchOrders',
  MatchOrdersOneToOne = 'matchOrdersOneToOne', 
  // MatchOrdersOneToMany =  'matchOrdersOneToMany' // TODO add support for one to many
}

export const orderMatchMethodToBundleType = {
  [FirestoreOrderMatchMethod.MatchOrders]: BundleType.MatchOrders,
  [FirestoreOrderMatchMethod.MatchOneToOneOrders]: BundleType.MatchOrdersOneToOne,
  // [FirestoreOrderMatchMethod.MatchOneToManyOrders]: BundleType.MatchOrdersOneToMany
};

export interface BaseBundleItem {
  id: string;
  bundleType: BundleType;
  maxGasPriceGwei?: number;
  chainId: ChainId;
}

export interface OneToOneBundleItem extends BaseBundleItem {
  exchangeAddress: string;
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

export type BundleItem = MatchOrdersBundleItem | MatchOrdersOneToOneBundleItem;

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
  [BundleType.MatchOrdersOneToOne]: BundleOrdersEncoder<MatchOrdersOneToOneBundleItem>;
};

export type BundleTypeToBundleItem  = {
  [BundleType.MatchOrders]: MatchOrdersBundleItem;
  [BundleType.MatchOrdersOneToOne]: MatchOrdersOneToOneBundleItem;
}

export type MatchOrdersArgs = [MakerOrder[], MakerOrder[], ChainNFTs[][]];
