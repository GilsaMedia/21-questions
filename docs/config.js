// Shared by the page (<script src>) and the service worker (importScripts).
// Fill these in from the Firebase console — see README.md.
self.APP_CONFIG = {
  firebase: {
    apiKey: 'REPLACE_ME',
    authDomain: 'REPLACE_ME.firebaseapp.com',
    projectId: 'REPLACE_ME',
    storageBucket: 'REPLACE_ME.firebasestorage.app',
    messagingSenderId: 'REPLACE_ME',
    appId: 'REPLACE_ME',
  },
  // Firebase console → Project settings → Cloud Messaging → Web Push certificates
  vapidKey: 'REPLACE_ME',
  // Only used to pick which screen to show; firestore.rules is what actually enforces it.
  adminEmail: 'REPLACE_ME@gmail.com',
  // Set to true only when running against the local Firebase emulators.
  useEmulators: false,
};
