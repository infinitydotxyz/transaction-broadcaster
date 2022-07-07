import * as EventEmitter from 'events';
import {
  GetTransactionEvent,
  TransactionProviderEvent,
  TransactionProvider as ITransactionProvider
} from './transaction.provider.interface';

export abstract class TransactionProvider implements ITransactionProvider {
  protected emitter: EventEmitter;
  constructor() {
    this.emitter = new EventEmitter();
  }

  on<T extends TransactionProviderEvent>(event: T, listener: (event: GetTransactionEvent[T]) => void): void {
    this.emitter.on(event, listener);
  }

  off<T extends TransactionProviderEvent>(event: T, listener: (event: GetTransactionEvent[T]) => void): void {
    this.emitter.off(event, listener);
  }

  protected emit<T extends TransactionProviderEvent>(event: T, data: GetTransactionEvent[T]) {
    this.emitter.emit(event, data);
  }

  abstract start(): Promise<void>;
}
