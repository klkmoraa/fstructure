# Prompt para Codex · continuación completa de FStructure

Eres Codex trabajando en el repositorio klkmoraa/fstructure (FStructure). Responde y reporta en español. Este prompt contiene todo lo que la persona pidió desde el inicio: continuar la implementación, completar la investigación, buscar una copia legal de ACI 318, generar propuestas visuales en ChatGPT con el navegador y sincronizar GitHub con la carpeta local.

## 0. Contexto y reglas duras
- Lee `AGENTS.md` antes de cualquier cambio. Reglas: no perder datos guardados (las migraciones van con versión); nada sale del dispositivo sin acción explícita; los territorios no se mezclan (`npm run architecture:check`); `main` debe ser publicable (`npm run check`). Cada push a `main` publica en GitHub Pages.
- Idioma: español en la interfaz de trabajo, en los reportes y en los documentos.
- No abras PR. No hagas merge a `main` salvo cambios de código verificados con `npm run check` en verde.
- Los commits no llevan nombres de modelo ni de agente.
- Plan de referencia: `docs/plans/2026-10-14-plan-final-normas-mejoras.md`, en la rama `plan/normas-y-mejoras-2026-10-14`.

## 1. Sincronizar GitHub y la carpeta local (primero, y otra vez al final)
1. `git status` en la carpeta local. Si hay cambios sin commit que no reconoces, no los borres ni los sobrescribas: detente y repórtalo con la lista de archivos.
2. `git fetch --all --prune`.
3. `git checkout plan/normas-y-mejoras-2026-10-14` y después `git pull --ff-only origin plan/normas-y-mejoras-2026-10-14`.
4. Verifica que `git rev-parse HEAD` y `git rev-parse origin/plan/normas-y-mejoras-2026-10-14` coincidan.
5. Verifica que `main` contenga el commit `52fdda8` o uno posterior: `git merge-base --is-ancestor 52fdda8 origin/main`.
6. Lee el plan de referencia y confirma que existe. Si no existe en la rama, detente y repórtalo.

Si cualquier paso falla, reporta el estado exacto (ramas, commits, archivos modificados) y no sigas.

## 2. Investigación completa

**Actualización documental · 2026-10-14:** la investigación solicitada abajo ya fue realizada y está integrada en el plan de referencia. Consultar el [informe de cierre](../research/reports/Investigación%20pendiente%20de%20FStructure.md), [acceso ACI](../research/aci-318-acceso-legal.md), [normas y acceso](../research/normas-estado-y-acceso.md), [referencias visuales](../research/referencias-visuales.md) y [comunidad/licencias](../research/propuestas-comunidad.md). Se conservan estas instrucciones como alcance de la investigación. Cada entregable registra fuentes, fecha y límites: completar el informe no equivale a obtener ACI, verificar todas las cláusulas ni implementar normas. La edición ACI 318-25 española sí existe; la copia licenciada de FStructure sigue pendiente.

Completa lo que la investigación previa no resolvió. Cada hallazgo lleva URL, fecha de consulta y marca de "verificado" o "no verificado". Guarda los resultados en `docs/research/`.

### 2.1 ACI 318 (copia legal)
La persona no tiene copia de ACI. Busca vías legítimas para obtener ACI 318-25, o la edición vigente, aplicables en México:
- ACI (concrete.org): ACI 318 PLUS, membresía estudiantil, copia de cortesía para profesores, precio en pesos.
- Catálogos de bibliotecas universitarias mexicanas que tengan ACI 318 (UNAM, UAM, IPN, UDG/ITESO, UANL, Universidad de Guanajuato, entre otras). Verifica cada catálogo. No inventes registros.
- IMCYC: confirma si existe una edición 2025 en español.
- Si encuentras una copia gratuita y legal (biblioteca digital con licencia institucional, acceso abierto de ACI), regístrala con URL y fecha.
Entregable: `docs/research/aci-318-acceso-legal.md` con cada vía, su costo verificado, la condición de acceso, la fuente y la fecha.

Reglas: no descargues PDFs de sitios piratas, blogs ni copias de terceros. Si no hay copia legal, deja ACI como "pendiente de copia" y no implementes nada de ACI.

Cuando la persona entregue el archivo: calcula su SHA-256 fuera del repositorio. Nunca subas el PDF al repositorio: la política lo prohíbe. La auditoría del 2026-10-14 no encontró una prueba que lo impida automáticamente; no atribuir esa garantía a `normativeEvidence.test.ts`.

### 2.2 Normas: estado y acceso
- NSR-10 Título C (AIS, Ministerio de Vivienda): confirma la URL oficial del texto y que la versión registrada siga vigente.
- E.060 (vivienda.gob.pe, El Peruano): confirma la URL oficial y la resolución vigente.
- Eurocode 2 (JRC, BSI): confirma el estado de la segunda generación y si hay acceso gratuito a un Anexo Nacional.
- Código Estructural de España (RD 470/2021): ya verificado en el BOE (`https://www.boe.es/eli/es/rd/2021/06/29/470`, PDF `https://www.boe.es/boe/dias/2021/08/10/pdfs/BOE-A-2021-13681.pdf`). Título 2 «Estructuras de hormigón», artículos 26 a 78, capítulos 7 a 16, y disposición transitoria única.
- "ASCI" no está confirmada como organización. No la uses como fuente.

### 2.3 Referencias visuales y propuestas de la comunidad
- Busca referencias para estados vacíos, colocación de etiquetas en gráficas, tablas de datos y dock en teléfono: Carbon (empty states, data table), Cloudscape, Supabase, Guidewire Jutro, Excalidraw, d3fc-label-layout, Vega-Lite, Observable Plot.
- Propuestas abiertas de la comunidad: busca en issues y discusiones de Excalidraw, PyNite, Frame3DD y anaStruct propuestas sobre interacción, etiquetas o dibujo de diagramas. Resume cada una con enlace. No copies código.
- Imágenes de referencia: guarda sólo si la licencia lo permite. Si no, enlaza la página. Cada imagen con URL de origen, licencia y fecha.
- Revisa la licencia de PyNite, OpenSeesPy y SFAP.

Entregable: `docs/research/referencias-visuales.md` y `docs/research/propuestas-comunidad.md`.

## 3. Propuestas visuales en ChatGPT (navegador)
Usa el navegador integrado, o Chrome si es lo que tienes disponible, y la cuenta de ChatGPT de la persona.

1. Abre `https://chatgpt.com`. Verifica que la cuenta esté iniciada.
2. Si pide iniciar sesión, un código o una verificación (captcha), detente y repórtalo. No escribas credenciales que no te den. No evadas verificaciones.
3. Abre un chat nuevo. No uses un proyecto ni un GPT personalizado.
4. Envía este primer mensaje:

> Usa tu generador de imágenes para crear nueve propuestas de pantalla de la app FStructure, con la misma marca en todas. Genera una imagen por mensaje, en el orden de la lista. Son interfaces de software reales, no ilustraciones decorativas. Escribe los textos exactamente como se indican, sin traducirlos ni inventar cifras.
>
> **Marca:** acento rojo `#ED4B46` (noche `#FF8E80`), texto sobre acento `#14171A`, texto de acento `#C23A33`, fondo día `#F7F6F1`, superficies `#FFFEFA`, fondo noche `#14171A`. Resultados en verde `#1AA57A`, ámbar o rojo; el acento nunca pinta un resultado. Tipos: Space Grotesk para títulos, Inter para texto, IBM Plex Mono para cifras y códigos. Radios de 8 a 12 px, sombras suaves. Cuadrícula de lienzo `#EDECE6` (día) y `#212528` (noche). Marca: una ménsula con franja roja junto al nombre "FStructure". Formatos: 1440 × 900 para escritorio y 390 × 844 para teléfono.
>
> Después de cada imagen, confirma si el texto coincide con la lista.

5. Envía las nueve propuestas, una por mensaje, con el bloque de marca del primer mensaje como referencia:

**01 · Home, día y noche (escritorio).** Título "Modela, analiza y diseña estructuras.". Dos columnas: "Calcular por separado" (mosaicos "Modelo 2D", "Modelo 3D", "Viga", "Columna", "Zapata", "Sección a flexión") y "Proyecto completo" (tarjetas "2D", "3D", "Diseño"). Debajo, "Proyectos recientes".

**02 · Modelo 2D vacío (escritorio, día).** Lienzo con cuadrícula. Tarjeta central "Empieza tu modelo 2D" con cinco opciones: "Viga apoyada" ("6 m · CM 15 y CV 8 kN/m"), "Voladizo", "Viga continua", "Pórtico", "Armadura Pratt". Botones secundarios "Generar con medidas propias" y "Dibujar nudos y barras". Barra inferior flotante con "Seleccionar", "Nodo", "Barra", "Apoyo", "Carga".

**03 · Viga continua con diagramas (escritorio, día).** Arriba, diagrama de cuerpo libre con cargas en rojo y reacciones "RA = 75.8 kN", "RB = 218.2 kN", "RC = 51.6 kN". Abajo, momento flector con curva roja y etiquetas "M mín −100.8 kN·m" y "M máx 82.9 kN·m". Las etiquetas no cruzan la curva ni las barras.

**04 · Armadura Pratt con axial (escritorio, noche).** Cuerdas y montantes en gris. Barras en tensión en azul y en compresión en rojo. Etiquetas "N máx 24.00 kN" fuera de las barras, sin cruzarlas. Miniatura de la estructura en una esquina.

**05 · Estado de revisión en tres niveles (panel de resultados, día).** Tres tarjetas: "Cumple" (verde, "100 %"), "No cumple" (rojo, "105 %") y "Faltan datos" (gris, "Faltan: sección de la barra, carga viva"). Lista corta debajo. No repitas el texto "Revisión incompleta".

**06 · Estado vacío con filtros en Proyectos (teléfono, día, 390 × 844).** Lista de proyectos sin resultados para el filtro activo. Texto "Ningún proyecto coincide con el filtro." y botón "Limpiar filtros". La altura de la lista se conserva.

**07 · Corte de zapata con secciones críticas (escritorio, día).** Pedestal y columna con "Pu = 1,230 kN" en flecha. Secciones "M", "d/2" y "d" marcadas con líneas de color, con etiquetas pegadas a su línea. Cotas "h = 55 cm" y "d = 45.9 cm" a la derecha. Presión "205 kPa" abajo.

**08 · Barra de 3D y Diseño en teléfono (noche, 390 × 844).** Barra superior con el nombre de la mesa y un solo botón de acción. Dock inferior mínimo con cuatro iconos, sin texto. Foco en el dibujo.

**09 · Columna con encabezado (escritorio, día).** Encabezado "Sección, materiales y acciones" con el botón "Proponer sección" en una sola línea. Formulario de base, peralte, f′c, fy, Pu, Mux y Muy.

6. Si el texto de una imagen no coincide, pide corrección sólo de ese texto, una vez. Si vuelve a fallar, guárdala con la etiqueta "revisar" y sigue con la siguiente.

## 4. Guardar las imágenes en el repositorio
1. Crea `docs/research/assets/propuestas-visuales/`.
2. Descarga cada imagen como `01-home.png`, `02-modelo-2d-vacio.png`, `03-viga-continua.png`, `04-armadura-axial-noche.png`, `05-revision-tres-estados.png`, `06-proyectos-sin-resultados.png`, `07-corte-zapata.png`, `08-dock-movil-noche.png`, `09-columna-encabezado.png`.
3. Crea `docs/research/assets/propuestas-visuales/README.md` con una tabla: número, archivo, estado (aprobada, revisar o pendiente), fecha y hora de generación, y observaciones sobre la coincidencia de textos.
4. Si una imagen pesa más de 300 KB, redúcela sin perder la legibilidad de los textos.
5. Haz commit en la rama del plan y push. No toques `main`.

## 5. Implementación (sólo después de sincronizar y de la investigación)
Un commit por tema, cada uno con sus pruebas. Cada push a `main` debe pasar `npm run check`.

**Fase 0 · Riesgo de datos y publicación**
1. Memoria con norma desconocida. `src/features/design/workbench/designMemory.tsx`, líneas 41 y 328: una norma no reconocida se reetiqueta como `ntc-2023` sin avisar. Conserva el código original, bloquea el recálculo y muestra «Norma no disponible en esta versión». Pruebas: `designMemory.test.tsx`, `src/data/migrate.test.ts`, y a mano abrir → guardar → reabrir y un archivo inválido.
2. Documentación desfasada. `docs/design/design-workbench.md` y `docs/references/normative/README.md` citan `src/design/structuralDesignMigration.test.ts`, que no existe. Las fuentes, páginas y hashes se validan en `src/design/normativeRegistry.test.ts`; `normativeEvidence.test.ts` contrasta constantes. Las referencias documentales se corrigieron en el cierre de investigación. No se encontró una prueba de bloqueo de PDFs; conservar esa distinción.
3. `$` extra en el porcentaje de utilización (busca el formateo en `src/i18n/catalogs/`).
4. Pages con el flujo oficial en `.github/workflows/deploy-pages.yml`: `configure-pages`, `upload-pages-artifact`, `deploy-pages`, con `needs` y permisos `pages: write` e `id-token: write`. Prueba primero en una rama.
5. Escenas de la Home a WebP en `public/assets/suite/` (hoy hay 8 PNG). Conserva el respaldo.
6. Aviso «Nueva versión lista · Recargar» en `scripts/sw.template.js`.

**Fase 1 · Mejoras visuales V1 a V9**
- V1 y V2: etiquetas del lienzo que no cruzan curvas ni barras. Ampliar `src/features/canvas/labelLayout.ts` (sin dependencias nuevas). Candidatos en `src/features/canvas/StructuralCanvas.tsx`, líneas 2308 a 2344 y 2504. Pruebas: `labelLayout.test.ts`, `CanvasResultLayer.test.tsx`. Capturas de los cinco inicios del 2D, a 1440 y 390 px, claro y oscuro.
- V3: revisión en tres estados (Cumple, No cumple, Faltan datos). Lógica en `src/design/elements/scope.ts`, línea 161. Pruebas: `codes.test.ts`, capturas.
- V4: «Proponer sección» en una sola línea en `src/features/design/workbench/ColumnWorkbench.tsx`. Capturas a 1440 y 390 px.
- V5: DCL legible en teléfono en `src/features/design/workbench/BeamDrawings.tsx` (`BeamFreeBody`). Pruebas: `designReport.test.ts`.
- V6: tarjeta vacía del 2D en `src/features/canvas/ModelStartCard.tsx`. Pruebas: `App.test.tsx -t "Modelo 2D individual"`.
- V7: estados vacíos con «Limpiar filtros» sólo cuando hay filtros, en Proyectos (`src/features/project-hub/`) y en `DesignMemoryDialog.tsx`. Pruebas: `HomePage.test.tsx`, capturas.
- V8: barra mínima en 3D y Diseño en teléfono.
- V9: parámetros de diseño junto al elemento en `DesignWorkbench.tsx`. Pruebas: `DesignWorkbench.test.tsx`.
- Si cambia la interfaz de una mesa, actualiza capturas y ficha en `docs/brandbook/`.

**Fase 2 · Norma de España (RD 470/2021)**
Sólo después de leer el texto completo en el BOE (Título 2, capítulos 7 a 16, y disposición transitoria). Descarga el PDF fuera del repositorio y calcula su SHA-256. Registra cada cláusula en `docs/design/normative-sources.json` con página, URL, hash y un extracto de una línea como máximo (fila de tabla o ecuación). Después crea el perfil en `src/design/elements/codes.ts` y el bloque del oráculo en `validation/python/elements_oracle.py`. Si no puedes leer el texto, detente y repórtalo. No completes constantes de memoria.

**Fase 3 · Cálculo individual completo**
- Individual → proyecto: promover un archivo individual a proyecto creando una copia. El original no se toca. Migración con versión.
- DCL de zapata de lindero y losa de cimentación. Valores de referencia: R1 800 kN, R2 1 000 kN; losa de 2 × 2 claros.
- Viga → zapata: puente en `src/integrations/beamFooting`, sin importar la interfaz del 2D ni de Diseño. Verifica con `npm run architecture:check`.

**Fase 4 · Modelo 3D**
Primero el corpus de referencia (valores de PyNite o Frame3DD, sólo como números). Después: resortes en apoyos, brazos rígidos, Timoshenko, espectro con envolventes, excentricidad accidental del diafragma, dibujo rápido de barras y losas como áreas. La torsión de diseño queda bloqueada hasta tener cláusula registrada.

**Fase 5 · Diseño**
- Bloque C: reacciones a zapata aislada y despiece con CSV y SVG. Oráculo: zapata de 2.45 m con 13 #5 por dirección.
- Bloque D: losa maciza unidireccional, sección libre, equilibrio biaxial y servicio.
- Pórtico: cargas puntuales, voladizos y worker para el 5 × 5 con sismo.
- Bloqueados por normativa: torsión, losas, muros, zunchos, lindero, dados, NSR-10 B.2.4.2, E.060 9.2.3.

**Fase 6 · ACI 318-25 (sólo con copia legal)**
Registra el hash del archivo, la página y las líneas permitidas. Contrasta la flexión de viga con RecrBeam (MIT), anotando que es la edición 318-19. Usa `officialDocument` en el registro, y ajusta `src/design/normativeRegistry.test.ts` para aceptarlo.

**Fase 7 · Limpieza**
- Quita el modo sin shell de `Space3DWorkspace.tsx` migrando sus pruebas.
- Divide `ProjectContext.tsx` y `WorkspaceShell.tsx` en tandas, con pruebas y `npm run deadcode` en cada una.
- Auditoría de dependencias en CI.

**Fase 8 · Pruebas de humo**
Playwright sobre la Home y sus secciones, en claro, oscuro y 390 px, con los scripts dentro del repositorio. Matriz de importación y exportación: un archivo válido y uno inválido por formato. PDF de Diseño en Safari: prueba manual.

## 6. Pruebas mínimas por tipo de cambio
| Cambio | Pruebas | Comando |
|---|---|---|
| Copy o CSS | Revisión visual | Capturas en claro y oscuro; `npm run lint:design` |
| Registro normativo (JSON) | Registro, evidencia, códigos | `npx vitest run src/design/normativeRegistry.test.ts src/design/normativeEvidence.test.ts src/design/elements/codes.test.ts` |
| Perfil de norma o `shared.ts` | Elementos y oráculo | `npx vitest run src/design/elements` + `npm run design:oracle` + `npm run typecheck` |
| Oráculo Python | Oráculo | `npm run design:oracle` |
| Memoria o datos guardados | Memoria y migraciones | `npx vitest run src/features/design/workbench/designMemory.test.tsx src/data/migrate.test.ts`; abrir → guardar → reabrir; archivo inválido |
| Selector o flujo de piezas | Taller y App | `npx vitest run src/features/design/workbench/DesignWorkbench.test.tsx src/App.test.tsx -t "pieza individual"` |
| Etiquetas del lienzo | Etiquetas | `npx vitest run src/features/canvas/labelLayout.test.ts src/features/canvas/CanvasResultLayer.test.tsx`; capturas 1440 y 390 px |
| Estados vacíos | Home y App | `npx vitest run src/features/welcome/HomePage.test.tsx src/App.test.tsx -t "Modelo 2D individual"`; capturas |
| Integraciones | Territorios | `npm run architecture:check` |
| División de archivos | Pruebas del archivo | Pruebas del archivo + `npm run deadcode`; un archivo por commit |
| Publicación | Todo | `npm run check`; verificar el sitio en vivo |
| Cambio transversal | Todo | `npm run check` |

## 7. Publicación y sincronización final
1. Antes de cada push a `main`: `npm run check` en verde. Si falla, no hagas push.
2. Después de cada push a `main`, espera el despliegue y verifica https://klkmoraa.github.io/fstructure/ (Home, mesa 2D vacía y una pieza individual).
3. Al terminar, repite la sincronización de la sección 1: `git fetch --all --prune`, compara `HEAD` con su remoto para cada rama que tocaste, y confirma que la carpeta local y GitHub tengan lo mismo.

## 8. Límites
- No pierdas datos guardados. Las migraciones van con versión.
- Nada sale del dispositivo: sin telemetría ni envío de datos a servicios externos. El único envío permitido es el texto de los prompts a ChatGPT, en la cuenta de la persona.
- No cambies valores normativos sin evidencia registrada.
- No subas PDFs normativos ni archivos del proyecto a ChatGPT.
- No abras PR salvo que te lo pidan.

## 9. Reporte final (en español)
- Sincronización: estado inicial y final de GitHub y de la carpeta local.
- Investigación: qué archivos creaste, qué quedó verificado y qué no, y el estado de ACI (vías encontradas, copia o no).
- Propuestas visuales: cuántas imágenes se generaron, cuáles aprobadas, cuáles a revisar, y la ruta de la carpeta.
- Implementación: commits por fase, qué pruebas corriste y su resultado, qué quedó pendiente y por qué.
- Publicación: si el sitio en vivo refleja lo verificado.
- Bloqueos: login, captchas, copias no encontradas o textos que no se pudieron leer.
