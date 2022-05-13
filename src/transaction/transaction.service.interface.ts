import { providers } from 'ethers/lib/ethers';

export enum TransactionServiceEvent {
  Update = 'transaction-updated',

  Remove = 'transaction-removed'
}

export interface UpdateTransactionEvent {
  id: string;
  transaction: providers.TransactionRequest;
}

export interface RemoveTransactionEvent {
  id: string;
}

export type GetTransactionEvent = {
  [TransactionServiceEvent.Update]: UpdateTransactionEvent;
  [TransactionServiceEvent.Remove]: RemoveTransactionEvent;
};

export interface TransactionService {
  on<T extends TransactionServiceEvent>(event: T, listener: (event: GetTransactionEvent[T]) => void): void;

  off<T extends TransactionServiceEvent>(event: T, listener: (event: GetTransactionEvent[T]) => void): void;

  transactionReverted(id: string): Promise<void>;
}
