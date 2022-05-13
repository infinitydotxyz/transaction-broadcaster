import { TransactionProvider } from './transaction.provider.abstract';
import { firestoreConstants } from '@infinityxyz/lib/utils/constants';
import { FirestoreOrder, FirestoreOrderMatch, FirestoreOrderMatchStatus } from '@infinityxyz/lib/types/core';
import { TransactionProviderEvent } from './transaction.provider.interface';
import { providers } from 'ethers';

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

  private async handleOrderMatchUpdate(id: string, match: FirestoreOrderMatch): Promise<void> {
    try {
      if (match.status !== FirestoreOrderMatchStatus.Active) {
        throw new Error('Order match is not active');
      }

      const { listing, offer } = await this.getOrders(match);

      const transaction = this.createTransaction(listing, offer);

      // TODO send transaction to client
    } catch (err) {
      console.error(err);
    }
  }

  private createTransaction(listing: FirestoreOrder, offer: FirestoreOrder): providers.TransactionRequest {
    const order = {
      isSellOrder: listing.isSellOrder,
      signer: listing.signedOrder.signer,
      constraints: listing.signedOrder.constraints,
      nfts: listing.signedOrder.nfts, // TODO do I have to filter out nfts that are not part of the match?
      execParams: listing.signedOrder.execParams,
      extraParams: listing.signedOrder.extraParams,
      sig: listing.signedOrder.sig
    };
    return {
      to: listing.complicationAddress,
      gasLimit: 1_000_000,
      data: '', // TODO encode orders
      chainId: parseInt(listing.chainId)
    };
  }

  private handleOrderMatchDelete(id: string): void {
    this.emit(TransactionProviderEvent.Remove, { id });
  }

  private async getOrders(match: FirestoreOrderMatch): Promise<{ listing: FirestoreOrder; offer: FirestoreOrder }> {
    const orders = this.db.collection(
      firestoreConstants.ORDERS_COLL
    ) as FirebaseFirestore.CollectionReference<FirestoreOrder>;
    const listingRef = orders.doc(match.listingId);
    const offerRef = orders.doc(match.offerId);

    const [listingSnap, offerSnap] = (await this.db.getAll(
      listingRef,
      offerRef
    )) as FirebaseFirestore.DocumentSnapshot<FirestoreOrder>[];

    const listing = listingSnap.data();
    const offer = offerSnap.data();

    if (!listing || !offer) {
      throw new Error('Order not found');
    }

    return { listing, offer };
  }

  async transactionReverted(id: string): Promise<void> {
    try {
      await this.deleteOrderMatch(id);
    } catch (err) {
      console.error(err);
    }
  }

  private async deleteOrderMatch(id: string) {
    await this.db.collection(firestoreConstants.ORDER_MATCHES_COLL).doc(id).delete();
  }
}
