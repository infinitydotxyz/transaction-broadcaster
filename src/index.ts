import { ChainId } from '@infinityxyz/lib/types/core';
import { getBroadcasters } from './broadcasters.config';
import { WEBHOOK_URL } from './constants';
import { relayErrorToEmbed } from './discord/relay-error-to-embed';
import { sendWebhook } from './discord/webhook';
import { getDb } from './firestore';
import { FlashbotsBroadcasterEvent, FlashbotsBroadcaster } from './flashbots-broadcaster';
import { BundleItem } from './flashbots-broadcaster/bundle.types';
import { FirestoreOrderTransactionProvider } from './transaction/firestore-order-transaction.provider';
import { TransactionProviderEvent } from './transaction/transaction.provider.interface';

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

function registerBroadcasterListeners(
  broadcaster: FlashbotsBroadcaster<BundleItem>,
  firestoreProvider: FirestoreOrderTransactionProvider
) {
  broadcaster.on(FlashbotsBroadcasterEvent.Started, console.log);
  broadcaster.on(FlashbotsBroadcasterEvent.Stopping, console.log);
  broadcaster.on(FlashbotsBroadcasterEvent.Stopped, console.log);
  broadcaster.on(FlashbotsBroadcasterEvent.Block, console.log);
  broadcaster.on(FlashbotsBroadcasterEvent.SubmittingBundle, console.log);
  broadcaster.on(FlashbotsBroadcasterEvent.RelayError, (event) => {
    if (WEBHOOK_URL) {
      const embed = relayErrorToEmbed(event, broadcaster.chainId);
      sendWebhook(WEBHOOK_URL, embed).catch(console.error);
    }
    console.error(`Relay Error`);
    console.error(JSON.stringify(event, null, 2));
  });

  broadcaster.on(FlashbotsBroadcasterEvent.Simulated, (event) => {
    try {
      console.log(`Simulated transactions for chain ${broadcaster.chainId} 
      Successful: ${event.successfulTransactions.length}. Reverted: ${event.revertedTransactions.length}.
      Gas Price: ${event.gasPrice.toString()} Total Gas Used: ${event.totalGasUsed}`);
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
        // bundle items should only be skipped if the orders are no longer valid
        // we should make the validate function on the contract an `external view` function
        // so we can check if each item is valid before submitting all of them together
        // we also need to make sure that orders within the bundle aren't conflicting
        // we should not attempt to transfer the same tokens from one owner more than once
        const ids = [...new Set(bundleItems.map((item) => item.id))];
        await Promise.all(ids.map((id) => firestoreProvider.transactionCompleted(id)));
      } catch (err) {
        console.log(err);
      }
    }
  });
}
