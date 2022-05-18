import { ChainId } from '@infinityxyz/lib/types/core';
import { AUTH_SIGNER_MAINNET, SIGNER_MAINNET, AUTH_SIGNER_GOERLI, SIGNER_GOERLI } from './constants';
import { getProvider } from './ethers';
import { getDb } from './firestore';
import { FlashbotsBroadcasterEvent, FlashbotsBroadcasterOptions, FlashbotsBroadcaster } from './flashbots-broadcaster';
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
  const mainnetBroadcaster = await FlashbotsBroadcaster.create(flashbotsOptionsMainnet);
  const goerliBroadcaster = await FlashbotsBroadcaster.create(flashbotsOptionsGoerli);

  const chainIdBroadcasters: Record<ChainId.Mainnet | ChainId.Goerli, FlashbotsBroadcaster> = {
    [ChainId.Mainnet]: mainnetBroadcaster,
    [ChainId.Goerli]: goerliBroadcaster
  };

  for (const broadcaster of Object.values(chainIdBroadcasters)) {
    broadcaster.on(FlashbotsBroadcasterEvent.Started, console.log);
    broadcaster.on(FlashbotsBroadcasterEvent.Stopping, console.log);
    broadcaster.on(FlashbotsBroadcasterEvent.Stopped, console.log);
    broadcaster.on(FlashbotsBroadcasterEvent.Block, console.log);
    broadcaster.on(FlashbotsBroadcasterEvent.Simulated, async (event) => {
      try {
        await Promise.all(event.revertedTransactions.map((tx) => firestoreProvider.transactionReverted(tx.id)));
      } catch (err) {
        console.log(err);
      }
    });
    broadcaster.on(FlashbotsBroadcasterEvent.SubmittingBundle, console.log);
    broadcaster.on(FlashbotsBroadcasterEvent.BundleResult, async (event) => {
      if ('reason' in event) {
        console.error(event.reason);
      } else {
        try {
          await Promise.all(event.transactions.map((tx) => firestoreProvider.transactionCompleted(tx.id)));
        } catch (err) {
          console.log(err);
        }
      }
    });
    broadcaster.on(FlashbotsBroadcasterEvent.RelayError, console.error);
  }

  firestoreProvider.on(TransactionProviderEvent.Update, (event) => {
    const chainId = `${event.transaction.chainId}` as ChainId;
    const broadcaster = chainIdBroadcasters[chainId as ChainId.Mainnet | ChainId.Goerli];
    if (broadcaster) {
      broadcaster.add(event.id, event.transaction);
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
