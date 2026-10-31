import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Silence internal SDK offline & timeout warnings so temporary network/proxy handshakes
// do not emit unhandled console errors in cloud preview environments
setLogLevel('silent');

// Initialize Firestore with persistent multi-tab cache and long polling
// Using experimentalForceLongPolling skips WebSocket streaming probes that trigger 10s timeout warnings in iframes
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    experimentalForceLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();


