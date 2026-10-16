import { initializeApp } from 'firebase/app';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
} from 'firebase/firestore';

// Defined by public/config.js, which the service worker shares.
export const config = window.APP_CONFIG;
export const app = initializeApp(config.firebase);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
if (config.useEmulators) connectFirestoreEmulator(db, location.hostname, 8080);
