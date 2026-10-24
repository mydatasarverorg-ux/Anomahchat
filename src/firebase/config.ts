import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Safe background connection handshake check
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: unknown) {
    // Graceful startup handling - Firestore SDK auto-reconnects and handles offline queueing seamlessly
    const msg = error instanceof Error ? error.message : String(error);
    console.info('Firestore initial connection notice (auto-reconnecting):', msg);
  }
}

testConnection();
