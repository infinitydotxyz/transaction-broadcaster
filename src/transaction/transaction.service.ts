import { TransactionProvider as AbstractTransactionProvider } from './transaction.provider.abstract';
import { TransactionProvider as ITransactionProvider, TransactionProviderEvent } from './transaction.provider.interface';
export class TransactionService extends AbstractTransactionProvider {
  constructor(private transactionProviders: ITransactionProvider[]) {
    super();
  }

  async start(): Promise<void> {
    for(const provider of this.transactionProviders) {
      for(const eventType of Object.values(TransactionProviderEvent)) {
        provider.on(eventType, (event) => {
          this.emit(eventType, event); 
        });
      }
    }

    await Promise.all(this.transactionProviders.map(provider => provider.start()));
    return;
  }

  transactionReverted(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
