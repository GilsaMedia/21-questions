import { useEffect, useRef, useState } from 'react';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, connectAuthEmulator,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { app, db, config } from '../firebase.js';
import { fmtDate, ms } from '../lib/format.js';
import { ErrorCard, Loader, MessageCard, NumBadge, navigate, toast, useLoad } from '../lib/ui.jsx';

const TOTAL = 21;
const MAX_IMAGE_CHARS = 350_000; // keeps each question doc well under Firestore's 1 MiB limit

const auth = getAuth(app);
if (config.useEmulators) connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });

// The UI check only decides which screen to show; firestore.rules enforces the same thing on the server.
async function roleOf(user) {
  const email = user.email?.toLowerCase();
  if (!email) return 'none';
  if (email === config.ownerEmail.toLowerCase()) return 'owner';
  try {
    return (await getDoc(doc(db, 'admins', email))).exists() ? 'admin' : 'none';
  } catch {
    return 'none';
  }
}

export default function Admin({ parts }) {
  const [session, setSession] = useState(null);
  useEffect(() => onAuthStateChanged(auth, async (user) => {
    setSession(user ? { user, role: await roleOf(user) } : { user: null });
  }), []);

  if (!session) return <Loader />;
  const { user, role } = session;
  if (!user) return <Login />;
  if (role === 'none') return <Denied user={user} />;
  if (parts[0] === 'edit') return <Editor key={parts[1] || 'new'} id={parts[1] || null} />;
  if (parts[0] === 'team' && role === 'owner') return <Team />;
  return <QuizList isOwner={role === 'owner'} />;
}

const logout = async () => { await signOut(auth); navigate('#/'); };

function Login() {
  const login = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      console.error(e);
      toast('ההתחברות נכשלה');
    }
  };
  return (
    <MessageCard title="כניסת מנהל" body="המסך הזה מיועד רק למי שכותב את השאלות.">
      <button className="btn primary" onClick={login}>התחברות עם Google</button>
      <a className="link" href="#/">חזרה לחידון</a>
    </MessageCard>
  );
}

function Denied({ user }) {
  return (
    <MessageCard title="אין הרשאה" body={`החשבון ${user.email} לא מורשה לערוך חידונים.`}>
      <button className="btn" onClick={logout}>התנתקות</button>
      <a className="link" href="#/">חזרה לחידון</a>
    </MessageCard>
  );
}

async function loadAll() {
  const snap = await getDocs(collection(db, 'quizzes'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.number || 0) - (a.number || 0));
}

function StatusChip({ quiz }) {
  const t = ms(quiz.publishAt);
  if (!t) return <span className="chip draft">טיוטה</span>;
  if (t > Date.now()) return <span className="chip scheduled">מתוזמן · {fmtDate(quiz.publishAt)}</span>;
  if (!quiz.notified) return <span className="chip live">פורסם · התראה בדרך</span>;
  return <span className="chip live">פורסם</span>;
}

function QuizList({ isOwner }) {
  const { data: quizzes, error, reload } = useLoad(loadAll, []);
  if (error) return <ErrorCard onRetry={reload} />;
  if (!quizzes) return <Loader />;
  return (
    <div className="admin">
      <header className="admin-top">
        <h1>ניהול חידונים</h1>
        <div className="admin-actions">
          {isOwner && <a className="link" href="#/admin/team">מנהלים</a>}
          <a className="link" href="#/">לאפליקציה</a>
          <button className="link" onClick={logout}>התנתקות</button>
        </div>
      </header>
      <a className="btn primary big" href="#/admin/edit">+ חידון חדש</a>
      <ul className="admin-list">
        {quizzes.length === 0 && <li className="card empty">עוד אין חידונים</li>}
        {quizzes.map((q) => (
          <li key={q.id}>
            <a className="card admin-item" href={`#/admin/edit/${q.id}`}>
              <NumBadge number={q.number} />
              <span className="a-title">{q.title?.trim() || 'חידון'}<StatusChip quiz={q} /></span>
              <span className="chev">←</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function loadAdmins() {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs.map((d) => d.id).sort();
}

function Team() {
  const { data: admins, error, reload } = useLoad(loadAdmins, []);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorCard onRetry={reload} />;
  if (!admins) return <Loader />;

  const add = async (e) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(clean)) return toast('כתובת המייל לא תקינה');
    if (clean === config.ownerEmail.toLowerCase() || admins.includes(clean)) return toast('הכתובת כבר ברשימה');
    setBusy(true);
    try {
      await setDoc(doc(db, 'admins', clean), { addedAt: serverTimestamp() });
      setEmail('');
      toast(`${clean} נוסף/ה כמנהל/ת ✓`);
      reload();
    } catch (err) {
      console.error(err);
      toast('ההוספה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (who) => {
    if (!confirm(`להסיר את ${who} מהמנהלים?`)) return;
    await deleteDoc(doc(db, 'admins', who));
    reload();
  };

  return (
    <div className="admin">
      <header className="admin-top">
        <a className="link" href="#/admin">→ כל החידונים</a>
        <h1>מנהלים</h1>
      </header>
      <section className="card form-card">
        <p className="hint">
          מנהלים יכולים ליצור, לערוך ולפרסם חידונים. רק את/ה יכול/ה להוסיף או להסיר מנהלים.
          הם נכנסים לאותו מסך ניהול עם חשבון ה-Google של המייל הזה.
        </p>
        <form className="add-admin" onSubmit={add}>
          <input
            type="email"
            dir="ltr"
            placeholder="name@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn primary" disabled={busy}>הוספה</button>
        </form>
      </section>
      <ul className="admin-list">
        <li className="card admin-item">
          <span className="a-title" dir="ltr">{config.ownerEmail}</span>
          <span className="chip live">בעלים</span>
        </li>
        {admins.map((a) => (
          <li key={a} className="card admin-item">
            <span className="a-title" dir="ltr">{a}</span>
            <button className="btn small ghost" onClick={() => remove(a)}>הסרה</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const pad2 = (n) => String(n).padStart(2, '0');
function toLocalInput(millis) {
  if (!millis) return '';
  const d = new Date(millis);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let max = 1200;
      let quality = 0.82;
      let out;
      for (let attempt = 0; attempt < 8; attempt++) {
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        out = canvas.toDataURL('image/jpeg', quality);
        if (out.length <= MAX_IMAGE_CHARS) break;
        max = Math.round(max * 0.8);
        quality = Math.max(0.5, quality - 0.08);
      }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

async function loadEditor(id) {
  const all = await loadAll();
  const meta = id ? all.find((q) => q.id === id) ?? null : null;
  const questions = Array.from({ length: TOTAL }, (_, i) => ({ n: i + 1, text: '', answer: '', image: null }));
  if (meta) {
    const snap = await getDocs(collection(db, 'quizzes', id, 'questions'));
    snap.forEach((d) => {
      const data = d.data();
      if (data.n >= 1 && data.n <= TOTAL) questions[data.n - 1] = { ...questions[data.n - 1], ...data };
    });
  }
  const number = meta?.number ?? Math.max(0, ...all.map((q) => q.number || 0)) + 1;
  let defaultPublish = ms(meta?.publishAt);
  if (!meta) {
    const last = Math.max(0, ...all.map((q) => ms(q.publishAt) || 0));
    // setDate keeps the same local hour across daylight-saving changes.
    const next = new Date(last);
    next.setDate(next.getDate() + 14);
    if (last && next > Date.now()) defaultPublish = next.getTime();
  }
  return { meta, questions, number, defaultPublish };
}

function Editor({ id }) {
  const { data, error, reload } = useLoad(() => loadEditor(id), [id]);
  if (error) return <ErrorCard onRetry={reload} />;
  if (!data) return <Loader />;
  if (id && !data.meta) return <MessageCard title="החידון לא נמצא"><a className="btn primary" href="#/admin">חזרה</a></MessageCard>;
  return <EditorForm id={id} {...data} />;
}

const isFilled = (q) => q.text.trim() && q.answer.trim();

function EditorForm({ id, meta, questions: initial, number, defaultPublish }) {
  const [title, setTitle] = useState(meta?.title || '');
  const [publishLocal, setPublishLocal] = useState(toLocalInput(defaultPublish));
  const [qs, setQs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  // A brand-new quiz writes all 21 docs; an existing one only the questions that changed.
  const dirty = useRef(new Set(id ? [] : initial.map((_, i) => i)));

  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (e) => e.preventDefault();
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const isLive = ms(meta?.publishAt) && ms(meta.publishAt) <= Date.now();
  const filledCount = qs.filter(isFilled).length;

  const update = (i, patch) => {
    setQs((prev) => prev.map((q, j) => (j === i ? { ...q, ...patch } : q)));
    dirty.current.add(i);
    setUnsaved(true);
  };

  const onImage = async (i, file) => {
    if (!file) return;
    try {
      update(i, { image: await compressImage(file) });
    } catch {
      toast('לא הצלחנו לקרוא את התמונה');
    }
  };

  async function save(publishNow) {
    let publishAt = publishLocal ? Timestamp.fromDate(new Date(publishLocal)) : null;
    if ((publishAt || publishNow) && filledCount < TOTAL) {
      toast(`כדי לפרסם צריך למלא את כל ${TOTAL} השאלות והתשובות`);
      document.querySelector('.qedit:not(.filled)')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const timeChanged = publishNow || ms(meta?.publishAt) !== ms(publishAt);
    if (publishNow) {
      if (!confirm('לפרסם את החידון עכשיו לכולם?')) return;
      publishAt = serverTimestamp();
    } else if (publishAt && timeChanged && ms(publishAt) <= Date.now()
      && !confirm('המועד שבחרת כבר עבר, אז החידון יתפרסם מיד. להמשיך?')) {
      return;
    }

    setSaving(true);
    try {
      const ref = id ? doc(db, 'quizzes', id) : doc(collection(db, 'quizzes'));
      await Promise.all([...dirty.current].map((i) => setDoc(doc(ref, 'questions', pad2(i + 1)), {
        n: i + 1, text: qs[i].text.trim(), answer: qs[i].answer.trim(), image: qs[i].image || null,
      })));
      // Questions first, metadata last: the quiz only shows up once its content is in place.
      const data = { number, title: title.trim(), publishAt, updatedAt: serverTimestamp() };
      if (!meta) data.createdAt = serverTimestamp();
      if (!meta || timeChanged) data.notified = false;
      await setDoc(ref, data, { merge: true });
      setUnsaved(false);
      toast(publishNow ? 'פורסם! 🎉' : publishAt ? 'נשמר ותוזמן ✓' : 'נשמר כטיוטה ✓');
      navigate('#/admin');
    } catch (e) {
      console.error(e);
      toast('השמירה נכשלה — נסו שוב');
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('למחוק את החידון לצמיתות?')) return;
    setSaving(true);
    await Promise.all(qs.map((_, i) => deleteDoc(doc(db, 'quizzes', id, 'questions', pad2(i + 1)))));
    await deleteDoc(doc(db, 'quizzes', id));
    setUnsaved(false);
    toast('נמחק');
    navigate('#/admin');
  }

  return (
    <div className="admin">
      <header className="admin-top">
        <a
          className="link"
          href="#/admin"
          onClick={(e) => { if (unsaved && !confirm('יש שינויים שלא נשמרו. לצאת בכל זאת?')) e.preventDefault(); }}
        >→ כל החידונים</a>
        <h1>חידון #{number}</h1>
      </header>

      {isLive && <div className="card warn">⚠️ החידון הזה כבר פורסם — שינויים יופיעו מיד אצל כולם.</div>}

      <section className="card form-card">
        <label>
          <span>כותרת <small>(לא חובה)</small></span>
          <input
            id="title"
            value={title}
            placeholder={`חידון #${number}`}
            onChange={(e) => { setTitle(e.target.value); setUnsaved(true); }}
          />
        </label>
        <label>
          מועד פרסום
          <input
            id="publishAt"
            type="datetime-local"
            value={publishLocal}
            onChange={(e) => { setPublishLocal(e.target.value); setUnsaved(true); }}
          />
        </label>
        <p className="hint">השאירו ריק כדי לשמור כטיוטה. בזמן הזה השאלות ייפתחו לכולם, וההתראה תצא תוך כ־10–15 דקות.</p>
      </section>

      <ol className="qedit-list">
        {qs.map((q, i) => (
          <li key={i} className={`card qedit ${isFilled(q) ? 'filled' : ''}`}>
            <div className="qedit-head"><span className="qnum small">{i + 1}</span></div>
            <label>
              שאלה
              <textarea data-f="text" rows={2} value={q.text} onChange={(e) => update(i, { text: e.target.value })} />
            </label>
            <label>
              תשובה
              <textarea data-f="answer" rows={1} value={q.answer} onChange={(e) => update(i, { answer: e.target.value })} />
            </label>
            <div className="img-row">
              {q.image && <img className="thumb" src={q.image} alt="" />}
              <label className="btn small">
                📷 {q.image ? 'החלפת תמונה' : 'הוספת תמונה'}
                <input type="file" accept="image/*" hidden onChange={(e) => { onImage(i, e.target.files[0]); e.target.value = ''; }} />
              </label>
              {q.image && <button className="btn small ghost" onClick={() => update(i, { image: null })}>הסרה</button>}
            </div>
          </li>
        ))}
      </ol>

      {id && <button className="link danger center" disabled={saving} onClick={remove}>מחיקת החידון</button>}

      <div className="savebar">
        <span id="filled">{filledCount}/{TOTAL} מלאות</span>
        <button className="btn" disabled={saving} onClick={() => save(true)}>פרסום עכשיו</button>
        <button className="btn primary" disabled={saving} onClick={() => save(false)}>{saving ? 'שומר…' : 'שמירה'}</button>
      </div>
    </div>
  );
}
