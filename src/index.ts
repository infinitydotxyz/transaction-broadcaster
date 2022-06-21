import {
  ChainId,
  FirestoreOrderMatchStatus,
  MatchOrderFulfilledEvent,
  OrderMatchStateSuccess
} from '@infinityxyz/lib/types/core';
import { BigNumber } from 'ethers';
import { getBroadcasters } from './broadcasters.config';
import { WEBHOOK_URL } from './utils/constants';
import { relayErrorToEmbed } from './discord/relay-error-to-embed';
import { sendWebhook } from './discord/webhook';
import { getDb } from './firestore';
import { FlashbotsBroadcasterEvent, FlashbotsBroadcaster } from './flashbots-broadcaster';
import { BundleItem } from './flashbots-broadcaster/bundle.types';
import { FirestoreOrderTransactionProvider } from './transaction/firestore-order-transaction.provider';
import { TransactionProviderEvent } from './transaction/transaction.provider.interface';

async function main() {
  const db = getDb();
  const { chainIdBroadcasters } = await getBroadcasters();
  const firestoreProvider = new FirestoreOrderTransactionProvider(db);

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
      console.log(JSON.stringify(event, null, 2));
      try {
        const bundleItems = event.nftTransfers
          .map((transfer) => broadcaster.getBundleItemFromTransfer(transfer))
          .filter((bundleItem) => !!bundleItem) as BundleItem[];

        // bundle items should only be skipped if the orders are no longer valid
        // we should make the validate function on the contract an `external view` function
        // so we can check if each item is valid before submitting all of them together
        // we also need to make sure that orders within the bundle aren't conflicting
        // we should not attempt to transfer the same tokens from one owner more than once

        const matchOrdersFulfilledByBuyOrderHash = event.matchOrdersFulfilled.reduce(
          (acc: { [buyOrderHash: string]: MatchOrderFulfilledEvent[] }, order) => {
            const orderHash: string = order.buyOrderHash.toLowerCase();
            const ordersFulfilled = acc[orderHash] ?? [];
            return { ...acc, [orderHash]: [...ordersFulfilled, order] };
          },
          {}
        );

        const updates = bundleItems.map((bundleItem) => {
          const matchOrderEvents = matchOrdersFulfilledByBuyOrderHash[bundleItem.buyOrderHash.toLowerCase()];
          const firstMatchOrderEvent = matchOrderEvents?.[0];
          const txHash = firstMatchOrderEvent?.txHash ?? '';
          const amount = matchOrderEvents.reduce(
            (sum: BigNumber, order: MatchOrderFulfilledEvent) => sum.add(BigNumber.from(order.amount)),
            BigNumber.from(0)
          );
          if (!txHash) {
            console.error(`No txHash for ${bundleItem.buyOrderHash}`);
          }
          const orderMatchState: Pick<
            OrderMatchStateSuccess,
            'status' | 'txHash' | 'currency' | 'amount' | 'ordersFulfilled'
          > = {
            status: FirestoreOrderMatchStatus.Matched,
            txHash: txHash,
            currency: firstMatchOrderEvent?.currencyAddress ?? '',
            amount: amount.toString(),
            ordersFulfilled: matchOrderEvents
          };

          return {
            id: bundleItem.id,
            orderMatchState
          };
        });

        await Promise.allSettled(
          updates.map(({ id, orderMatchState: update }) => firestoreProvider.updateOrderMatch(id, update))
        );
      } catch (err) {
        console.log(err);
      }
    }
  });
}
