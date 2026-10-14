import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import { DESIGN_CODE_IDS, designCode, isDesignCodeId, type DesignCodeId } from '../../design/elements/codes';
import { EXERCISE_CHAPTERS, EXERCISE_TOPICS, exerciseTopic } from '../../design/exercises/catalog';
import type { ExerciseValues } from '../../design/exercises/types';
import type { UnitSystem } from '../../design/exercises/units';
import { FStructureMark } from '../../design-system/brand';
import { useWorkspaceUI } from '../../store/ProjectContext';
import { readCalcState, writeCalcState, type CalcState } from './calcStorage';
import { ExerciseView } from './ExerciseView';
import { CALC_PIECES, type CalcPiece } from './pieces';
import './calc.css';

// El taller completo (y su peso) llega sólo si se abre «Piezas».
const PiecesView = lazy(() => import('./PiecesView'));

interface CalcUrl { topic: string | null; find: string | null; piece: CalcPiece | null }

const readUrl = (): CalcUrl => {
  const params = new URLSearchParams(window.location.search);
  const piece = params.get('piece');
  return {
    topic: exerciseTopic(params.get('topic'))?.id ?? null,
    find: params.get('find'),
    piece: CALC_PIECES.includes(piece as CalcPiece) ? piece as CalcPiece : null,
  };
};

const writeUrl = (next: CalcUrl) => {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(next)) {
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  }
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
};

const usePhone = () => {
  const query = '(max-width: 759px)';
  const [phone, setPhone] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const change = () => setPhone(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  return phone;
};

/**
 * Cálculo: el apartado de ejercicios y cálculos rápidos.
 *
 * Cada tema se resuelve por separado, como en un libro de concreto: eliges qué
 * buscas (revisar con todos los datos o diseñar con incógnitas), capturas los
 * datos y la solución aparece paso a paso. Nada de esto toca el proyecto
 * abierto; las piezas completas sueltas también viven aquí.
 */
export function CalcPage({ onOpenHome }: { onOpenHome: () => void }) {
  const { theme, setTheme } = useWorkspaceUI();
  const phone = usePhone();
  const [url, setUrl] = useState<CalcUrl>(readUrl);
  const [state, setState] = useState<CalcState>(readCalcState);
  const [saveFailed, setSaveFailed] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const update = useCallback((next: Partial<CalcUrl>) => {
    setUrl((current) => {
      const merged = { ...current, ...next };
      writeUrl(merged);
      return merged;
    });
  }, []);
  useEffect(() => { writeUrl(url); }, [url]);

  const persist = useCallback((next: CalcState) => {
    setState(next);
    setSaveFailed(!writeCalcState(next));
  }, []);

  const topic = exerciseTopic(url.topic) ?? (phone ? undefined : EXERCISE_TOPICS.find((item) => item.chapter === 'Flexión'));
  const problem = topic ? topic.problems.find((item) => item.id === url.find) ?? topic.problems[0]! : undefined;
  const values: ExerciseValues = problem ? state.drafts[problem.id] ?? problem.examples[0]?.values ?? {} : {};
  const code = state.code;
  const piecesOpen = url.piece !== null;

  const openTopic = (id: string) => {
    update({ topic: id, find: null, piece: null });
    mainRef.current?.scrollTo({ top: 0 });
  };

  const byChapter = useMemo(() => EXERCISE_CHAPTERS.map((chapter) => ({ chapter, topics: EXERCISE_TOPICS.filter((item) => item.chapter === chapter) })), []);

  const index = <nav className="fc-index" aria-label="Temas">
    {byChapter.map(({ chapter, topics }) => <section key={chapter} className="fc-index__chapter" aria-labelledby={`fc-ch-${chapter}`}>
      <h2 id={`fc-ch-${chapter}`} className="fc-index__title">{chapter}</h2>
      <ul className="fc-index__list">
        {topics.map((item) => <li key={item.id}>
          <button type="button" className="fc-index__item" aria-current={!piecesOpen && topic?.id === item.id ? 'page' : undefined} onClick={() => openTopic(item.id)}>
            <span className="fc-index__text"><strong>{item.title}</strong><small>{item.problems.map((entry) => entry.find.symbol).join(' · ')}</small></span>
            <ChevronRight className="fc-index__go" size={16} aria-hidden="true" />
          </button>
        </li>)}
      </ul>
    </section>)}
  </nav>;

  return <main className="fc" data-testid="calc" data-view={piecesOpen ? 'pieces' : 'exercises'}>
    <header className="fc-bar">
      <button type="button" className="fc-home" onClick={onOpenHome} aria-label="Volver al Inicio" title="Inicio">
        <FStructureMark size={24} />
        <span className="fc-home__text"><strong>Cálculo</strong><small>Ejercicios y piezas sueltas</small></span>
      </button>
      <div className="fc-tabs" role="tablist" aria-label="Apartado de Cálculo">
        <button type="button" role="tab" aria-selected={!piecesOpen} onClick={() => update({ piece: null })}>Ejercicios</button>
        <button type="button" role="tab" aria-selected={piecesOpen} onClick={() => update({ piece: url.piece ?? topic?.piece ?? 'beam' })}>Piezas</button>
      </div>
      <div className="fc-prefs">
        {!piecesOpen ? <label className="fc-select" title={designCode(code).summary}>
          <span className="fc-visually-hidden">Norma</span>
          <select aria-label="Norma de diseño" value={code} onChange={(event) => { const next = event.currentTarget.value; if (isDesignCodeId(next)) persist({ ...state, code: next as DesignCodeId }); }}>
            {DESIGN_CODE_IDS.map((id) => <option key={id} value={id}>{designCode(id).name}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label> : null}
        {!piecesOpen ? <div className="fc-segmented" role="group" aria-label="Unidades">
          {(['kgf', 'si'] as const).map((item: UnitSystem) => <button key={item} type="button" aria-pressed={state.units === item} onClick={() => persist({ ...state, units: item })}>{item === 'kgf' ? 'kgf' : 'SI'}</button>)}
        </div> : null}
        <button type="button" className="fc-icon-button" aria-label="Cambiar tema" title="Cambiar tema" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
        </button>
      </div>
    </header>

    {saveFailed ? <p className="fc-banner" role="status">Los ejercicios de esta sesión no se guardan en este navegador (almacenamiento lleno, privado o con un guardado de otra versión que se conserva).</p> : null}

    {piecesOpen ? <div className="fc-pieces-wrap">
      <Suspense fallback={<div className="fc-loading" role="status" aria-label="Cargando el taller" />}>
        <PiecesView piece={url.piece!} />
      </Suspense>
    </div> : <div className="fc-layout" data-detail={topic ? '' : undefined}>
      {!phone || !topic ? <aside className="fc-aside">
        {phone ? <div className="fc-intro">
          <h1 className="fc-title">Cálculo</h1>
          <p className="fc-lead">Ejercicios sueltos, como en el libro: elige un tema, di qué buscas y captura los datos. La solución aparece paso a paso.</p>
        </div> : null}
        {index}
      </aside> : null}
      {topic && problem ? <div className="fc-main" ref={mainRef}>
        {phone ? <button type="button" className="fc-back" onClick={() => update({ topic: null, find: null })}><ChevronLeft size={18} aria-hidden="true" />Temas</button> : null}
        <ExerciseView topic={topic} problem={problem} values={values} units={state.units} code={code}
          onProblem={(id) => update({ topic: topic.id, find: id })}
          onValues={(next) => persist({ ...state, drafts: { ...state.drafts, [problem.id]: next } })}
          onOpenPiece={(piece) => update({ piece })} />
      </div> : null}
    </div>}
  </main>;
}
