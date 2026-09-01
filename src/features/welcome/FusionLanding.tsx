import { type KeyboardEvent, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Blocks, ChartNoAxesCombined, FolderKanban, GraduationCap, Network, Play, Route } from 'lucide-react';
import './fusionLanding.css';

interface FusionLandingProps {
  language: 'es' | 'en';
  onOpenSolver2D: () => void;
  onOpenSolver3D?: () => void;
  onOpenClassroom?: () => void;
  onOpenImport: () => void;
}

type Localized = { es: string; en: string };
type FamilyId = 'analysis' | 'model' | 'civil' | 'project' | 'interop' | 'learning';

interface Family {
  id: FamilyId;
  code: string;
  mark: string;
  name: Localized;
  line: Localized;
  detail: Localized;
  image: string;
  icon: typeof ChartNoAxesCombined;
  tone: 'blue' | 'yellow' | 'green' | 'red' | 'pink';
}

const FAMILIES: readonly Family[] = [
  { id: 'analysis', code: '01', mark: 'tools/solver-2d.svg', name: { es: 'Análisis', en: 'Analysis' }, line: { es: 'Ve lo que sostiene cada decisión.', en: 'See what supports every decision.' }, detail: { es: 'Modelo, cargas, comportamiento y resultados en una misma lectura.', en: 'Model, loads, behaviour, and results in one clear view.' }, image: 'fusionstructure-analysis-v3.png', icon: ChartNoAxesCombined, tone: 'blue' },
  { id: 'model', code: '02', mark: 'tools/space-3d.svg', name: { es: 'Modelo', en: 'Model' }, line: { es: 'Da forma al sistema físico.', en: 'Shape the physical system.' }, detail: { es: 'Geometría, materiales y relaciones que conservan su intención.', en: 'Geometry, materials, and relationships that retain their intent.' }, image: 'fusionstructure-hero-v3.png', icon: Blocks, tone: 'yellow' },
  { id: 'civil', code: '03', mark: 'tools/field.svg', name: { es: 'Civil', en: 'Civil' }, line: { es: 'Relaciona terreno, agua y estructura.', en: 'Relate terrain, water, and structure.' }, detail: { es: 'El contexto deja de ser un archivo aparte.', en: 'Context stops being a separate file.' }, image: 'fusionstructure-project-v3.png', icon: Route, tone: 'green' },
  { id: 'project', code: '04', mark: 'tools/hub.svg', name: { es: 'Proyecto', en: 'Project' }, line: { es: 'Conserva el porqué junto al resultado.', en: 'Keep the why beside the result.' }, detail: { es: 'Planos, cantidades, revisiones y decisiones comparten procedencia.', en: 'Drawings, quantities, revisions, and decisions share provenance.' }, image: 'fusionstructure-project-v3.png', icon: FolderKanban, tone: 'red' },
  { id: 'interop', code: '05', mark: 'tools/evidence.svg', name: { es: 'Conexiones', en: 'Connections' }, line: { es: 'Mueve información sin perder significado.', en: 'Move information without losing meaning.' }, detail: { es: 'Un proyecto permanece reconocible al cruzar formatos y equipos.', en: 'A project remains recognisable across formats and teams.' }, image: 'fusionstructure-hero-v3.png', icon: Network, tone: 'blue' },
  { id: 'learning', code: '06', mark: 'tools/learn.svg', name: { es: 'Aprendizaje', en: 'Learning' }, line: { es: 'Convierte modelos en comprensión.', en: 'Turn models into understanding.' }, detail: { es: 'La misma estructura puede ser una pregunta, una prueba y una explicación.', en: 'The same structure can be a question, a test, and an explanation.' }, image: 'fusionstructure-learning-v3.png', icon: GraduationCap, tone: 'pink' },
];

const copy = {
  es: {
    principle: 'Make complexity legible.', title: 'Todo conectado a la estructura.', body: 'Del primer trazo a lo que se entrega, un proyecto se entiende como uno.', enter: 'Entrar al workspace', explore: 'Conocer la plataforma',
    familiesTitle: 'Un sistema. Seis formas de avanzar.', familiesBody: 'Cada familia parte del mismo proyecto, por eso cada decisión llega más lejos.', exploreFamily: 'Explorar familia',
    create: 'Crear', createBody: 'Define el modelo que todas las demás decisiones comparten.', understand: 'Entender', understandBody: 'Haz visibles las relaciones, hipótesis y consecuencias.', deliver: 'Entregar', deliverBody: 'Convierte el trabajo en un expediente que conserva contexto.',
    platform: 'La plataforma', platformBody: 'FusionStructure reúne la continuidad que normalmente se pierde entre herramientas.', note: 'Visión de producto en evolución. Algunas superficies continúan desarrollándose.',
    openAnalysis: 'Abrir análisis', openProject: 'Abrir proyecto', openLearning: 'Abrir aprendizaje', openSpace: 'Explorar espacio 3D',
  },
  en: {
    principle: 'Make complexity legible.', title: 'Everything connected to the structure.', body: 'From the first line to what is delivered, a project is understood as one.', enter: 'Enter workspace', explore: 'Explore the platform',
    familiesTitle: 'One system. Six ways forward.', familiesBody: 'Every family starts from the same project, so every decision reaches further.', exploreFamily: 'Explore family',
    create: 'Create', createBody: 'Define the model every other decision shares.', understand: 'Understand', understandBody: 'Make relationships, assumptions, and consequences visible.', deliver: 'Deliver', deliverBody: 'Turn the work into a record that retains context.',
    platform: 'The platform', platformBody: 'FusionStructure brings together the continuity that is usually lost between tools.', note: 'An evolving product vision. Some surfaces are still in development.',
    openAnalysis: 'Open analysis', openProject: 'Open project', openLearning: 'Open learning', openSpace: 'Explore 3D space',
  },
} as const;

export const FusionLanding = ({ language, onOpenSolver2D, onOpenSolver3D, onOpenClassroom, onOpenImport }: FusionLandingProps) => {
  const text = copy[language];
  const [activeFamilyId, setActiveFamilyId] = useState<FamilyId>('analysis');
  const activeFamily = FAMILIES.find((family) => family.id === activeFamilyId) ?? FAMILIES[0];
  const ActiveIcon = activeFamily.icon;
  const scrollToFamilies = () => document.getElementById('fusion-families')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const selectFamilyFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, currentFamilyId: FamilyId) => {
    const currentIndex = FAMILIES.findIndex((family) => family.id === currentFamilyId);
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? FAMILIES.length - 1 : direction === 0 ? currentIndex : (currentIndex + direction + FAMILIES.length) % FAMILIES.length;
    if (nextIndex === currentIndex && direction === 0 && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const nextFamily = FAMILIES[nextIndex];
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#fs-family-tab-${nextFamily.id}`)?.focus();
    setActiveFamilyId(nextFamily.id);
  };
  const openActiveFamily = () => {
    if (activeFamily.id === 'analysis') onOpenSolver2D();
    else if (activeFamily.id === 'learning') onOpenClassroom?.();
    else if (activeFamily.id === 'project' || activeFamily.id === 'interop') onOpenImport();
    else if (activeFamily.id === 'model') onOpenSolver3D?.();
  };
  const activeAction = activeFamily.id === 'analysis' ? text.openAnalysis : activeFamily.id === 'learning' ? text.openLearning : activeFamily.id === 'project' || activeFamily.id === 'interop' ? text.openProject : activeFamily.id === 'model' ? text.openSpace : undefined;

  return <div className="fs-landing">
    <section className="fs-landing-hero" aria-labelledby="fusion-landing-title">
      <div className="fs-landing-hero__copy"><div className="fs-identity"><span className="fs-brandmark" aria-hidden="true"><img className="fs-brandmark__light" src="./assets/brand/fusionstructure-mark.svg" alt="" /><img className="fs-brandmark__dark" src="./assets/brand/fusionstructure-mark-inverse.svg" alt="" /></span><span className="fs-wordmark">FusionStructure</span></div><span className="fs-principle">{text.principle}</span><h1 id="fusion-landing-title">{text.title}</h1><p>{text.body}</p><div className="fs-landing-hero__actions"><button type="button" className="fs-action fs-action--primary" onClick={onOpenSolver2D}><Play size={16} fill="currentColor" />{text.enter}</button><button type="button" className="fs-action" onClick={scrollToFamilies}>{text.explore}<ArrowDown size={16} /></button></div></div>
      <div className="fs-landing-hero__visual" aria-hidden="true"><img src="./assets/landing/fusionstructure-hero-v3.png" alt="" decoding="async" fetchPriority="high" /></div>
    </section>

    <section id="fusion-families" className="fs-families" aria-labelledby="fusion-families-title">
      <header className="fs-section-heading"><span>{text.platform}</span><h2 id="fusion-families-title">{text.familiesTitle}</h2><p>{text.familiesBody}</p></header>
      <div className="fs-family-stage"><div className="fs-family-stage__media" data-tone={activeFamily.tone}><img key={activeFamily.id} src={`./assets/landing/${activeFamily.image}`} alt="" loading="lazy" decoding="async" /></div><article key={activeFamily.id} id="fs-family-panel" className="fs-family-stage__copy" role="tabpanel" aria-labelledby={`fs-family-tab-${activeFamily.id}`} tabIndex={0}><div className="fs-family-stage__index"><span>{activeFamily.code}</span><ActiveIcon size={21} aria-hidden="true" /></div><h3>{activeFamily.name[language]}</h3><strong>{activeFamily.line[language]}</strong><p>{activeFamily.detail[language]}</p>{activeAction ? <button type="button" onClick={openActiveFamily}>{activeAction}<ArrowUpRight size={16} /></button> : <span className="fs-family-stage__concept">{text.exploreFamily}<ArrowRight size={15} /></span>}</article></div>
      <div className="fs-family-list" role="tablist" aria-label={text.familiesTitle}>{FAMILIES.map((family) => { const selected = family.id === activeFamily.id; return <button key={family.id} id={`fs-family-tab-${family.id}`} data-tone={family.tone} type="button" role="tab" aria-label={family.name[language]} aria-controls="fs-family-panel" aria-selected={selected} tabIndex={selected ? 0 : -1} className={selected ? 'is-active' : undefined} onClick={() => setActiveFamilyId(family.id)} onKeyDown={(event) => selectFamilyFromKeyboard(event, family.id)}><span data-tone={family.tone}><img src={`./assets/brand/${family.mark}`} alt="" loading="lazy" decoding="async" /></span><strong>{family.name[language]}</strong><small aria-hidden="true">{family.code}</small></button>; })}</div>
    </section>

    <section className="fs-product-flow" aria-label={text.platform}><article className="fs-product-flow__step"><div><span>01</span><h2>{text.create}</h2><p>{text.createBody}</p></div><img src="./assets/landing/fusionstructure-project-v3.png" alt="" loading="lazy" decoding="async" /></article><article className="fs-product-flow__step fs-product-flow__step--reverse"><div><span>02</span><h2>{text.understand}</h2><p>{text.understandBody}</p></div><img src="./assets/landing/fusionstructure-analysis-v3.png" alt="" loading="lazy" decoding="async" /></article><article className="fs-product-flow__step"><div><span>03</span><h2>{text.deliver}</h2><p>{text.deliverBody}</p></div><img src="./assets/landing/fusionstructure-hero-v3.png" alt="" loading="lazy" decoding="async" /></article></section>
    <footer className="fs-landing-footer"><p>{text.platformBody}</p><small>{text.note}</small></footer>
  </div>;
};
