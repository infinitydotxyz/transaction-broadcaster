import { providers } from "ethers/lib/ethers";

export enum TransactionProviderEvent {
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
    [TransactionProviderEvent.Update]: UpdateTransactionEvent;
    [TransactionProviderEvent.Remove]: RemoveTransactionEvent;
  };
  

export interface TransactionProvider  {
    on<T extends TransactionProviderEvent>(event: T, listener: (event: GetTransactionEvent[T]) => void): void;

    off<T extends TransactionProviderEvent>(event: T, listener: (event: GetTransactionEvent[T]) => void): void;
  
    transactionReverted(id: string): Promise<void>;
}