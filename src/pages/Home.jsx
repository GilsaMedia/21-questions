import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import { fmtDate, fmtShort, ms, quizLabel } from '../lib/format.js';
import { getProgress, scoreOf } from '../lib/progress.js';
import {
  enableNotifications, isIOS, isStandalone, promptInstall, pushSupported, useInstallPrompt,
} from '../lib/push.js';
import { ErrorCard, Loader, NumBadge, useLoad } from '../lib/ui.jsx';

export async function loadQuizzes() {
  const snap = await getDocs(collection(db, 'quizzes'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function progressStatus(q) {
  const p = getProgress(q.id);
  if (!p) return { label: 'בואו נתחיל', short: 'חדש', cls: 'new' };
  if (p.done) return { label: `${scoreOf(p)}/21`, short: `${scoreOf(p)}/21`, cls: 'done', done: true };
  return { label: `המשך · ${Object.keys(p.marks).length}/21`, short: 'בתהליך', cls: 'progress' };
}

export default function Home() {
  const { data: quizzes, error, reload } = useLoad(loadQuizzes, []);
  if (error) return <ErrorCard onRetry={reload} />;
  if (!quizzes) return <Loader />;

  const now = Date.now();
  const published = quizzes.filter((q) => ms(q.publishAt) && ms(q.publishAt) <= now)
    .sort((a, b) => ms(b.publishAt) - ms(a.publishAt));
  const next = quizzes.filter((q) => ms(q.publishAt) > now)
    .sort((a, b) => ms(a.publishAt) - ms(b.publishAt))[0];
  const [latest, ...older] = published;

  return (
    <>
      <header className="hero">
        <div className="logo">21</div>
        <h1>שאלות</h1>
        <p className="tagline">חידון חדש פעם בשבועיים</p>
      </header>

      {latest ? <HeroCard quiz={latest} /> : <section className="card empty">עוד אין חידון — בקרוב! ✨</section>}

      {next && (
        <section className="card next">
          <div className="next-label">החידון הבא</div>
          <div className="next-when">{fmtDate(next.publishAt)}</div>
          <Countdown target={ms(next.publishAt)} onDone={reload} />
        </section>
      )}

      <Extras />

      {older.length > 0 && (
        <>
          <h2 className="section-title">ארכיון</h2>
          <ul className="archive">
            {older.map((q) => {
              const st = progressStatus(q);
              return (
                <li key={q.id}>
                  <a className="archive-item" href={`#/quiz/${q.id}`}>
                    <NumBadge number={q.number} />
                    <span className="a-title">{q.title?.trim() || 'חידון'}<small>{fmtShort(q.publishAt)}</small></span>
                    <span className={`a-status ${st.cls}`}>{st.short}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

function HeroCard({ quiz }) {
  const st = progressStatus(quiz);
  return (
    <a className="card hero-card" href={`#/quiz/${quiz.id}`}>
      <div className="hero-card-top">
        {/* Untitled quizzes are already labelled "חידון #N", so the badge would only repeat it. */}
        {quiz.title?.trim() ? <NumBadge number={quiz.number} /> : <span />}
        <span className="date">{fmtDate(quiz.publishAt)}</span>
      </div>
      <h2>{quizLabel(quiz)}</h2>
      {st.done
        ? <div className="hero-score"><span>{st.label}</span> נכונות · לתוצאות ←</div>
        : <span className="btn primary big">{st.label} ←</span>}
    </a>
  );
}

const pad = (n) => String(n).padStart(2, '0');
function Countdown({ target, onDone }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = target - now;
  useEffect(() => { if (diff <= 0) onDone(); }, [diff <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = Math.floor(diff / 864e5);
  const h = Math.floor(diff / 36e5) % 24;
  const m = Math.floor(diff / 6e4) % 60;
  const s = Math.floor(diff / 1e3) % 60;
  let text;
  if (diff <= 0) text = '';
  else if (d >= 2) text = `בעוד ${d} ימים`;
  else text = `${d ? `${d} ימים ו־` : ''}${pad(h)}:${pad(m)}:${pad(s)}`;
  return <div className="countdown">{text}</div>;
}

function Extras() {
  const installPrompt = useInstallPrompt();
  const [perm, setPerm] = useState(pushSupported ? Notification.permission : null);

  let notifications = null;
  if (isIOS && !isStandalone) {
    notifications = (
      <div className="card hint">
        <strong>📲 רוצים התראה כשיוצא חידון חדש?</strong>
        <p>
          לחצו על כפתור השיתוף <span className="share-glyph">⬆︎</span> בספארי ואז על <b>"הוספה למסך הבית"</b>.
          פתחו את האפליקציה מהמסך הבית והפעילו התראות.
        </p>
      </div>
    );
  } else if (perm === 'granted') {
    notifications = <div className="pill">🔔 התראות פעילות</div>;
  } else if (perm === 'denied') {
    notifications = <div className="pill muted">🔕 ההתראות חסומות בהגדרות הדפדפן</div>;
  } else if (perm === 'default') {
    notifications = (
      <button className="btn ghost-light" onClick={async () => setPerm(await enableNotifications())}>
        🔔 תודיעו לי כשיש חידון חדש
      </button>
    );
  }

  return (
    <div className="extras">
      {installPrompt && <button className="btn ghost-light" onClick={promptInstall}>📲 התקנת האפליקציה במסך הבית</button>}
      {notifications}
    </div>
  );
}
