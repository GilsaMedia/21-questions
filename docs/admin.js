import { app, db, config } from './firebase.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {
  collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, Timestamp,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { $, esc, ms, fmtDate, toast, loader } from './ui.js';

const TOTAL = 21;
const TWO_WEEKS = 14 * 864e5;
const MAX_IMAGE_CHARS = 350_000; // keeps each question doc well under Firestore's 1 MiB limit

const auth = getAuth(app);
if (config.useEmulators) connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });
const authReady = new Promise((resolve) => {
  const off = onAuthStateChanged(auth, () => { off(); resolve(); });
});

let unsaved = false;
addEventListener('beforeunload', (e) => { if (unsaved) e.preventDefault(); });

export async function renderAdmin($app, parts) {
  unsaved = false;
  await authReady;
  const user = auth.currentUser;
  if (!user) return renderLogin($app, parts);
  if (user.email?.toLowerCase() !== config.adminEmail.toLowerCase()) return renderDenied($app, user);
  if (parts[0] === 'edit') return renderEditor($app, parts[1] ? decodeURIComponent(parts[1]) : null);
  return renderList($app);
}

function renderLogin($app, parts) {
  $app.innerHTML = `<section class="card message">
    <h2>כניסת מנהל</h2>
    <p>המסך הזה מיועד רק למי שכותב את השאלות.</p>
    <button class="btn primary" id="login">התחברות עם Google</button>
    <a class="link" href="#/">חזרה לחידון</a>
  </section>`;
  $('#login').addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      renderAdmin($app, parts);
    } catch (e) {
      console.error(e);
      toast('ההתחברות נכשלה');
    }
  });
}

function renderDenied($app, user) {
  $app.innerHTML = `<section class="card message">
    <h2>אין הרשאה</h2>
    <p>החשבון ${esc(user.email)} לא מורשה לערוך חידונים.</p>
    <button class="btn" id="logout">התנתקות</button>
    <a class="link" href="#/">חזרה לחידון</a>
  </section>`;
  $('#logout').addEventListener('click', async () => { await signOut(auth); location.hash = '#/'; });
}

async function loadAll() {
  const snap = await getDocs(collection(db, 'quizzes'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.number || 0) - (a.number || 0));
}

function statusChip(q) {
  const t = ms(q.publishAt);
  if (!t) return '<span class="chip draft">טיוטה</span>';
  if (t > Date.now()) return `<span class="chip scheduled">מתוזמן · ${esc(fmtDate(q.publishAt))}</span>`;
  if (!q.notified) return '<span class="chip live">פורסם · התראה בדרך</span>';
  return '<span class="chip live">פורסם</span>';
}

async function renderList($app) {
  const quizzes = await loadAll();
  $app.innerHTML = `<div class="admin">
    <header class="admin-top">
      <h1>ניהול חידונים</h1>
      <div class="admin-actions">
        <a class="link" href="#/">לאפליקציה</a>
        <button class="link" id="logout">התנתקות</button>
      </div>
    </header>
    <a class="btn primary big" href="#/admin/edit">+ חידון חדש</a>
    <ul class="admin-list">
      ${quizzes.map((q) => `<li><a class="card admin-item" href="#/admin/edit/${esc(q.id)}">
        <span class="badge">#${esc(q.number)}</span>
        <span class="a-title">${esc(q.title?.trim() || 'חידון')}${statusChip(q)}</span>
        <span class="chev">←</span>
      </a></li>`).join('') || '<li class="card empty">עוד אין חידונים</li>'}
    </ul>
  </div>`;
  $('#logout').addEventListener('click', async () => { await signOut(auth); location.hash = '#/'; });
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
        if (out.length <= MAX_IMAGE_CHARS) return resolve(out);
        max = Math.round(max * 0.8);
        quality = Math.max(0.5, quality - 0.08);
      }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

async function renderEditor($app, id) {
  const all = await loadAll();
  const meta = id ? all.find((q) => q.id === id) : null;
  if (id && !meta) { toast('החידון לא נמצא'); location.hash = '#/admin'; return; }

  const qs = Array.from({ length: TOTAL }, (_, i) => ({ n: i + 1, text: '', answer: '', image: null }));
  if (id) {
    const snap = await getDocs(collection(db, 'quizzes', id, 'questions'));
    snap.forEach((d) => {
      const data = d.data();
      if (data.n >= 1 && data.n <= TOTAL) qs[data.n - 1] = { ...qs[data.n - 1], ...data };
    });
  }
  // A brand-new quiz writes all 21 docs; an existing one only the questions that changed.
  const dirty = new Set(id ? [] : qs.map((_, i) => i));
  const number = meta?.number ?? Math.max(0, ...all.map((q) => q.number || 0)) + 1;

  let defaultPublish = ms(meta?.publishAt);
  if (!meta) {
    const last = Math.max(0, ...all.map((q) => ms(q.publishAt) || 0));
    // setDate keeps the same local hour across daylight-saving changes.
    const next = new Date(last);
    next.setDate(next.getDate() + 14);
    if (last && next > Date.now()) defaultPublish = next.getTime();
  }
  const isLive = ms(meta?.publishAt) && ms(meta.publishAt) <= Date.now();

  const imgRow = (q) => `
    ${q.image ? `<img class="thumb" src="${esc(q.image)}" alt="">` : ''}
    <label class="btn small">📷 ${q.image ? 'החלפת תמונה' : 'הוספת תמונה'}<input type="file" accept="image/*" hidden></label>
    ${q.image ? '<button class="btn small ghost" data-act="rmimg">הסרה</button>' : ''}`;

  $app.innerHTML = `<div class="admin">
    <header class="admin-top">
      <a class="link" href="#/admin" id="back">→ כל החידונים</a>
      <h1>חידון #${esc(number)}</h1>
    </header>
    ${isLive ? '<div class="card warn">⚠️ החידון הזה כבר פורסם — שינויים יופיעו מיד אצל כולם.</div>' : ''}
    <section class="card form-card">
      <label>כותרת <small>(לא חובה)</small><input id="title" value="${esc(meta?.title || '')}" placeholder="חידון #${esc(number)}"></label>
      <label>מועד פרסום<input type="datetime-local" id="publishAt" value="${toLocalInput(defaultPublish)}"></label>
      <p class="hint">השאירו ריק כדי לשמור כטיוטה. בזמן הזה השאלות ייפתחו לכולם, וההתראה תצא תוך כ־10–15 דקות.</p>
    </section>
    <ol class="qedit-list">
      ${qs.map((q, i) => `<li class="card qedit" data-i="${i}">
        <div class="qedit-head"><span class="qnum small">${i + 1}</span></div>
        <label>שאלה<textarea data-f="text" rows="2">${esc(q.text)}</textarea></label>
        <label>תשובה<textarea data-f="answer" rows="1">${esc(q.answer)}</textarea></label>
        <div class="img-row">${imgRow(q)}</div>
      </li>`).join('')}
    </ol>
    ${id ? '<button class="link danger center" id="delete">מחיקת החידון</button>' : ''}
    <div class="savebar">
      <span id="filled"></span>
      <button class="btn" id="publish-now">פרסום עכשיו</button>
      <button class="btn primary" id="save">שמירה</button>
    </div>
  </div>`;

  const isFilled = (q) => q.text.trim() && q.answer.trim();
  const updateFilled = () => {
    const n = qs.filter(isFilled).length;
    $('#filled').textContent = `${n}/${TOTAL} מלאות`;
    $app.querySelectorAll('.qedit').forEach((li) => li.classList.toggle('filled', !!isFilled(qs[+li.dataset.i])));
  };
  updateFilled();

  const list = $('.qedit-list');
  list.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const i = +e.target.closest('.qedit').dataset.i;
    qs[i][f] = e.target.value;
    dirty.add(i);
    unsaved = true;
    updateFilled();
  });
  ['#title', '#publishAt'].forEach((s) => $(s).addEventListener('input', () => { unsaved = true; }));

  list.addEventListener('change', async (e) => {
    if (e.target.type !== 'file' || !e.target.files[0]) return;
    const li = e.target.closest('.qedit');
    const i = +li.dataset.i;
    try {
      qs[i].image = await compressImage(e.target.files[0]);
      dirty.add(i);
      unsaved = true;
      $('.img-row', li).innerHTML = imgRow(qs[i]);
    } catch {
      toast('לא הצלחנו לקרוא את התמונה');
    }
  });
  list.addEventListener('click', (e) => {
    if (e.target.dataset.act !== 'rmimg') return;
    const li = e.target.closest('.qedit');
    const i = +li.dataset.i;
    qs[i].image = null;
    dirty.add(i);
    unsaved = true;
    $('.img-row', li).innerHTML = imgRow(qs[i]);
  });

  $('#back').addEventListener('click', (e) => {
    if (unsaved && !confirm('יש שינויים שלא נשמרו. לצאת בכל זאת?')) e.preventDefault();
  });

  const buttons = ['#save', '#publish-now'].map((s) => $(s));
  async function save(publishNow) {
    const title = $('#title').value.trim();
    const localValue = $('#publishAt').value;
    let publishAt = localValue ? Timestamp.fromDate(new Date(localValue)) : null;
    const complete = qs.every(isFilled);

    if ((publishAt || publishNow) && !complete) {
      toast(`כדי לפרסם צריך למלא את כל ${TOTAL} השאלות והתשובות`);
      $app.querySelector('.qedit:not(.filled)')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    buttons.forEach((b) => { b.disabled = true; });
    $('#save').textContent = 'שומר…';
    try {
      const ref = id ? doc(db, 'quizzes', id) : doc(collection(db, 'quizzes'));
      await Promise.all([...dirty].map((i) => setDoc(doc(ref, 'questions', pad2(i + 1)), {
        n: i + 1, text: qs[i].text.trim(), answer: qs[i].answer.trim(), image: qs[i].image || null,
      })));
      // Questions first, metadata last: the quiz only shows up once its content is in place.
      const data = { number, title, publishAt, updatedAt: serverTimestamp() };
      if (!meta) data.createdAt = serverTimestamp();
      if (!meta || timeChanged) data.notified = false;
      await setDoc(ref, data, { merge: true });
      unsaved = false;
      toast(publishNow ? 'פורסם! 🎉' : publishAt ? 'נשמר ותוזמן ✓' : 'נשמר כטיוטה ✓');
      location.hash = '#/admin';
    } catch (e) {
      console.error(e);
      toast('השמירה נכשלה — נסו שוב');
      buttons.forEach((b) => { b.disabled = false; });
      $('#save').textContent = 'שמירה';
    }
  }
  $('#save').addEventListener('click', () => save(false));
  $('#publish-now').addEventListener('click', () => save(true));

  $('#delete')?.addEventListener('click', async () => {
    if (!confirm('למחוק את החידון לצמיתות?')) return;
    $app.innerHTML = loader;
    await Promise.all(qs.map((_, i) => deleteDoc(doc(db, 'quizzes', id, 'questions', pad2(i + 1)))));
    await deleteDoc(doc(db, 'quizzes', id));
    unsaved = false;
    toast('נמחק');
    location.hash = '#/admin';
  });
}
