import { TransactionRequest } from '@ethersproject/abstract-provider';
import { ChainId, ChainOBOrder } from '@infinityxyz/lib/types/core';
import { getExchangeAddress } from '@infinityxyz/lib/utils/orders';
import { Contract, providers } from 'ethers';
import { infinityExchangeAbi } from './abi/infinity-exchange.abi';
import { MAX_GAS_LIMIT } from './constants';
import { BundleItem, MatchOrdersBundle } from './flashbots-broadcaster/bundle.types';

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

      const buildBundles = async (
        bundleItems: MatchOrdersBundle[],
        numBundles: number
      ): Promise<TransactionRequest[]> => {
        /**
         * spread the orders that will cost the most gas into different bundles
         */
        const bundleItemsSortedByNumMatches = bundleItems.sort((a, b) => {
          const numMatchesA = a.constructed.constraints[0] as number;
          const numMatchesB = b.constructed.constraints[0] as number;
          return numMatchesB - numMatchesA;
        });
        const bundles = bundleItemsSortedByNumMatches.reduce(
          (
            acc: { sells: ChainOBOrder[]; buys: ChainOBOrder[]; constructed: ChainOBOrder[] }[],
            bundleItem,
            currentIndex
          ) => {
            const index = currentIndex % numBundles;
            const bundle = acc[index] ?? { sells: [], buys: [], constructed: [] };
            bundle.sells.push(bundleItem.sell);
            bundle.buys.push(bundleItem.buy);
            bundle.constructed.push(bundleItem.constructed);
            acc[index] = bundle;
            return acc;
          },
          []
        );
        const transactionRequests = await Promise.all(bundles.map(async (bundle) => {
          const args = [bundle.sells, bundle.buys, bundle.constructed]; 
          const fn = contract.interface.getFunction('matchOrders');
          const data = contract.interface.encodeFunctionData(fn, args);
          const estimate = await provider.estimateGas({
            to: contract.address,
            data
          });
          const gasLimit = Math.floor(estimate.toNumber() * 1.2);
          return {
            to: contract.address,
            gasLimit: gasLimit,
            data,
            chainId: parseInt(chainId)
          };
        }));

        const transactionsTooBig = transactionRequests.some((txRequest) => txRequest.gasLimit > MAX_GAS_LIMIT);
        if (transactionsTooBig) {
          const estimatedNumBundles = Math.ceil(transactionRequests.length / MAX_GAS_LIMIT);
          const updatedNumBundles = numBundles >= estimatedNumBundles ? numBundles * 2 : estimatedNumBundles;
          return await buildBundles(bundleItems, updatedNumBundles);
        }

        return transactionRequests;
      };

      const txRequests =  await buildBundles(bundleItems, 1);

      return txRequests;
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