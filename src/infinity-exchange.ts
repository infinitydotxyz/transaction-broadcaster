import { TransactionRequest } from '@ethersproject/abstract-provider';
import { ChainId, ChainNFTs, ChainOBOrder, MakerOrder } from '@infinityxyz/lib/types/core';
import { getExchangeAddress } from '@infinityxyz/lib/utils/orders';
import { BytesLike, Contract, providers } from 'ethers';
import { solidityKeccak256, keccak256, defaultAbiCoder } from 'ethers/lib/utils';
import { infinityExchangeAbi } from './abi/infinity-exchange.abi';
import { MAX_GAS_LIMIT } from './constants';
import {
  BundleCallDataEncoder,
  BundleItemsToArgsTransformer,
  BundleOrdersEncoder,
  BundleType,
  BundleVerifier,
  MatchOrdersArgs,
  MatchOrdersBundleItem
} from './flashbots-broadcaster/bundle.types';

export class InfinityExchange {
  private contracts: Map<ChainId, Contract>;
  constructor(private providers: Record<ChainId, providers.JsonRpcProvider>) {
    this.contracts = new Map();
    for (const [chainId, provider] of Object.entries(providers) as [ChainId, providers.JsonRpcProvider][]) {
      const contract = new Contract(InfinityExchange.getExchangeAddress(chainId), infinityExchangeAbi, provider);
      this.contracts.set(chainId, contract);
    }
  }

  public getBundleEncoder(bundleType: BundleType, chainId: ChainId, signerAddress: string) {
    switch (bundleType) {
      case BundleType.MatchOrders:
        return this.getEncoder<MatchOrdersBundleItem, MatchOrdersArgs>(
          chainId,
          signerAddress,
          this.matchOrdersItemsToArgsTransformer.bind(this),
          this.matchOrdersCallDataEncoder.bind(this),
          this.matchOrdersVerifier.bind(this)
        );
      default:
        throw new Error(`Bundle type ${bundleType} not yet supported`);
    }
  }

  private getEncoder<BundleItem, Args extends Array<unknown>>(
    chainId: ChainId,
    signerAddress: string,
    bundleItemsToArgs: BundleItemsToArgsTransformer<BundleItem, Args>,
    encodeCallData: BundleCallDataEncoder<Args>,
    verifyBundleItems: BundleVerifier<BundleItem>
  ): BundleOrdersEncoder<BundleItem> {
    const contract = this.getContract(chainId);
    const provider = this.getProvider(chainId);

    const buildBundles = async (
      bundleItems: BundleItem[],
      numBundles: number
    ): Promise<{ txRequests: TransactionRequest[]; invalidBundleItems: BundleItem[] }> => {
      const bundleArgs = bundleItemsToArgs(bundleItems, numBundles);
      const transactionRequests: TransactionRequest[] = (
        await Promise.all(
          bundleArgs.map(async (args) => {
            try {
              const data = encodeCallData(args, chainId);
              const estimate = await provider.estimateGas({
                to: contract.address,
                from: signerAddress,
                data
              });
              const gasLimit = Math.floor(estimate.toNumber() * 1.2);
              return {
                to: contract.address,
                gasLimit: gasLimit,
                data,
                chainId: parseInt(chainId),
                type: 2
              };
            } catch (err: any) {
              if ('error' in err && 'error' in err.error) {
                if (err.error.error.code === 3) {
                  // error types seen so far: 'ERC721 transfer caller is not owner or approved' | 'SafeERC20: low-level call failed'
                  // TODO check erc721 approval
                  // TODO why is this failing with 'SafeERC20: low-level call failed'
                  console.log(err.error.error);
                } else {
                  console.error(err.error.error);
                }
              } else {
                console.error(err);
              }
              return undefined;
            }
          })
        )
      ).filter((item) => !!item) as TransactionRequest[];
      const transactionsTooBig = transactionRequests.some(
        (txRequest) => txRequest.gasLimit != null && txRequest.gasLimit > MAX_GAS_LIMIT
      );
      if (transactionsTooBig) {
        const estimatedNumBundles = Math.ceil(transactionRequests.length / MAX_GAS_LIMIT);
        const updatedNumBundles = numBundles >= estimatedNumBundles ? numBundles * 2 : estimatedNumBundles;
        return await buildBundles(bundleItems, updatedNumBundles);
      }
      return { txRequests: transactionRequests, invalidBundleItems: [] };
    };

    const encoder: BundleOrdersEncoder<BundleItem> = async (
      bundleItems: BundleItem[],
      minBundleSize: number
    ): Promise<{ txRequests: TransactionRequest[]; invalidBundleItems: BundleItem[] }> => {
      const { validBundleItems, invalidBundleItems: invalidBundleItemsFromVerify } = await verifyBundleItems(
        bundleItems,
        chainId
      );

      // if (validBundleItems.length < minBundleSize) {
      //   return { txRequests: [] as TransactionRequest[], invalidBundleItems: invalidBundleItemsFromVerify };
      // } // TODO enable min bundle size

      // TODO check approval for erc721 and weth
      // TODO check erc721 and weth balances

      const { txRequests, invalidBundleItems: invalidBundleItemsFromBuild } = await buildBundles(validBundleItems, 1);

      return { txRequests, invalidBundleItems: [...invalidBundleItemsFromVerify, ...invalidBundleItemsFromBuild] };
    };

    return encoder;
  }

  private matchOrdersCallDataEncoder: BundleCallDataEncoder<MatchOrdersArgs> = (
    args: MatchOrdersArgs,
    chainId: ChainId
  ) => {
    const contract = this.getContract(chainId);
    const fn = contract.interface.getFunction('matchOrders');
    const data = contract.interface.encodeFunctionData(fn, args);

    return data;
  };

  private matchOrdersItemsToArgsTransformer: BundleItemsToArgsTransformer<MatchOrdersBundleItem, MatchOrdersArgs> = (
    bundleItems: MatchOrdersBundleItem[],
    numBundles: number
  ) => {
    const bundles = bundleItems.reduce(
      (acc: { sells: MakerOrder[]; buys: MakerOrder[]; constructed: ChainNFTs[][] }[], bundleItem, currentIndex) => {
        const index = currentIndex % numBundles;
        const bundle = acc[index] ?? { sells: [], buys: [], constructed: [] };
        bundle.sells.push(bundleItem.sell);
        bundle.buys.push(bundleItem.buy);
        bundle.constructed.push(bundleItem.constructed.nfts);
        acc[index] = bundle;
        return acc;
      },
      []
    );
    const bundlesArgs = bundles.map((bundle) => {
      const args: MatchOrdersArgs = [bundle.sells, bundle.buys, bundle.constructed];
      return args;
    });
    return bundlesArgs;
  };

  private matchOrdersVerifier: BundleVerifier<MatchOrdersBundleItem> = async (
    bundleItems: MatchOrdersBundleItem[],
    chainId: ChainId
  ) => {
    try {
      const contract = this.getContract(chainId);
      const results = await Promise.allSettled(
        bundleItems.map(async (item) => {
          const sellOrderHash = this.orderHash(item.sell);
          const buyOrderHash = this.orderHash(item.buy);
          return contract.verifyMatchOrders(
            sellOrderHash,
            buyOrderHash,
            item.sell,
            item.buy,
            item.constructed.nfts
          ) as Promise<[boolean, string]>;
        })
      );
      return bundleItems.reduce(
        (
          acc: { validBundleItems: MatchOrdersBundleItem[]; invalidBundleItems: MatchOrdersBundleItem[] },
          bundleItem,
          index
        ) => {
          const result = results[index];
          const isValid = result.status === 'fulfilled' && result.value[0];
          return {
            validBundleItems: isValid ? [...acc.validBundleItems, bundleItem] : acc.validBundleItems,
            invalidBundleItems: !isValid ? [...acc.invalidBundleItems, bundleItem] : acc.invalidBundleItems
          };
        },
        { validBundleItems: [], invalidBundleItems: [] }
      );
    } catch (err) {
      console.log(`failed to verify match orders`);
      console.error(err);
      throw err;
    }
  };

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

  orderHash(order: ChainOBOrder): BytesLike {
    const fnSign =
      'Order(bool isSellOrder,address signer,uint256[] constraints,OrderItem[] nfts,address[] execParams,bytes extraParams)OrderItem(address collection,TokenInfo[] tokens)TokenInfo(uint256 tokenId,uint256 numTokens)';
    const orderTypeHash = solidityKeccak256(['string'], [fnSign]);

    const constraints = order.constraints;
    const execParams = order.execParams;
    const extraParams = order.extraParams;

    const constraintsHash = keccak256(
      defaultAbiCoder.encode(['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'], constraints)
    );

    const nftsHash = this.getNftsHash(order.nfts);
    const execParamsHash = keccak256(defaultAbiCoder.encode(['address', 'address'], execParams));

    const calcEncode = defaultAbiCoder.encode(
      ['bytes32', 'bool', 'address', 'bytes32', 'bytes32', 'bytes32', 'bytes32'],
      [
        orderTypeHash,
        order.isSellOrder,
        order.signer,
        constraintsHash,
        nftsHash,
        execParamsHash,
        keccak256(extraParams)
      ]
    );

    const orderHash = keccak256(calcEncode);
    return orderHash;
  }

  private getNftsHash(nfts: ChainNFTs[]): BytesLike {
    const fnSign = 'OrderItem(address collection,TokenInfo[] tokens)TokenInfo(uint256 tokenId,uint256 numTokens)';
    const typeHash = solidityKeccak256(['string'], [fnSign]);

    const hashes = [];
    for (const nft of nfts) {
      const hash = keccak256(
        defaultAbiCoder.encode(
          ['bytes32', 'uint256', 'bytes32'],
          [typeHash, nft.collection, this.getTokensHash(nft.tokens)]
        )
      );
      hashes.push(hash);
    }
    const encodeTypeArray = hashes.map(() => 'bytes32');
    const nftsHash = keccak256(defaultAbiCoder.encode(encodeTypeArray, hashes));

    return nftsHash;
  }

  private getTokensHash(tokens: ChainNFTs['tokens']): BytesLike {
    const fnSign = 'TokenInfo(uint256 tokenId,uint256 numTokens)';
    const typeHash = solidityKeccak256(['string'], [fnSign]);

    const hashes = [];
    for (const token of tokens) {
      const hash = keccak256(
        defaultAbiCoder.encode(['bytes32', 'uint256', 'uint256'], [typeHash, token.tokenId, token.numTokens])
      );
      hashes.push(hash);
    }
    const encodeTypeArray = hashes.map(() => 'bytes32');
    const tokensHash = keccak256(defaultAbiCoder.encode(encodeTypeArray, hashes));

    return tokensHash;
  }
}
