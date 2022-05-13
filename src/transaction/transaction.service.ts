import { TransactionProvider as AbstractTransactionProvider } from './transaction.provider.abstract';
export class TransactionService extends AbstractTransactionProvider {
  constructor(private db: FirebaseFirestore.Firestore) {
    super();
  }

  start(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  transactionReverted(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
