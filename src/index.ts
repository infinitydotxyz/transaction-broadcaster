import { ChainId } from '@infinityxyz/lib/types/core';
import { getBroadcasters } from './broadcasters.config';
import { getDb } from './firestore';
import { FlashbotsBroadcasterEvent, FlashbotsBroadcaster } from './flashbots-broadcaster';
import { BundleItem } from './flashbots-broadcaster/bundle.types';
import { FirestoreOrderTransactionProvider } from './transaction/firestore-order-transaction.provider';
import {  TransactionProviderEvent } from './transaction/transaction.provider.interface';

async function main() {
  const db = getDb();
  const firestoreProvider = new FirestoreOrderTransactionProvider(db);
  const chainIdBroadcasters = await getBroadcasters();

  for (const broadcaster of Object.values(chainIdBroadcasters)) {
    registerBroadcasterListeners(broadcaster, firestoreProvider);
  }

  firestoreProvider.on(TransactionProviderEvent.Update, (event) => {
    const chainId = event.item.chainId;
    const broadcaster = chainIdBroadcasters[chainId as ChainId.Mainnet | ChainId.Goerli];
    if (broadcaster) {
      broadcaster.add(event.item);
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


function registerBroadcasterListeners(broadcaster: FlashbotsBroadcaster<BundleItem>, firestoreProvider: FirestoreOrderTransactionProvider) {
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
      // wasn't formed correctly => this shouldn't the case
      // insufficient gas price
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
          .map((transfer) => broadcaster.getBundleItemFromTransfer(transfer))
          .filter((bundleItem) => !!bundleItem) as BundleItem[];
        // TODO how do we handle bundleItems that were skipped? 
        // TODO call validate method on the bundleItem to see if it's valid before submission and delete if not valid
        const ids = [...new Set(bundleItems.map((item) => item.id))];
        await Promise.all(ids.map((id) => firestoreProvider.transactionCompleted(id)));
      } catch (err) {
        console.log(err);
      }
    }
  });
}