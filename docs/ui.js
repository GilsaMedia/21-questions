export const $ = (sel, root = document) => root.querySelector(sel);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const ms = (t) => t?.toMillis?.() ?? null;

export const quizLabel = (q) => q.title?.trim() || `חידון #${q.number}`;

const longFmt = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
});
const shortFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
export const fmtDate = (t) => (t ? longFmt.format(t.toDate ? t.toDate() : t) : '');
export const fmtShort = (t) => (t ? shortFmt.format(t.toDate ? t.toDate() : t) : '');

let toastTimer;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 300);
  }, 3200);
}

export const loader = '<div class="loader"></div>';
