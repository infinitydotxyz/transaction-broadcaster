import { TransactionProvider } from './transaction.provider.abstract';
import { firestoreConstants } from '@infinityxyz/lib/utils/constants';
import {
  ChainId,
  ChainNFTs,
  ChainOBOrder,
  FirestoreOrder,
  FirestoreOrderMatch,
  FirestoreOrderMatchMethod,
  FirestoreOrderMatchOneToMany,
  FirestoreOrderMatchOneToOne,
  FirestoreOrderMatchStatus,
  OrderMatchState
} from '@infinityxyz/lib/types/core';
import { TransactionProviderEvent } from './transaction.provider.interface';
import { getExchangeAddress } from '@infinityxyz/lib/utils/orders';
import {
  BundleItem,
  BundleType,
  MatchOrdersBundleItem,
  MatchOrdersOneToManyBundleItem,
  MatchOrdersOneToOneBundleItem
} from '../flashbots-broadcaster/bundle.types';
import { BigNumber } from 'ethers';
import { orderHash } from '../utils/order-hash';
import { formatUnits } from 'ethers/lib/utils';

export class FirestoreOrderTransactionProvider extends TransactionProvider {
  constructor(private db: FirebaseFirestore.Firestore) {
    super();
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false;
      const query = this.db
        .collection(firestoreConstants.ORDER_MATCHES_COLL)
        .where('state.status', '==', FirestoreOrderMatchStatus.Active);
      query.onSnapshot(
        (snapshot) => {
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
                this.handleOrderMatchRemoved(ref.id);
                break;
            }
          }
        },
        (err) => {
          console.error(err);
        }
      );
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

  async updateOrderMatch(id: string, state: Partial<OrderMatchState>, batch?: FirebaseFirestore.WriteBatch) {
    const matchRef = this.db.collection(firestoreConstants.ORDER_MATCHES_COLL).doc(id);
    if (batch) {
      batch.set(matchRef, { state }, { merge: true });
    } else {
      await matchRef.set({ state }, { merge: true });
    }
  }

  async updateOrderMatches(updates: { id: string; state: Partial<OrderMatchState> }[]) {
    const batch = this.db.batch();
    for (const { id, state } of updates) {
      await this.updateOrderMatch(id, state, batch);
    }
    await batch.commit();
  }

  private async handleOrderMatchUpdate(id: string, match: FirestoreOrderMatch): Promise<void> {
    try {
      if (match.state.status !== FirestoreOrderMatchStatus.Active) {
        throw new Error('Order match is not active');
      }
      const { listings, offers } = await this.getOrders(match);
      const bundleItem = this.createBundleItem(id, listings, offers, match);

      this.emit(TransactionProviderEvent.Update, { id, item: bundleItem });
    } catch (err) {
      console.error(err);
    }
  }

  private createBundleItem(
    id: string,
    listings: FirestoreOrder[],
    offers: FirestoreOrder[],
    match: FirestoreOrderMatch | FirestoreOrderMatchOneToOne | FirestoreOrderMatchOneToMany
  ): BundleItem {
    const chainNfts: ChainNFTs[] = [];
    let numMatches = 0;
    const collections = Object.values(match.matchData.orderItems);

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

    switch (match.type) {
      case FirestoreOrderMatchMethod.MatchOrders: {
        const listing = listings[0];
        const offer = offers[0];
        if (listings.length !== 1 || !listing || !offer || offers.length !== 1) {
          throw new Error(
            `Invalid match orders data. Expected one listing and one offer. Received ${listings.length} listings and ${offers.length} offers.`
          );
        }
        return this.getMatchOrdersBundle(id, listing, offer, numMatches, chainNfts);
      }
      case FirestoreOrderMatchMethod.MatchOneToOneOrders: {
        const listing = listings[0];
        const offer = offers[0];
        if (listings.length !== 1 || !listing || !offer || offers.length !== 1) {
          throw new Error(
            `Invalid match orders data. Expected one listing and one offer. Received ${listings.length} listings and ${offers.length} offers.`
          );
        }
        const bundleItem: MatchOrdersOneToOneBundleItem = {
          id,
          chainId: listing.chainId as ChainId,
          bundleType: BundleType.MatchOrdersOneToOne,
          exchangeAddress: getExchangeAddress(listing.chainId),
          sell: listing.signedOrder,
          buy: offer.signedOrder,
          buyOrderHash: orderHash(offer.signedOrder),
          sellOrderHash: orderHash(listing.signedOrder),
          maxGasPriceGwei: parseFloat(formatUnits(offer.maxGasPriceWei, 'gwei'))
        };
        return bundleItem;
      }
      case FirestoreOrderMatchMethod.MatchOneToManyOrders: {
        let order: ChainOBOrder;
        let manyOrders: ChainOBOrder[] = [];
        if (listings.length === 1) {
          order = listings[0].signedOrder;
          manyOrders = offers.map((offer) => offer.signedOrder);
        } else {
          order = offers[0].signedOrder;
          manyOrders = listings.map((listing) => listing.signedOrder);
        }

        if (!order || manyOrders.length === 0) {
          throw new Error(
            `Invalid match orders data. Expected a single order and multiple matching orders. Received ${listings.length} listings and ${offers.length} offers.`
          );
        }
        const minMaxGasPriceGweiOfOffers = Math.min(
          ...offers.map((item) => parseFloat(formatUnits(item.maxGasPriceWei, 'gwei')))
        );
        const maxGasPriceGwei = minMaxGasPriceGweiOfOffers * offers.length;

        const bundleItem: MatchOrdersOneToManyBundleItem = {
          id,
          chainId: match.chainId,
          bundleType: BundleType.MatchOrdersOneToMany,
          exchangeAddress: getExchangeAddress(match.chainId),
          order,
          manyOrders,
          orderHash: orderHash(order),
          manyOrderHashes: manyOrders.map(orderHash),
          maxGasPriceGwei
        };
        return bundleItem;
      }
      default:
        throw new Error(`Unknown match type: ${(match as any)?.type}`);
    }
  }

  private getMatchOrdersBundle(
    id: string,
    listing: FirestoreOrder,
    offer: FirestoreOrder,
    numMatches: number,
    chainNfts: ChainNFTs[]
  ) {
    const constructed: ChainOBOrder = {
      /**
       * refunding gas fees is done in WETH and paid by the buyer
       * therefore constructed isSellOrder needs to be the buy order side
       */
      isSellOrder: false,
      signer: listing.signedOrder.signer,
      constraints: [
        numMatches,
        BigNumber.from(offer.signedOrder.constraints[1]).toString(),
        BigNumber.from(offer.signedOrder.constraints[2]).toString(),
        offer.signedOrder.constraints[3],
        offer.signedOrder.constraints[4],
        offer.nonce,
        offer.signedOrder.constraints[6]
      ],
      nfts: chainNfts,
      execParams: [listing.complicationAddress, listing.currencyAddress],
      extraParams: listing.signedOrder.extraParams,
      sig: listing.signedOrder.sig
    };

    listing.signedOrder.constraints = listing.signedOrder.constraints.map((item) => BigNumber.from(item).toString());
    offer.signedOrder.constraints = offer.signedOrder.constraints.map((item) => BigNumber.from(item).toString());
    const bundleItem: MatchOrdersBundleItem = {
      id,
      chainId: listing.chainId as ChainId,
      bundleType: BundleType.MatchOrders,
      exchangeAddress: getExchangeAddress(listing.chainId),
      sell: listing.signedOrder,
      buy: offer.signedOrder,
      buyOrderHash: orderHash(offer.signedOrder),
      sellOrderHash: orderHash(listing.signedOrder),
      constructed,
      maxGasPriceGwei: parseFloat(formatUnits(offer.maxGasPriceWei, 'gwei'))
    };

    return bundleItem;
  }

  private handleOrderMatchRemoved(id: string): void {
    this.emit(TransactionProviderEvent.Remove, { id });
  }

  private async getOrders(
    match: FirestoreOrderMatch
  ): Promise<{ listings: FirestoreOrder[]; offers: FirestoreOrder[] }> {
    const ordersCollectionRef = this.db.collection(
      firestoreConstants.ORDERS_COLL
    ) as FirebaseFirestore.CollectionReference<FirestoreOrder>;

    const orderRefs = match.ids.map((id) => ordersCollectionRef.doc(id));
    const orderSnaps = (await this.db.getAll(...orderRefs)) as FirebaseFirestore.DocumentSnapshot<FirestoreOrder>[];

    const orders = orderSnaps.map((item) => item.data() as FirestoreOrder);
    const listings = orders.filter((item) => item?.isSellOrder === true);
    const offers = orders.filter((item) => item?.isSellOrder === false);

    const listing = listings?.[0];
    const offer = offers?.[0];

    if (!listing || listings.length < 1 || !offer || offers.length < 1) {
      throw new Error(`Failed to find at least one listing and one offer for order ${match.id}`);
    }

    return { listings, offers };
  }

  private async deleteOrderMatch(id: string) {
    const matchRef = this.db.collection(firestoreConstants.ORDER_MATCHES_COLL).doc(id);
    await matchRef.delete();
  }
}
