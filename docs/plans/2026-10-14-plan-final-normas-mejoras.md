# Plan final · normas, pruebas y mejoras · FStructure

Fecha: 14 de octubre de 2026. Reemplaza a `plan-todo.md` y `plan-normas-y-mejoras.md`. No se modificó el repositorio en esta etapa.

---

## 0. Resumen ejecutivo

1. **ACI 318 queda en espera** hasta tener una copia legal. Hoy no hay forma gratuita ni legal de obtener la edición 2025 para México que el repositorio pueda verificar. Abajo están las vías concretas para conseguirla (§3).
2. **El Código Estructural de España (RD 470/2021) es la norma que se puede agregar ya.** Es oficial, gratuita en el BOE, y su concreto está en el Título 2 (artículos 26 a 78). Es la primera norma nueva del plan (§4).
3. **Antes de agregar cualquier norma hay que corregir un riesgo de datos** en la memoria de diseño (§5.1).
4. **Decisión sobre extractos (tomada por mí):** el registro sólo guarda cláusula, página, valor numérico, hash del documento y, como máximo, **una línea** del texto (la fila de una tabla o una ecuación). Nunca párrafos. Así no se reproduce obra protegida y el hash sigue verificando. Si luego quieres algo más estricto, se cambia en un punto (§6).
5. **Mejoras visuales y limpieza no dependen de ACI** y pueden avanzar ya (§8).

---

## 1. Lo que dice la investigación, norma por norma

| Norma | Estado | Acceso legal hoy | Acción |
|---|---|---|---|
| **NTC-CDMX Concreto 2023** | Vigente (Gaceta, 6 nov. 2023) | Gratuito | Ya implementada (74 cláusulas) |
| **NSR-10 Título C** (Colombia) | Vigente; hay debate sobre reemplazarla tras el sismo del 10 de agosto de 2026. No hay «NSR-25» publicado | Gratuito en fuentes oficiales; no confirmé la URL del AIS ni del Minvivienda | Ya implementada (36 cláusulas). Confirmar que la versión registrada es la vigente |
| **E.060 2009** (Perú) | Vigente según lo encontrado. El PDF del Ministerio no apareció en la búsqueda; sólo copias municipales y un borrador de 2019 | Gratuito si se obtiene del Ministerio o de El Peruano | Ya implementada (34 cláusulas). Confirmar la resolución vigente en El Peruano |
| **Código Estructural RD 470/2021** (España) | Vigente desde noviembre de 2021; sustituye a la EHE-08 | **Gratuito**: BOE, PDF y XML | **Agregar ya** (§4) |
| **ACI 318-25** | Edición vigente (lanzada a inicios de 2025). Sin edición oficial en español encontrada; el texto en inglés es el que rige | **Pagado.** Ver §3 | En espera de copia |
| **ACI 318-14 en español** | Traducción oficial de ACI | Pagado | No recomendado: la edición vigente es la 2025 |
| **Eurocode 2 EN 1992-1-1** | Segunda generación publicada en 2023; retiro de la primera el 30 de marzo de 2028 | Pagado (BSI). El JRC ofrece talleres gratuitos, no el texto | Diferir hasta definir país |
| **CSA A23.3:24** (Canadá) | Octava edición (2024) | Por suscripción universitaria o biblioteca pública; no encontré acceso gratuito general | Diferir |
| **ABNT NBR 6118:2023** (Brasil) | Vigente | Gratis para estudiantes y personal de instituciones con acceso CAPES; para profesionales, el Creanet del CREA-SC (solicitud en 72 h) | Diferir |

Fuentes principales: [BOE, RD 470/2021](https://www.boe.es/eli/es/rd/2021/06/29/470), [ACI 318 PLUS](https://www.concrete.org/publications/aci318plus.aspx), [ACI, estudiantes](https://www.concrete.org/educatorsandresearchers/aciinyourclassroom.aspx), [JRC Eurocodes](https://eurocodes.jrc.ec.europa.eu/EN-Eurocodes/eurocode-2-design-concrete-structures), [CSA en bibliotecas (UAlberta)](https://guides.library.ualberta.ca/az/csa-canadian-standards-association-standards), [CAPES, normas ABNT](https://educapes.capes.gov.br/handle/capes/1090320?mode=full), [CREA-SC Creanet](https://portal.crea-sc.org.br/mesa-redonda-dia-14-11-normas-abnt-nbrs-15-575-2021-e-6118-2023/?print=pdf), [ITESO, catálogo ACI 318-02 en español](https://opac.biblio.iteso.mx/vufind/Record/000165905/Description).

Nota: la mayoría de las fuentes son secundarias. El texto oficial manda, y cada cláusula implementada debe confirmarse contra él.

---

## 2. Qué significa para México

- En **Ciudad de México** la norma obligatoria es la **NTC-CDMX 2023**, ya implementada. Esa es la prioridad para proyectos reales.
- **ACI 318 es referencia técnica** salvo que una jurisdicción la adopte. Lo dice una fuente argentina (INTI); conviene verificar qué reglamento aplica en cada estado donde se use la herramienta.
- Por eso ACI sirve para comparar, enseñar o diseñar en proyectos fuera de jurisdicciones con NTC. No cambia la prioridad de NTC.

---

## 3. ACI 318: cómo conseguir una copia legal (sin pedir permiso a nadie)

Lo que encontré, en orden de costo:

| Vía | Qué implica | Verificado |
|---|---|---|
| **Ser estudiante** | Membresía de estudiante **gratuita**. Comprar el libro impreso del 318-25 a precio estudiantil (**US$105** más envío) incluye **un año de ACI 318 PLUS** | Sí, en la página de ACI para educadores |
| **Pedirla a un profesor** | ACI ofrece copia de cortesía a profesores (*desk copy*) para la cátedra; el profesor puede compartir notas | Sí |
| **Biblioteca universitaria** | Preguntar si tienen ACI 318 **físico o licencia**. El ITESO tiene ACI 318-02 en español, edición antigua (2004) | Parcial: confirmar la edición y el horario de consulta |
| **Comprar el 318-25** | Precio en pesos no verificado. Hay ofertas de terceros que **no uso** porque no son de ACI | Precio no verificado |
| **ACI 318 PLUS** | Suscripción desde **US$149/año**, año gratis para quien compró 318-19 directamente | Sí |
| **IMCYC** | Publicó ACI 318-02 en español en 2004. No encontré una edición 2025 ni precio actual | No verificado: preguntar directamente |

**Recomendación práctica:** si eres estudiante o conoces a alguien en una facultad, la vía de **estudiante o profesor** es la más barata y legal. Si no, la compra directa del 318-25 en ACI es la única segura. Ninguna vía libre está confirmada, y no voy a usar PDFs que circulan en blogs o redes: no son fuente verificable.

**Qué hacemos cuando tengas la copia:** calcular el SHA-256 de tu archivo fuera del repositorio y registrar el hash, la página y las líneas permitidas (§6). El archivo no se sube al repositorio.

---

## 4. Ruta concreta: Código Estructural de España (se puede empezar ya)

Verificado en el BOE: aprobado por el RD 470/2021, publicado el 10 de agosto de 2021, **Título 2 «Estructuras de hormigón», artículos 26 a 78, capítulos 7 a 16**. Deroga la EHE-08. Su disposición transitoria exime proyectos redactados antes de la entrada en vigor, si las obras empiezan en un año (edificación) o tres (obra civil). Ese punto debe leerse en el texto completo.

**Pasos:**
1. Descargar el PDF oficial del BOE (`https://www.boe.es/boe/dias/2021/08/10/pdfs/BOE-A-2021-13681.pdf`) **fuera** del repositorio y calcular su SHA-256. Anotar fecha de verificación.
2. Leer el Título 2 (capítulos 7 a 16) y la disposición transitoria. Elegir las cláusulas que el taller ya cubre: flexión, cortante, desarrollo, separación de barras, columnas y zapatas.
3. Registrar en `docs/design/normative-sources.json` una entrada `standards` con `id: "rd-470-2021-hormigon"`: título, URL del BOE, hash del documento, y `verifiedClauses` por cláusula (página, valor, una línea de extracto y su hash).
4. Ampliar el tipo en `src/design/elements/shared.ts` (`NormativeStandardId`) y crear `const cs = reference('rd-470-2021-hormigon', 'CE')`.
5. Crear el perfil en `src/design/elements/codes.ts` (ver §7 para la ruta completa).
6. Agregar bloque en `validation/python/elements_oracle.py` con valores hechos a mano.
7. Pruebas de §9, fila «Perfil de norma».

**Criterio de terminado:** cada constante del perfil cita una cláusula con página y hash; el oráculo independiente pasa; `codes.test.ts` confirma que toda cláusula citada existe.

**Advertencia:** la búsqueda sólo mostró cabecera y artículos iniciales; los valores concretos (factores, límites) hay que tomarlos del texto. No los copies de resúmenes.

---

## 5. Hallazgos del código y riesgos

### 5.1 Riesgo de datos (prioridad 1, antes de cualquier norma nueva)
`src/features/design/workbench/designMemory.tsx`, líneas 41 y 328: una norma desconocida se trata como `ntc-2023` **sin avisar**. Si una versión nueva guarda una pieza con otra norma y la abre una versión anterior, la recalcula como NTC y la guarda así. Viola «no perder datos».

**Corrección:** conservar el código original en la pieza, bloquear el recálculo y mostrar «Norma no disponible en esta versión». Pruebas en §9.

### 5.2 Otros hallazgos
- **Identificador de norma cerrado en cuatro sitios:** `DesignCodeId` y `DESIGN_CODE_IDS` (`codes.ts`, líneas 19 y 27), `NormativeStandardId` (`shared.ts`) y el esquema de `normativeRegistry.test.ts`. Cambiarlos en un solo commit.
- **El esquema del registro exige dos documentos por norma** (`publicationNotice` y `officialElectronicAnnex`). ACI y el BOE tienen uno. Hay que aceptar `officialDocument` además de esos dos, con su prueba.
- **Documentación desfasada:** `docs/design/design-workbench.md` y `docs/references/normative/README.md` citan `src/design/structuralDesignMigration.test.ts`, que no existe. La regla de PDFs está en `src/design/normativeEvidence.test.ts`.
- **Brecha de evidencia congelada:** `normativeEvidence.test.ts` mide constantes de NTC sin extracto (por ejemplo, la de 3.6.1). No puede crecer. Reducirla es trabajo aparte.
- **Motor de etiquetas ya existe:** `src/features/canvas/labelLayout.ts` (pruebas en `labelLayout.test.ts`), con candidatos en `StructuralCanvas.tsx` (líneas 2308–2344 y 2504). El problema es que no considera la geometría de barras ni de curvas.
- **Archivos grandes:** `Space3DWorkspace.tsx` (1 688 líneas), `ProjectContext.tsx` (778), `WorkspaceShell.tsx` (693).
- **Texto «Revisión incompleta»:** lo decide `src/design/elements/scope.ts`, línea 161.

---

## 6. Política de extractos (decidida)

| Campo del registro | Qué guardamos |
|---|---|
| `sourceUrl` | URL oficial |
| `sourceSha256` | Hash del documento completo (el archivo oficial) |
| `pages` | Página o páginas |
| `evidence.excerpt` | **Una línea como máximo**: la fila de una tabla o la ecuación. Nunca párrafos |
| `evidence.excerptSha256` | Hash de esa línea exacta |
| `verifiedAt` | Fecha de verificación |

Para normas pagadas (ACI): se usa **sólo** lo necesario para verificar el valor. Si el valor es un número o una fórmula, es un dato, no una expresión protegida; aun así, la línea se limita a la fila o ecuación. Si prefieres una regla más estricta, se cambia aquí y en `normativeEvidence.test.ts`.

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
- Corregir la referencia a `structuralDesignMigration.test.ts`.
- `$` extra en el porcentaje de utilización (localización en `src/i18n/catalogs/`).
- Pages con el flujo oficial: `.github/workflows/deploy-pages.yml` con `configure-pages`, `upload-pages-artifact` y `deploy-pages` (permisos `pages: write` e `id-token: write`, y `needs`). Probar en rama antes de `main`.
- Escenas de la Home a WebP (`public/assets/suite/`, 8 archivos hoy).
- Aviso de versión nueva en `scripts/sw.template.js`.

### Fase 1 · Código Estructural de España (M)
§4, pasos 1 a 7.

### Fase 2 · Mejoras visuales (S–M, en paralelo)
§9 de referencias visuales; ver §10.

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
| V1 | «Ry = 165.81 kN» cae sobre la curva de momento | Evitar la curva en el cálculo de posición | d3fc-label-layout, D3-Labeler | `labelLayout.ts`, `StructuralCanvas.tsx` | `labelLayout.test.ts` |
| V2 | «N máx» cruza barras (armadura) | Candidatos fuera de la barra | avoid-overlap | Igual | Igual |
| V3 | «Revisión incompleta» casi siempre | Tres estados: Cumple, No cumple, Faltan datos | Decisión de diseño | `scope.ts` 161 | `codes.test.ts`, capturas |
| V4 | «Proponer sección» se parte en dos líneas | Icono con texto accesible o fila inferior | — | `ColumnWorkbench.tsx` | Capturas 1440 y 390 |
| V5 | DCL ilegible en teléfono | Versión vertical o texto mínimo mayor | — | `BeamDrawings.tsx` (`BeamFreeBody`) | `designReport.test.ts`, captura |
| V6 | Tarjeta vacía del 2D sin jerarquía | Título positivo y acción principal única | [Carbon](https://carbondesignsystem.com/patterns/empty-states-pattern/) | `ModelStartCard.tsx` | `App.test.tsx -t "Modelo 2D individual"` |
| V7 | Filtros sin resultados se ven como lista vacía | Estado propio con «Limpiar filtros» solo si hay filtros, altura estable | [Cloudscape](https://cloudscape.design/patterns/general/empty-states/), [Guidewire](https://docs.guidewire.com/jutro/documentation/10.13/table-states), [Supabase](https://supabase.com/design-system/docs/ui-patterns/empty-states) | `src/features/project-hub/`, `DesignMemoryDialog.tsx` | `HomePage.test.tsx`, capturas |
| V8 | Barra con muchos controles en teléfono | Barra mínima, foco en el dibujo | [Excalidraw](https://github.com/excalidraw/excalidraw/) | Barra de 3D y Diseño | Capturas 390 px |
| V9 | Diseño separado de la estructura | Parámetros de diseño junto al elemento | [RFEM 6](https://www.dlubal.com/en/support-and-learning/support/faq/005103) (material del fabricante) | `DesignWorkbench.tsx` | `DesignWorkbench.test.tsx` |

Huecos: no encontré referencias verificadas de interacción táctil en teléfono ni de tablas de datos (la guía de tablas de Carbon no se pudo leer). Para esas decisiones, usar capturas propias a 390 px.

---

## 11. Riesgos y licencias

- **ACI sin copia:** la fase 6 espera. No se implementa sin hash del archivo.
- **Licencias:** Frame3DD (GPL) y anaStruct (GPL-3.0) sólo como oráculos numéricos. RecrBeam (MIT) es el más cómodo. Revisar PyNite y OpenSeesPy antes de usarlos.
- **Publicación:** migrar Pages puede romper la ruta del sitio; probar en rama.
- **Dividir archivos:** riesgo de regresiones; pruebas existentes primero.
- **Memoria:** el cambio de §5.1 es prerrequisito de cualquier norma nueva.

---

## 12. Lo verificado y lo que no

**Verificado:**
- Estructura y contenido del RD 470/2021 en el BOE (título, fechas, Título 2, derogación de EHE-08, disposición transitoria en resumen).
- Política de acceso de ACI (estudiantes, profesores, ACI 318 PLUS, precios de la página de ACI).
- Que el registro del proyecto exige hash y extracto, y prohíbe PDFs normativos (leído en el repositorio).
- Riesgo de datos en `designMemory.tsx` (leído en el código).

**No verificado:**
- Precio del ACI 318-25 en pesos mexicanos y disponibilidad en IMCYC.
- Existencia de una edición oficial de ACI 318-25 en español.
- URL oficial de E.060 (vivienda.gob.pe) y de NSR-10 (AIS, Minvivienda).
- Valores concretos del Código Estructural: no los leí todavía, sólo la estructura.
- Licencias de PyNite, OpenSeesPy y SFAP.
- Fórmula de desarrollo de ACI 318-25 que circula en redes (no usada).

---

## 13. Lo que necesito de ti (sólo esto)

1. **ACI:** decide la vía para la copia (§3). Si eres estudiante o tienes profesor, es lo más barato.
2. **Orden:** ¿arrancamos con la fase 0 y la norma de España (fase 1), que no dependen de nadie?

Sin respuesta, empiezo con la fase 0 y la fase 2, porque son de riesgo bajo y no cambian datos.
