/**
 * Units, sign conventions, scope and declared limitations.
 *
 * An engineering memoir has to state, on its own pages, the units it uses, the sign convention
 * behind every N-V-M figure, what the analysis does and does not cover, and any warning the
 * solver raised. This part carries all four, and it is the one place in the document where a
 * reader who disagrees with a number can find out what the number was even claiming.
 *
 * It used to print `label: value` prose under a coloured band; the pairs are a ruled grid now,
 * which is what lets a reader scan the column rather than read the sentences.
 */
import { unitLabel } from '../../engine/units';
import { formulationLabel } from './pdfSummarySection';
import type { ReportContext } from './reportContext';

export const drawScopePart = (context: ReportContext): void => {
  const { layout, project, analysis } = context;
  const units = project.settings.units;

  layout.part(
    'Anexo A · Unidades, convenciones y alcance',
    'Unidades, convenciones de signo, alcance del análisis y sus advertencias.',
  );

  layout.heading('Unidades de presentación');
  layout.keyValues([
    ['Longitud y desplazamiento', unitLabel(units, 'length')],
    ['Fuerza y reacción', unitLabel(units, 'force')],
    ['Momento', unitLabel(units, 'moment')],
    ['Carga distribuida', unitLabel(units, 'distributedForce')],
    ['Rotación', 'rad'],
    ['Precisión', 'cálculo en doble precisión; se redondea sólo al presentar, a cuatro cifras significativas'],
    ['Cero', 'un valor menor que la tolerancia relativa del análisis se escribe 0'],
  ]);

  layout.heading('Convenciones de signo');
  layout.text(
    '+X hacia la derecha y +Y hacia arriba. El eje local x de cada barra va del nudo i al nudo j; '
    + 'el eje local y está girado 90° en sentido antihorario.',
  );
  layout.gap();
  layout.keyValues([
    ['N axial', 'positivo en tensión, según el eje local x de la barra'],
    ['V cortante', 'positivo según el eje local y de la barra'],
    ['M momento', 'positivo cuando tracciona la fibra del lado local -y'],
    ['Reacciones', 'en ejes globales, con el signo de la fuerza que el apoyo ejerce sobre la estructura'],
    ['Deformada', 'desplazamientos nodales en ejes globales; la escala del dibujo es ilustrativa'],
  ]);

  layout.heading('Alcance del análisis');
  layout.keyValues([
    ['Formulación', formulationLabel(analysis.educationTrace?.formulation)],
    ['Barra de marco', 'Euler–Bernoulli, con deformación axial y por flexión'],
    ['Barra de armadura', 'sólo rigidez axial'],
    ['Hipótesis', 'material elástico lineal, pequeñas deformaciones y propiedades constantes en cada barra'],
  ]);

  layout.heading('Limitaciones declaradas');
  layout.bullets([
    'No se consideran efectos de segundo orden (P-Delta) ni no linealidad geométrica.',
    'No se considera plasticidad, fluencia, fisuración ni degradación de rigidez.',
    'No se realiza análisis modal, dinámico, de historia en el tiempo ni espectral.',
    'No se aplica ninguna norma de diseño: el documento reporta solicitaciones, no verificaciones normativas.',
    'El pandeo, la torsión fuera del plano y el comportamiento tridimensional quedan fuera del modelo 2D.',
    'Los resultados dependen enteramente del modelo introducido; su idoneidad es responsabilidad del ingeniero que firma.',
  ]);

  layout.heading('Advertencias del análisis');
  if (analysis.issues.length === 0) {
    layout.callout(
      'ok',
      'Sin incidencias',
      'Las comprobaciones de entrada, estabilidad y equilibrio no detectaron incidencias.',
    );
    return;
  }
  for (const issue of analysis.issues) {
    const tone = issue.severity === 'error' ? 'danger' : issue.severity === 'warning' ? 'warn' : 'neutral';
    const heading = `${issue.severity === 'error' ? 'Error' : issue.severity === 'warning' ? 'Aviso' : 'Info'}`
      + ` · ${issue.title}${issue.objectId ? ` (${issue.objectId})` : ''}`;
    layout.callout(tone, heading, issue.suggestedFix ? `${issue.message} Solución sugerida: ${issue.suggestedFix}` : issue.message);
  }
};
