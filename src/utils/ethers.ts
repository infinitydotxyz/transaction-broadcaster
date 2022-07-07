import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { providers } from 'ethers';
import { getEnvVariable } from './constants';

const providersByChainId: Map<ChainId, providers.StaticJsonRpcProvider> = new Map();

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

export function getProvider(chainId: ChainId): providers.StaticJsonRpcProvider {
  let provider = providersByChainId.get(chainId);

  if (!provider) {
    const chainIdNum = parseInt(chainId, 10);
    const providerUrl = getProviderUrl(chainId);
    provider = new providers.StaticJsonRpcProvider(providerUrl, chainIdNum);
    providersByChainId.set(chainId, provider);
  }
  return provider;
}
