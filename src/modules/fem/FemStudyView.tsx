import { useEffect, useState } from 'react';
import { Tabs } from '../../design-system/components/disclosure';
import type { FemAnalysisResult, FemDocumentV1 } from './public';
import { FemMesh, femNumber } from './FemMesh';

function StudyTable<T>({ caption, headings, rows, cells }: { caption: string; headings: readonly string[]; rows: readonly T[]; cells: (row: T) => readonly string[] }) {
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(rows.length / 50) - 1);
  const currentPage = Math.min(page, lastPage);
  return <div className="fusion-fem__table-block">
    <div className="fusion-fem__table-scroll" tabIndex={0} aria-label={caption}>
      <table><caption>{caption}</caption><thead><tr>{headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{rows.slice(currentPage * 50, (currentPage + 1) * 50).map((row, index) => <tr key={`${currentPage}-${index}`}>{cells(row).map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
    {rows.length > 50 ? <nav className="fusion-fem__pagination" aria-label={`Páginas de ${caption}`}>
      <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button>
      <span aria-live="polite">{currentPage * 50 + 1}–{Math.min((currentPage + 1) * 50, rows.length)} de {rows.length}</span>
      <button type="button" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Siguiente</button>
    </nav> : null}
  </div>;
}

type StudyProps = { document: FemDocumentV1; analysis: FemAnalysisResult | null; onAnalyze: () => void };

function ModelView({ document }: Pick<StudyProps, 'document'>) {
  return <div className="fusion-fem__view">
    <header><h2>{document.name}</h2><p>{document.analysis === 'plane-stress' ? 'Esfuerzo plano' : document.analysis === 'plane-strain' ? 'Deformación plana' : document.analysis} · unidades m y kN</p></header>
    <dl className="fusion-fem__facts">
      <div><dt>Módulo E</dt><dd>{femNumber(document.material.E)} <small>kN/m²</small></dd></div>
      <div><dt>Poisson ν</dt><dd>{femNumber(document.material.nu)}</dd></div>
      <div><dt>Espesor</dt><dd>{femNumber(document.material.thickness)} <small>m</small></dd></div>
      <div><dt>Elementos</dt><dd>{document.elements.length}</dd></div>
    </dl>
    <div className="fusion-fem__data-grid">
      <section><h3>Apoyos</h3>{document.restraints.length ? <StudyTable caption="Restricciones por nudo" headings={['Nudo', 'X', 'Y']} rows={document.restraints} cells={(restraint) => [restraint.nodeId, restraint.ux ? 'Fijo' : 'Libre', restraint.uy ? 'Fijo' : 'Libre']} /> : <p className="fusion-fem__empty">Esta malla no tiene apoyos. El análisis necesita restricciones para impedir el movimiento rígido.</p>}</section>
      <section><h3>Cargas</h3>{document.loads.length ? <StudyTable caption="Cargas por nudo · kN" headings={['Nudo', 'Fx', 'Fy']} rows={document.loads} cells={(load) => [load.nodeId, femNumber(load.fx), femNumber(load.fy)]} /> : <p className="fusion-fem__empty">No hay cargas en el estudio importado.</p>}</section>
    </div>
    <p className="fusion-fem__note">Importar Gmsh trae la geometría de la malla. Esta mesa consulta los datos del estudio; el editor de apoyos y cargas está pendiente.</p>
  </div>;
}

function MeshView({ document }: Pick<StudyProps, 'document'>) {
  return <div className="fusion-fem__view">
    <header><h2>Malla del estudio</h2><p>Revisa la conectividad y las coordenadas antes de analizar.</p></header>
    <FemMesh document={document} />
    <details><summary>Coordenadas de los nudos</summary><StudyTable caption="Nudos · m" headings={['Nudo', 'X', 'Y']} rows={document.nodes} cells={(node) => [node.id, femNumber(node.x), femNumber(node.y)]} /></details>
    <details><summary>Conectividad de los elementos</summary><StudyTable caption="Elementos de la malla" headings={['Elemento', 'Tipo', 'Nudos']} rows={document.elements} cells={(element) => [element.id, element.type, element.nodeIds.join(', ')]} /></details>
  </div>;
}

function ResultsView({ document, analysis, onAnalyze, onReview }: StudyProps & { onReview: () => void }) {
  return <div className="fusion-fem__view">
    {!analysis ? <div className="fusion-fem__empty"><h2>El estudio aún no tiene resultados</h2><p>Revisa Modelo y Malla, y analiza para consultar los campos y el equilibrio.</p><button type="button" className="sc-button sc-button--primary" onClick={onAnalyze}>Analizar el estudio</button></div>
      : !analysis.success ? <div className="fusion-fem__empty"><h2>Revisa el estudio antes de continuar</h2><p>{analysis.reason}</p>
        {analysis.issues.length ? <ul>{analysis.issues.map((issue, index) => <li key={index}>{issue.id ? `${issue.entity} ${issue.id}: ` : ''}{issue.code} · {issue.field}</li>)}</ul> : null}
        <button type="button" className="sc-button" onClick={onReview}>Revisar modelo</button></div>
        : <>
          <header><h2>Resultados del estudio</h2><p>Elasticidad lineal 2D. Valores por elemento y por nudo del análisis actual.</p></header>
          <FemMesh document={document} analysis={analysis} />
          <dl className="fusion-fem__facts">
            <div><dt>Residuo relativo</dt><dd>{femNumber(analysis.relativeResidual)}</dd></div>
            <div><dt>Equilibrio normalizado</dt><dd>{femNumber(analysis.equilibrium.normalized)}</dd></div>
            <div><dt>Área mínima</dt><dd>{femNumber(analysis.meshQuality.minArea)} <small>m²</small></dd></div>
            <div><dt>Relación de aspecto máx.</dt><dd>{femNumber(analysis.meshQuality.maxAspectRatio)}</dd></div>
          </dl>
          <StudyTable caption="Tensiones por elemento · kN/m²" headings={['Elemento', 'σx', 'σy', 'τxy', 'von Mises']} rows={analysis.stresses} cells={(stress) => [stress.elementId, ...stress.stress.map(femNumber), femNumber(stress.vonMises)]} />
          <StudyTable caption="Desplazamientos por nudo · mm" headings={['Nudo', 'Ux', 'Uy']} rows={analysis.displacements} cells={(displacement) => [displacement.nodeId, femNumber(displacement.ux * 1000), femNumber(displacement.uy * 1000)]} />
          <details><summary>Reacciones en los apoyos</summary><StudyTable caption="Reacciones por nudo · kN" headings={['Nudo', 'Rx', 'Ry']} rows={analysis.reactions} cells={(reaction) => [reaction.nodeId, femNumber(reaction.ux), femNumber(reaction.uy)]} /></details>
        </>}
  </div>;
}

export function FemStudyView({ document, analysis, onAnalyze }: StudyProps) {
  const [view, setView] = useState('model');
  // Una corrida lleva al diagnóstico; importar lleva al modelo recién cargado.
  useEffect(() => setView(analysis ? 'results' : 'model'), [document, analysis]);
  return <Tabs className="fusion-fem__tabs" label="Secciones del estudio FEM" value={view} onValueChange={setView}
    items={[
      { id: 'model', label: 'Modelo', content: <ModelView document={document} /> },
      { id: 'mesh', label: 'Malla', content: <MeshView document={document} /> },
      { id: 'results', label: 'Resultados', content: <ResultsView document={document} analysis={analysis} onAnalyze={onAnalyze} onReview={() => setView('model')} /> },
    ]} />;
}
