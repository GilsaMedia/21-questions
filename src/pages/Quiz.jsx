import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase.js';
import { fmtDate, ms, quizLabel } from '../lib/format.js';
import {
  clearProgress, getProgress, newProgress, saveProgress, scoreOf, verdict,
} from '../lib/progress.js';
import { ErrorCard, Loader, MessageCard, NumBadge, toast, useLoad } from '../lib/ui.jsx';

const questionCache = new Map();

async function loadQuiz(id) {
  const metaSnap = await getDoc(doc(db, 'quizzes', id));
  if (!metaSnap.exists()) return { status: 'missing' };
  const meta = { id, ...metaSnap.data() };
  if (!ms(meta.publishAt) || ms(meta.publishAt) > Date.now()) return { status: 'locked', meta };

  let questions = questionCache.get(id);
  if (!questions) {
    try {
      const snap = await getDocs(query(collection(db, 'quizzes', id, 'questions'), orderBy('n')));
      questions = snap.docs.map((d) => d.data());
    } catch (e) {
      // The server's clock decides; ours may be a little ahead.
      if (e.code === 'permission-denied') return { status: 'locked', meta };
      throw e;
    }
    if (!questions.length) return { status: 'empty' };
    questionCache.set(id, questions);
  }
  return { status: 'ready', meta, questions };
}

export default function Quiz({ id }) {
  const { data, error, reload } = useLoad(() => loadQuiz(id), [id]);
  if (error) return <ErrorCard onRetry={reload} />;
  if (!data) return <Loader />;
  if (data.status === 'missing') return <MessageCard title="החידון לא נמצא" />;
  if (data.status === 'empty') return <MessageCard title="לא הצלחנו לטעון את השאלות" body="בדקו את החיבור לאינטרנט ונסו שוב." />;
  if (data.status === 'locked') {
    const when = data.meta.publishAt ? `הוא יתפרסם ${fmtDate(data.meta.publishAt)}` : '';
    return <MessageCard title="החידון עוד לא נפתח ⏳" body={when} />;
  }
  return <Player meta={data.meta} questions={data.questions} />;
}

function Player({ meta, questions }) {
  const total = questions.length;
  const [p, setP] = useState(() => getProgress(meta.id) || newProgress());
  // null = results screen
  const [index, setIndex] = useState(() => (p.done ? null : Math.min(p.current, total - 1)));
  const [justRevealed, setJustRevealed] = useState(null);
  useEffect(() => { scrollTo(0, 0); }, [index]);

  const commit = (next) => { saveProgress(meta.id, next); setP(next); };
  const goTo = (j) => { commit({ ...p, current: j }); setIndex(j); };

  const reveal = () => {
    commit({ ...p, revealed: { ...p.revealed, [index]: true } });
    setJustRevealed(index);
  };

  const markAs = (val) => {
    const marks = { ...p.marks, [index]: val };
    let nextI = null;
    for (let k = 1; k <= total; k++) {
      const j = (index + k) % total;
      if (!(j in marks)) { nextI = j; break; }
    }
    if (nextI === null) commit({ ...p, marks, done: true });
    else commit({ ...p, marks, current: nextI });
    setIndex(nextI);
  };

  const reset = () => {
    if (!confirm('למחוק את התשובות שלך לחידון הזה?')) return;
    clearProgress(meta.id);
    setP(newProgress());
    setIndex(0);
  };

  if (index === null) return <Results meta={meta} questions={questions} p={p} onOpen={setIndex} onReset={reset} />;

  const q = questions[index];
  const revealed = !!p.revealed[index];
  const mark = p.marks[index];

  return (
    <div className="quiz">
      <QuizHeader meta={meta} right={`${index + 1}/${total}`} />
      <div className="dots">
        {questions.map((_, j) => (
          <button
            key={j}
            className={['dot', j === index && 'current', p.marks[j] === true && 'right', p.marks[j] === false && 'wrong'].filter(Boolean).join(' ')}
            aria-label={`שאלה ${j + 1}`}
            onClick={() => goTo(j)}
          />
        ))}
      </div>

      <article className="card qcard pop" key={index}>
        <div className="qnum">{index + 1}</div>
        {q.image && <img className="qimg" src={q.image} alt="" />}
        <p className="qtext">{q.text}</p>
        {revealed && (
          <div className={`answer ${justRevealed === index ? 'reveal' : ''}`}>
            <span className="answer-label">התשובה</span>
            <p>{q.answer}</p>
          </div>
        )}
      </article>

      <div className="actions">
        {revealed ? (
          <>
            <button className={`btn good big ${mark === true ? 'selected' : ''}`} onClick={() => markAs(true)}>✓ צדקתי</button>
            <button className={`btn bad big ${mark === false ? 'selected' : ''}`} onClick={() => markAs(false)}>✗ טעיתי</button>
          </>
        ) : (
          <button className="btn primary big" onClick={reveal}>חשפו את התשובה</button>
        )}
      </div>

      <nav className="qnav">
        <button className="link" disabled={index === 0} onClick={() => goTo(index - 1)}>→ הקודמת</button>
        <span className="score-mini">{scoreOf(p)} נכונות</span>
        <button className="link" disabled={index === total - 1} onClick={() => goTo(index + 1)}>הבאה ←</button>
      </nav>
    </div>
  );
}

function QuizHeader({ meta, right }) {
  return (
    <header className="quiz-top">
      <a href="#/" className="icon-btn" aria-label="חזרה לדף הבית">→</a>
      <div className="quiz-title">{meta.title?.trim() && <NumBadge number={meta.number} />} {quizLabel(meta)}</div>
      <div className="qcount">{right}</div>
    </header>
  );
}

function Results({ meta, questions, p, onOpen, onReset }) {
  const total = questions.length;
  const score = scoreOf(p);

  const share = async () => {
    const text = `קיבלתי ${score}/${total} ב"21 שאלות" — ${quizLabel(meta)} 🎯`;
    const url = location.href.split('#')[0];
    if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(`${text}\n${url}`);
      toast('הועתק — אפשר להדביק בוואטסאפ');
    }
  };

  return (
    <div className="results">
      <QuizHeader meta={meta} />
      <section className="card score-card pop">
        <div className="ring" style={{ '--pct': (score / total) * 100 }}>
          <span>{score}</span><small>מתוך {total}</small>
        </div>
        <h2>{verdict(score, total)}</h2>
        <button className="btn primary" onClick={share}>שתפו את התוצאה</button>
      </section>

      <h2 className="section-title">כל התשובות</h2>
      <ol className="review">
        {questions.map((q, j) => (
          <li key={j}>
            <button className={`review-item ${p.marks[j] ? 'right' : 'wrong'}`} onClick={() => onOpen(j)}>
              <span className="rnum">{j + 1}</span>
              <span className="rbody"><span className="rq">{q.text}</span><span className="ra">{q.answer}</span></span>
              <span className="rmark">{p.marks[j] ? '✓' : '✗'}</span>
            </button>
          </li>
        ))}
      </ol>
      <button className="link danger center" onClick={onReset}>לאפס ולהתחיל מחדש</button>
    </div>
  );
}
