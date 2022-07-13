import {
  FirestoreOrderMatchStatus,
  MatchOrderFulfilledEvent,
  OrderMatchStateError,
  OrderMatchStateSuccess
} from '@infinityxyz/lib/types/core';
import { BigNumber } from 'ethers';
import { enabledChainIds, getBroadcasters, SupportedChainId } from './broadcasters.config';
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
    if (enabledChainIds.includes(chainId as SupportedChainId)) {
      const broadcaster = chainIdBroadcasters[chainId as SupportedChainId];
      if (broadcaster) {
        broadcaster.add(event.item);
      } else {
        console.error(`Unsupported chainId: ${chainId}`);
      }
    }
  });

  firestoreProvider.on(TransactionProviderEvent.Remove, ({ id }) => {
    for (const broadcaster of Object.values(chainIdBroadcasters)) {
      broadcaster.remove(id);
    }
  });

  for (const broadcaster of Object.values(chainIdBroadcasters)) {
    if (enabledChainIds.includes(broadcaster.chainId as SupportedChainId)) {
      broadcaster.start();
    }
  }

  await firestoreProvider.start();
}

void main();

function registerBroadcasterListeners(
  broadcaster: FlashbotsBroadcaster<BundleItem>,
  firestoreProvider: FirestoreOrderTransactionProvider
) {
  const log = (state: FlashbotsBroadcasterEvent, blockNumber?: number, message?: string) => {
    const msg = `[${broadcaster.network.name}] [${state}] ${
      blockNumber ? '[' + blockNumber.toString() + ']' : ''
    } ${message}`;
    console.log(msg);
  };

  broadcaster.on(FlashbotsBroadcasterEvent.Started, (event) => {
    const message = `Signer: ${event.signerAddress} Allow Reverts: ${
      event.settings.allowReverts ? '✅' : '❌'
    } Blocks in the future: ${event.settings.blocksInFuture} Filter reverts: ${
      event.settings.filterSimulationReverts ? '✅' : '❌'
    }`;
    log(FlashbotsBroadcasterEvent.Started, undefined, message);
  });
  broadcaster.on(FlashbotsBroadcasterEvent.Stopping, () => {
    log(FlashbotsBroadcasterEvent.Stopping, undefined, '');
  });
  broadcaster.on(FlashbotsBroadcasterEvent.Stopped, () => {
    log(FlashbotsBroadcasterEvent.Stopped, undefined, '');
  });
  broadcaster.on(FlashbotsBroadcasterEvent.Block, (event) => {
    const pools = Object.entries(event.txPoolSizes)
      .map(([name, size]) => `${name}: ${size}`)
      .join(', ');
    const message = `Gas Price: ${event.gasPrice} ${pools}`;
    log(FlashbotsBroadcasterEvent.Block, event.blockNumber, message);
  });
  broadcaster.on(FlashbotsBroadcasterEvent.InvalidBundleItems, async (event) => {
    try {
      const updates = event.invalidBundleItems.map(({ item, error, code }) => {
        const state: Partial<OrderMatchStateError> = {
          status: FirestoreOrderMatchStatus.Error,
          error: error,
          code: code
        };
        const id = item.id;
        return { id, state };
      });
      log(
        FlashbotsBroadcasterEvent.InvalidBundleItems,
        event.blockNumber,
        `Found: ${updates.length} invalid bundle items`
      );
      console.table(updates.map((item) => ({ id: item.id, error: item.state.error })));
      await firestoreProvider.updateInvalidOrderMatches(updates);
    } catch (err) {
      console.error(err);
    }
  });
  broadcaster.on(FlashbotsBroadcasterEvent.SubmittingBundle, (event) => {
    const message = `Submitting bundle to block ${event.blockNumber} with ${event.transactions.length} transactions`;
    log(FlashbotsBroadcasterEvent.SubmittingBundle, event.blockNumber, message);
  });
  broadcaster.on(FlashbotsBroadcasterEvent.RelayError, (event) => {
    if (WEBHOOK_URL) {
      const embed = relayErrorToEmbed(event, broadcaster.chainId);
      sendWebhook(WEBHOOK_URL, embed).catch(console.error);
    }
    log(FlashbotsBroadcasterEvent.RelayError, event.blockNumber, event.message);
    console.error(`Relay Error: ${JSON.stringify(event, null, 2)}`);
  });

  broadcaster.on(FlashbotsBroadcasterEvent.Simulated, (event) => {
    log(
      FlashbotsBroadcasterEvent.Simulated,
      event.blockNumber,
      `Successful: ${event.successfulTransactions.length} Failed: ${
        event.revertedTransactions.length
      } Gas Price: ${event.gasPrice.toString()} Total gas used: ${event.totalGasUsed}`
    );
  });

  broadcaster.on(FlashbotsBroadcasterEvent.BundleResult, async (event) => {
    if ('reason' in event) {
      log(FlashbotsBroadcasterEvent.BundleResult, event.blockNumber, `Failed: ${event.reason}`);
    } else {
      try {
        const bundleItems = event.nftTransfers
          .map((transfer) => broadcaster.getBundleItemFromTransfer(transfer))
          .filter((bundleItem) => !!bundleItem) as BundleItem[];

        const matchOrdersFulfilledByBuyOrderHash = event.matchOrdersFulfilled.reduce(
          (acc: { [buyOrderHash: string]: MatchOrderFulfilledEvent[] }, order) => {
            const orderHash: string = order.buyOrderHash.toLowerCase();
            const ordersFulfilled = acc[orderHash] ?? [];
            return { ...acc, [orderHash]: [...ordersFulfilled, order] };
          },
          {}
        );

        const updates = bundleItems.map((bundleItem) => {
          const orderHash = 'orderHash' in bundleItem ? bundleItem.orderHash : bundleItem.buyOrderHash;
          const matchOrderEvents = matchOrdersFulfilledByBuyOrderHash[orderHash];
          const firstMatchOrderEvent = matchOrderEvents?.[0];
          const txHash = firstMatchOrderEvent?.txHash ?? '';
          const amount = matchOrderEvents.reduce(
            (sum: BigNumber, order: MatchOrderFulfilledEvent) => sum.add(BigNumber.from(order.amount)),
            BigNumber.from(0)
          );
          if (!txHash) {
            console.error(`No txHash for ${orderHash}`);
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

        await firestoreProvider.updateOrderMatches(
          updates.map((item) => ({ id: item.id, state: item.orderMatchState }))
        );
      } catch (err) {
        console.error(err);
      }
    }
  });
}
