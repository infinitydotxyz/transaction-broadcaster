import firebaseAdmin, { ServiceAccount } from 'firebase-admin';
import * as serviceAccount from '../creds/nftc-infinity-firebase.json';

let db: FirebaseFirestore.Firestore;

export function getDb(): firebaseAdmin.firestore.Firestore {
  if (!db) {
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount as ServiceAccount)
    });
    db = firebaseAdmin.firestore();
  }

  return db;
}
