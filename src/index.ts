import { ChainId } from '@infinityxyz/lib/types/core';
import { providers } from 'ethers/lib/ethers';
import { AUTH_SIGNER_MAINNET, SIGNER_MAINNET, AUTH_SIGNER_GOERLI, SIGNER_GOERLI } from './constants';
import { getProvider } from './ethers';
import { getDb } from './firestore';
import { FlashbotsBroadcasterEvent, FlashbotsBroadcasterOptions, FlashbotsBroadcaster } from './flashbots-broadcaster';
import { BundleItem, BundleType } from './flashbots-broadcaster/bundle.types';
import { TxBundlerPool } from './flashbots-broadcaster/tx-bundler-pool';
import { InfinityExchange } from './infinity-exchange';
import { FirestoreOrderTransactionProvider } from './transaction/firestore-order-transaction.provider';
import { TransactionProviderEvent } from './transaction/transaction.provider.interface';

const db = getDb();
const firestoreProvider = new FirestoreOrderTransactionProvider(db);

const flashbotsOptions: Pick<
  FlashbotsBroadcasterOptions,
  'blocksInFuture' | 'priorityFee' | 'filterSimulationReverts' | 'allowReverts'
> = {
  blocksInFuture: 2,
  priorityFee: 3.5,
  filterSimulationReverts: true,
  allowReverts: false
};

const flashbotsOptionsMainnet: FlashbotsBroadcasterOptions = {
  authSigner: {
    privateKey: AUTH_SIGNER_MAINNET
  },
  transactionSigner: {
    privateKey: SIGNER_MAINNET
  },
  provider: getProvider(ChainId.Mainnet),
  ...flashbotsOptions
};

const flashbotsOptionsGoerli: FlashbotsBroadcasterOptions = {
  authSigner: {
    privateKey: AUTH_SIGNER_GOERLI
  },
  transactionSigner: {
    privateKey: SIGNER_GOERLI
  },
  provider: getProvider(ChainId.Goerli),
  ...flashbotsOptions
};

// TODO add support for sending multiple order matches in a single transaction
async function main() {
  const providers: Record<ChainId, providers.JsonRpcProvider> = {
    [ChainId.Mainnet]: getProvider(ChainId.Mainnet),
    [ChainId.Goerli]: getProvider(ChainId.Goerli),
    [ChainId.Polygon]: undefined as any // not supported
  };
  const infinityExchange = new InfinityExchange(providers);
  const mainnetEncoder = infinityExchange.getMatchOrdersEncoder(ChainId.Mainnet).bind(infinityExchange);
  const goerliEncoder = infinityExchange.getMatchOrdersEncoder(ChainId.Goerli).bind(infinityExchange);
  const mainnetTxPool = new TxBundlerPool({ [BundleType.MatchOrders]: mainnetEncoder });
  const goerliTxPool = new TxBundlerPool({ [BundleType.MatchOrders]: goerliEncoder });
  const mainnetBroadcaster = await FlashbotsBroadcaster.create(mainnetTxPool, flashbotsOptionsMainnet);
  const goerliBroadcaster = await FlashbotsBroadcaster.create(goerliTxPool, flashbotsOptionsGoerli);

  const chainIdBroadcasters: Record<ChainId.Mainnet | ChainId.Goerli, FlashbotsBroadcaster<BundleItem>> = {
    [ChainId.Mainnet]: mainnetBroadcaster,
    [ChainId.Goerli]: goerliBroadcaster
  };

  for (const broadcaster of Object.values(chainIdBroadcasters)) {
    broadcaster.on(FlashbotsBroadcasterEvent.Started, console.log);
    broadcaster.on(FlashbotsBroadcasterEvent.Stopping, console.log);
    broadcaster.on(FlashbotsBroadcasterEvent.Stopped, console.log);
    broadcaster.on(FlashbotsBroadcasterEvent.Block, console.log);
    broadcaster.on(FlashbotsBroadcasterEvent.SubmittingBundle, console.log);
    broadcaster.on(FlashbotsBroadcasterEvent.RelayError, console.error);

    broadcaster.on(FlashbotsBroadcasterEvent.Simulated, (event) => {
      try {
        console.log(`Simulated`, JSON.stringify(event, null, 2));

        // TODO how do we map reverted transactions back to the order?
        // why would a tx get reverted?
        // wasn't formed correctly => assume this isn't the case
        // insufficient gas price
        // invalid balance of tokens in owners of nfts/eth
        // await Promise.all(event.revertedTransactions.map((tx) => firestoreProvider.transactionReverted(tx.id)));
      } catch (err) {
        console.log(err);
      }
    });

    broadcaster.on(FlashbotsBroadcasterEvent.BundleResult, async (event) => {
      if ('reason' in event) {
        console.error(event.reason);
      } else {
        try {
          const bundleItems = event.transfers
            .map((item) => broadcaster.getBundleItemByTransfer(item))
            .filter((item) => !!item) as { id: string; item: BundleItem }[];
          const ids = [...new Set(bundleItems.map((item) => item.id))];
          await Promise.all(ids.map((id) => firestoreProvider.transactionCompleted(id)));
        } catch (err) {
          console.log(err);
        }
      }
    });
  }

  firestoreProvider.on(TransactionProviderEvent.Update, (event) => {
    const chainId = event.item.chainId;
    const broadcaster = chainIdBroadcasters[chainId as ChainId.Mainnet | ChainId.Goerli];
    if (broadcaster) {
      broadcaster.add(event.id, event.item);
    } else {
      console.error(`Unsupported chainId: ${chainId}`);
    }
  });

  firestoreProvider.on(TransactionProviderEvent.Remove, ({ id }) => {
    for (const broadcaster of Object.values(chainIdBroadcasters)) {
      broadcaster.remove(id);
    }
  });

  for (const broadcaster of Object.values(chainIdBroadcasters)) {
    broadcaster.start();
  }

  await firestoreProvider.start();
}

void main();
