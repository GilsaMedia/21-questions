import { app, db, config } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, deleteDoc,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { $, esc, ms, quizLabel, fmtDate, fmtShort, toast, loader } from './ui.js';

const $app = $('#app');
let cleanup = null;

// ---------- service worker, install & notifications ----------

const swReady = 'serviceWorker' in navigator
  ? navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).catch((e) => { console.warn(e); return null; })
  : Promise.resolve(null);

let installPrompt = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  renderExtras();
});

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

async function registerPush() {
  const { getMessaging, register, onRegistered, onUnregistered, onMessage } =
    await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging.js');
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

async function enableNotifications() {
  // Must be the first await: iOS only allows the prompt directly from a tap.
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
  renderExtras();
}

function renderExtras() {
  const slot = $('#extras');
  if (!slot) return;
  const parts = [];
  if (installPrompt) {
    parts.push('<button class="btn ghost-light" id="install">📲 התקנת האפליקציה במסך הבית</button>');
  }
  if (isIOS && !isStandalone) {
    parts.push(`<div class="card hint">
      <strong>📲 רוצים התראה כשיוצא חידון חדש?</strong>
      <p>לחצו על כפתור השיתוף <span class="share-glyph">⬆︎</span> בספארי ואז על <b>"הוספה למסך הבית"</b>. פתחו את האפליקציה מהמסך הבית והפעילו התראות.</p>
    </div>`);
  } else if (pushSupported) {
    if (Notification.permission === 'granted') {
      parts.push('<div class="pill">🔔 התראות פעילות</div>');
    } else if (Notification.permission === 'denied') {
      parts.push('<div class="pill muted">🔕 ההתראות חסומות בהגדרות הדפדפן</div>');
    } else {
      parts.push('<button class="btn ghost-light" id="notify">🔔 תודיעו לי כשיש חידון חדש</button>');
    }
  }
  slot.innerHTML = parts.join('');
  $('#notify', slot)?.addEventListener('click', enableNotifications);
  $('#install', slot)?.addEventListener('click', async () => {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    renderExtras();
  });
}

// ---------- data ----------

async function loadQuizzes() {
  const snap = await getDocs(collection(db, 'quizzes'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const questionCache = new Map();
async function loadQuestions(id) {
  if (questionCache.has(id)) return questionCache.get(id);
  const snap = await getDocs(query(collection(db, 'quizzes', id, 'questions'), orderBy('n')));
  const qs = snap.docs.map((d) => d.data());
  if (qs.length) questionCache.set(id, qs);
  return qs;
}

const progKey = (id) => `q21:progress:${id}`;
function getProgress(id) {
  try { return JSON.parse(localStorage.getItem(progKey(id))); } catch { return null; }
}
const saveProgress = (id, p) => localStorage.setItem(progKey(id), JSON.stringify(p));
const newProgress = () => ({ marks: {}, revealed: {}, current: 0, done: false });
const scoreOf = (p) => Object.values(p.marks).filter(Boolean).length;

function verdict(score, total) {
  const r = score / total;
  if (r === 1) return 'מושלם! 🏆';
  if (r >= 0.8) return 'מרשים מאוד! 🔥';
  if (r >= 0.6) return 'יפה מאוד 👏';
  if (r >= 0.4) return 'לא רע בכלל 🙂';
  return 'יהיה טוב בפעם הבאה 😅';
}

// ---------- home ----------

function progressStatus(q) {
  const p = getProgress(q.id);
  if (!p) return { label: 'בואו נתחיל', cls: 'new' };
  if (p.done) return { label: `${scoreOf(p)}/21`, cls: 'done', done: true };
  return { label: `המשך · ${Object.keys(p.marks).length}/21`, cls: 'progress' };
}

// Untitled quizzes are labelled "חידון #N" already, so the number badge would just repeat it.
const numBadge = (q) => (q.title?.trim() ? `<span class="badge">#${esc(q.number)}</span>` : '<span></span>');

function heroCard(q) {
  const st = progressStatus(q);
  return `<a class="card hero-card" href="#/quiz/${esc(q.id)}">
    <div class="hero-card-top">${numBadge(q)}<span class="date">${esc(fmtDate(q.publishAt))}</span></div>
    <h2>${esc(quizLabel(q))}</h2>
    ${st.done
      ? `<div class="hero-score"><span>${esc(st.label)}</span> נכונות · לתוצאות ←</div>`
      : `<span class="btn primary big">${esc(st.label)} ←</span>`}
  </a>`;
}

function archiveItem(q) {
  const st = progressStatus(q);
  return `<li><a class="archive-item" href="#/quiz/${esc(q.id)}">
    <span class="badge">#${esc(q.number)}</span>
    <span class="a-title">${esc(q.title?.trim() || 'חידון')}<small>${esc(fmtShort(q.publishAt))}</small></span>
    <span class="a-status ${st.cls}">${esc(st.done ? st.label : st.cls === 'new' ? 'חדש' : 'בתהליך')}</span>
  </a></li>`;
}

function startCountdown(target) {
  const el = $('#countdown');
  const tick = () => {
    const diff = target - Date.now();
    if (diff <= 0) { route(); return; }
    const d = Math.floor(diff / 864e5);
    const h = Math.floor(diff / 36e5) % 24;
    const m = Math.floor(diff / 6e4) % 60;
    const s = Math.floor(diff / 1e3) % 60;
    const pad = (n) => String(n).padStart(2, '0');
    el.textContent = d >= 2 ? `בעוד ${d} ימים` : `${d ? `${d} ימים ו־` : ''}${pad(h)}:${pad(m)}:${pad(s)}`;
  };
  tick();
  const t = setInterval(tick, 1000);
  cleanup = () => clearInterval(t);
}

async function renderHome() {
  const quizzes = await loadQuizzes();
  const now = Date.now();
  const published = quizzes.filter((q) => ms(q.publishAt) && ms(q.publishAt) <= now)
    .sort((a, b) => ms(b.publishAt) - ms(a.publishAt));
  const next = quizzes.filter((q) => ms(q.publishAt) > now)
    .sort((a, b) => ms(a.publishAt) - ms(b.publishAt))[0];
  const [latest, ...older] = published;

  $app.innerHTML = `
    <header class="hero">
      <div class="logo">21</div>
      <h1>שאלות</h1>
      <p class="tagline">חידון חדש פעם בשבועיים</p>
    </header>
    ${latest ? heroCard(latest) : '<section class="card empty">עוד אין חידון — בקרוב! ✨</section>'}
    ${next ? `<section class="card next">
      <div class="next-label">החידון הבא</div>
      <div class="next-when">${esc(fmtDate(next.publishAt))}</div>
      <div class="countdown" id="countdown"></div>
    </section>` : ''}
    <div id="extras" class="extras"></div>
    ${older.length ? `<h2 class="section-title">ארכיון</h2><ul class="archive">${older.map(archiveItem).join('')}</ul>` : ''}
  `;
  if (next) startCountdown(ms(next.publishAt));
  renderExtras();
}

// ---------- quiz ----------

function renderMessage(title, body) {
  $app.innerHTML = `<section class="card message">
    <h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}
    <a class="btn primary" href="#/">לדף הבית</a>
  </section>`;
}

async function renderQuiz(id) {
  $app.innerHTML = loader;
  const metaSnap = await getDoc(doc(db, 'quizzes', id));
  if (!metaSnap.exists()) return renderMessage('החידון לא נמצא');
  const meta = { id, ...metaSnap.data() };
  const locked = () => renderMessage('החידון עוד לא נפתח ⏳', meta.publishAt ? `הוא יתפרסם ${fmtDate(meta.publishAt)}` : '');
  if (!ms(meta.publishAt) || ms(meta.publishAt) > Date.now()) return locked();

  let qs;
  try {
    qs = await loadQuestions(id);
  } catch (e) {
    if (e.code === 'permission-denied') return locked();
    throw e;
  }
  if (!qs.length) return renderMessage('לא הצלחנו לטעון את השאלות', 'בדקו את החיבור לאינטרנט ונסו שוב.');

  const p = getProgress(id) || newProgress();
  if (p.done) return renderResults(meta, qs, p);
  showQuestion(meta, qs, p, Math.min(p.current, qs.length - 1));
}

function quizHeader(meta, right = '') {
  return `<header class="quiz-top">
    <a href="#/" class="icon-btn" aria-label="חזרה לדף הבית">→</a>
    <div class="quiz-title">${numBadge(meta)} ${esc(quizLabel(meta))}</div>
    <div class="qcount">${right}</div>
  </header>`;
}

function showQuestion(meta, qs, p, i, animate = true) {
  const q = qs[i];
  const total = qs.length;
  const revealed = !!p.revealed[i];
  const mark = p.marks[i];

  const dots = qs.map((_, j) => {
    const cls = [j === i && 'current', p.marks[j] === true && 'right', p.marks[j] === false && 'wrong'].filter(Boolean).join(' ');
    return `<button class="dot ${cls}" data-j="${j}" aria-label="שאלה ${j + 1}"></button>`;
  }).join('');

  $app.innerHTML = `<div class="quiz">
    ${quizHeader(meta, `${i + 1}/${total}`)}
    <div class="dots">${dots}</div>
    <article class="card qcard ${animate ? 'pop' : ''}">
      <div class="qnum">${i + 1}</div>
      ${q.image ? `<img class="qimg" src="${esc(q.image)}" alt="">` : ''}
      <p class="qtext">${esc(q.text)}</p>
      ${revealed ? `<div class="answer ${animate ? '' : 'reveal'}"><span class="answer-label">התשובה</span><p>${esc(q.answer)}</p></div>` : ''}
    </article>
    <div class="actions">
      ${revealed
        ? `<button class="btn good big ${mark === true ? 'selected' : ''}" id="right">✓ צדקתי</button>
           <button class="btn bad big ${mark === false ? 'selected' : ''}" id="wrong">✗ טעיתי</button>`
        : '<button class="btn primary big" id="reveal">חשפו את התשובה</button>'}
    </div>
    <nav class="qnav">
      <button class="link" id="prev" ${i === 0 ? 'disabled' : ''}>→ הקודמת</button>
      <span class="score-mini">${scoreOf(p)} נכונות</span>
      <button class="link" id="next" ${i === total - 1 ? 'disabled' : ''}>הבאה ←</button>
    </nav>
  </div>`;

  const go = (j) => { p.current = j; saveProgress(meta.id, p); showQuestion(meta, qs, p, j); };
  $app.querySelectorAll('.dot').forEach((b) => b.addEventListener('click', () => go(+b.dataset.j)));
  $('#prev').addEventListener('click', () => go(i - 1));
  $('#next').addEventListener('click', () => go(i + 1));
  $('#reveal')?.addEventListener('click', () => {
    p.revealed[i] = true;
    saveProgress(meta.id, p);
    showQuestion(meta, qs, p, i, false);
  });
  const markAs = (val) => {
    p.marks[i] = val;
    let nextI = -1;
    for (let k = 1; k <= total; k++) {
      const j = (i + k) % total;
      if (!(j in p.marks)) { nextI = j; break; }
    }
    if (nextI === -1) {
      p.done = true;
      saveProgress(meta.id, p);
      renderResults(meta, qs, p);
    } else {
      go(nextI);
    }
  };
  $('#right')?.addEventListener('click', () => markAs(true));
  $('#wrong')?.addEventListener('click', () => markAs(false));
}

function renderResults(meta, qs, p) {
  const total = qs.length;
  const score = scoreOf(p);
  window.scrollTo(0, 0);
  $app.innerHTML = `<div class="results">
    ${quizHeader(meta)}
    <section class="card score-card pop">
      <div class="ring" style="--pct:${(score / total) * 100}"><span>${score}</span><small>מתוך ${total}</small></div>
      <h2>${verdict(score, total)}</h2>
      <button class="btn primary" id="share">שתפו את התוצאה</button>
    </section>
    <h2 class="section-title">כל התשובות</h2>
    <ol class="review">
      ${qs.map((q, j) => `<li><button class="review-item ${p.marks[j] ? 'right' : 'wrong'}" data-j="${j}">
        <span class="rnum">${j + 1}</span>
        <span class="rbody"><span class="rq">${esc(q.text)}</span><span class="ra">${esc(q.answer)}</span></span>
        <span class="rmark">${p.marks[j] ? '✓' : '✗'}</span>
      </button></li>`).join('')}
    </ol>
    <button class="link danger center" id="reset">לאפס ולהתחיל מחדש</button>
  </div>`;

  $app.querySelectorAll('.review-item').forEach((b) => b.addEventListener('click', () => showQuestion(meta, qs, p, +b.dataset.j)));
  $('#share').addEventListener('click', async () => {
    const text = `קיבלתי ${score}/${total} ב"21 שאלות" — ${quizLabel(meta)} 🎯`;
    const url = location.href.split('#')[0];
    if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(`${text}\n${url}`);
      toast('הועתק — אפשר להדביק בוואטסאפ');
    }
  });
  $('#reset').addEventListener('click', () => {
    if (!confirm('למחוק את התשובות שלך לחידון הזה?')) return;
    localStorage.removeItem(progKey(meta.id));
    showQuestion(meta, qs, newProgress(), 0);
  });
}

// ---------- router ----------

async function route() {
  cleanup?.();
  cleanup = null;
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  window.scrollTo(0, 0);
  try {
    if (parts[0] === 'quiz' && parts[1]) {
      await renderQuiz(decodeURIComponent(parts[1]));
    } else if (parts[0] === 'admin') {
      $app.innerHTML = loader;
      const { renderAdmin } = await import('./admin.js');
      await renderAdmin($app, parts.slice(1));
    } else {
      await renderHome();
    }
  } catch (e) {
    console.error(e);
    $app.innerHTML = `<section class="card message">
      <h2>אופס, משהו השתבש</h2>
      <p>בדקו את החיבור לאינטרנט ונסו שוב.</p>
      <button class="btn primary" id="retry">נסו שוב</button>
    </section>`;
    $('#retry').addEventListener('click', route);
  }
}

addEventListener('hashchange', route);
route();

// Refresh the push registration on each visit so stale ones get replaced.
if (pushSupported && Notification.permission === 'granted') registerPush().catch(console.warn);
