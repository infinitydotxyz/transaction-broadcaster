import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { BigNumber, ethers, providers } from 'ethers';
import { erc721Abi } from './abi/erc721.abi';
import { getEnvVariable, SupportedTokenStandard, tokenStandardByTransferTopic } from './constants';

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

export function decodeTransfer(log: providers.Log): {
  address: string;
  from: string;
  to: string;
  tokenId: string;
  amount: number;
}[] {
  try {
    const topics = log.topics;
    const topic = topics[0];
    const tokenStandard = tokenStandardByTransferTopic[topic];
    switch (tokenStandard) {
      case SupportedTokenStandard.ERC721: {
        const iface = new ethers.utils.Interface(erc721Abi);
        const res = iface.parseLog(log);
        const [from, to, tokenId] = res.args;
        return [
          {
            address: log.address.toLowerCase(),
            from: from.toLowerCase(),
            to: to.toLowerCase(),
            tokenId: BigNumber.isBigNumber(tokenId) ? tokenId.toString() : tokenId,
            amount: 1
          }
        ];
      }
      default:
        return [];
    }
  } catch (err) {
    return [];
  }
}
