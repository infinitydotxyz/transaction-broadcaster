import { providers } from "ethers";

enum BroadcasterEvent {
    TransactionReverted = 'transaction-reverted',
    TransactionSucceeded = 'transaction-succeeded',
}

interface TransactionRevertedEvent {
    id: string;

    tx: providers.TransactionRequest;
}


interface TransactionSubmittedEvent {
    id: string;

    tx: providers.TransactionRequest;

    receipt: providers.TransactionReceipt;
}

interface ChainBroadcaster {
    start(): void | Promise<void>;

    stop(): Promise<void>;

    add(id: string, tx: providers.TransactionRequest): void;

    remove(id: string): void;
}