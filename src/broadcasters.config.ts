import { ChainId } from '@infinityxyz/lib/types/core';
import { providers, Wallet } from 'ethers';
import { AUTH_SIGNER_GOERLI, AUTH_SIGNER_MAINNET, SIGNER_GOERLI, SIGNER_MAINNET } from './utils/constants';
import { getProvider } from './utils/ethers';
import { BundleEncoder, BundleItem, BundleType } from './flashbots-broadcaster/bundle.types';
import { FlashbotsBroadcaster } from './flashbots-broadcaster/flashbots-broadcaster';
import { FlashbotsBroadcasterOptions } from './flashbots-broadcaster/flashbots-broadcaster-options.types';
import { TxBundlerPool, TxBundlerPoolOptions } from './flashbots-broadcaster/tx-bundler-pool';
import { InfinityExchange } from './infinity-exchange';

type SupportedChainId = ChainId.Mainnet | ChainId.Goerli;

const txBundlerPoolOptions: TxBundlerPoolOptions = {
  minBundleSize: {
    [BundleType.MatchOrders]: 1, // TODO increase this
    [BundleType.MatchOrdersOneToOne]: 1, // TODO increase this
    [BundleType.MatchOrdersOneToMany]: 1
  }
};

const flashbotsOptions: Pick<
  FlashbotsBroadcasterOptions,
  'blocksInFuture' | 'priorityFee' | 'filterSimulationReverts' | 'allowReverts'
> = {
  blocksInFuture: 2,
  priorityFee: 4,
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
  ...flashbotsOptions,
  priorityFee: 1
};

const chainIdProviders: Record<SupportedChainId, providers.JsonRpcProvider> = {
  [ChainId.Mainnet]: getProvider(ChainId.Mainnet),
  [ChainId.Goerli]: getProvider(ChainId.Goerli)
};

export const infinityExchange = new InfinityExchange(chainIdProviders as Record<ChainId, providers.JsonRpcProvider>);

const mainnetSigner = new Wallet(SIGNER_MAINNET, chainIdProviders[ChainId.Mainnet]);
const goerliSigner = new Wallet(SIGNER_GOERLI, chainIdProviders[ChainId.Goerli]);
const mainnetMatchOrdersEncoder = infinityExchange
  .getBundleEncoder(BundleType.MatchOrders, ChainId.Mainnet, mainnetSigner.address)
  .bind(infinityExchange);

const mainnetMatchOrdersOneToOneEncoder = infinityExchange
  .getBundleEncoder(BundleType.MatchOrdersOneToOne, ChainId.Mainnet, mainnetSigner.address)
  .bind(infinityExchange);

const mainnetMatchOrdersOneToManyEncoder = infinityExchange.getBundleEncoder(BundleType.MatchOrdersOneToMany, ChainId.Mainnet, mainnetSigner.address).bind(infinityExchange);

const goerliMatchOrdersEncoder = infinityExchange
  .getBundleEncoder(BundleType.MatchOrders, ChainId.Goerli, goerliSigner.address)
  .bind(infinityExchange);

const goerliMatchOrdersOneToOneEncoder = infinityExchange
  .getBundleEncoder(BundleType.MatchOrdersOneToOne, ChainId.Goerli, goerliSigner.address)
  .bind(infinityExchange);

  const goerliMatchOrdersOneToManyEncoder = infinityExchange
  .getBundleEncoder(BundleType.MatchOrdersOneToMany, ChainId.Goerli, goerliSigner.address)
  .bind(infinityExchange);

export const bundleEncoders: Record<SupportedChainId, Record<BundleType, BundleEncoder[BundleType]>> = {
  [ChainId.Mainnet]: {
    [BundleType.MatchOrders]: mainnetMatchOrdersEncoder,
    [BundleType.MatchOrdersOneToOne]: mainnetMatchOrdersOneToOneEncoder,
    [BundleType.MatchOrdersOneToMany]: mainnetMatchOrdersOneToManyEncoder
  },
  [ChainId.Goerli]: {
    [BundleType.MatchOrders]: goerliMatchOrdersEncoder,
    [BundleType.MatchOrdersOneToOne]: goerliMatchOrdersOneToOneEncoder,
    [BundleType.MatchOrdersOneToMany]: goerliMatchOrdersOneToManyEncoder
  }
};

export async function getBroadcasters() {
  const mainnetTxPool = new TxBundlerPool(bundleEncoders[ChainId.Mainnet], txBundlerPoolOptions);
  const goerliTxPool = new TxBundlerPool(bundleEncoders[ChainId.Goerli], txBundlerPoolOptions);

  const mainnetBroadcaster = await FlashbotsBroadcaster.create(mainnetTxPool, flashbotsOptionsMainnet);
  const goerliBroadcaster = await FlashbotsBroadcaster.create(goerliTxPool, flashbotsOptionsGoerli);

  const chainIdBroadcasters: Record<SupportedChainId, FlashbotsBroadcaster<BundleItem>> = {
    [ChainId.Mainnet]: mainnetBroadcaster,
    [ChainId.Goerli]: goerliBroadcaster
  };

  return { chainIdBroadcasters, infinityExchange };
}
