import { TransactionRequest } from '@ethersproject/abstract-provider';
import { ChainId } from '@infinityxyz/lib/types/core';
import { ChainOBOrder } from '@infinityxyz/lib/types/core/OBOrder';

export enum BundleType {
  MatchOrders = 'matchOrders'
}

export interface BaseBundleItem {
  id: string;
  bundleType: BundleType;
  maxGasPriceGwei?: number;
  chainId: ChainId;
}

export interface MatchOrdersBundle extends BaseBundleItem {
  bundleType: BundleType.MatchOrders;
  exchangeAddress: string;
  sell: ChainOBOrder;
  buy: ChainOBOrder;
  sellOrderHash: string;
  buyOrderHash: string;
  constructed: ChainOBOrder;
}

export type BundleItem = MatchOrdersBundle;
export type MatchOrdersEncoder = (
  bundleItems: BundleItem[],
  minBundleSize: number
) => Promise<{ txRequests: TransactionRequest[]; invalidBundleItems: BundleItem[] }>;

export type BundleEncoder = {
  [BundleType.MatchOrders]: MatchOrdersEncoder;
};
