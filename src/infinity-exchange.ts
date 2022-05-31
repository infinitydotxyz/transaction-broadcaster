import { TransactionRequest } from '@ethersproject/abstract-provider';
import { ChainId, ChainOBOrder } from '@infinityxyz/lib/types/core';
import { getExchangeAddress } from '@infinityxyz/lib/utils/orders';
import { Contract, providers } from 'ethers';
import { infinityExchangeAbi } from './abi/infinity-exchange.abi';
import { BundleItem } from './flashbots-broadcaster/bundle.types';

export class InfinityExchange {
  private contracts: Map<ChainId, Contract>;
  constructor(private providers: Record<ChainId, providers.JsonRpcProvider>) {
    this.contracts = new Map();
    for (const [chainId, provider] of Object.entries(providers) as [ChainId, providers.JsonRpcProvider][]) {
      const contract = new Contract(InfinityExchange.getExchangeAddress(chainId), infinityExchangeAbi, provider);
      this.contracts.set(chainId, contract);
    }
  }

  public getMatchOrdersEncoder(chainId: ChainId) {
    const contract = this.getContract(chainId);
    const provider = this.getProvider(chainId);
    const encoder = async (bundleItems: BundleItem[]): Promise<TransactionRequest[]> => {
      const tradingRewards = false;
      const feeDiscountEnabled = false;
      const orders = bundleItems.reduce(
        (acc: { sells: ChainOBOrder[]; buys: ChainOBOrder[]; constructed: ChainOBOrder[] }, bundleItem) => {
          return {
            sells: [...acc.sells, bundleItem.sell],
            buys: [...acc.buys, bundleItem.buy],
            constructed: [...acc.constructed, bundleItem.constructed]
          };
        },
        { sells: [], buys: [], constructed: [] }
      );

      const args = [orders.sells, orders.buys, orders.constructed, tradingRewards, feeDiscountEnabled]; // TODO remove trading rewards and fee discount enabled
      const fn = contract.interface.getFunction('matchOrders');
      const data = contract.interface.encodeFunctionData(fn, args);

      const estimate = await provider.estimateGas({
        to: contract.address,
        data
      });
  
      const gasLimit = Math.floor(estimate.toNumber() * 1.2);
      return [{ // TODO make sure gas limit is < 30_000_000
        to: contract.address,
        gasLimit: gasLimit,
        data,
        chainId: parseInt(chainId)
      }];
    };

    return encoder;
  }

  private getProvider(chainId: ChainId) {
    const provider = this.providers[chainId];
    if (!provider) {
      throw new Error(`No provider for chainId: ${chainId}`);
    }
    return provider;
  }

  private getContract(chainId: ChainId) {
    const contract = this.contracts.get(chainId);
    if (!contract) {
      throw new Error(`No exchange contract for chainId: ${chainId}`);
    }
    return contract;
  }

  private static getExchangeAddress(chainId: ChainId): string {
    const exchangeAddress = getExchangeAddress(chainId);
    if (!exchangeAddress) {
      throw new Error(`No exchange address for chainId: ${chainId}`);
    }
    return exchangeAddress;
  }
}
