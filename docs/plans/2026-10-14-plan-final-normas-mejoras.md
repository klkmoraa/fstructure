# Plan final · normas, pruebas y mejoras · FStructure

Fecha original: 14 de octubre de 2026. **Actualizado con investigación de cierre el 14 de octubre de 2026.** Reemplaza a `plan-todo.md` y `plan-normas-y-mejoras.md`. Esta actualización es documental: no incorpora normas al motor ni publica cambios en la app.

## 0. Resumen ejecutivo

1. **ACI 318-25 existe oficialmente en español**, con ficha ACI fechada el 29-09-2026. Esto corrige la conclusión original. FStructure sigue **pendiente de copia legal**; no se adquirió ni descargó el Código.
2. **NSR-10 y E.060 tienen fuentes oficiales identificadas.** Deben distinguirse sus modificaciones y propuestas de actualización de la evidencia de las cláusulas ya registradas. Una noticia o comité no sustituye un acto de aprobación.
3. **El Código Estructural español tiene acceso público, pero su implementación exige más lectura.** El art. 45 remite a Anejos 19/21 y las bases al Anejo 18; no basta con artículos 26–78. Se identificó la corrección de 2024.
4. **La investigación visual ya incluye tablas, táctil, diagramas y comunidad.** Las reglas externas orientan propuestas bajo el canon de FusionStructure; no acreditan que las mejoras estén implementadas en la app oficial.
5. **Antes de ampliar normas deben revisarse los riesgos de datos y las pruebas.** La investigación no reparó el recálculo de normas desconocidas ni cambió el registro. Las propuestas de código están aisladas en `feature/propuestas-visuales-brandbook`.

Documentos de investigación (consulta **2026-10-14**; cada fuente distingue **Verificado** y **No verificado**):

- [Informe de cierre e índice](../research/reports/Investigación%20pendiente%20de%20FStructure.md).
- [ACI: acceso legal y comprobación de bibliotecas](../research/aci-318-acceso-legal.md).
- [Normas: estado, acceso y mapa técnico](../research/normas-estado-y-acceso.md).
- [Referencias visuales y criterios V1–V9](../research/referencias-visuales.md).
- [Comunidad y licencias](../research/propuestas-comunidad.md).
- [Nueve propuestas en código y límites](../research/propuestas-codigo-2026-10-14.md).

## 1. Lo que dice la investigación, norma por norma

| Norma | Estado comprobado a 2026-10-14 | Acceso y acción |
|---|---|---|
| NTC-CDMX Concreto 2023 | El registro local contiene 74 entradas de cláusula. Esta investigación no repite la auditoría de vigencia de NTC. | Mantener su evidencia registrada; no usar este informe como nueva certificación. |
| NSR-10 Título C | **Verificado:** Decreto 926/2010 y cadena de modificaciones; AIS 100-24 es una propuesta, no un reglamento adoptado por ese solo hecho. | [Texto base IDRD, 590 páginas](https://www.idrd.gov.co/sites/default/files/documentos/Construcciones/3titulo-c-nsr-100.pdf) accesible. **No verificado:** cotejo de cada cláusula del motor con todos los modificatorios. |
| E.060 Perú | **Verificado:** DS 010-2009-VIVIENDA, firma 8-may/publicación 9-may-2009; [El Peruano](https://busquedas.elperuano.pe/dispositivo/NL/346173-9), art. 2. Los proyectos de 2019 y 2026 y el grupo de 2025 no acreditan aprobación de una sustitución. | Se identificó la ruta oficial RNE/SENCICO y el archivo registrado. **No verificado:** nueva lectura de sus bytes desde Drive y existencia de un acto aprobatorio posterior fuera del rastreo documentado. |
| Código Estructural RD 470/2021 | **Verificado:** [BOE](https://www.boe.es/eli/es/rd/2021/06/29/470), texto y corrección de 2024; art. 45 → Anejos 19/21. | Consulta pública. Antes de agregar: elegir ámbito, leer anejos, registrar cláusulas/páginas/hashes, validar casos independientes y resolver riesgo de datos. |
| ACI CODE-318-25 | **Verificado:** edición oficial española, [ficha ACI 29-09-2026](https://www.concrete.org/publications/internationalconcreteabstractsportal.aspx?id=51752098&m=details). | Compra/suscripción. **Pendiente de copia legal**, sin implementación. Precio español y MXN no verificados. |
| Eurocódigo 2 | **Verificado:** [JRC](https://eurocodes.jrc.ec.europa.eu/second-generation-eurocodes) fija publicación nacional hasta 30-sep-2027 y retirada de primera generación hasta 30-mar-2028; BSI ya vende adopción 2023 y Anejo británico. | País y Anejo Nacional obligan a una decisión explícita. Hay [NA danés gratuito](https://www.bygningsreglementet.dk/nationale-annekser/nationale-annekser/nationale-annekser/?Layout=ShowAll) de primera generación; no equivale a texto EN completo ni a NA de segunda generación. |
| CSA A23.3:24 | **Verificado:** ficha editorial de octava edición 2024. | Compra/suscripción; **no verificado** acceso gratuito general o licencia de biblioteca concreta. Véase informe de normas. |
| ABNT NBR 6118 | **Verificado:** acuerdo profesional Confea/ABNT y referencia a edición 2023. | **No verificado:** edición más reciente del catálogo y acceso CAPES que afirmaba el borrador. No asumir que un acuerdo brasileño habilite al usuario de México. |

Las URLs, fechas y límites completos están en los cuatro documentos de investigación. Se retiró la afirmación no sustentada sobre un sismo de 2026 como fundamento de vigencia de NSR. «ASCI» no se utiliza como fuente.

## 2. Qué significa para México

No se investigó la adopción municipal/estatal de ACI en todo México. **No verificado:** que una norma extranjera sea aplicable a un proyecto concreto por el solo hecho de estar disponible en la herramienta. Antes de elegirla se debe identificar jurisdicción, edición adoptada, alcance y condiciones. El acceso legal al texto y su aplicabilidad técnica/jurídica son comprobaciones diferentes.

## 3. ACI 318: vías legales de acceso

| Vía | Resultado de la comprobación a 2026-10-14 |
|---|---|
| Compra directa ACI CODE-318-25 | **Verificado:** US$309 público / US$184 miembro en la ficha inglesa Protected PDF. **No verificado:** precio de la variante española, MXN, impuestos/envío o total final México. |
| ACI 318 PLUS | **Verificado:** US$299 público / US$169 miembro al año en la ficha consultada; corrige el precio anterior de US$149. **No verificado:** inclusión del texto español en PLUS. |
| Estudiante elegible | **Verificado:** membresía gratuita bajo condiciones y una copia a US$105 anunciada por ACI. **No verificado:** elegibilidad de la persona, idioma español y costo final México. La membresía por sí sola no entrega el Código. |
| Docente / Faculty Network | **Verificado:** desk copy y año PLUS bajo condiciones. No se interpreta como autorización para compartir el Código con terceros; las notas de curso son un recurso distinto. |
| ACI Collection Online | **Verificado:** índice incluye CODE-318-25 Spanish; ficha anual US$1,049 público / US$319 miembro. No es precio del título español individual ni acceso adquirido. |
| Bibliotecas UNAM, UAM, IPN, UDG, ITESO, UANL y Guanajuato | Se revisaron portales/catálogos, con errores, login o formularios no consultables. **No verificado:** tenencia, ejemplar y disponibilidad de ACI. No concluir ausencia del libro ni convertir snippets en registro confirmado. |
| IMCYC | **No verificado:** distribución propia 2025 española, precio y disponibilidad; tienda no legible en el acceso consultado. La existencia del título español se verificó directamente en ACI. |

Fuentes y condiciones de cada vía: [ACI 318: acceso legal](../research/aci-318-acceso-legal.md). No se encontró una copia gratuita autorizada de acceso general en las fuentes consultadas; esto no excluye licencias institucionales no confirmadas. No se hicieron compras, solicitudes ni inicios de sesión.

Al recibir una copia autorizada, calcular SHA-256 **fuera del repositorio**, conservar edición/erratas y registrar sólo la evidencia permitida. **No subir el PDF.** Es una política documental; no se encontró en esta rama una prueba que automáticamente impida versionarlo.

## 4. Ruta de evaluación del Código Estructural de España

**Verificado:** [RD 470/2021](https://www.boe.es/eli/es/rd/2021/06/29/470), publicado 10-ago-2021, entrada en vigor a los tres meses; [corrección 2024](https://www.boe.es/eli/es/rd/2021/06/29/470/corrigendum/20240202). Su Título 2 contiene artículos 26–78, pero el art. 45 remite el cálculo a Anejos 19/21, y las bases incluyen Anejo 18. El informe identifica un ejemplo de anclaje y fiabilidad; **no** verificó todas las páginas/constantes de flexión, cortante, columnas y zapatas. Véase [mapa de lectura y límites](../research/normas-estado-y-acceso.md).

Pasos futuros, todavía no implementados:

1. Resolver y verificar el riesgo de norma desconocida (§5.1); escoger edificación o puentes y fijar la ruta normativa completa.
2. Consultar texto y corrección oficiales fuera del repo; comprobar disposición transitoria y condiciones de aplicabilidad del proyecto.
3. Leer Anejo 19 o 21, bases de Anejo 18 y las referencias geotécnicas necesarias. Registrar cláusulas, páginas, condiciones y hashes exactos; no trasladar números de ejemplos aislados.
4. Proponer y probar el esquema de registro `officialDocument`; añadir perfil, tipos y oráculo en una rama de código desde `main`, siguiendo §7.
5. Verificar todos los casos y las referencias del perfil antes de habilitarlo. No reutilizar fórmulas ACI/NTC por similitud aparente.

**Criterio de terminado técnico:** evidencia de cada constante, condiciones de aplicación, oráculo independiente y pruebas de registro/perfil en verde. La accesibilidad del BOE por sí sola no cumple ese criterio.

---

## 5. Hallazgos del código y riesgos

### 5.1 Riesgo de datos (prioridad 1, antes de cualquier norma nueva)

Hallazgo del diagnóstico original, conservado para implementación. Esta actualización documental no ejecutó la reparación ni una prueba funcional de ida y vuelta; las líneas citadas son orientativas y deben revalidarse.
`src/features/design/workbench/designMemory.tsx`, líneas 41 y 328: una norma desconocida se trata como `ntc-2023` **sin avisar**. Si una versión nueva guarda una pieza con otra norma y la abre una versión anterior, la recalcula como NTC y la guarda así. Viola «no perder datos».

**Corrección:** conservar el código original en la pieza, bloquear el recálculo y mostrar «Norma no disponible en esta versión». Pruebas en §9.

### 5.2 Otros hallazgos
- **Identificador de norma cerrado en cuatro sitios:** `DesignCodeId` y `DESIGN_CODE_IDS` (`codes.ts`, líneas 19 y 27), `NormativeStandardId` (`shared.ts`) y el esquema de `normativeRegistry.test.ts`. Cambiarlos en un solo commit.
- **El esquema del registro exige dos documentos por norma** (`publicationNotice` y `officialElectronicAnnex`). ACI y el BOE tienen uno. Hay que aceptar `officialDocument` además de esos dos, con su prueba.
- **Documentación corregida en este cierre:** hashes, páginas y fuentes se validan en `normativeRegistry.test.ts`; constantes frente a extractos, en `normativeEvidence.test.ts`. `structuralDesignMigration.test.ts` no existe. La política prohíbe PDFs, pero no se encontró un test que la aplique automáticamente.
- **Brecha de evidencia saldada en el registro actual:** `RECORDED_EVIDENCE_DEBT = {}` en `normativeEvidence.test.ts`; el comentario documenta el cierre el 2026-09-23. No afirmar deuda pendiente por el ejemplo histórico 3.6.1. La prueba sigue exigiendo que nuevas constantes tengan evidencia.
- **Motor de etiquetas ya existe:** `src/features/canvas/labelLayout.ts` (pruebas en `labelLayout.test.ts`), con candidatos en `StructuralCanvas.tsx` (líneas 2308–2344 y 2504). El problema es que no considera la geometría de barras ni de curvas.
- **Archivos grandes:** `Space3DWorkspace.tsx` (1 688 líneas), `ProjectContext.tsx` (778), `WorkspaceShell.tsx` (693).
- **Texto «Revisión incompleta»:** lo decide `src/design/elements/scope.ts`, línea 161.

---

## 6. Política de extractos (criterio de minimización para trabajo futuro)

| Campo del registro | Qué guardamos |
|---|---|
| `sourceUrl` | URL oficial |
| `sourceSha256` | Hash del documento completo (el archivo oficial) |
| `pages` | Página o páginas |
| `evidence.excerpt` | **Una línea como máximo**: la fila de una tabla o la ecuación. Nunca párrafos |
| `evidence.excerptSha256` | Hash de esa línea exacta |
| `verifiedAt` | Fecha de verificación |

Para normas pagadas (ACI), confirmar los términos del acceso/licencia y limitar el registro a lo necesario y permitido. Una línea, un número o una fórmula no constituyen automáticamente una excepción de reproducción. Este criterio no demuestra que todos los extractos existentes sean de una sola línea ni que haya una prueba automática de longitud/licencia; `normativeEvidence.test.ts` comprueba correspondencia de constantes, no derechos de reproducción.

---

## 7. Ruta para agregar una norma (cualquiera)

1. **Riesgo de datos** (§5.1) resuelto.
2. **Registro (JSON):** entrada en `docs/design/normative-sources.json` con la política de §6.
3. **Esquema:** `src/design/normativeRegistry.test.ts` acepta `officialDocument`.
4. **Tipos:** `src/design/elements/shared.ts` — `NormativeStandardId` y la referencia.
5. **Perfil:** `src/design/elements/codes.ts` — `DesignCodeId` (línea 19), `DESIGN_CODE_IDS` (línea 27), perfil nuevo reutilizando helpers (`betaOne`, `equivalentBlockStrengthMpa`, `balancedSteel`, `ACI_ROW_DEVELOPMENT`), y `DESIGN_CODES` (línea 665). El módulo de elasticidad no sale de `ntcConcrete2023.ts`: el perfil trae su fórmula verificada.
6. **Oráculo:** `validation/python/elements_oracle.py` y `test_elements_oracle.py`.
7. **Interfaz:** el selector se llena solo desde `DESIGN_CODE_IDS`; verificar nombre en el chip y en el PDF (`designReportPdf.ts`).
8. **Documentación:** tabla de `design-workbench.md` y `docs/references/normative/README.md`.
9. **Pruebas:** §9.

Nota para E.060: ya lleva ramas `'aci'` (`codes.ts` líneas ~370, 420–457, 572–602). Esas ramas no sirven como verificación de ACI 318-25: E.060 2009 se basa en una edición anterior.

---

## 8. Plan por fases

### Fase 0 · Riesgo de datos y publicación (S)
- Norma desconocida en memoria (§5.1).
- Referencias documentales a pruebas: corregidas en este cierre; queda sin implementar una eventual prueba automática de no versionar PDFs.
- `$` extra en el porcentaje de utilización (localización en `src/i18n/catalogs/`).
- Pages con el flujo oficial: `.github/workflows/deploy-pages.yml` con `configure-pages`, `upload-pages-artifact` y `deploy-pages` (permisos `pages: write` e `id-token: write`, y `needs`). Probar en rama antes de `main`.
- Escenas de la Home a WebP (`public/assets/suite/`, 8 archivos hoy).
- Aviso de versión nueva en `scripts/sw.template.js`.

### Fase 1 · Evaluación e implementación del Código Estructural (M)
§4, pasos 1 a 5; no habilitar el perfil sin completar lectura de anejos y evidencia.

### Fase 2 · Mejoras visuales (S–M, en paralelo)
Ver §10 y los documentos de referencias/comunidad. La galería exploratoria ya existe en una rama aparte; la integración en la app oficial sigue siendo trabajo de código.

### Fase 3 · Cálculo individual completo (M)
- Individual → proyecto: promover el archivo (copia nueva, sin tocar el original), con migración de bundle.
- DCL de zapata de lindero y losa (valores de referencia: R1 800 kN, R2 1 000 kN; losa 2 × 2 claros).
- Viga → zapata: puente en `src/integrations/beamFooting`, sin importar interfaz del 2D ni de Diseño.

### Fase 4 · Modelo 3D (L)
Corpus de referencia primero (valores de PyNite o Frame3DD, sólo como números). Luego: resortes en apoyos, brazos rígidos, Timoshenko, espectro con envolventes, excentricidad accidental, dibujo rápido de barras, losas. Torsión de diseño: bloqueada hasta tener cláusula registrada.

### Fase 5 · Diseño (M–L)
- Bloque C: reacciones a zapata aislada y despiece con CSV y SVG. Oráculo: zapata de 2.45 m (13 #5 por dirección).
- Bloque D: losa maciza unidireccional, sección libre, equilibrio biaxial, servicio.
- Pórtico: cargas puntuales, voladizos y worker para el 5 × 5 con sismo.
- Bloqueados por normativa: torsión, losas, muros, zunchos, lindero, dados, NSR-10 B.2.4.2, E.060 9.2.3.

### Fase 6 · ACI 318-25 (M, cuando tengas la copia)
§3 para conseguirla; luego §7 completo. Contraste de flexión de viga con RecrBeam (MIT), anotando que es edición 318-19.

### Fase 7 · Limpieza (M)
- Quitar el modo sin shell de `Space3DWorkspace`.
- Dividir `ProjectContext.tsx` y `WorkspaceShell.tsx` en tandas.
- Auditoría de dependencias en CI.

### Fase 8 · Pruebas de humo (S)
Playwright sobre la Home y sus secciones, en claro, oscuro y 390 px, con scripts dentro del repositorio. Matriz de importación y exportación. PDF de Diseño en Safari: prueba manual.

---

## 9. Pruebas mínimas por tipo de cambio

Se suma a `AGENTS.md`. Correr lo que aplique antes de cada commit.

| Tipo de cambio | Pruebas | Comando o verificación |
|---|---|---|
| Sólo copy o CSS | Revisión visual | Capturas en claro y oscuro; `npm run lint:design` |
| Registro JSON | `normativeRegistry`, `normativeEvidence`, `codes` | `npx vitest run src/design/normativeRegistry.test.ts src/design/normativeEvidence.test.ts src/design/elements/codes.test.ts` |
| Perfil de norma o `shared.ts` | Todo `src/design/elements` + oráculo | `npx vitest run src/design/elements` + `npm run design:oracle` + `npm run typecheck` |
| Oráculo Python | Oráculo | `npm run design:oracle` |
| Memoria o datos guardados | `designMemory.test.tsx`, `migrate.test.ts` | Abrir → guardar → reabrir; un archivo inválido |
| Selector o flujo de piezas | `DesignWorkbench.test.tsx`, `App.test.tsx -t "pieza individual"` | `npx vitest run src/features/design/workbench/DesignWorkbench.test.tsx src/App.test.tsx -t "pieza individual"` |
| Etiquetas del lienzo | `labelLayout.test.ts`, `CanvasResultLayer.test.tsx` | Capturas de los 5 inicios del 2D a 1440 y 390 px, claro y oscuro |
| Estados vacíos | `HomePage.test.tsx`, `App.test.tsx -t "Modelo 2D individual"` | Capturas: vacío, sin resultados, con datos |
| Integraciones | `npm run architecture:check` | Obligatorio si se toca `src/integrations` |
| División de archivos | Pruebas del archivo + `npm run deadcode` | Un archivo por commit |
| Publicación | `npm run check` | Rama de prueba, luego `main`; verificar el sitio en vivo |
| Transversal o cambio grande | `npm run check` | Obligatorio |

---

## 10. Mejoras visuales (con referencias)

| # | Problema observado | Propuesta | Referencia | Ruta | Prueba |
|---|---|---|---|---|---|
| V1 | «Ry = 165.81 kN» cae sobre la curva de momento | Evitar la curva en el cálculo de posición | d3fc-label-layout, Vega Label Transform | `labelLayout.ts`, `StructuralCanvas.tsx` | `labelLayout.test.ts` |
| V2 | «N máx» cruza barras (armadura) | Candidatos fuera de la barra | d3fc-label-layout, candidatos de Vega | Igual | Igual |
| V3 | «Revisión incompleta» casi siempre | Tres estados: Cumple, No cumple, Faltan datos | Decisión de diseño | `scope.ts` 161 | `codes.test.ts`, capturas |
| V4 | «Proponer sección» se parte en dos líneas | Icono con texto accesible o fila inferior | — | `ColumnWorkbench.tsx` | Capturas 1440 y 390 |
| V5 | DCL ilegible en teléfono | Versión vertical o texto mínimo mayor | — | `BeamDrawings.tsx` (`BeamFreeBody`) | `designReport.test.ts`, captura |
| V6 | Tarjeta vacía del 2D sin jerarquía | Título positivo y acción principal única | [Carbon](https://carbondesignsystem.com/patterns/empty-states-pattern/) | `ModelStartCard.tsx` | `App.test.tsx -t "Modelo 2D individual"` |
| V7 | Filtros sin resultados se ven como lista vacía | Estado propio con «Limpiar filtros» solo si hay filtros, altura estable | [Cloudscape](https://cloudscape.design/patterns/general/empty-states/), [Guidewire](https://docs.guidewire.com/jutro/documentation/10.13/table-states), [Supabase](https://supabase.com/design-system/docs/ui-patterns/empty-states) | `src/features/project-hub/`, `DesignMemoryDialog.tsx` | `HomePage.test.tsx`, capturas |
| V8 | Barra con muchos controles en teléfono | Barra mínima, foco en el dibujo | [Excalidraw](https://github.com/excalidraw/excalidraw/) | Barra de 3D y Diseño | Capturas 390 px |
| V9 | Diseño separado de la estructura | Parámetros de diseño junto al elemento | Propuesta local; conservar selección y parámetros (criterio V9 del informe visual) | `DesignWorkbench.tsx` | `DesignWorkbench.test.tsx` |

Investigación completada: [referencias visuales](../research/referencias-visuales.md) documenta Carbon Data table, estados vacíos, Jutro, etiquetas y casos táctiles de Excalidraw; [comunidad](../research/propuestas-comunidad.md) separa solicitudes, respuestas y licencias. Incluye criterios medibles V1–V9 propuestos, no resultados de pruebas ni requisitos impuestos por esas fuentes. No se descargaron activos externos. Se conserva el canon y se valida en pantallas propias de 390/1440 px, Día/Noche.

---

## 11. Riesgos y licencias

- **ACI sin copia:** la fase 6 espera. No se implementa sin hash del archivo.
- **Licencias verificadas:** PyNite MIT, Frame3DD GPL-3.0 y anaStruct **LGPL-3.0**. OpenSeesPy y su motor tienen condiciones propias, incluidas restricciones de distribución comercial; no tratarlos como MIT/BSD. SFAP: autoría académica identificada, repo/licencia **no verificados**. En esta investigación no se copió código ni se integraron dependencias; los términos del binario/versión elegidos deberán revisarse antes de usarlos. [Fuentes primarias y alcance](../research/propuestas-comunidad.md).
- **Publicación:** migrar Pages puede romper la ruta del sitio; probar en rama.
- **Dividir archivos:** riesgo de regresiones; pruebas existentes primero.
- **Memoria:** el cambio de §5.1 es prerrequisito de cualquier norma nueva.

---

## 12. Lo verificado y lo que sigue sin verificar

La investigación requerida en §2 del prompt está documentada en cuatro entregables y sus notas, con URL, consulta y estado. El [informe de cierre](../research/reports/Investigación%20pendiente%20de%20FStructure.md) resume la cobertura.

**Verificado:** existencia de ACI 318-25 en español, precios de vistas inglesas y condiciones generales; portales consultados de siete universidades; fuentes y actos de NSR/E.060; estado de propuestas de actualización; calendario JRC y adopción BSI; NA danés gratuito de primera generación; BOE y necesidad de anejos; patrones visuales/táctiles/tablas; discusiones concretas y licencias de proyectos identificados; responsabilidad real de las pruebas del registro.

**No verificado o aún no disponible:** copia ACI licenciada para FStructure, precio español/MXN/final México, tenencias universitarias y distribución IMCYC; cotejo completo NSR frente a modificatorios; nueva lectura/hash del PDF E.060 desde Drive; adopción posterior de propuestas fuera de las fuentes consultadas; NA gratuito de segunda generación para un país elegido; coeficientes y páginas completas de anejos españoles; repo/licencia de SFAP; última edición ABNT y acceso CAPES. Se documenta cada intento y no se infiere ausencia universal.

## 13. Estado de cierre y siguiente trabajo

- Investigación documental e integración de sus resultados: completadas con los límites anteriores, sin compras ni envío de solicitudes.
- Documentos e imágenes permanecen en `plan/normas-y-mejoras-2026-10-14`; no se hace PR ni merge a `main`.
- Código exploratorio: `feature/propuestas-visuales-brandbook`, commit `09de120`, separado de la app oficial. Las nueve imágenes previas siguen como material a revisar.
- La implementación de §5–§8, la verificación cláusula por cláusula y la adquisición de una copia ACI son tareas distintas; este cierre no las marca realizadas ni exige una aprobación nueva para terminar la documentación.

---

## 14. Estado de implementación (15 de octubre de 2026)

Cada cambio entró a `main` con `npm run check` en verde; el último `main` es `4bd26bb` (208 archivos, 1 477 pruebas, oráculo Python y build) y `npm run smoke` da 32 de 32 pantallas.

| Fase | Estado | Qué se hizo / por qué no |
|---|---|---|
| 0 · Riesgo de datos | Hecha | Una pieza con norma desconocida no se muestra, no se abre ni se recalcula, y se conserva en el documento (guardar, ejes y reabrir probados). |
| 0 · `$` extra | No reproducible | No hay `$` literal en el código actual. |
| 0 · Pages oficial | No se hizo | Requiere cambiar el origen de Pages en la configuración y perdería la generación anterior de `assets/`. Se mantiene gh-pages. |
| 0 · WebP y aviso de versión | Hechas | WebP con PNG de respaldo; «Nueva versión lista · Recargar», probado en Chromium. |
| 1–2 · Código Estructural | En lectura, sin perfil | BOE descargado fuera del repo con SHA-256; 38 extractos de una línea (14 de texto comprobado, 24 transcripciones visuales); registro `pending` con `officialDocument`. Bloqueos: motor de coeficientes parciales (L–XL) y CTE DB-SE sin registrar. |
| Visual V1–V9 | Hechas | Etiquetas fuera de barras y curvas; Cumple / No cumple / Faltan datos; «Proponer sección» en una línea; DCL móvil a 14 px; 2D vacío con una acción primaria; sin coincidencias con «Limpiar filtros»; barra mínima en teléfono; «Edificio» abre con la pieza elegida. |
| 3 · Cálculo individual | Hecha | Convertir en proyecto (copia, original intacto); DCL de lindero y losa; viga → zapata. |
| 4 · 3D | Parcial | Corpus PyNite de 10 casos (≤ 1e-10); resortes de apoyo y zonas rígidas en motor y editor (esquema v5). Pendiente: Timoshenko, resortes de extremo de barra, espectro + estáticos, excentricidad accidental, dibujo rápido, losas. |
| 5 · Diseño | Parcial | Bloque C (despiece CSV/SVG, oráculo 2 × 13 #5); Pórtico con cargas puntuales, voladizos y worker. Pendiente: bloque D; bloqueados por norma: torsión, losas, muros, zunchos, combinaciones sísmicas NSR/E.060. |
| 6 · ACI 318-25 | Bloqueada | Sin copia legal. El registro ya acepta `officialDocument`. |
| 7 · Limpieza | Hecha | Sin modo sin shell en el 3D; `ProjectContext` 778 → 534, `WorkspaceShell` 693 → 500; `npm audit` en CI. |
| 8 · Humo | Hecha | `npm run smoke` y bloqueo de PDF versionados en `architecture:check`. Pendiente: matriz de importación/exportación y PDF en Safari (manual). |

Las imágenes generadas en ChatGPT se usaron sólo como guía; la implementación partió de la app y del brandbook oficiales.
