import { TransactionProvider } from './transaction.provider.abstract';
import { firestoreConstants } from '@infinityxyz/lib/utils/constants';
import {
  ChainId,
  ChainNFTs,
  ChainOBOrder,
  FirestoreOrder,
  FirestoreOrderItemMatch,
  FirestoreOrderMatch,
  FirestoreOrderMatchStatus
} from '@infinityxyz/lib/types/core';
import { TransactionProviderEvent } from './transaction.provider.interface';
import { Contract, providers } from 'ethers';
import { infinityExchangeAbi } from '../abi/infinity-exchange.abi';
import { getProvider } from '../ethers';
import { getExchangeAddress } from '@infinityxyz/lib/utils/orders';

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
      await this.deleteOrderMatch(id);
    } catch (err) {
      console.error(err);
    }
  }

  async transactionCompleted(id: string): Promise<void> {
    try {
      await this.deleteOrderMatch(id);
      // TODO should we mark the order as invalid that it's been fulfilled?
      // TODO how do we know that this has been completed and it wasn't just skipped??
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
      const matches = await this.getMatchItems(match.id);
      const transaction = await this.createTransaction(listing, offer, match, matches);

      this.emit(TransactionProviderEvent.Update, { id, transaction });
    } catch (err) {
      console.error(err);
    }
  }

  private async createTransaction(
    listing: FirestoreOrder,
    offer: FirestoreOrder,
    match: FirestoreOrderMatch,
    matches: FirestoreOrderItemMatch[]
  ): Promise<providers.TransactionRequest> {
    const chainNfts: ChainNFTs[] = [];

    for (const { listing, offer } of matches) {
      const address = listing.collectionAddress;

      let collectionChainNfts = chainNfts.find((item) => item.collection === address);
      if (!collectionChainNfts) {
        collectionChainNfts = {
          collection: address,
          tokens: []
        };
        chainNfts.push(collectionChainNfts);
      }

      const tokenId = listing.tokenId || offer.tokenId;
      const quantity = listing.numTokens ?? offer.numTokens;

      collectionChainNfts.tokens.push({
        tokenId: tokenId,
        numTokens: quantity
      });
    }
    const constructed: ChainOBOrder = {
      isSellOrder: true,
      signer: listing.signedOrder.signer,
      constraints: [
        matches.length,
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

    const provider = getProvider(listing.chainId as ChainId);
    const exchange = getExchangeAddress(listing.chainId);
    if (!exchange) {
      throw new Error(`Invalid chain id. Exchange not supported`);
    }
    const contract = new Contract(exchange, infinityExchangeAbi, provider);
    const sells = [listing.signedOrder];
    const buys = [offer.signedOrder];
    const orders = [constructed];
    const tradingRewards = false;
    const feeDiscountEnabled = false;
    const args = [sells, buys, orders, tradingRewards, feeDiscountEnabled]; // TODO remove trading rewards and fee discount enabled
    const fn = contract.interface.getFunction('matchOrders');
    const data = contract.interface.encodeFunctionData(fn, args);

    const estimate = await provider.estimateGas({
      to: exchange,
      data
    });

    const gasLimit = estimate.toNumber();

    return {
      to: exchange,
      gasLimit: gasLimit,
      data,
      chainId: parseInt(listing.chainId)
    };
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

  private async getMatchItems(matchId: string): Promise<FirestoreOrderItemMatch[]> {
    const matchRef = this.db.collection(firestoreConstants.ORDER_MATCHES_COLL).doc(matchId);

    const matchItemsRef = matchRef.collection(firestoreConstants.ORDER_MATCH_ITEMS_SUB_COLL);

    const matchItems = await matchItemsRef.get();

    return matchItems.docs.map((item) => item.data() as FirestoreOrderItemMatch);
  }

  private async deleteOrderMatch(id: string) {
    const batch = this.db.batch();
    const matchRef = this.db.collection(firestoreConstants.ORDER_MATCHES_COLL).doc(id);
    const matchItems = await matchRef.collection(firestoreConstants.ORDER_MATCH_ITEMS_SUB_COLL).listDocuments();
    for (const matchItem of matchItems) {
      batch.delete(matchItem);
    }
    batch.delete(matchRef);
    await batch.commit();
  }
}
