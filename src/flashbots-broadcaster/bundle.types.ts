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
  constructed: ChainOBOrder;
}

export type BundleItem = MatchOrdersBundle;
export type MatchOrdersEncoder = (args: BundleItem[]) => Promise<TransactionRequest[]>;

export type BundleEncoder = {
  [BundleType.MatchOrders]: MatchOrdersEncoder
};
