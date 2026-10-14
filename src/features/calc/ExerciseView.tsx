import { ArrowUpRight, Check, Copy, Eraser, Printer, X } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { context as exerciseContext } from '../../design/exercises/common';
import type { ExerciseOutcome, ExerciseProblem, ExerciseSolution, ExerciseTopic, ExerciseValues } from '../../design/exercises/types';
import { formatQuantity, type UnitSystem } from '../../design/exercises/units';
import { designCode, type DesignCodeId } from '../../design/elements/codes';
import { ExerciseFigure } from './ExerciseFigure';
import { QuantityInput } from './QuantityInput';

const MODE_LABEL = { check: 'Revisar', design: 'Diseñar', analysis: 'Analizar' } as const;
const PIECE_LABEL = { beam: 'Viga completa', column: 'Columna completa', footing: 'Zapata completa', flexure: 'Sección a flexión', section: 'Estudio de sección' } as const;

/** Texto plano de la solución para copiar o pegar en un cuaderno. */
function solutionText(topic: ExerciseTopic, problem: ExerciseProblem, statement: string, solution: ExerciseSolution, units: UnitSystem, code: DesignCodeId) {
  const q = (value: number, kind: Parameters<typeof formatQuantity>[1]) => formatQuantity(units, kind, value);
  return [
    `${topic.chapter} · ${topic.title} — ${problem.find.label} (${designCode(code).name})`,
    '',
    statement,
    '',
    ...solution.steps.flatMap((step, index) => [
      `${index + 1}. ${step.title}`,
      ...step.lines.map((line) => `   ${[line.formula, line.substitution, line.result ? `${line.result.symbol} = ${q(line.result.value, line.result.kind)}` : '', line.note].filter(Boolean).join('  ·  ')}`),
    ]),
    '',
    'Resultado:',
    ...solution.answers.map((answer) => `   ${answer.symbol} = ${answer.text ?? q(answer.value, answer.kind)}  (${answer.label})`),
    ...solution.checks.map((check) => `   [${check.status === 'pass' ? 'cumple' : check.status === 'fail' ? 'no cumple' : 'nota'}] ${check.label}: ${check.detail}`),
    '',
    'FStructure · Cálculo experimental; requiere revisión profesional.',
  ].join('\n');
}

export function ExerciseView({ topic, problem, values, units, code, onProblem, onValues, onOpenPiece }: {
  topic: ExerciseTopic;
  problem: ExerciseProblem;
  values: ExerciseValues;
  units: UnitSystem;
  code: DesignCodeId;
  onProblem: (id: string) => void;
  onValues: (values: ExerciseValues) => void;
  onOpenPiece?: (piece: NonNullable<ExerciseTopic['piece']>) => void;
}) {
  const context = useMemo(() => exerciseContext(code, units), [code, units]);
  const outcome: ExerciseOutcome = useMemo(() => {
    try { return problem.solve(values, context); } catch (error) { return { status: 'invalid', message: error instanceof Error ? error.message : 'No se pudo resolver.' }; }
  }, [problem, values, context]);
  const statement = useMemo(() => problem.statement(values, context).replace(/—( [^\s,.;)]+)?/g, '…'), [problem, values, context]);
  const [copied, setCopied] = useState(false);
  const empty = problem.fields.every((field) => values[field.id] === undefined);

  const copy = async () => {
    if (outcome.status !== 'solved') return;
    try {
      await navigator.clipboard.writeText(solutionText(topic, problem, statement, outcome.solution, units, code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { setCopied(false); }
  };

  return <article className="fc-exercise" key={`${topic.id}:${problem.id}`}>
    <header className="fc-exercise__head">
      <p className="fc-eyebrow">{topic.chapter}</p>
      <h1 className="fc-title">{topic.title}</h1>
      <p className="fc-lead">{topic.summary}</p>
      {topic.problems.length > 1 ? <div className="fc-find" role="radiogroup" aria-label="¿Qué buscas?">
        <span className="fc-find__label" aria-hidden="true">¿Qué buscas?</span>
        {topic.problems.map((item) => <button key={item.id} type="button" role="radio" aria-checked={item.id === problem.id}
          className="fc-find__option" onClick={() => onProblem(item.id)}>
          <strong>{item.find.symbol}</strong>
          <span>{item.find.label}</span>
          <small>{MODE_LABEL[item.mode]}</small>
        </button>)}
      </div> : <p className="fc-find-single"><strong>{problem.find.symbol}</strong> {problem.find.label} · <span>{MODE_LABEL[problem.mode]}</span></p>}
    </header>

    <div className="fc-work">
      <section className="fc-data" aria-labelledby="fc-data-title">
        <div className="fc-card fc-statement">
          <h2 className="fc-card__title">Enunciado</h2>
          <p>{statement}</p>
          <div className="fc-examples" role="group" aria-label="Cargar datos">
            {problem.examples.map((example) => <button key={example.id} type="button" className="fc-chip" onClick={() => onValues({ ...example.values })}>{example.label}</button>)}
            {!empty ? <button type="button" className="fc-chip fc-chip--quiet" onClick={() => onValues({})}><Eraser size={14} aria-hidden="true" />Datos en blanco</button> : null}
          </div>
        </div>
        <form className="fc-card fc-fields" onSubmit={(event) => event.preventDefault()} noValidate>
          <h2 id="fc-data-title" className="fc-card__title">Datos</h2>
          {problem.fields.map((field) => <QuantityInput key={field.id} field={field} units={units} value={values[field.id]}
            onChange={(next) => onValues({ ...values, [field.id]: next })} />)}
        </form>
      </section>

      <section className="fc-solution" aria-labelledby="fc-solution-title" aria-live="polite">
        <h2 id="fc-solution-title" className="fc-visually-hidden">Solución</h2>
        {outcome.status === 'missing' ? <div className="fc-card fc-pending">
          <p className="fc-pending__title">Falta{outcome.missing.length === 1 ? '' : 'n'} {outcome.missing.length} dato{outcome.missing.length === 1 ? '' : 's'}</p>
          <p className="fc-pending__list">{outcome.missing.map((symbol) => <span key={symbol} className="fc-token">{symbol}</span>)}</p>
          <p className="fc-pending__note">Escribe tus datos o carga un ejemplo; la solución aparece aquí paso a paso.</p>
        </div> : outcome.status === 'invalid' ? <div className="fc-card fc-pending fc-pending--invalid" role="alert">
          <p className="fc-pending__title">Revisa los datos</p>
          <p className="fc-pending__note">{outcome.message}</p>
        </div> : <Solved solution={outcome.solution} units={units} problem={problem} />}
        {outcome.status === 'solved' ? <div className="fc-actions">
          <button type="button" className="fc-button" onClick={copy}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? 'Copiada' : 'Copiar solución'}</button>
          <button type="button" className="fc-button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Imprimir</button>
          {topic.piece && onOpenPiece ? <button type="button" className="fc-button fc-button--link" onClick={() => onOpenPiece(topic.piece!)}>{PIECE_LABEL[topic.piece]}<ArrowUpRight size={16} aria-hidden="true" /></button> : null}
        </div> : null}
      </section>
    </div>
  </article>;
}

function Solved({ solution, units, problem }: { solution: ExerciseSolution; units: UnitSystem; problem: ExerciseProblem }) {
  const q = (value: number, kind: Parameters<typeof formatQuantity>[1]) => formatQuantity(units, kind, value);
  const failed = solution.checks.some((check) => check.status === 'fail');
  const judged = solution.checks.some((check) => check.status !== 'info');
  return <>
    <div className={`fc-card fc-result${failed ? ' is-fail' : ''}`}>
      <div className="fc-result__head">
        <p className="fc-result__label">{problem.find.label}</p>
        {judged ? <span className={`fc-badge${failed ? ' fc-badge--fail' : ' fc-badge--ok'}`}>{failed ? 'No cumple' : 'Cumple'}</span> : null}
      </div>
      {solution.answers.length ? <dl className="fc-answers">
        {solution.answers.map((answer, index) => <div key={`${answer.symbol}-${index}`} className={index === 0 ? 'fc-answer fc-answer--main' : 'fc-answer'}>
          <dt><span className="fc-answer__symbol">{answer.symbol}</span><span className="fc-answer__label">{answer.label}</span></dt>
          <dd>{answer.text ?? q(answer.value, answer.kind)}</dd>
        </div>)}
      </dl> : null}
      {solution.figure ? <ExerciseFigure figure={solution.figure} units={units} /> : null}
      {solution.checks.length ? <ul className="fc-checks">
        {solution.checks.map((check) => <li key={check.label} className={`fc-check fc-check--${check.status}`}>
          <span className="fc-check__icon" aria-hidden="true">{check.status === 'pass' ? <Check size={14} /> : check.status === 'fail' ? <X size={14} /> : 'i'}</span>
          <span className="fc-check__text"><strong>{check.label}</strong><span>{check.detail}</span>{check.reference ? <small>{check.reference}</small> : null}</span>
        </li>)}
      </ul> : null}
    </div>

    <ol className="fc-steps">
      {solution.steps.map((step, index) => <li key={`${step.title}-${index}`} className="fc-step" style={{ '--i': index } as CSSProperties}>
        <h3 className="fc-step__title"><span className="fc-step__number">{index + 1}</span>{step.title}</h3>
        <div className="fc-step__lines">
          {step.lines.map((line, lineIndex) => <div key={lineIndex} className="fc-line">
            {line.formula ? <p className="fc-line__formula">{line.formula}</p> : null}
            {line.substitution ? <p className="fc-line__sub">= {line.substitution}</p> : null}
            {line.result ? <p className="fc-line__result"><span>{line.result.symbol}</span> = <strong>{q(line.result.value, line.result.kind)}</strong></p> : null}
            {line.note ? <p className="fc-line__note">{line.note}</p> : null}
          </div>)}
        </div>
      </li>)}
    </ol>
    {solution.notes?.length ? <ul className="fc-notes">{solution.notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
    <p className="fc-experimental"><span className="fc-badge fc-badge--experimental">Experimental</span> Requiere revisión profesional.</p>
  </>;
}
