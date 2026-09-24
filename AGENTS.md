# FStructure — guía persistente para agentes

## Producto y alcance

FStructure es una aplicación web local-first y experimental de modelado y análisis estructural. Una sola app React/Vite integra Modelo 2D, Diseño, Modelo 3D y FEM. No es software certificado ni sustituye una revisión profesional. Estas reglas cubren todo el repositorio; no se permiten `AGENTS.md` anidados ni adaptadores equivalentes.

## Invariantes

- Mantener una sola app, una sola entrada Vite y un solo sistema de diseño raíz.
- El proyecto es un contenedor compartido (identidad, nombre, guardado); cada herramienta guarda su propia rama (`model2d`, `design`, `space3d`, `fem`) y ninguna deriva datos de otra.
- Cada herramienta (Modelo 2D, Diseño, Modelo 3D, FEM) monta su propio shell y se elige sólo desde el Inicio. Ninguna importa código de otra: `src/design` + `src/features/design`, `src/modules/space3d` y `src/modules/fem` son territorios separados, y la interfaz 2D (`src/features`) tampoco carga interfaz ajena (gate `architecture:check`). Sólo `src/features/workspace` (registro, adaptadores y shells) las conoce a todas.
- Conservar unidades internas, signos, ejes, grados de libertad, precisión y conversiones de forma explícita. No redondear entradas del solver para presentación.
- No aceptar `NaN`, infinitos, objetos de runtime, ciclos, archivos sobredimensionados ni rutas inseguras en persistencia/importación.
- No perder datos silenciosamente. Migraciones, guardado, undo/redo e import/export deben fallar de forma visible y recuperable.
- Los workers usan contratos versionados y datos serializables. No transferir estado React, objetos DOM ni instancias de clases.
- Mantener el proyecto local-first. Cualquier transmisión de un modelo o expediente requiere una acción y destino comprensibles para la persona usuaria.
- `src/foundation` es la Foundation canónica del producto. No añadir paquetes ni imports de productos hermanos.
- Diferenciar en UI y documentación `Disponible`, `Experimental`, `Planeado` y `No comprometido`.

## Fuentes de verdad

Ante contradicciones, usar este orden:

1. código ejecutable y formatos persistidos actuales;
2. pruebas y gates reproducibles;
3. `AGENTS.md` y contratos documentados vigentes;
4. `fix/features/README.md` para estado de mejoras;
5. README y documentación especializada;
6. planes, historial y conversaciones.

Una prueba verde demuestra sólo lo que ejecuta. Un plan o una pantalla pulida no demuestran una capacidad.

## Antes de modificar

1. Ejecutar `git status --short` y preservar cambios ajenos.
2. Leer este archivo, `README.md` y los archivos de dominio afectados.
3. Si el trabajo es una mejora, seguir el protocolo de backlog de abajo.
4. Identificar entidad, unidades, persistencia, undo/redo, worker, exportación y pruebas afectadas.
5. Cargar sólo las skills aplicables desde `.agents/skills/`; sus referencias se leen bajo demanda.
6. Preferir una verificación focalizada antes del gate completo.

## Entorno y comandos reales

- Runtime: Node 24 (`.nvmrc`), npm con `package-lock.json` y Python 3 para el oráculo de diseño.
- Instalar: `npm ci`.
- Desarrollo: `npm run dev`.
- Typecheck: `npm run typecheck`.
- Lint: `npm run lint`.
- Pruebas TS/React: `npm test -- <ruta-de-test>`; suite: `npm test`.
- Arquitectura: `npm run architecture:check && npm run architecture:test`; ambos forman parte de `npm run check`.
- Diseño estructural: `npm run design:delivery:test && npm run design:oracle`.
- Build: `npm run build`; gate general: `npm run check`.

No sustituir `npm ci` por una instalación que cambie el lockfile. Si un comando no puede ejecutarse por el entorno, registrar el fallo exacto y no presentarlo como validado.

## Mapa de arquitectura

- `src/App.tsx`, `src/features/workspace/`: rutas por query string, `WorkspaceShell` (Modelo 2D), `ToolShell` (Diseño, 3D, FEM), `toolCatalog.ts` (identidad pública de cada herramienta) y superficies.
- Navegación: Inicio de FusionStructure (`src/features/welcome/SuiteHome`, `?surface=welcome`) → bienvenida de la herramienta (`?surface=home&tool=…`) → mesa (`?tool=…`). FStructure conserva su bienvenida original (`Model2DWelcome` + `Solver2DHome`); Solver 3D, FEM y Diseño usan `src/features/tool-home/ToolHome` desde sus territorios (`Space3DHome`, `FemHome`, `DesignHome`). Las entradas de una bienvenida llegan a la mesa por `features/workspace/toolIntent.ts`. Escenas: `src/features/structural-assets/suiteScenes.ts`, renderizadas con `node scripts/render-suite-scenes.mjs` a `public/assets/suite/`.
- `src/types.ts`, `src/data/`, `src/commands/`: modelo 2D, migraciones y mutaciones reversibles.
- `src/store/`: estado React, historial, selección, análisis y coordinación de persistencia.
- `src/engine/`, `src/analysis-methods/`, `src/foundation/`: solver, estudios, unidades y álgebra numérica.
- `src/workers/`, `src/runtime/`, `src/numeric/`: aislamiento, protocolos versionados y presupuesto de memoria del análisis.
- `src/storage/`, `src/shared/project/`: repositorios IndexedDB, bundles, checksums, versiones y recuperación.
- `src/import/`, `src/utils/portable*`, `src/utils/pdf/`: DXF, expedientes, JSON, PDF y exportaciones.
- `src/design/`: cálculo de diseño y evidencia normativa.
- `src/modules/space3d/`, `src/modules/fem/`: dominios 3D y FEM detrás de adaptadores explícitos.
- `src/design-system/`, `src/features/`: componentes, canvas, accesibilidad y experiencia de usuario.

Las reglas de negocio viven fuera de la UI. Las superficies consumen comandos/DTO; no escriben formatos persistidos ad hoc.

## Implementación y datos

- TypeScript estricto; evitar `any`, casts que oculten validación y mutaciones compartidas.
- Usar metros, kN y las unidades base documentadas en los tipos; convertir sólo en fronteras.
- Los resultados derivados deben llevar identidad/procedencia y se invalidan al cambiar entradas relevantes.
- Toda mutación del proyecto debe declarar si afecta análisis y participar en undo/redo o explicar por qué no.
- Validar datos no confiables antes de normalizarlos o descomprimirlos; mantener presupuestos de archivo.
- No crear sincronización ni derivación entre herramientas; si algún día se añade un intercambio, debe ser una importación explícita que la persona dispara.
- Preferir formatos abiertos. DWG/IFC y física no implementada deben rechazarse de forma explícita, no simularse.
- Preservar navegación por teclado, nombres accesibles, foco visible, reducción de movimiento y controles táctiles.
- No introducir telemetría o red sin consentimiento, documentación y prueba del modo offline/local.

## Estrategia de pruebas

- UI/copy/estilos: typecheck o build y revisión visual focalizada; teclado y un viewport móvil si cambia interacción.
- Comandos/modelo/undo: prueba unitaria del comando, ida/vuelta y estado de historial.
- Solver/unidades/diseño: caso pequeño con solución de referencia, tolerancia explícita y prueba del fallo.
- Persistencia/migración: abrir, guardar, reabrir, conflicto y recuperación sin pérdida.
- Import/export: fixture válido, corrupto, sobredimensionado y round trip cuando el formato lo permita.
- Worker/protocolo: éxito, error, versión incompatible y cancelación/respuesta obsoleta.
- Cambio transversal o release: `npm run check` (incluye lint, typecheck, arquitectura, suite, oráculo y build) y prueba visual de las cuatro superficies.

El gate completo puede ser costoso; ejecútalo cuando el alcance sea transversal, cuando cierre una tarea que lo exige o cuando el usuario lo solicite. Documenta qué sí y qué no se ejecutó.

## Git, revisión y terminado

- No hacer commit, push, ramas, PR ni release salvo solicitud explícita de esa sesión.
- No descartar, reescribir ni formatear cambios ajenos. Evitar comandos destructivos.
- Revisar corrección, unidades, estabilidad numérica, pérdida de datos, accesibilidad, privacidad, bundle y compatibilidad.
- Un cambio está terminado sólo con alcance cumplido, verificaciones relevantes verdes, documentación/fixtures actualizados y limitaciones declaradas.
- No cerrar una mejora con pruebas fallidas o evidencia pendiente. El responsable y la evidencia de cierre se registran en el backlog, no en este archivo.

## Skills

- Leer `.agents/skills/fstructure-workflows/SKILL.md` para cambios de modelo, solver, persistencia, undo/redo, workers o interoperabilidad.
- Leer `.agents/skills/security-best-practices/SKILL.md` sólo ante una revisión de seguridad explícita o trabajo secure-by-default; cargar únicamente sus referencias JavaScript/React aplicables.
- Leer `.agents/skills/accessibility-review/SKILL.md` al auditar o cambiar interacción, foco, semántica, contraste o responsive.
- Leer `.agents/skills/design-system/SKILL.md` al auditar, documentar o extender tokens y componentes compartidos.
- Leer `.agents/skills/testing-strategy/SKILL.md` para diseñar una estrategia nueva, cobertura o un plan transversal; conservar la matriz específica de FStructure como autoridad.
- Leer `.agents/skills/documentation/SKILL.md` para README, arquitectura, runbooks u onboarding, sin duplicar fuentes de verdad.
- Consultar `.agents/skills/CATALOG.md` para procedencia, licencia y fuentes descartadas.
- Si Superpowers está disponible globalmente, usar sus procesos de brainstorming, depuración, TDD, revisión y verificación cuando apliquen. No copiarlo al repositorio ni permitir que sustituya estas reglas o el alcance del backlog.

## Flujo del backlog

Frase activadora: **“Vamos a trabajar en las mejoras”.**

Al recibirla:

1. leer `AGENTS.md`, `fix/features/README.md` y `fix/features/00-auditoria-base.md`;
2. elegir en el índice la tarea `[ ]` de mayor prioridad que no esté bloqueada ni en curso, respetando dependencias y el orden listado;
3. cambiarla a `[>]` tanto en el índice como en su archivo y registrar fecha/responsable;
4. implementar solamente el alcance descrito;
5. ejecutar la estrategia de pruebas de esa tarea;
6. cambiarla a `[x]` sólo si cumple todos los criterios y registrar evidencia reproducible;
7. si aparece trabajo adicional, crear una tarea relacionada sin ampliar silenciosamente el alcance.

Órdenes especiales:

- **“Vamos con ID-001”**: trabajar exactamente en ese ID; si está bloqueado, explicar la dependencia.
- **“Revisa el avance de las mejoras”**: informar desde el índice y la evidencia, sin implementar.
- **“Cierra la mejora en curso”**: cerrar sólo si todos sus criterios tienen evidencia suficiente.

`fix/features/README.md` es la única fuente de estado. Los archivos por categoría contienen el detalle y deben conservar la misma marca. Al añadir, dividir o cerrar tareas, actualizar ambos en el mismo cambio.

## Mantenimiento

Actualizar este archivo sólo cuando cambien comandos, fronteras, invariantes o el protocolo de trabajo. Mantenerlo compacto: la evidencia histórica y las instrucciones de dominio extensas pertenecen al backlog, documentación o skills.
