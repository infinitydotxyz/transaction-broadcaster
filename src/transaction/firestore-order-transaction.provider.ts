import { TransactionProvider } from './transaction.provider.abstract';
import { firestoreConstants } from '@infinityxyz/lib/utils/constants';
import {
  ChainId,
  ChainNFTs,
  ChainOBOrder,
  FirestoreOrder,
  FirestoreOrderMatch,
  FirestoreOrderMatchStatus
} from '@infinityxyz/lib/types/core';
import { TransactionProviderEvent } from './transaction.provider.interface';
import { getExchangeAddress } from '@infinityxyz/lib/utils/orders';
import { BundleItem, BundleType } from '../flashbots-broadcaster/bundle.types';

export class FirestoreOrderTransactionProvider extends TransactionProvider {
  constructor(private db: FirebaseFirestore.Firestore) {
    super();
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false;
      this.db
        .collection(firestoreConstants.ORDER_MATCHES_COLL)
        .where('status', '==', FirestoreOrderMatchStatus.Active)
        .onSnapshot((snapshot) => {
          if (!resolved) {
            resolve();
            resolved = true;
          }
          const changes = snapshot.docChanges();
          for (const change of changes) {
            const ref = change.doc.ref;
            const match = change.doc.data() as FirestoreOrderMatch;
            switch (change.type) {
              case 'added':
              case 'modified':
                this.handleOrderMatchUpdate(ref.id, match).catch(console.error);
                break;
              case 'removed':
                this.handleOrderMatchDelete(ref.id);
                break;
            }
          }
        });
    });
  }

  async transactionReverted(id: string): Promise<void> {
    try {
      // TODO handle orders that are no longer valid
      await this.deleteOrderMatch(id);
    } catch (err) {
      console.error(err);
    }
  }

  async transactionCompleted(id: string): Promise<void> {
    try {
      await this.deleteOrderMatch(id);
      // TODO should we mark the order as invalid once it has been fulfilled?
      // TODO how do we know that this has been completed and it wasn't just skipped?
    } catch (err) {
      console.error(err);
    }
  }

  private async handleOrderMatchUpdate(id: string, match: FirestoreOrderMatch): Promise<void> {
    try {
      if (match.status !== FirestoreOrderMatchStatus.Active) {
        throw new Error('Order match is not active');
      }

      const { listing, offer } = await this.getOrders(match);
      const bundleItem = this.createBundleItem(listing, offer, match);

      this.emit(TransactionProviderEvent.Update, { id, item: bundleItem });
    } catch (err) {
      console.error(err);
    }
  }

  private createBundleItem(listing: FirestoreOrder, offer: FirestoreOrder, match: FirestoreOrderMatch): BundleItem {
    const chainNfts: ChainNFTs[] = [];
    let numMatches = 0;
    const collections = Object.values(match.collections);
    for (const collection of collections) {
      let collectionNumMatches = 0;
      const tokens = Object.values(collection.tokens);
      const collectionChainNfts: ChainNFTs = {
        collection: collection.collectionAddress,
        tokens: []
      };
      for (const token of tokens) {
        collectionChainNfts.tokens.push({
          tokenId: token.tokenId,
          numTokens: token.numTokens
        });
        collectionNumMatches += 1;
      }
      chainNfts.push(collectionChainNfts);

      if (collectionNumMatches === 0) {
        collectionNumMatches += 1;
      }

      numMatches += collectionNumMatches;
    }

    const constructed: ChainOBOrder = {
      /**
       * refunding gas fees is done in WETH and paid by the buyer
       * therefore constructed isSellOrder needs to be the buy order side
       */
      isSellOrder: false,
      signer: listing.signedOrder.signer,
      constraints: [
        numMatches,
        offer.signedOrder.constraints[1],
        offer.signedOrder.constraints[2],
        offer.signedOrder.constraints[3],
        offer.signedOrder.constraints[4],
        offer.minBpsToSeller,
        offer.nonce
      ],
      nfts: chainNfts,
      execParams: [listing.complicationAddress, listing.currencyAddress],
      extraParams: [],
      sig: listing.signedOrder.sig
    };

    const bundle: BundleItem = {
      id: `${listing.id}-${offer.id}`,
      chainId: listing.chainId as ChainId,
      bundleType: BundleType.MatchOrders,
      exchangeAddress: getExchangeAddress(listing.chainId),
      sell: listing.signedOrder,
      buy: offer.signedOrder,
      buyOrderHash: offer.id,
      sellOrderHash: listing.id,
      constructed
    };
    return bundle;
  }

  private handleOrderMatchDelete(id: string): void {
    this.emit(TransactionProviderEvent.Remove, { id });
  }

  private async getOrders(match: FirestoreOrderMatch): Promise<{ listing: FirestoreOrder; offer: FirestoreOrder }> {
    const ordersCollectionRef = this.db.collection(
      firestoreConstants.ORDERS_COLL
    ) as FirebaseFirestore.CollectionReference<FirestoreOrder>;

    const orderRefs = match.ids.map((id) => ordersCollectionRef.doc(id));
    const orderSnaps = (await this.db.getAll(...orderRefs)) as FirebaseFirestore.DocumentSnapshot<FirestoreOrder>[];

    const orders = orderSnaps.map((item) => item.data() as FirestoreOrder);
    const listings = orders.filter((item) => item.isSellOrder === true);
    const offers = orders.filter((item) => item.isSellOrder === false);

    const listing = listings?.[0];
    const offer = offers?.[0];

    if (!listing || !offer) {
      throw new Error('Order not found');
    }
    if (listings.length > 1 || offers.length > 1) {
      throw new Error(`Multiple orders are not yet supported`);
    }

    return { listing, offer };
  }

  private async deleteOrderMatch(id: string) {
    const matchRef = this.db.collection(firestoreConstants.ORDER_MATCHES_COLL).doc(id);
    await matchRef.delete();
  }
}
