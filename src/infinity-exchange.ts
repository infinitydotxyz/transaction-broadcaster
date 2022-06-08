import { TransactionRequest } from '@ethersproject/abstract-provider';
import {
  ChainId,
  ChainNFTs,
  ChainOBOrder,
  FirestoreOrderMatchErrorCode,
  MakerOrder,
  OrderMatchStateError
} from '@infinityxyz/lib/types/core';
import { getExchangeAddress, getTxnCurrencyAddress } from '@infinityxyz/lib/utils/orders';
import { BigNumber, BigNumberish, BytesLike, Contract, ethers, providers } from 'ethers';
import { solidityKeccak256, keccak256, defaultAbiCoder } from 'ethers/lib/utils';
import { erc20Abi } from './abi/erc20.abi';
import { erc721Abi } from './abi/erc721.abi';
import { infinityExchangeAbi } from './abi/infinity-exchange.abi';
import { MAX_GAS_LIMIT } from './constants';
import {
  BundleCallDataEncoder,
  BundleItem,
  BundleItemsToArgsTransformer,
  BundleItemWithCurrentPrice,
  BundleOrdersEncoder,
  BundleType,
  BundleVerifier,
  MatchOrdersArgs,
  MatchOrdersBundleItem
} from './flashbots-broadcaster/bundle.types';
import { getErrorMessage } from './utils';

type InvalidBundleItem = {
  bundleItem: BundleItem | MatchOrdersBundleItem;
  orderError: Pick<OrderMatchStateError, 'code' | 'error'>;
};
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
      let validBundleItems: BundleItemWithCurrentPrice[] = [];
      let invalidBundleItems: InvalidBundleItem[] = [];

      console.log(
        `Received: ${bundleItems.length} valid bundle items and ${invalidBundleItems.length} invalid bundle items`
      );

      const { validBundleItems: validBundleItemsAfterVerification, invalidBundleItems: invalidBundleItemsFromVerify } =
        await verifyBundleItems(bundleItems, chainId);
      const invalidBundleItemsFromVerifyWithError = invalidBundleItemsFromVerify.map((invalidItem) => {
        return {
          bundleItem: invalidItem as unknown as MatchOrdersBundleItem,
          orderError: {
            // TODO remove casting once other bundle item types are added
            code: FirestoreOrderMatchErrorCode.OrderInvalid,
            error: 'Order match not valid for one or more orders'
          }
        };
      });
      validBundleItems = validBundleItemsAfterVerification as unknown as BundleItemWithCurrentPrice[]; // TODO remove casting once other bundle item types are added
      invalidBundleItems = [...invalidBundleItems, ...invalidBundleItemsFromVerifyWithError];

      console.log(
        `Have ${validBundleItems.length} valid bundle items and ${invalidBundleItems.length} invalid bundle items after verifying orders`
      );

      const {
        validBundleItems: validBundleItemsAfterNftApproval,
        invalidBundleItems: invalidBundleItemsAfterNftApproval
      } = await this.checkNftSellerApprovalAndBalance(validBundleItems as unknown as BundleItemWithCurrentPrice[], chainId); // TODO remove casting once other bundle item types are added
      validBundleItems = validBundleItemsAfterNftApproval as unknown as BundleItemWithCurrentPrice[];
      invalidBundleItems = [...invalidBundleItems, ...invalidBundleItemsAfterNftApproval];

      console.log(
        `Have ${validBundleItems.length} valid bundle items and ${invalidBundleItems.length} invalid bundle items after checking nft approval and balance`
      );

      const {
        validBundleItems: validBundleItemsAfterCurrencyCheck,
        invalidBundleItems: invalidBundleItemsFromCurrencyCheck
      } = await this.checkNftBuyerApprovalAndBalance(validBundleItems as unknown as BundleItemWithCurrentPrice[], chainId); // TODO remove casting once other bundle item types are added
      validBundleItems = validBundleItemsAfterCurrencyCheck as unknown as BundleItemWithCurrentPrice[];
      invalidBundleItems = [...invalidBundleItems, ...invalidBundleItemsFromCurrencyCheck];

      console.log(
        `Have ${validBundleItems.length} valid bundle items and ${invalidBundleItems.length} invalid bundle items after checking currency approval and balance`
      );

      // if (validBundleItems.length < minBundleSize) {
      //   return { txRequests: [] as TransactionRequest[], invalidBundleItems: invalidBundleItemsFromVerify };
      // } // TODO enable min bundle size

      const { txRequests, invalidBundleItems: invalidBundleItemsFromBuild } = await buildBundles(validBundleItems as unknown[] as BundleItem[], 1);

      return { txRequests, invalidBundleItems: [...invalidBundleItemsFromVerify, ...invalidBundleItemsFromBuild] };
    };

    return encoder;
  }

  private async checkNftBuyerApprovalAndBalance(
    bundleItems: BundleItemWithCurrentPrice[],
    chainId: ChainId
  ): Promise<{ validBundleItems: BundleItemWithCurrentPrice[]; invalidBundleItems: InvalidBundleItem[] }> {
    const provider = this.getProvider(chainId);
    const operator = this.getContract(chainId).address;
    type BundleItemIsValid = { bundleItem: BundleItemWithCurrentPrice; isValid: true };
    type BundleItemIsInvalid = InvalidBundleItem & { isValid: false };

    const results: (BundleItemIsValid | BundleItemIsInvalid)[] = await Promise.all(
      bundleItems.map(async (bundleItem) => {
        try {
          const buyer = bundleItem.buy.signer;
          const currency = bundleItem.buy.execParams[1];
          const weth = getTxnCurrencyAddress(chainId);
          const currencies = [...new Set([currency, weth])];

          for (const currency of currencies) {
            const contract = new ethers.Contract(currency, erc20Abi, provider);
            const allowance: BigNumberish = await contract.allowance(buyer, operator);
            let expectedCost = bundleItem.currentPrice.mul(11).div(10); // 10% buffer
            if(currency === weth) {
              // TODO include expected gas price
              expectedCost = expectedCost.add(0);
            }

            if (BigNumber.from(allowance).lt(expectedCost)) {
              return { 
                bundleItem,
                isValid: false,
                orderError: {
                  code: FirestoreOrderMatchErrorCode.InsufficientCurrencyAllowance,
                  error: `Buyer: ${buyer} has an insufficient currency allowance for currency ${currency}. Allowance: ${allowance.toString()}. Expected: ${expectedCost.toString()}`
                }
              }
            }

            const balance: BigNumberish = await contract.balanceOf(buyer);
            if (BigNumber.from(balance).lt(expectedCost)) {
              return { 
                bundleItem,
                isValid: false,
                orderError: {
                  code: FirestoreOrderMatchErrorCode.InsufficientCurrencyBalance,
                  error: `Buyer: ${buyer} has an insufficient currency balance for currency ${currency}. Balance: ${balance.toString()}. Expected: ${expectedCost.toString()}`
                }
              }
            }
          } 
          return { bundleItem, isValid: true };
        } catch (err) {
          console.error(err);
          const errorMessage = getErrorMessage(err);
          return {
            bundleItem,
            isValid: false,
            orderError: {
              code: FirestoreOrderMatchErrorCode.UnknownError,
              error: errorMessage
            }
          };
        }
      })
    );

    return results.reduce(
      (acc: { validBundleItems: BundleItemWithCurrentPrice[]; invalidBundleItems: InvalidBundleItem[] }, result) => {
        if (result.isValid) {
          return {
            ...acc,
            validBundleItems: [...acc.validBundleItems, result.bundleItem]
          };
        }
        const invalidBundleItem = {
          bundleItem: result.bundleItem,
          orderError: result.orderError
        };
        return {
          ...acc,
          invalidBundleItems: [...acc.invalidBundleItems, invalidBundleItem]
        };
      },
      { validBundleItems: [], invalidBundleItems: [] }
    );
  }

  private async checkNftSellerApprovalAndBalance(
    bundleItems: BundleItemWithCurrentPrice[],
    chainId: ChainId
  ): Promise<{ validBundleItems: BundleItemWithCurrentPrice[]; invalidBundleItems: InvalidBundleItem[] }> {
    const provider = this.getProvider(chainId);
    const operator = this.getContract(chainId).address;
    type BundleItemIsValid = { bundleItem: BundleItemWithCurrentPrice; isValid: true };
    type BundleItemIsInvalid = InvalidBundleItem & { isValid: false };
    const results: (BundleItemIsValid | BundleItemIsInvalid)[] = await Promise.all(
      bundleItems.map(async (bundleItem) => {
        try {
          const owner = bundleItem.sell;
          const signerAddress = owner.signer;
          const nfts =
            bundleItem.bundleType === BundleType.MatchOrders ? bundleItem.constructed.nfts : bundleItem.sell.nfts;
          for (const { collection, tokens } of nfts) {
            const erc721Contract = new ethers.Contract(collection, erc721Abi, provider);
            const isApproved = await erc721Contract.isApprovedForAll(signerAddress, operator);
            if (!isApproved) {
              return {
                bundleItem,
                isValid: false,
                orderError: {
                  error: `Operator ${operator} is not approved on contract ${collection}`,
                  code: FirestoreOrderMatchErrorCode.NotApprovedToTransferToken
                }
              };
            }
            for (const { tokenId, numTokens } of tokens) {
              const ownerOfToken = await erc721Contract.ownerOf(tokenId);
              if (signerAddress !== ownerOfToken.toLowerCase()) {
                return {
                  bundleItem,
                  isValid: false,
                  orderError: {
                    error: `Signer ${signerAddress} does not own at least ${numTokens} tokens of token ${tokenId} from collection ${collection}`,
                    code: FirestoreOrderMatchErrorCode.InsufficientTokenBalance
                  }
                };
              }
            }
          }
          return { bundleItem, isValid: true };
        } catch (err) {
          console.error(err);
          const errorMessage = getErrorMessage(err);
          return {
            bundleItem,
            isValid: false,
            orderError: {
              error: errorMessage,
              code: FirestoreOrderMatchErrorCode.UnknownError
            }
          };
        }
      })
    );

    return results.reduce(
      (acc: { validBundleItems: BundleItemWithCurrentPrice[]; invalidBundleItems: InvalidBundleItem[] }, result) => {
        if (result.isValid) {
          return {
            ...acc,
            validBundleItems: [...acc.validBundleItems, result.bundleItem]
          };
        }
        const invalidBundleItem = {
          bundleItem: result.bundleItem,
          orderError: result.orderError
        };
        return {
          ...acc,
          invalidBundleItems: [...acc.invalidBundleItems, invalidBundleItem]
        };
      },
      { validBundleItems: [], invalidBundleItems: [] }
    );
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
          acc: {
            validBundleItems: BundleItemWithCurrentPrice[];
            invalidBundleItems: MatchOrdersBundleItem[];
          },
          bundleItem,
          index
        ) => {
          const result = results[index];
          const isValid = result.status === 'fulfilled' && result.value[0];
          const currentPrice = result.status === 'fulfilled' ? BigNumber.from(result.value[1]) : BigNumber.from(0);
          const bundleItemWithCurrentPrice: BundleItemWithCurrentPrice = {
            ...bundleItem,
            currentPrice
          };
          return {
            validBundleItems: isValid ? [...acc.validBundleItems, bundleItemWithCurrentPrice] : acc.validBundleItems,
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
