export const ms = (t) => t?.toMillis?.() ?? null;

export const quizLabel = (q) => q.title?.trim() || `חידון #${q.number}`;

const longFmt = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
});
const shortFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
const toDate = (t) => (t.toDate ? t.toDate() : t);
export const fmtDate = (t) => (t ? longFmt.format(toDate(t)) : '');
export const fmtShort = (t) => (t ? shortFmt.format(toDate(t)) : '');
