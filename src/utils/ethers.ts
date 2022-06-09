import { NumberAttribute } from '@infinityxyz/lib/types/core';
import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { BigNumber, ethers, providers } from 'ethers';
import { erc721Abi } from '../abi/erc721.abi';
import { infinityExchangeAbi } from '../abi/infinity-exchange.abi';
import { getEnvVariable, SupportedTokenStandard, tokenStandardByTransferTopic } from '../constants';

const providersByChainId: Map<ChainId, providers.JsonRpcProvider> = new Map();

export function getProviderUrl(chainId: ChainId) {
  let envVariable = '';
  switch (chainId) {
    case ChainId.Mainnet:
      envVariable = 'PROVIDER_URL_MAINNET';
      break;
    case ChainId.Goerli:
      envVariable = 'PROVIDER_URL_GOERLI';
      break;
    case ChainId.Polygon:
      envVariable = 'PROVIDER_URL_POLYGON';
      break;
  }
  const providerUrl = getEnvVariable(envVariable, true);

  return providerUrl;
}

export function getProvider(chainId: ChainId): providers.JsonRpcProvider {
  let provider = providersByChainId.get(chainId);

  if (!provider) {
    const chainIdNum = parseInt(chainId, 10);
    const providerUrl = getProviderUrl(chainId);
    provider = new providers.JsonRpcProvider(providerUrl, chainIdNum);
    providersByChainId.set(chainId, provider);
  }
  return provider;
}
