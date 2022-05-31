import { ChainId } from '@infinityxyz/lib/types/core';
import { providers } from 'ethers';
import { AUTH_SIGNER_GOERLI, AUTH_SIGNER_MAINNET, SIGNER_GOERLI, SIGNER_MAINNET } from './constants';
import { getProvider } from './ethers';
import { BundleEncoder, BundleItem, BundleType } from './flashbots-broadcaster/bundle.types';
import { FlashbotsBroadcaster } from './flashbots-broadcaster/flashbots-broadcaster';
import { FlashbotsBroadcasterOptions } from './flashbots-broadcaster/flashbots-broadcaster-options.types';
import { TxBundlerPool } from './flashbots-broadcaster/tx-bundler-pool';
import { InfinityExchange } from './infinity-exchange';

type SupportedChainId = ChainId.Mainnet | ChainId.Goerli;

const flashbotsOptions: Pick<
  FlashbotsBroadcasterOptions,
  'blocksInFuture' | 'priorityFee' | 'filterSimulationReverts' | 'allowReverts'
> = {
  blocksInFuture: 2,
  priorityFee: 3.5,
  filterSimulationReverts: true,
  allowReverts: false
};

export const flashbotsOptionsMainnet: FlashbotsBroadcasterOptions = {
  authSigner: {
    privateKey: AUTH_SIGNER_MAINNET
  },
  transactionSigner: {
    privateKey: SIGNER_MAINNET
  },
  provider: getProvider(ChainId.Mainnet),
  ...flashbotsOptions
};

export const flashbotsOptionsGoerli: FlashbotsBroadcasterOptions = {
  authSigner: {
    privateKey: AUTH_SIGNER_GOERLI
  },
  transactionSigner: {
    privateKey: SIGNER_GOERLI
  },
  provider: getProvider(ChainId.Goerli),
  ...flashbotsOptions
};

const chainIdProviders: Record<SupportedChainId, providers.JsonRpcProvider> = {
  [ChainId.Mainnet]: getProvider(ChainId.Mainnet),
  [ChainId.Goerli]: getProvider(ChainId.Goerli),
};

export const infinityExchange = new InfinityExchange(chainIdProviders as Record<ChainId, providers.JsonRpcProvider>);

const mainnetEncoder = infinityExchange.getMatchOrdersEncoder(ChainId.Mainnet).bind(infinityExchange);
const goerliEncoder = infinityExchange.getMatchOrdersEncoder(ChainId.Goerli).bind(infinityExchange);

export const bundleEncoders: Record<SupportedChainId, Record<BundleType, BundleEncoder[BundleType]>> = {
    [ChainId.Mainnet]: {
        [BundleType.MatchOrders]: mainnetEncoder,
    },
    [ChainId.Goerli]: {
        [BundleType.MatchOrders]: goerliEncoder,
    }
}


export async function getBroadcasters() {
    const mainnetTxPool = new TxBundlerPool(bundleEncoders[ChainId.Mainnet]);
    const goerliTxPool = new TxBundlerPool(bundleEncoders[ChainId.Goerli]);
  
    const mainnetBroadcaster = await FlashbotsBroadcaster.create(mainnetTxPool, flashbotsOptionsMainnet);
    const goerliBroadcaster = await FlashbotsBroadcaster.create(goerliTxPool, flashbotsOptionsGoerli);
  
    const chainIdBroadcasters: Record<ChainId.Mainnet | ChainId.Goerli, FlashbotsBroadcaster<BundleItem>> = {
      [ChainId.Mainnet]: mainnetBroadcaster,
      [ChainId.Goerli]: goerliBroadcaster
    };
  
    return chainIdBroadcasters;
  }