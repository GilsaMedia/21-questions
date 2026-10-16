// Each player's answers live only in their own browser.
const key = (id) => `q21:progress:${id}`;

export function getProgress(id) {
  try { return JSON.parse(localStorage.getItem(key(id))); } catch { return null; }
}
export const saveProgress = (id, p) => localStorage.setItem(key(id), JSON.stringify(p));
export const clearProgress = (id) => localStorage.removeItem(key(id));
export const newProgress = () => ({ marks: {}, revealed: {}, current: 0, done: false });
export const scoreOf = (p) => Object.values(p.marks).filter(Boolean).length;

export function verdict(score, total) {
  const r = score / total;
  if (r === 1) return 'מושלם! 🏆';
  if (r >= 0.8) return 'מרשים מאוד! 🔥';
  if (r >= 0.6) return 'יפה מאוד 👏';
  if (r >= 0.4) return 'לא רע בכלל 🙂';
  return 'יהיה טוב בפעם הבאה 😅';
}
