// Run by .github/workflows/notify.yml every ~10 minutes.
// Sends one push notification for each quiz whose publish time has arrived.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const DAY = 864e5;
const STALE_CODES = new Set([
  'messaging/installation-id-not-registered',
  'messaging/registration-token-not-registered',
]);

const siteUrl = process.env.SITE_URL.replace(/\/?$/, '/');
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const messaging = getMessaging();

const now = Date.now();
const pending = await db.collection('quizzes').where('notified', '==', false).get();
const due = pending.docs
  .filter((d) => d.get('publishAt') && d.get('publishAt').toMillis() <= now)
  .sort((a, b) => b.get('publishAt').toMillis() - a.get('publishAt').toMillis());

if (!due.length) {
  console.log('No quizzes waiting for a notification.');
  process.exit(0);
}

// Only announce the newest one, and only if it went live recently (e.g. not after a long outage).
const [latest] = due;
if (now - latest.get('publishAt').toMillis() < DAY) {
  const fids = (await db.collection('pushRegs').select().get()).docs.map((d) => d.id);
  const title = latest.get('title')?.trim() || `חידון #${latest.get('number')}`;
  let sent = 0;
  for (let i = 0; i < fids.length; i += 500) {
    const chunk = fids.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      fids: chunk,
      notification: { title: '21 שאלות', body: `${title} כאן! 21 שאלות חדשות מחכות לך 🎯` },
      webpush: {
        notification: { icon: `${siteUrl}icons/icon-192.png`, dir: 'rtl', lang: 'he' },
        fcmOptions: { link: `${siteUrl}#/quiz/${latest.id}` },
      },
    });
    sent += res.successCount;
    await Promise.all(res.responses.map((r, j) => (
      !r.success && STALE_CODES.has(r.error?.code)
        ? db.collection('pushRegs').doc(chunk[j]).delete()
        : null
    )));
    res.responses.forEach((r) => { if (!r.success) console.warn(r.error?.code, r.error?.message); });
  }
  console.log(`"${title}": sent to ${sent}/${fids.length} devices.`);
} else {
  console.log(`"${latest.id}" went live over a day ago, skipping notification.`);
}

await Promise.all(due.map((d) => d.ref.update({ notified: true, notifiedAt: FieldValue.serverTimestamp() })));
