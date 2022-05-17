import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { providers } from 'ethers';

const providersByChainId: Map<ChainId, providers.BaseProvider> = new Map();

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
  const providerUrl = process.env[envVariable];

  if (!providerUrl) {
    throw new Error(`Missing environment variable ${envVariable}`);
  }

  return providerUrl;
}

export function getProvider(chainId: ChainId): providers.BaseProvider {
  let provider = providersByChainId.get(chainId);

  if (!provider) {
    const chainIdNum = parseInt(chainId, 10);
    const providerUrl = getProviderUrl(chainId);
    provider = new providers.JsonRpcProvider(providerUrl, chainIdNum);
  }
  return provider;
}
