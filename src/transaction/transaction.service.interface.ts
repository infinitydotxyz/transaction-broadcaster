import { providers } from 'ethers/lib/ethers';

export enum TransactionServiceEvent {
  Update = 'transaction-updated',

  Remove = 'transaction-removed'
}

interface UpdateTransactionEvent {
  id: string;
  transaction: providers.TransactionRequest;
}

interface RemoveTransactionEvent {
  id: string;
}

type GetTransactionEvent = {
  [TransactionServiceEvent.Update]: UpdateTransactionEvent;
  [TransactionServiceEvent.Remove]: RemoveTransactionEvent;
};

export interface TransactionService {
  on<T extends TransactionServiceEvent>(event: T, listener: (event: GetTransactionEvent[T]) => void): void;

  off<T extends TransactionServiceEvent>(event: T, listener: (event: GetTransactionEvent[T]) => void): void;

  transactionReverted(id: string): Promise<void>;
}
