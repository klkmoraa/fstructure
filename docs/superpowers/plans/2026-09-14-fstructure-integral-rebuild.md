# Reconstrucción integral de FStructure

**Spec:** el plan aprobado por el usuario en la conversación del 14 de septiembre de 2026. Este archivo conserva sus decisiones como autoridad de implementación.

## Objetivo

Consolidar `/Users/crismora/Desktop/FStructure` en una sola web app llamada `fstructure`, basada en `Fusiones` y su historial Git. La app integra cuatro herramientas nativas en un solo shell: Modelo 2D, Diseño estructural, Modelo 3D y FEM. Todo permanece `Experimental`, local-first, sin backend ni servicios remotos.

## Restricciones globales

- El Modelo 2D sigue siendo la autoridad. Su solver, canvas, comportamiento e identidad visual no se refactorizan; sólo se adaptan navegación, selección compartida, persistencia y publicación de snapshots.
- El design system actual de 2D es la única fuente de tokens, componentes, botones, temas e iconografía. Ningún módulo crea otra topbar ni otro design system.
- Las URLs canónicas son `?project=<id>&tool=<tool>`, donde `tool` es `model2d`, `design`, `space3d` o `fem`; los parámetros legacy deben migrar sin romper recarga, atrás/adelante ni enlaces guardados.
- La persistencia canónica es IndexedDB transaccional. Las claves legacy de `localStorage` se leen, validan y copian una sola vez, se registra la migración y nunca se borra el respaldo.
- “Sin límite” significa sin máximos fijos de entidades: la admisión ocurre antes de reservar matrices y depende de un presupuesto del 20% de la memoria anunciada, limitado a 128 MiB–2 GiB; sin señal se usan 256 MiB. Treinta segundos son un aviso blando, nunca una cancelación automática.
- Todo análisis lleva versión de fuente, progreso, cancelación por terminación del worker, descarte de resultados obsoletos y métricas comunes de condición, residuo lineal y equilibrio.
- Ningún cambio de 3D sobrescribe 2D silenciosamente. Sólo parches compatibles y aprobados regresan como una transacción deshacible; lo fuera del plano permanece en 3D.
- Diseño consume exclusivamente snapshots versionados y fiables de 2D/3D. NTC CDMX 2023 y AISC 360-22 sólo se habilitan con evidencia pública verificable; ACI 318-25 y ASCE/SEI 7-22 permanecen registrados pero bloqueados hasta contar con fuentes completas autorizadas.
- FEM es lineal estático. Se excluyen no linealidad, contacto, dinámica e historia de tiempo. 3D excluye plasticidad material, grandes desplazamientos e historia de tiempo.
- No se añaden backend remoto, IFC, colaboración en nube ni push a repos remotos.
- Al final `/Users/crismora/Desktop/FStructure` contiene únicamente `fstructure`; las fuentes anteriores se conservan recuperables en `/Users/crismora/Desktop/FStructure-legacy-20260914`.

## Contratos obligatorios

```ts
type ToolId = 'model2d' | 'design' | 'space3d' | 'fem';
type Maturity = 'available' | 'experimental' | 'planned' | 'unavailable';

interface ToolModuleDescriptor {
  id: ToolId;
  labelKey: string;
  maturity: Maturity;
  load(): Promise<React.ComponentType>;
  capabilities: readonly string[];
}

interface AnalysisJobRequest<T> {
  jobId: string;
  tool: ToolId;
  sourceVersion: string;
  targetId: string;
  budget: AnalysisBudget;
  payload: T;
}

interface AnalysisBudget {
  maxEstimatedBytes: number;
  softDeadlineMs: number;
}

interface AnalysisQuality {
  conditionEstimate: number;
  linearResidual: number;
  equilibriumResidual: number;
  level: 'stable' | 'limited' | 'unreliable' | 'failed';
}

interface SyncPatchV1 {
  entityKind: string;
  entityId: string;
  field: string;
  before: unknown;
  after: unknown;
  compatibility: 'exact' | 'requires-review' | 'unsupported';
}
```

## Task 1: Consolidar el repositorio y capturar el baseline

- Crear un manifiesto reproducible SHA-256 de `Fusiones`, `Solver2D`, `Solver3D`, `DiseñoEstructural`, `FEM-Estructural` y `Aprendizaje-y-Evidencia`, incluyendo commit, rama, remoto, estado y hashes de archivos relevantes.
- Crear `/Users/crismora/Desktop/FStructure/fstructure` como repositorio Git autónomo desde el commit exacto de `Fusiones`, preservando rama, historial y el remoto GitHub original. Verificar igualdad del árbol Git y del build antes de archivar.
- Migrar al repositorio canónico los diez tests exclusivos de Space3D, fixtures/oráculos útiles, licencias MIT y documentación normativa que no esté duplicada. No migrar resultados ilustrativos del prototipo de Diseño.
- Mover las carpetas preexistentes a `/Users/crismora/Desktop/FStructure-legacy-20260914` sin borrar datos ni repos remotos. Verificar que en `/Users/crismora/Desktop/FStructure` sólo quede `fstructure`.
- Documentar toda operación y evidencia en `docs/migration/`.

## Task 2: Definir contratos, bundle, registro de herramientas y URL canónica

- Añadir los contratos obligatorios en un dominio compartido sin imports internos entre herramientas.
- Implementar `UnifiedProjectBundleV1` con manifiesto, `ProjectModel` 2D autoritativo, rama 3D vinculada, workspace de Diseño y estudios FEM.
- Implementar registro perezoso de los cuatro módulos con capacidades y madurez reales.
- Implementar lectura/escritura canónica de `?project=<id>&tool=<tool>` y migración de parámetros legacy compatible con reload, popstate e historial.
- Escribir primero pruebas de contrato y de navegación que fallen por la ausencia del comportamiento.

## Task 3: Migrar persistencia local a IndexedDB transaccional

- Crear un repositorio transaccional para `UnifiedProjectBundleV1` con versionado, validación y recuperación controlada.
- Importar una sola vez las claves legacy 2D y 3D de `localStorage`, registrar el resultado de migración y conservar intactas las claves originales.
- Soportar fallo parcial/recuperación sin dejar proyectos a medias.
- Escribir primero pruebas con IndexedDB real o una implementación fiel en memoria; no probar mocks.

## Task 4: Integrar el shell único conservando intacto el Modelo 2D

- Sustituir `WorkspaceId` por el registro de cuatro herramientas y navegación persistente.
- Mantener la topbar, los botones, los temas y la iconografía de 2D, añadiendo el selector `2D / Diseño / 3D / FEM`.
- Cada herramienta aporta controles contextuales, inspector, acción primaria y estado sin renderizar otra topbar.
- Adaptar 2D sólo para navegación, selección compartida, persistencia y snapshots versionados. Añadir pruebas diferenciales que demuestren que el solver y el canvas conservan comportamiento.
- Implementar un único panel móvil accesible, teclado, touch y reduced motion.

## Task 5: Incorporar el runtime numérico adaptativo Rust→WASM

- Crear un crate local compilable a WebAssembly, con representación CSC/CSR y una puerta de factibilidad para `faer` 0.24.4 (MIT) que pruebe al menos una factorización dispersa representativa. No hacer depender la app de `faer` si esa puerta no compila y corre.
- Conservar el solver denso actual como referencia de modelos pequeños y para pruebas diferenciales.
- Implementar presupuesto automático, estimación previa a la reserva, fases/progreso, aviso de 30 s, cancelación por terminación de worker, versionado y descarte de obsoletos.
- Emitir `AnalysisQuality` uniforme. No introducir topes fijos de nodos o barras.
- Escribir primero pruebas de presupuesto, admisión, cancelación, obsolescencia y equivalencia denso/disperso.

## Task 6: Crear el modelo espacial sin pérdidas y la sincronización revisable

- Definir un esquema espacial de seis GDL que represente marcos, armaduras, rígidos, liberaciones, resortes, offsets, MPC, desplazamientos prescritos, efectos iniciales/térmicos, peso propio y cargas nodales, de barra y móviles.
- Convertir cada semántica 2D sin omisiones. Con modelo 2D se crea/actualiza una rama 3D vinculada; con 2D vacío se abre un proyecto espacial vacío.
- Implementar diff por campo mediante `SyncPatchV1`, conflictos, compatibilidad y aplicación atómica deshacible a 2D sólo después de aprobación explícita.
- Escribir primero tests exhaustivos de conversión, round-trip planar, conflictos, no-representables y undo/redo.

## Task 7: Implementar análisis 3D en seis GDL

- Implementar análisis lineal, P-Delta, modal, pandeo e influencia/cargas móviles sobre el runtime común.
- Soportar mecanismos, casi singularidad, apoyos, liberaciones, resortes, offsets, MPC, desplazamientos prescritos, térmicos/iniciales y peso propio.
- Comparar modelos planares equivalentes 2D/3D con tolerancia relativa `1e-9` en desplazamientos/fuerzas y `1e-8` en equilibrio.
- Añadir pruebas diferenciales denso/disperso y fixtures de los corpus migrados.

## Task 8: Reconstruir la experiencia de modelado y resultados 3D

- Reemplazar la doble topbar y el muro de diagnóstico por controles contextuales nativos del shell y un estado compacto de linaje.
- Renderizar geometría instanciada y overlays incrementales; selección, capas y resultados no reconstruyen toda la escena. Resize conserva cámara; picking diferencia clic y órbita.
- Añadir snap 3D, ejes, gizmo, view cube, coordenadas exactas, inspector, tablas masivas, capas, resultados y cámaras guardadas.
- Añadir vista “Comparar cambios” con aprobación de parches compatibles.
- Verificar visual y funcionalmente escritorio, 390 px, claro/oscuro, teclado, touch y reduced motion.

## Task 9: Reconstruir Diseño estructural multinorma

- Crear un workspace completo alimentado sólo por snapshots fiables/versionados de 2D/3D.
- Cubrir vigas, columnas y diagonales de concreto y acero: axial, flexión, cortante, interacción, servicio, detalle y evidencia.
- Implementar adaptadores versionados NTC CDMX 2023 y AISC 360-22 con fixtures oficiales, procedencia y oráculo independiente cuando la evidencia pública completa lo permita.
- Registrar ACI CODE-318-25 y ASCE/SEI 7-22 como bloqueados, explicando la evidencia faltante. No reutilizar resultados ilustrativos del prototipo independiente.
- Escribir primero pruebas de admisión de snapshots, cálculos, oráculos, procedencia y bloqueos.

## Task 10: Implementar documentos, geometría, malla e importación FEM

- Crear documentos FEM derivados de 2D/3D, importados o en blanco, con geometría y malla propias.
- Soportar regiones y cajas paramétricas, malla estructurada, edición manual e importación Gmsh 4.1.
- Soportar cargas nodales, de borde, superficie y volumen, apoyos y desplazamientos prescritos.
- Escribir primero pruebas de validación, importación, conectividad, orientación, calidad y modos rígidos.

## Task 11: Implementar elementos, solución y postproceso FEM

- Implementar `TRI3/QUAD4` para esfuerzo/deformación plana, `MITC4` para placas/cáscaras y `TET4` para sólidos elásticos lineales.
- Publicar desplazamientos, reacciones, tensiones, principales, von Mises, calidad de malla y deformada.
- Exportar bundle abierto y VTK.
- Superar patch tests por elemento, simetría, equilibrio, rotación y refinamiento, además de comparaciones analíticas o publicadas.
- Integrar el flujo FEM completo en el shell sin topbar propia.

## Task 12: Cerrar arquitectura, documentación y aceptación integral

- Eliminar duplicados de design system y módulos históricos ya reemplazados.
- Añadir una guarda ejecutable que rechace copias paralelas, imports internos entre dominios y segundas entradas Vite.
- Actualizar README, migraciones, capacidades, estados reales, limitaciones y fuentes/licencias.
- Ejecutar E2E de navegación directa/recarga de las cuatro herramientas, migración, 2D→3D, 3D vacío, Diseño desde selección, FEM completo y recuperación tras fallo.
- Ejecutar una sola vez el gate completo final: corpus 2D intacto, unitarias/integración, Rust/WASM, build, arquitectura, E2E y QA visual/accesible.
- Confirmar que `/Users/crismora/Desktop/FStructure` contiene una única carpeta `fstructure` y que no se hizo push.

## Aceptación final

Una sola app y shell; 2D intacto; 3D sin pérdidas desde 2D y con cambios compatibles revisables; Diseño multinorma honesto; FEM lineal funcional; persistencia transaccional; runtime adaptativo sin límites arbitrarios; QA accesible y ausencia de copias paralelas.
