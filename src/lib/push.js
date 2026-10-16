import { useSyncExternalStore } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { app, db, config } from '../firebase.js';
import { toast } from './ui.jsx';

export const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const pushSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

const swReady = 'serviceWorker' in navigator
  ? navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready)
    .catch((e) => { console.warn(e); return null; })
  : Promise.resolve(null);

// ---------- Android/desktop install prompt ----------

let installPrompt = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  emit();
});

export function useInstallPrompt() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => installPrompt);
}

export async function promptInstall() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  emit();
}

// ---------- push notifications ----------

export async function registerPush() {
  const { getMessaging, register, onRegistered, onUnregistered, onMessage } = await import('firebase/messaging');
  const reg = await swReady;
  if (!reg) throw new Error('no service worker');
  const messaging = getMessaging(app);
  onRegistered(messaging, (fid) => {
    setDoc(doc(db, 'pushRegs', fid), { updatedAt: serverTimestamp() }).catch(console.error);
  });
  onUnregistered(messaging, (fid) => deleteDoc(doc(db, 'pushRegs', fid)).catch(console.error));
  onMessage(messaging, (p) => toast(p.notification?.body || 'יש חידון חדש!'));
  await register(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: reg });
}

// Returns the resulting permission. Must run straight from a tap: iOS refuses the prompt otherwise.
export async function enableNotifications() {
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    try {
      await registerPush();
      toast('מעולה! נודיע לך כשיתפרסם חידון חדש 🔔');
    } catch (e) {
      console.error(e);
      toast('לא הצלחנו להפעיל התראות. נסו שוב מאוחר יותר.');
    }
  }
  return perm;
}

// Refresh the registration on each visit so stale ones get replaced.
if (pushSupported && Notification.permission === 'granted') registerPush().catch(console.warn);
