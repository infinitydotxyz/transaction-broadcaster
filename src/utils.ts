import { BigNumber, BigNumberish, providers } from 'ethers/lib/ethers';
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
