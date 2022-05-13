import * as EventEmitter from 'events';
import {
  GetTransactionEvent,
  TransactionService as ITransactionService,
  TransactionServiceEvent
} from './transaction.service.interface';

export class TransactionService implements ITransactionService {
  private emitter: EventEmitter;
  constructor() {
    this.emitter = new EventEmitter();
  }

  on<T extends TransactionServiceEvent>(event: T, listener: (event: GetTransactionEvent[T]) => void): void {
    this.emitter.on(event, listener);
  }

  off<T extends TransactionServiceEvent>(event: T, listener: (event: GetTransactionEvent[T]) => void): void {
    this.emitter.off(event, listener);
  }

  transactionReverted(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
