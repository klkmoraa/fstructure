# Task 3 — formularios propios, UI simplificada y búsquedas cancelables

## Cambios

- Aula presenta dos entradas: **Ejercicio en blanco**, que conserva la creación del modelo sin preselección, y **Resolver sección y acero**, que abre Diseño en la categoría de ejercicios. El diálogo vacío usa una sola columna, ancho compacto y no muestra una escena que sugiera geometría ya creada. Los subtítulos ES/EN ya no prometen generar geometría, apoyos ni cargas.
- Los tres inicios propios se llaman **Sección con acciones dadas**, **Columna con acciones dadas** y **Viga con claros y cargas**. Geometría, materiales, acciones y armado empiezan vacíos; el caso de viga trae un claro con apoyos articulado/rodillo, pero longitud, cargas y acero sin valores. Se comprueba que estos borradores quedan incompletos y no presentan un resultado.
- La columna y la sección ofrecen propuestas asíncronas desde snapshots serializables. El worker solo devuelve parches de armado permitidos; las ediciones posteriores, el cambio de código de sección, la cancelación y el desmontaje descartan respuestas viejas. Hay fallback si no se puede crear el worker.
- Se agruparon controles de geometría, materiales y acciones, y se redujeron controles secundarios. V y los valores de cortante/esbeltez que siguen activos quedan identificados y resumidos en la interfaz. El diálogo de viga dejó de mostrar la guía antigua; los campos `exercise` de ejercicios guardados se siguen leyendo.
- La distribución de sección muestra **Perímetro**, **Lechos** y **Grupos separados**; el campo de zona conserva **Barras por cara** y tiene límite explícito. Se puede proponer sección aunque el armado manual congestione. El texto de propuesta describe lechos, perímetro o grupos de acuerdo con la distribución elegida.

## TDD y verificación

Se observaron fallos RED antes de implementar los contratos nuevos:

- `npx vitest run src/features/design/workbench/designStarts.test.ts`: falló porque faltaba el inicio propio `exercise-section`.
- `npx vitest run src/features/design/workbench/DesignStartDialog.test.tsx`: fallaron el inicio de categoría `exercise` y la expectativa anterior de un caso prefabricado.
- `npx vitest run src/features/design/workbench/reinforcementProposal.test.ts`: falló porque aún no existía el módulo de propuestas.
- `npx vitest run src/features/design/workbench/MaterialFields.test.tsx`: falló la expectativa del máximo de barras por cara.
- `npx vitest run src/features/welcome/NewExerciseDialog.test.tsx`: falló porque el selector de casos todavía se mostraba.

Después del cambio, la suite relacionada pasó con **11 archivos y 91 pruebas**:

```text
npx vitest run src/features/welcome/HomePage.test.tsx src/features/welcome/NewExerciseDialog.test.tsx src/features/design/workbench/reinforcementProposal.test.ts src/features/design/workbench/DesignWorkbench.test.tsx src/features/design/workbench/BeamExerciseGuide.test.tsx src/features/design/workbench/DesignStartDialog.test.tsx src/features/design/workbench/designStarts.test.ts src/features/design/workbench/designMemory.test.tsx src/features/design/workbench/beamExercises.test.ts src/features/design/workbench/MaterialFields.test.tsx src/features/workspace/adapters/DesignSurface.test.tsx
Test Files  11 passed (11)
Tests       91 passed (91)
```

También pasaron:

- `npm run typecheck` — salida cero.
- `npm run build` — salida cero; Vite generó el bundle del worker.
- `git diff --check` — salida cero, antes de los commits.

Las pruebas de jsdom imprimen cuatro avisos existentes de `HTMLCanvasElement.getContext` no implementado. El build imprime los avisos habituales de import dinámico inefectivo para `projectRepository.ts` y de chunks mayores a 500 kB; no impidieron compilar.

## Commits y revisión propia

- Base: `b7dc2c463eb5dc3464f3c085226b84d9f52da39e`.
- Implementación: `4092c626ddd213555888351d1f2a624451f93964`.
- Rama `main`; no se hizo push.
- El documento `docs/design/problemas-armado-validation-2026-10-09.md` del QA del controlador quedó fuera del commit.

Revisé que Home no importe motores ni `DesignWorkbench`, que las propuestas solo apliquen campos permitidos de refuerzo, que las respuestas se invaliden por edición/cambio de código y que las recetas propias no inicien con valores de cálculo. Los casos legacy siguen cubiertos por pruebas de carga/guardado de memoria.

## Rótulos y controles visibles útiles para QA

- Aula: **Ejercicio en blanco** y **Resolver sección y acero**.
- Inicios: **Sección con acciones dadas**, **Columna con acciones dadas** y **Viga con claros y cargas**.
- Sección: **Datos del problema**, **Acero longitudinal**, **Proponer acero**/**Cancelar búsqueda**, **Perímetro**, **Lechos**, **Grupos separados**, **Barras por esquina** y **Barras por cara**.
- Columna: **Sección, materiales y acciones**, **Proponer sección**, **Refuerzo**, **Proponer acero**/**Cancelar búsqueda**.
- Viga: **Geometría y materiales** y **Acero longitudinal y transversal**.

## Pendiente / concerns

No queda un bloqueo de código conocido. La comprobación visual Día/Noche y móvil, junto con el QA del flujo del controlador, corre fuera de esta tanda; las advertencias de canvas/chunks descritas arriba limitan el alcance de las verificaciones automatizadas, pero no causaron fallos.
