import { useCallback, useEffect, useState } from 'react';

// ---------- routing (hash based, so it works on GitHub Pages without server config) ----------

const parseHash = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

export function useRoute() {
  const [parts, setParts] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setParts(parseHash());
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return parts;
}

export const navigate = (path) => { location.hash = path; };

// ---------- async data ----------

export function useLoad(load, deps) {
  const [state, setState] = useState({ data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ data: null, error: null });
    load().then(
      (data) => alive && setState({ data, error: null }),
      (error) => { console.error(error); if (alive) setState({ data: null, error }); },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  const reload = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, reload };
}

// ---------- toast ----------

export const toast = (msg) => dispatchEvent(new CustomEvent('q21-toast', { detail: msg }));

export function Toast() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  useEffect(() => {
    let hide;
    const onToast = (e) => {
      setMsg(e.detail);
      setShow(true);
      clearTimeout(hide);
      hide = setTimeout(() => setShow(false), 3200);
    };
    addEventListener('q21-toast', onToast);
    return () => { removeEventListener('q21-toast', onToast); clearTimeout(hide); };
  }, []);
  return <div id="toast" role="status" className={show ? 'show' : ''}>{msg}</div>;
}

// ---------- shared bits ----------

export const Loader = () => <div className="loader" />;

export function MessageCard({ title, body, children }) {
  return (
    <section className="card message">
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {children ?? <a className="btn primary" href="#/">לדף הבית</a>}
    </section>
  );
}

export function ErrorCard({ onRetry }) {
  return (
    <MessageCard title="אופס, משהו השתבש" body="בדקו את החיבור לאינטרנט ונסו שוב.">
      <button className="btn primary" onClick={onRetry}>נסו שוב</button>
    </MessageCard>
  );
}

export const NumBadge = ({ number }) => <span className="badge">#{number}</span>;
