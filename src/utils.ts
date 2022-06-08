import { ChainNFTs, ChainOBOrder } from '@infinityxyz/lib/types/core';
import { BigNumber, BigNumberish, BytesLike, providers } from 'ethers/lib/ethers';
import { solidityKeccak256, keccak256, defaultAbiCoder } from 'ethers/lib/utils';
import { GWEI } from './constants';

export function weiToRoundedGwei(gasPrice: BigNumber): number {
  return gasPrice.mul(100).div(GWEI).toNumber() / 100;
}

export function gweiToWei(gwei: BigNumberish): BigNumber {
  return BigNumber.from(Math.round(Number(gwei) * 1000))
    .mul(GWEI)
    .div(1000);
}

export function round(value: number, numDecimals: number): number {
  const decimals = 10 ** numDecimals;
  return Math.round(value * decimals) / decimals;
}

export function getFeesAtTarget(currentBaseFee: BigNumber, blocksInFuture: number) {
  const MAX_SINGLE_BLOCK_INCREASE = 1.125;
  const MAX_SINGLE_BLOCK_DECREASE = 0.875;
  const maxIncreaseAtTarget = Math.ceil(MAX_SINGLE_BLOCK_INCREASE ** blocksInFuture * 1000);
  const maxDecreaseAtTarget = Math.floor(MAX_SINGLE_BLOCK_DECREASE ** blocksInFuture * 1000);

  const maxBaseFee = currentBaseFee.mul(maxIncreaseAtTarget).div(1000);
  const minBaseFee = currentBaseFee.mul(maxDecreaseAtTarget).div(1000);

  return {
    maxBaseFeeWei: maxBaseFee,
    minBaseFeeWei: minBaseFee,
    maxBaseFeeGwei: weiToRoundedGwei(maxBaseFee),
    minBaseFeeGwei: weiToRoundedGwei(minBaseFee)
  };
}

export function getFlashbotsEndpoint(network: providers.Network): string | undefined {
  switch (network.chainId) {
    case 1:
      return undefined;
    case 5:
      return 'https://relay-goerli.flashbots.net';
    default:
      throw new Error(`Network ${network.chainId} is not supported by flashbots`);
  }
}

export function getErrorMessage(err: any) {
  if (err instanceof Error) {
    return err.message;
  } else if (typeof err === 'string') {
    return err;
  } else if (typeof err === 'object' && 'toString' in err && typeof err.toString === 'function') {
    return err.toString();
  } else {
    return JSON.stringify(err);
  }
}



export function orderHash(order: ChainOBOrder): string {
  const fnSign =
    'Order(bool isSellOrder,address signer,uint256[] constraints,OrderItem[] nfts,address[] execParams,bytes extraParams)OrderItem(address collection,TokenInfo[] tokens)TokenInfo(uint256 tokenId,uint256 numTokens)';
  const orderTypeHash = solidityKeccak256(['string'], [fnSign]);

  const constraints = order.constraints;
  const execParams = order.execParams;
  const extraParams = order.extraParams;

  const constraintsHash = keccak256(
    defaultAbiCoder.encode(['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'], constraints)
  );

  const nftsHash = getNftsHash(order.nfts);
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

function getNftsHash(nfts: ChainNFTs[]): BytesLike {
  const fnSign = 'OrderItem(address collection,TokenInfo[] tokens)TokenInfo(uint256 tokenId,uint256 numTokens)';
  const typeHash = solidityKeccak256(['string'], [fnSign]);

  const hashes = [];
  for (const nft of nfts) {
    const hash = keccak256(
      defaultAbiCoder.encode(
        ['bytes32', 'uint256', 'bytes32'],
        [typeHash, nft.collection, getTokensHash(nft.tokens)]
      )
    );
    hashes.push(hash);
  }
  const encodeTypeArray = hashes.map(() => 'bytes32');
  const nftsHash = keccak256(defaultAbiCoder.encode(encodeTypeArray, hashes));

  return nftsHash;
}

function getTokensHash(tokens: ChainNFTs['tokens']): BytesLike {
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