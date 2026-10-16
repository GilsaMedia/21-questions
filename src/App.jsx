import { lazy, Suspense, useEffect } from 'react';
import Home from './pages/Home.jsx';
import Quiz from './pages/Quiz.jsx';
import { Loader, Toast, useRoute } from './lib/ui.jsx';
import './lib/push.js';

// Players never download the admin screen (or Firebase Auth).
const Admin = lazy(() => import('./pages/Admin.jsx'));

export default function App() {
  const [page, ...rest] = useRoute();
  useEffect(() => { scrollTo(0, 0); }, [page, rest[0]]);

  let content;
  if (page === 'quiz' && rest[0]) content = <Quiz key={rest[0]} id={rest[0]} />;
  else if (page === 'admin') content = <Admin parts={rest} />;
  else content = <Home />;

  return (
    <>
      <Suspense fallback={<Loader />}>{content}</Suspense>
      <Toast />
    </>
  );
}
