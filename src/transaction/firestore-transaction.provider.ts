import { TransactionProvider } from "./transaction.provider.abstract";


export class FirestoreTransactionProvider extends TransactionProvider {

    constructor(private query: FirebaseFirestore.Query) {
        super();
    }

    start(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    transactionReverted(id: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
}