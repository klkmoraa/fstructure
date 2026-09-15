# Space 3D: análisis de seis GDL

## Objetivo

Construir un único ensamblador espacial que interprete un documento `Space3DProjectV2` de forma determinista. Los modos lineal, P-Delta, modal, pandeo e influencia consumen esa misma representación; ningún modo vuelve a ensamblar miembros, restricciones o cargas con reglas distintas.

La aplicación sigue siendo Experimental. Un resultado sólo se publica con su versión de fuente, métricas de calidad y auditoría estructural de equilibrio.

## Primera entrega del núcleo

La primera fase crea el análisis estático lineal de marcos espaciales, con seis GDL por nodo en el orden `[ux, uy, uz, rx, ry, rz]`. Incluye cargas nodales y de barra, peso propio, efectos iniciales/térmicos, apoyos, resortes lineales, desplazamientos prescritos, MPC, liberaciones y offsets. Produce reacciones de seis componentes, acciones locales de extremo y un cierre independiente de fuerzas y momentos.

Armaduras, vínculos rígidos, resortes rotacionales por eje y vínculos no lineales permanecen entidades preservables hasta que su despacho físico se implemente. En esa fase el motor devuelve una causa explícita; nunca las convierte en marcos ni inventa una rigidez grande.

La API prevista mantiene el adaptador heredado y añade un límite explícito:

```ts
interface Space3DStaticAnalysisOptions {
  backend?: 'auto' | 'dense' | 'sparse';
  includeAssemblyTrace?: boolean;
}

function assembleSpace3DStaticModel(
  project: Space3DProjectV2,
  targetId: string,
  options?: Space3DStaticAnalysisOptions,
): Space3DStaticAssembly;

function analyzeSpace3DStatic(
  project: Space3DProjectV2,
  targetId: string,
  options?: Space3DStaticAnalysisOptions,
): Space3DAnalysisResult;
```

El backend denso es referencia diferencial para modelos pequeños. El backend disperso y su ciclo de vida usan `AnalysisJobRequest` y el runtime común: presupuesto antes de reservar, progreso, resultado obsoleto por versión y cancelación mediante worker.

## Convenciones vinculantes

- `rigidOffsetI` avanza de i hacia j en el eje local +x; `rigidOffsetJ` avanza de j hacia i. La longitud deformable debe ser positiva. Las zonas rígidas no aportan masa distribuida.
- Un `planarSupport` conserva exactamente su normal XY: un rodillo angular impone `cos(a)·ux + sin(a)·uy = valor`. Si contradice los booleanos XY, el análisis falla con conflicto de apoyo.
- La dirección vectorial de un vínculo nodal es canónica. `angleDeg` sólo es un alias planar y, si coexiste, debe coincidir; los vínculos no lineales se declaran explícitamente no disponibles hasta el active set espacial.
- Los efectos iniciales siguen `εx(y,z) = ε0 + κy z − κz y`. El gradiente térmico local +y conserva la convención planar: `κz = −α·gradientY`; el gradiente +z genera `κy = +α·gradientZ`.
- La densidad se convierte de kg/m³ a Mg/m mediante `rho·A·1e−3`; masas nodales e inercias se convierten coherentemente a Mg y Mg·m². La masa distribuida cubre el tramo deformable.
- Las acciones locales de extremo son fuerzas generalizadas resistentes: rigidez por desplazamiento menos acciones equivalentes de cargas y efectos iniciales.

## Cargas móviles e influencia

La forma V1 sólo representa el caso planar sin ambigüedad. No se escogerá de forma implícita una dirección, lado de corte o componente espacial. La siguiente revisión del documento incorpora un objeto versionado con vector de carga unitario, objetivo tipado y lado de corte:

```ts
type Space3DInfluenceQuantity = 'N' | 'Vy' | 'Vz' | 'T' | 'My' | 'Mz';

type Space3DMovingTarget =
  | { kind: 'member'; memberId: string; position: number; quantity: Space3DInfluenceQuantity; side: 'left' | 'right' | 'continuous' }
  | { kind: 'node-reaction'; nodeId: string; component: 'fx' | 'fy' | 'fz' | 'mx' | 'my' | 'mz' };
```

La migración V1 sólo infiere `N`, `Vy` y `Mz` para una geometría planar inequívoca, con carga global hacia abajo `[0, -1, 0]`. `R` V1 queda bloqueado para revisión; no se recodifica como momento. Los casos espaciales requieren dirección, componente y lado explícitos.

## Modos posteriores

- P-Delta añade rigidez geométrica en ambos planos de flexión sobre el ensamblaje estático y converge por incrementos de desplazamiento y fuerza axial.
- Modal ensambla masa y resuelve el problema generalizado restringido `Kφ = ω²Mφ`.
- Pandeo usa la solución estática de referencia y `Kφ = λ(−Kg)φ`.
- Influencia reutiliza respuestas estáticas de carga vectorial unitaria y el contrato móvil versionado.

## Verificación mínima por fase

Cada fase añade sólo una prueba focal que capture el nuevo contrato: equivalencia plana 2D/3D a `1e-9` en GDL/acciones mapeados y `1e-8` en equilibrio; marcos locales/offsets/liberaciones; apoyos inclinados/MPC/prescritos; cargas térmicas y peso propio; y posteriormente oráculos independientes de P-Delta, frecuencia, Euler y carga móvil. No se ejecutará la suite completa antes del corte final.
