import { getDb } from "./firestore";
import { FirestoreOrderTransactionProvider } from "./transaction/firestore-order-transaction.provider";
import { TransactionService } from "./transaction/transaction.service";

const db = getDb()
const firestoreProvider = new FirestoreOrderTransactionProvider(db);

const transactionService = new TransactionService([firestoreProvider]);

async function main() {
    await transactionService.start();
}

void main();