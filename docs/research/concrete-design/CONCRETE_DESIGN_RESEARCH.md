# Investigación técnica del diseño de concreto para FStructure

**Versión:** 1.0 · **Fecha de corte:** 25 de septiembre de 2026  
**Alcance:** ingeniería, normativa, flujos, software, repositorios abiertos, experiencia visual, auditoría de FS-A04 y propuesta de producto.  
**Estado:** estudio de investigación; no implementa ni aprueba un cálculo.

> **HECHO** identifica una afirmación respaldada por código, norma o documentación enlazada. **INFERENCIA** es una conclusión derivada de esas fuentes. **PROPUESTA** es una decisión sugerida para FStructure. Las interfaces de fabricantes documentan patrones, no prueban la precisión de sus motores.

## Índice

1. [Resumen ejecutivo](#resumen-ejecutivo)
2. [Método y límites](#método-y-límites)
3. [Auditoría de FStructure](#auditoría-de-fstructure)
4. [Flujo profesional](#flujo-profesional)
5. [Elementos y verificaciones](#elementos-y-verificaciones)
6. [Normativa y trazabilidad](#normativa-y-trazabilidad)
7. [Benchmark comercial](#benchmark-comercial)
8. [Open source inspeccionado](#open-source-inspeccionado)
9. [Investigación visual y UI/UX](#investigación-visual-y-uiux)
10. [Propuesta para FStructure](#propuesta-para-fstructure)
11. [Modelo de datos e integración](#modelo-de-datos-e-integración)
12. [Riesgos y decisiones abiertas](#riesgos-y-decisiones-abiertas)
13. [Roadmap](#roadmap)
14. [Bibliografía](#bibliografía)

---

## Resumen ejecutivo

- **HECHO.** FStructure ya tiene un taller experimental de concreto con viga continua, columna rectangular y zapata aislada. Implementa perfiles NTC-CDMX 2023, NSR-10 Título C y E.060 2009, resultados normativos por cláusula y dibujos SVG. El mismo taller declara que no certifica un diseño ni sustituye a la persona responsable. [Guía del taller](../../design/design-workbench.md), [perfiles de norma](../../../src/design/elements/codes.ts).
- **HECHO.** El cálculo se separa por elemento en motores TypeScript. El análisis de viga compone un modelo 2D local y llama al solver existente; columnas y zapatas usan motores propios. Hay un oráculo Python y fixtures que recalculan casos con métodos distintos. Esto es validación numérica útil del alcance declarado, pero no hace que el taller ya tome acciones del modelo 2D o 3D completo. [Viga](../../../src/design/elements/beam.ts), [análisis de viga](../../../src/design/elements/beamAnalysis.ts), [columna](../../../src/design/elements/column.ts), [zapata](../../../src/design/elements/footing.ts), [oráculo](../../../validation/python/elements_oracle.py).
- **HECHO.** La trazabilidad normativa local es una fortaleza: el registro local conserva documentos, enlaces, edición, página, extractos, hash y fecha. No se guardan PDFs de norma. Las entradas que no están justificadas por cláusula se marcan complementarias. [Registro normativo](../../design/normative-sources.json), [pruebas de registro](../../../src/design/normativeRegistry.test.ts), [pruebas de evidencia](../../../src/design/normativeEvidence.test.ts).
- **HECHO.** El módulo está aislado del modelo global. La entrada se captura a mano; se persisten borradores dentro de una rama de diseño del bundle o localmente, pero no se asignan resultados al modelo ni se importan casos/combinaciones del edificio. La viga sí reutiliza el solver para el caso independiente construido desde su formulario. [Adapter de Diseño](../../../src/features/workspace/adapters/DesignSurface.tsx), [persistencia](../../../src/features/design/workbench/workbenchStorage.ts), [análisis de viga](../../../src/design/elements/beamAnalysis.ts).
- **INFERENCIA.** La brecha con mayor impacto es dar contexto de proyecto a los tres elementos existentes: modelo/miembro, cargas concurrentes, combinación gobernante, estación, norma/edición, detalle y reporte, manteniendo el modo independiente.
- **PROPUESTA.** Mantener el FS-A04 y sus capas; establecer NTC CDMX 2023 como primer flujo de proyecto gobernante; permitir selección y lectura de demanda a través del workspace; completar revisión por miembro, estado, servicio y detalle; luego ampliar a losas, muros y más cimentaciones. No declarar cobertura completa por incluir un formulario de elemento.

| Área | Capacidad observada | Prioridad de cierre |
|---|---|---|
| Viga, columna, zapata aislada | Diseño y armado propuesto para tres perfiles | Enlace con el modelo global y armado editable |
| Evidencia normativa | Registro de cláusulas/hashes y pruebas asociadas | Presentar fuente, edición, página y supuestos en cada check/PDF |
| Servicio | Algunas verificaciones de viga, columna y zapata | Aclarar estados no evaluados y homogeneizar criterios por familia |
| Modelo | Taller aislado, con análisis local 2D en viga | DTO de modelo y demanda con origen/versionado |
| Reporte | Memoria de texto copiable | PDF reproducible ligado a norma, cálculo y versión |
| Fuera de alcance | Torsión, losas, muros, zapata corrida, pedestal, detalles de alta ductilidad, etc. | Incorporación faseada con reglas/test de cada subfamilia |

---

## Método y límites

La investigación combina inspección del repositorio local, normas y portales oficiales, documentación pública de fabricantes, capturas visuales y lectura de código fuente/pruebas en GitHub. La consulta de los repositorios se congeló al 25-09-2026; los HEAD informados abajo son snapshots y no garantizan mantenimiento futuro.

Para CDMX se priorizaron el RCDF, la Gaceta Oficial y los anexos electrónicos de NTC. ACI, ASCE y EN 1992 se documentan usando índices y materiales oficiales; parte del texto normativo completo requiere licencia/compra. No se intenta reconstruir un código protegido desde una captura o un repositorio de tercero. Cada ecuación resumida va acompañada de la referencia normativa que fue posible verificar.

Las imágenes de producto son evidencia de interfaz publicada por fabricantes. No son visualizaciones de FStructure, pruebas de exactitud ni permiso para copiar el código o la marca. Se indica procedencia en [assets/README.md](assets/README.md). El reporte ClearCalcs visualizado es una muestra de 2021 que cita ACI 318-14/IBC 2018; se analiza sólo su composición.

---

## Auditoría de FStructure

### Arquitectura y producto

**HECHO.** El paquete usa React 19, TypeScript 6 y Vite 8, con Three.js para espacio 3D y paquetes PDF. El repositorio divide la app en FS-A01 2D, FS-A02 3D, FS-A03 FEM y FS-A04 Diseño. El workspace es la capa que conoce los cuatro módulos; el código de herramientas se mantiene aislado. Por ello, compartir datos debe hacerse mediante un contrato serializable/adaptador del workspace, no mediante importaciones directas desde FS-A04 al estado interno de 2D o 3D. [AGENTS.md](../../../AGENTS.md), [package.json](../../../package.json), [registro de herramientas](../../../src/features/workspace/toolRegistry.ts), [ToolShell](../../../src/features/workspace/ToolShell.tsx).

**HECHO.** El taller usa el layout del sistema: panel de entrada, área gráfica, panel de resultados, selector de elemento y norma, zoom/pellizco, cambio entre Datos/Dibujo/Resultados y un comportamiento responsive. A menos de 1240 px solo se abre un panel lateral; a menos de 760 px se convierte en vistas de pantalla completa. La selección admite flechas, Inicio y Fin. Son elementos que deben conservarse/reutilizarse. [WorkbenchLayout](../../../src/features/design/workbench/WorkbenchLayout.tsx), [DesignWorkbench](../../../src/features/design/workbench/DesignWorkbench.tsx), [presentación de superficies](../../../src/features/workspace/surfacePresentation.ts).

### Estado funcional encontrado

| Área | Hecho observado | Código y documento |
|---|---|---|
| Normas | NTC-CDMX 2023, NSR-10 y E.060 2009; selector común a los tres miembros | [codes.ts](../../../src/design/elements/codes.ts), [guía](../../design/design-workbench.md) |
| Viga | 1–6 claros; cargas/envolventes; flexión; cuantías; bastones/cortes; cortante/estribos; fisuración; flecha inmediata/diferida; desarrollo/anclaje y traslape; detecta viga profunda fuera de su método | [beam.ts](../../../src/design/elements/beam.ts), [beamAnalysis.ts](../../../src/design/elements/beamAnalysis.ts), [BeamWorkbench](../../../src/features/design/workbench/BeamWorkbench.tsx) |
| Columna | Rectangular con estribos; interacción por compatibilidad, axial máximo, excentricidad, esbeltez/magnificación según norma; acero longitudinal, cortante, estribos y empalme | [column.ts](../../../src/design/elements/column.ts), [ColumnWorkbench](../../../src/features/design/workbench/ColumnWorkbench.tsx) |
| Zapata | Zapata aislada rectangular; presión y núcleo, presión última, flexión por dirección, cortante unidireccional, punzonamiento, cuantía/separación y anclaje | [footing.ts](../../../src/design/elements/footing.ts), [FootingWorkbench](../../../src/features/design/workbench/FootingWorkbench.tsx) |
| Resultado | Veredicto/ratio, resumen, armado, lista de checks, detalle desplegable, valores y citas; dibujos de elemento en SVG | [common.tsx](../../../src/features/design/workbench/common.tsx), [dibujos de viga](../../../src/features/design/workbench/BeamDrawings.tsx), [columna](../../../src/features/design/workbench/ColumnDrawings.tsx), [zapata](../../../src/features/design/workbench/FootingDrawings.tsx) |
| Almacenamiento | Guarda formularios y selección como documento versionado en rama local design del bundle; sin proyecto usa almacenamiento del navegador | [workbenchStorage.ts](../../../src/features/design/workbench/workbenchStorage.ts) |
| Solver | El caso de viga independiente usa el solver 2D existente; columnas y zapata calculan en sus motores puros | [beamAnalysis.ts](../../../src/design/elements/beamAnalysis.ts) |

**Unidades.** La guía del repo declara m/kN como convención general, mientras el cálculo de concreto convierte parámetros entre unidades de formulario y unidades internas como mm/MPa. Debe conservarse el origen de unidad y realizar conversión sólo en fronteras bien definidas. [AGENTS.md](../../../AGENTS.md), [campos/formularios](../../../src/features/design/workbench/common.tsx), [resultados compartidos](../../../src/design/elements/shared.ts).

**No equivale a vínculo global.** beamAnalysis crea un modelo 2D local con las dimensiones/cargas del formulario y lo resuelve para casos muerta/viva por claro, con estaciones y discontinuidades; no trae por sí mismo demandas del modelo del usuario, ni FS-A02, ni las combinaciones globales. Las fuentes del proyecto localizan el workbench como superficie experimental. [beamAnalysis.ts](../../../src/design/elements/beamAnalysis.ts), [toolRegistry.ts](../../../src/features/workspace/toolRegistry.ts).

### Trazabilidad y discrepancias

**HECHO.** El registro de normas contiene evidencia para NTC Concreto (55 cláusulas), NTC Criterios y Acciones (3), NSR-10 (36) y E.060 (34). Los registros NTC incluyen página, URL oficial, hash del documento, fragmentos con hash y fecha. El policy local prohíbe copiar PDFs normativos al repositorio. Las pruebas recorren cláusulas y constantes con evidencia. [normative-sources.json](../../design/normative-sources.json), [codes.test.ts](../../../src/design/elements/codes.test.ts).

**HECHO.** La guía dice que los supuestos no respaldados como requisito de norma se etiquetan complementary/◇, incluida la presión admisible del suelo que debe proceder del estudio geotécnico. También documenta una desviación que exige atención: la NTC expresa β₁ = 0.85 hasta 30 MPa, mientras el motor hace continua la transición desde 28 MPa, por consistencia/conservadurismo con otros perfiles. El registro local conserva correctamente el extracto normativo, pero su metadata `implementation` todavía declara el umbral de 30 MPa; el motor `ntcConcrete2023.ts` usa 28 MPa. No presentar 28 MPa como transcripción literal NTC ni el metadata desfasado como comportamiento del motor. [design-workbench.md](../../design/design-workbench.md), [evidencia NTC](../../design/normative-sources.json), [códigos](../../../src/design/elements/codes.ts), [motor β₁](../../../src/design/concrete/ntcConcrete2023.ts).

**Fuera de alcance declarado.** La documentación reconoce fuera de alcance: detalles de ductilidad media/alta, segundo orden explícito, torsión, secciones T/L, acero de compresión, zapatas corridas/combinadas, pedestales, volteo/deslizamiento geotécnico, losas, muros y presfuerzo. También se distinguen los detalles de un cálculo local y el análisis global del edificio. [design-workbench.md](../../design/design-workbench.md).

**INFERENCIA.** El siguiente cambio arquitectónico útil es versionar una referencia a elemento/demanda/acciones, no ampliar el formulario aislado. La nueva experiencia debería aprovechar los motores, status y evidencias que existen y hacer explícita toda la cadena.

---

## Flujo profesional

**HECHO.** El artículo 53 del RCDF requiere una memoria que permita revisar datos de carga/material, parámetros de sitio/sismo, modelo/método, combinaciones, resultados, cimentación/geotecnia, estados límite, ejemplo de cálculo y detalles. Los arts. 137–140 encuadran la seguridad estructural y remiten al sistema normativo local. La trazabilidad, por tanto, forma parte del flujo de revisión, no solo de la exportación. [RCDF oficial](https://data.consejeria.cdmx.gob.mx/index.php/articulo-leyes-y-reglamentos/28-reglamentos/35-reglamentodeconstruccionesparaeldistritofederal).

| Etapa | Ingeniero captura/revisa | Software puede automatizar | Decisión que conserva el ingeniero |
|---|---|---|---|
| Base de diseño | Jurisdicción, edición, grupo/ocupación, ductilidad, sistema y exposición | Validar compatibilidad entre norma de concreto, acciones, sismo y cimentación | Seleccionar norma y clasificación apropiadas al proyecto |
| Materiales | Clase de concreto, f’c, fy/grado, barra, agregado, peso, durabilidad y recubrimiento | Validar unidades, rangos de norma y catálogo de grado permitido | Aceptar materiales de planos, especificación y ensayos |
| Geometría | Ejes, piso, claro, sección, apoyo, excentricidad, continuidad, huecos, conectividad | Leer geometría y detectar discrepancia entre sección de análisis y sección de diseño | Definir idealización, restricciones y trayectoria de carga |
| Acciones | Muerta, viva, ambiente, sismo, viento, asentamientos, origen/fecha/unidad | Generar combinaciones compatibles, patrones variables y envolventes sin perder casos fuente | Resolver cargas no modeladas, criterios contractuales y patrones excepcionales |
| Análisis | Modelo, hipótesis de rigidez, segundo orden, método/malla, estabilidad | Resolver casos y combinaciones, verificar equilibrio/convergencia, extraer estaciones | Juzgar idoneidad del método/modelo y resultados FEM |
| Resistencia | Fuerzas concurrentes, secciones críticas, factores, modos de falla | Determinar resistencia/capacidad y acero requerido por edición | Elegir sección/material/armado final y aceptar alcance |
| Servicio | Combinaciones de servicio, flecha, fisuración, vibración, deformación global | Evaluar verificaciones implementadas y señalar límites usados | Definir criterio del proyecto y resolver condiciones particulares |
| Detallado | Recubrimiento, espaciamiento, capas, anclaje, traslapes, confinamiento | Proponer barras/zonas, checar cabida geométrica y longitudes | Revisar interferencias, constructabilidad, tolerancia y secuencia |
| Revisión | Lista de elementos y estados, combinación, ubicación, advertencia, cláusula | Ordenar por estado/ratio y conectar fila↔modelo↔cálculo | Atender pendientes, registrar observación y marcar revisión |
| Emisión | Responsable/revisión, memoria, dibujos y alcances | Generar snapshot reproducible y reportes agrupados | Autorizar uso/entrega según responsabilidades profesionales |

**Qué muestra un check gobernante.** Elemento, ubicación, combinación concurrente; fuerzas y unidades; resistencia nominal, factor y resistencia de diseño; ratio y criterio; referencia exacta; detalle de armado; valores intermedios; rama/hipótesis; warning y acción recomendada; estado/versión del modelo que dio origen a la demanda.

**Envolventes.** En elementos sometidos a interacción, máximos independientes de N, Mx, My, V y T pueden venir de distintos casos y no constituyen un vector de fuerzas físicamente concurrente. Cada check debe conservar el caso concurrente de carga y ubicación, o etiquetar el método conservador de envolvente que se haya usado. Para viga debe identificarse signo/cara/estación; para columna, P-Mx-My del mismo caso; para punzonamiento, fuerza y transferencia de momento del mismo estado.

---

## Elementos y verificaciones

La referencia de jurisdicción CDMX es el compendio NTC 2023: cap. 5 resistencia de sección; caps. 6–8 sistemas/detallado de ductilidad; cap. 9 cimentación; cap. 10 puntales-tensores; cap. 13 servicio; cap. 14 detallado. [Compendio oficial](https://data.consejeria.cdmx.gob.mx/portal_old/uploads/gacetas/b3c4f4ff37241d0a93cc6742a8b0bf2f.pdf), NTC Concreto desde p. 745 del PDF compuesto.

| Elemento | Resistencia/análisis que debe cubrir | Servicio y detalle a revisar |
|---|---|---|
| Vigas | Flexión positiva/negativa, cortante, torsión e interacción cuando corresponda, axial concurrente; continuidad y estación gobernante | Flecha inmediata/diferida, fisuración, cuantías, bastones, cortes, desarrollo en apoyo, anclaje, traslapo y confinamiento sísmico |
| Columnas | Interacción P-Mx-My, carga axial máxima/mínima, esbeltez, magnificación/P-Δ, cortante, estabilidad del sistema | Cuantía máxima/mínima, distribución de barras, grapas/estribos, confinamiento, empalmes fuera de regiones críticas, jerarquía viga/columna si aplica |
| Losas unidireccionales | Flexión por franja/estación, cortante por claro, continuidad y cargas localizadas | Flecha, fisuración, acero superior en apoyo, contracción/temperatura, huecos, espaciamiento |
| Losas bidireccionales/planas | Momentos en dos direcciones, cortante unidireccional, punzonamiento y momento no balanceado en columna, abertura próxima | Flecha diferida, servicio/vibración aplicable, bandas, franjas, acero superior/inferior, capiteles y anclajes |
| Muros estructurales | N-M, cortante, estabilidad, carga sísmica e interacción con diafragmas/cimentación | Refuerzo vertical/horizontal, borde confinado, vigas de acoplamiento, colectores, aberturas, categoría de ductilidad |
| Muros de contención | Flexión/cortante por suelo, agua y sobrecargas, interacción con la base | Presión, drenaje, fases, deslizamiento/volteo, desplazamiento de suelo y refuerzo de dos caras; geotecnia separada |
| Zapatas aisladas | Presión de contacto según geotecnia, excentricidad, flexión, cortante en una dirección, punzonamiento, aplastamiento/transferencia | Refuerzo por ambas direcciones, banda de concentración, espesor, recubrimiento, desarrollo y vínculo con columna/dado |
| Corridas/combinadas | Presión y reparto entre cargas, flexión/cortante, continuidad de acciones | Armado longitudinal/transversal, transferencia entre columnas, torsión como viga si aplica, asentamiento |
| Losas de cimentación | Respuesta de placa/malla/franjas, flexión biaxial, punzonamiento y presión/resortes del terreno | Asentamientos diferenciales, fisuración, malla por bandas, secuencia de colado, armado arriba/abajo |
| Dados, pedestales, cabezales | Compresión-flexión/cortante, aplastamiento y zona D; puntal-tensor si la geometría lo requiere | Anclaje, jaula, estribos, continuidad y espacio constructivo |
| Vigas de cimentación/contratrabes | Flexión, cortante, axial/torsión, compatibilidad de desplazamiento y suelo | Armado por cara, conexión con zapata/columna, asentamiento, durabilidad y contacto con terreno |
| Pilotes/pilas | Axial/flexión/cortante, carga lateral y distribución a grupo con base geotécnica | Confinamiento, integridad, longitud de anclaje y empalme, ejecución especializada |

### Comprobaciones transversales

- **Flexión y cuantías:** identificar cara en tensión, sección efectiva, bloque de compresión y factor ligado al modo de deformación; separar acero requerido, mínimo, máximo y proporcionado. NTC §§5.2–5.4 y tabla §3.8.
- **Cortante:** demanda concurrente, contribución de concreto/refuerzo, mínimo/máximo, límite de compresión diagonal y separaciones máximas. NTC §5.5; el perfil local registra §§5.5.3.1.1–.1.2, §§5.5.3.6.1–.6.2 y §6.3.7.6.2.2.
- **Torsión:** NTC §5.8; revisar requisitos de jaula cerrada y combinación con cortante/flexión cuando cambia equilibrio. Si no se implementa, mostrar fuera de alcance o pendiente, nunca omitirla de forma silenciosa.
- **Flexocompresión:** conservar acciones concurrentes y curva/superficie de sección; NTC §§5.3–5.4. Para columnas, agregar estabilidad y las reglas de los capítulos 6–8.
- **Punzonamiento:** mostrar perímetro/área crítica, abertura cercana, distancia a borde y momento no balanceado. NTC §5.6 y cap. 9. La comprobación no se resume con un ratio sin dibujo y ubicación. Además, validar el disparador de acero mínimo de §6.7.6.1.2: el motor usa esfuerzo directo `vuv`, aunque su demanda de punzonamiento también suma transferencia de momento; confirmar si el umbral normativo debe usar el esfuerzo máximo combinado de §6.7.4 antes de declarar equivalencia. [Motor de zapata](../../../src/design/elements/footing.ts).
- **Servicio:** separar ULS de servicio. NTC cap. 13 distingue flechas inmediatas/diferidas, agrietamiento y distribución del acero. Sin acción sostenida/límite aplicable no existe aprobación de flecha total.
- **Desarrollo/anclajes/traslapes:** NTC cap. 14 §§14.2–14.7 agrupa espaciamiento, dobleces, longitudes, empalmes y refuerzo transversal. Mostrar longitud y rama del factor/condición, tipo de barra, cara y ubicación. En el cálculo NTC actual de desarrollo no hay entrada para barra epóxica ni concreto ligero y la fórmula no incluye `ψe` ni `λ`; hasta ampliar y verificar esas ramas, exponer esa limitación y no atribuir cobertura general a condiciones no modeladas. [Opciones y ecuación de desarrollo](../../../src/design/elements/codes.ts).
- **Confinamiento:** caps. 6–8 NTC distinguen sistemas de ductilidad. Un ratio de resistencia gravitacional menor que 1 no prueba el detalle sísmico del nudo o miembro.
- **Viga profunda y región D:** NTC §5.2.1.1.2 dirige al cap. 10 cuando la geometría cae en ámbito de puntales-tensores; no extrapolar la ecuación de viga ordinaria.
- **Cimentación:** NTC-Cimentaciones gobierna geotecnia y NTC-Concreto resistencia del elemento. Los factores de capacidad del suelo (por ejemplo FR geotécnico de 0.35 o 0.65 en casos listados) no son FR del concreto.
- **Constructabilidad:** una cuantía de acero calculada no demuestra que quepa. Validar recubrimiento, separación libre, tamaño de agregado, capas, anclaje, gancho, empalme, confinamiento e interferencia.

---

## Normativa y trazabilidad

### Jerarquía

**HECHO.** Para obra en CDMX, el RCDF y NTC vigentes son la base de autoridad; los estándares de ensayo/materiales se aplican según las referencias dentro de NTC y los estándares contractuales/especiales según el proyecto. ACI/ASCE/Eurocode se pueden seleccionar como base alternativa jurisdiccional o comparador, nunca mezclarse sin declarar edición y compatibilidad. La NTC-Concreto cita influencias de ACI, pero no por eso se intercambian sus capítulos, factores o requisitos legales.

| Fuente | Qué verificar | Referencias y límites de implementación |
|---|---|---|
| RCDF CDMX | Seguridad estructural, documentación revisable y remisión a NTC | Art. 53; arts. 137–140. El portal oficial indica reforma 04-10-2024 |
| NTC Concreto CDMX 2023 | Materiales, análisis, resistencias, ductilidad, servicio y detalle | §§2.2–2.4; caps. 3, 5–10, 13–14, 16 |
| NTC Criterios y Acciones 2023 | Intensidades, patrones y combinaciones | §§2.1–2.3 y 3.4; coordinar con Sismo/Viento/Cimentaciones. La norma incluye rama accidental (p. ej. §3.4.1(b)); no equivale a la cobertura actual del taller |
| NTC Sismo, Viento y Cimentaciones | Acciones ambientales, estabilidad global, geotecnia y diseño del cimiento | Paquetes relacionados del compendio 2023; no sustituir por factores de otro código |
| ACI CODE-318-25 | Edición 2025, declarada por ACI como última al corte; texto completo requiere acceso editorial | Índice oficial: caps. 5–6 carga/análisis, 7–8 losas, 9 viga, 10 columna, 11 muro, 13 cimentación, 17 anclaje, 18 sismo, 21 φ, 22 resistencia, 23 STM, 24 servicio, 25 detalle, 26 documentación |
| ACI 355.2-24/355.4-24/355.5-24 | Calificación de anclajes mecánicos, adhesivos y barras postinstaladas | No son diseño de armadura convencional; requieren producto ensayado y ACI 318 compatible |
| ACI 440.11-22 | Concreto con refuerzo GFRP | Requiere modelo material/servicio/detalle distinto al acero |
| ASCE/SEI 7-22 | Acciones estadounidenses, incluidas tsunami y nuevas disposiciones sobre tornados en 7-22, además de cargas gravitacionales, ambientales y combinaciones | No es una norma de acciones CDMX; usar con el código y jurisdicción elegidos |
| Eurocode 2 y transición 2G | Concreto simple/reforzado/presforzado, resistencia, servicio, durabilidad/fuego | Coordinar EN 1990/1991/1997/1998 y anexo nacional. Votos formales 2G concluyeron en nov-2025; JRC publica como hitos límite la publicación nacional al 30-09-2027 y el retiro de normas nacionales conflictivas al 30-03-2028. Son fechas de transición, no adopción simultánea de todos los anexos nacionales |
| NSR-10 Título C | Perfil colombiano que ya existe en FS-A04 | Mantener Título C/edición y referencias de Colombia; no usar como sustituto de NTC |
| E.060 2009 | Perfil peruano existente, bajo el RNE | Guardar la edición 2009 y revisar cambios futuros antes de afirmar actualización |
| NMX y CFE | Ensayos/calidad de materiales y manuales de contrato/infraestructura | Complementan la norma que los invoca; no son automáticamente un código general de edificio |

### Parámetros y ecuaciones NTC CDMX verificables

| Tema | Implementación a considerar | Referencia/unidad/caveat |
|---|---|---|
| Combinaciones | NTC Criterios §§2.3/3.4 contempla combinaciones ordinarias y accidentales (la rama de §3.4.1(b) incluye 1.1). FS-A04 genera una receta gravitacional ULS por grupo: B = 1.3 CM + 1.5 CV; A = 1.5 CM + 1.7 CV. El factor 0.9 favorable se aplica en el cálculo donde corresponde, pero no se genera una combinación accidental/sísmica. Algunas verificaciones de servicio se calculan aparte; no son un generador completo de combinaciones SLS. [Perfil de combinación](../../../src/design/elements/codes.ts), [catálogo que excluye acciones accidentales](../../../src/data/loadCombinationStandards.ts), [entrada sísmica de zapata](../../../src/features/design/workbench/FootingWorkbench.tsx) | Mantener acción fuente y patrón; declarar cobertura por estado y grupo. No seleccionar grupo por defecto oculto; no reportar cumplimiento sísmico por el toggle de zapata, que solo cambia FR de punzonamiento |
| Clases de concreto | NTC separa clase y resistencia; clases 1A/1B tienen rangos propios y concreto clase 2 tiene restricciones de uso | NTC §§2.2.2–2.2.3; f’c en MPa o kgf/cm² con unidad explícita, clase no inferida sólo desde f’c |
| Materiales de refuerzo | NTC §2.4 controla grado/tipo de acero por aplicación y ductilidad | Conservar norma de producto, fy, clase/barra y uso permitido |
| Bloque de compresión | NTC §3.6.1 define f″c = 0.85 f’c y β₁ = 0.85 hasta f’c ≤ 30 MPa; arriba usa β₁ = 1.05 − f’c/140 con mínimo 0.65 | El motor [ntcConcrete2023.ts](../../../src/design/concrete/ntcConcrete2023.ts) adelanta la transición continua a 28 MPa, dando menor β₁ entre 28–30 MPa. [normative-sources.json](../../design/normative-sources.json) aún describe 30 MPa también como metadata de implementación. Conciliar metadata y decisión del motor antes de afirmar equivalencia literal |
| Factores de resistencia | §3.8.1.1 y tablas 3.8.2.1–.2: factor depende de acción, modo, sistema/ductilidad; flexión puede variar 0.65–0.90; cortante ordinario 0.75; torsión 0.75; algunas ramas sísmicas de penetración usan otro valor | Aplicar rama exacta por verificación, no un φ global; las reglas tienen excepciones sísmicas |
| Flexión | Forma de la sección rectangular registrada en §5.2.2.1.1.1: MR = FR As fy d (1 − 0.5q), donde q depende de cuantía/materiales | N·mm si se trabaja con N, MPa, mm; aplicar sólo dentro de hipótesis/cláusula |
| Viga profunda | §5.2.1.1.2 remite al cap. 10 para regiones dentro del rango definido por la norma | Rechazar/derivar a puntal-tensor cuando no aplica el modelo de secciones ordinarias |
| Cortante | §§5.5.3.1.1–.1.2 gobiernan VcR y límites; en rama Pu=0 aparece forma proporcional a FR·0.17·λ·√f’c·bw·d; §6.3 define acero mínimo/detalle | N y mm con MPa; incluir límites superior/inferior y condición de cada ecuación |
| Columnas | §§3.3.5.2.1–.2 y 3.3.5.2.4 cubren esbeltez/magnificación, depende de M1/M2, arriostramiento, longitud y rigidez efectiva | Guardar método, apoyos, carga sostenida y si requiere análisis de segundo orden explícito |
| Servicio | Cap. 13, §§13.4–13.6: respuesta inmediata/diferida y control de fisuración/distribución | Separar combinación de servicio y límite/claro en el resultado |
| Detallado | Cap. 14: espaciamiento §14.2; dobleces §14.3; desarrollo §14.4; empalmes §14.5; transversal/confinamiento §14.7 | Longitudes en mm con rama y factores explícitos |
| Cimentación | Cap. 9 y §9.4; el registro del taller incluye §§9.4.3, 9.4.6.1, 9.4.7.8, 9.4.8.2, además de cortante/punzonamiento de caps. 5–6 | Revisar resistencia del elemento y dejar la capacidad/asentamiento del suelo bajo NTC-Cimentaciones |

Las referencias internas se deben acompañar de página del PDF oficial compuesto, porque el número impreso dentro de la NTC puede ser distinto al número físico del compendio. La documentación interna ya guarda esas páginas e identifica una lista de cláusulas, por lo que el reporte debe aprovechar ese recurso en vez de crear citas sin procedencia. [Registro NTC](../../design/normative-sources.json).

**ACI/ASCE/EC2 — límite de acceso.** El portal de ACI identifica ACI CODE-318-25 y da su índice; no es texto íntegro libre. La comparación permite planear estructura y compatibilidad, pero fórmulas/límites numéricos deben implementarse con copia autorizada y erratas. ASCE 7 es estándar de cargas estadounidense. Eurocode requiere edición y anexo nacional; no mezclar primera y segunda generación. [ACI 318 portal](https://www.concrete.org/topicsinconcrete/318buildingcodeportal.aspx), [ACI 318-25 TOC](https://www.concrete.org/store/productdetail.aspx?ItemID=318U25&Language=English&Units=US_Units), [ASCE 7-22](https://www.asce.org/publications-and-news/codes-and-standards/asce-sei-7-22), [JRC EC2](https://eurocodes.jrc.ec.europa.eu/EN-Eurocodes/eurocode-2-design-concrete-structures), [cronograma de segunda generación](https://eurocodes.jrc.ec.europa.eu/second-generation-eurocodes).

---

## Benchmark comercial

Las conclusiones son de UX/documentación oficial, no un ranking ni auditoría de precisión. Algunas ayudas/tutoriales corresponden a ediciones anteriores; consultar la versión objetivo antes de asumir que la función permanece idéntica.

| Producto | Flujo y patrón de interfaz observado | Fortaleza útil | Límite/oportunidad para FStructure |
|---|---|---|---|
| ETABS | Analizar → diseñar → seleccionar miembro/estación y abrir tabla interactiva por combinación; resultados de acero, ratios y flexión/cortante en modelo. [Interactive design](https://docs.csiamerica.com/help-files/etabs/Menus/Design/Concrete_Frame_Design/CF_Interactive_Concrete_Frame_Design.htm), [Display Design Info](https://docs.csiamerica.com/help-files/etabs/Menus/Design/Display_Design_Info.htm) | Selección gráfica lleva al contexto de cálculo local | Ayuda consultada antigua; imitar navegación miembro-combinación-estación |
| SAP2000 | Varias vistas coordinan deformada, diagramas, tablas y resultados de diseño/sobrescrituras. [Funciones](https://www.csiamerica.com/products/sap2000/features), [concreto](https://docs.csiamerica.com/help-files/sap/Menus/Design/Concrete_Frame_Design/CF_Display_Design_Info.htm) | Configuración de espacio visual de modelo/resultados | Producto de análisis general; distinguir su diseño de herramienta de detallado |
| SAFE | Losa/fundación: análisis, franjas, acero de flexión, ratios de punzonamiento, tabla y reporte; detallado preliminar y planillas/editables. [Flujo](https://docs.csiamerica.com/help-files/safe/Getting_Started/General_Modeling_Process_and_Tips.htm), [franjas](https://docs.csiamerica.com/help-files/safe/Program_Output/Integrated_Strip_Forces.htm), [manual](https://docs.csiamerica.com/manuals/safe/SAFE%20RC%20Design.pdf) | Vincula franja, demanda, punzonamiento y acero | El manual aclara que ciertas láminas son preliminares; FStructure debe declarar salida no constructiva |
| CSiCOL | Asistente, importación de columnas ETABS, sección/DXF, curvas P-M/M-M y reporte resumido/detallado. [Producto](https://www.csiamerica.com/products/csicol), [features](https://www.csiamerica.com/products/csicol/features) | Curva y carga de columna visibles en la misma solución | Especialista de columna, no modelo de edificio |
| STAAD.Pro + RCDC | Instrucción por miembro y mensajes en análisis; RCDC agrupa/detecta continuidad, edita refuerzo, produce reportes/planos y causas de fallo. [RCDC](https://bentleysystems.service-now.com/community?id=kb_article_view&sysparm_article=KB0111695), [resultados](https://bentleysystems.service-now.com/community?id=kb_article&sysparm_article=KB0115163) | Diferencia análisis de fabricación/detallado | Parte del ciclo depende de otro producto/licencia; mostrar etapa y vigencia |
| RAM Structural System | Tareas/módulos para edificio, análisis, concreto y fundación, con resultados e informes. [Tutorial](https://bentleysystems.service-now.com/community?id=kb_article&sysparm_article=KB0117768), [producto PDF](https://www.bentley.com/wp-content/uploads/PDS-RAM-Structural-System-LTR-EN-LR.pdf) | Organización por flujo de edificio y disciplina | Mantener navegación sin perder selección al transitar de módulo |
| RAM Concept | Losa/mat/PT, elementos finitos, franjas/contornos, punzonamiento y flecha a largo plazo. [Producto](https://www.bentley.com/products/ram-concept), [ficha](https://www.bentley.com/wp-content/uploads/pds-ram-concept-ltr-en-lr.pdf) | Servicio y refuerzo de placa al mismo nivel de revisión | Optimización PT es alcance específico |
| RISA-3D | Hojas separadas para flexión/cortante y resultados por envolvente/estación; reportes incluyen ratios y warnings. [Resultados de concreto](https://help.risa.com/risahelp/risa3d/Content/ConcreteMembers/Concrete-Design-Results.htm) | Expone ubicación chequeada, diagramas y capacidad | Ratio máximo necesita combinación/resolución visibles |
| RISA ADAPT Builder | Estados N/A, OK, requiere refuerzo, excede norma; visor/mapa. [Panel de resultados](https://help.risa.com/risahelp/adaptbuilder/Content/UI/ResultDisplayViewer-panel.htm) | No colapsa pendiente de refuerzo con fallo | Mantener leyenda y texto junto al color |
| Tekla Structural Designer | Review View, tabla y colores: Error, Beyond Scope, Fail, Warning, Pass, Not Yet Designed; ratios configurables para autodesign/check. [Estados](https://support.tekla.com/doc/tekla-structural-designer/2026/rev_reviewmemberdesign), [review](https://support.tekla.com/doc/tekla-structural-designer/2026/ref_reviewribbon), [ratios](https://support.tekla.com/doc/tekla-structural-designer/2026/des_applyutizationratios) | Distingue fuera de alcance y warning | Modos auto/check pueden diferir; indicar modo y umbral |
| Robot Structural Analysis | Losa: geometría/apoyos/malla → cargas/analysis → mapas/tablas → acero teórico/proporcionado → revisar flecha tras cambio. [Tutorial](https://help.autodesk.com/cloudhelp/2022/ENU/Robot-GSG/files/Tutorials/Robot_GSG_Tutorials_Tut_Plate_Design_html.html), [alcance](https://help.autodesk.com/cloudhelp/2025/ENU/RSAPRO-UsersGuide/files/GUID-07532EC8-6712-4642-9C60-7A43EB2993F7.htm) | Separa steel requerido del dispuesto y vuelve a servicio | Tutorial viejo; el ciclo de modificación/verificación sí es un patrón |
| RFEM/RSTAB | Tabla enlaza situación/carga/miembro/ubicación/check/ratio; filtra ULS/SLS; detalle doble clic con variables y ecuaciones simbólicas o numéricas. [Tabla](https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6-tutorial-concrete-design-en-us/003081), [filtros](https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6-concrete-design/004021), [ecuaciones](https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6-concrete-design/000561) | Alta trazabilidad entre línea, ecuación, norma y miembro | Requiere que el contexto/filtros se mantengan al navegar |
| IDEA StatiCa | Miembro/región D local con geometría/DXF, barras, ULS/SLS, anclaje, fisura y reporte. [Muros/regiones D](https://www.ideastatica.com/concrete/walls-and-details), [miembros](https://www.ideastatica.com/concrete-member-design) | Casos locales que exceden modelo global | No sustituye análisis de edificio; buena extensión posterior |
| SkyCiv | Modelo beam/3D, secciones/materiales/combinaciones, edición de barras/estribos gráfica y salida por paso. [Módulo RC](https://skyciv.com/structural-software/reinforced-concrete-design/), [section designer](https://skyciv.com/docs/skyciv-section-builder/general-section-designer/getting-started/) | Feedback de armado y reporte | Función depende de código/módulo; el PDF de ejemplo intentado respondió 404 y se excluyó |
| ClearCalcs / Calcs.com | Hoja de viga, dibujo de sección, entradas/unidades/cargas, diagramas y resumen/PDF. [Guía actual ACI 318-19](https://calcs.com/docs/calculators/us/beams/concreteBeamRectangularUSAACI318-19), [PDF de muestra 2021](https://s3.amazonaws.com/helpscout.net/docs/assets/5c09df402c7d3a31944ed720/attachments/5ff5137cfd168b7773531eac/US-Concrete-Beam---B1.pdf) | Progresión clara de campos a resultado | El PDF citado es ACI 318-14/IBC 2018; herramienta por miembro no lleva al edificio |
| ENERCALC | Seleccionar elemento/código después del análisis; vista 2D/3D, diagramas/tablas y mensaje cuando el chequeo no cubre una rama. [Viga](https://media.enercalc.com/sel_help_20/concretebeam.htm), [columna](https://media.enercalc.com/sel_help_20/concretecolumn.htm) | Supuestos y límites se comunican | Manual dice que módulo de viga no es detallado; no ocultar esas hipótesis |
| ProtaStructure | Lista batch/grupo/eje/nivel/ratio; editor de barras, patrón, copiar, recomputar, reporte y causa de fallo. [Editor PS 2022](https://support.protasoftware.com/portal/en/kb/articles/reinforcement-data-editor-ps-2022), [novedades 2024](https://cdn.protasoftware.com/documents/protastructure-suite-2024-whats-new.pdf) | Ciclo lote → elemento → editar → recalcular → reportar | Cambio de sección invalida análisis |
| CYPECAD | Base de diseño, plantas/materiales/combinaciones, vigas/losas/muros/fundación, mapas/armado/planos. [CYPECAD](https://info.cype.com/es/software/cypecad/), [NTC 2023](https://info.cype.com/es/codes/ntc-2023/) | Evidencia documentada de NTC 2023 comercial desde producto/versión | Módulo/versión/licencia condicionan disponibilidad |
| Aplicación mexicana | CYPE publica implementación de NTC-CDMX 2023 para concreto, CYPECAD/CYPE 3D/punzonamiento/cimentación. [Implementación](https://info.cype.com/es/novedad/implementacion-de-normativa-7/) | Confirma una ruta comercial local descrita por fabricante | La revisión no encontró evidencia oficial igual de soporte NTC 2023 para todo otro producto del benchmark |

**Síntesis comparativa — INFERENCIA.** Hay tres modelos: modelo global + inspector de miembro (ETABS, Tekla, Robot, CYPE, Prota); hoja de cálculo explicable (ClearCalcs/ENERCALC); aplicación especializada por componente (SAFE/RAM, CSiCOL, IDEA, RFEM). La propuesta para FStructure combina la hoja actual con selección/global sólo cuando hay vínculo real, y conserva una modalidad aislada. Debe poderse recorrer miembro → combinación → ubicación → demanda concurrente → estado → variables → cláusula → armado.

---

## Open source inspeccionado

Se leyeron licencias y archivos concretos de código/pruebas. Los repositorios sirven como patrones, no como fuente de cumplimiento NTC.

| Proyecto, licencia y actividad consultada | Arquitectura/alcance y archivos inspeccionados | Utilidad y límite |
|---|---|---|
| [StructLib](https://github.com/Pravin-surawase/structural_engineering_lib), MIT; HEAD 9c75e56 (2026-09-19) | Python/FastAPI, React 19, Three.js, Zustand, AG Grid/Dockview; [ResultsPanel](https://github.com/Pravin-surawase/structural_engineering_lib/blob/9c75e56/react_app/src/components/design/ResultsPanel.tsx), [Viewport3D](https://github.com/Pravin-surawase/structural_engineering_lib/blob/9c75e56/react_app/src/components/viewport/Viewport3D.tsx), [viga IS456](https://github.com/Pravin-surawase/structural_engineering_lib/blob/9c75e56/Python/structural_lib/codes/is456/beam/flexure.py), [punzonamiento](https://github.com/Pravin-surawase/structural_engineering_lib/blob/9c75e56/Python/structural_lib/codes/is456/footing/punching_shear.py) | Útil para selección, tabla y overlay; declara no ser solver general de edificio y trabaja IS456 |
| [Mento](https://github.com/mihdicaballero/mento), MIT; f304b90 (2026-09-21) | Python, Pint/Pandas/reportes; [beam.py](https://github.com/mihdicaballero/mento/blob/f304b90/mento/beam.py), [design_results.py](https://github.com/mihdicaballero/mento/blob/f304b90/mento/design_results.py), [ACI flexure](https://github.com/mihdicaballero/mento/blob/f304b90/mento/codes/aci_318_19/equations/flexure.py), [prueba](https://github.com/mihdicaballero/mento/blob/f304b90/tests/test_aci_318_19_flexure_equations.py), [slab.py](https://github.com/mihdicaballero/mento/blob/f304b90/mento/slab.py) | Separa unidades/orquestación/combos; no es GUI ni solver global; parte de cobertura sigue roadmap |
| [concrete-properties](https://github.com/robbievanleeuwen/concrete-properties), MIT; 13bfb7b (2026-09-17) | Python; [sección](https://github.com/robbievanleeuwen/concrete-properties/blob/13bfb7b/src/concreteproperties/concrete_section.py), [integration](https://github.com/robbievanleeuwen/concrete-properties/blob/13bfb7b/src/concreteproperties/analysis_section.py), [interaction tests](https://github.com/robbievanleeuwen/concrete-properties/blob/13bfb7b/tests/test_moment_interaction.py) | Mecánica y curvas de sección/interacción con pruebas; no diseño global/NTC |
| [fib StructuralCodes](https://github.com/fib-international/structuralcodes), Apache-2.0; 3e9c3f5 (2026-09-15) | Python por edición: [shear EC2 2004](https://github.com/fib-international/structuralcodes/blob/3e9c3f5/structuralcodes/codes/ec2_2004/shear.py), [SLS EC2 2023](https://github.com/fib-international/structuralcodes/blob/3e9c3f5/structuralcodes/codes/ec2_2023/_section9_sls.py), [integrators](https://github.com/fib-international/structuralcodes/tree/3e9c3f5/structuralcodes/sections/section_integrators), [tests](https://github.com/fib-international/structuralcodes/tree/3e9c3f5/tests) | Ejemplo de separar norma/versiones y pruebas; sin UI ni solver de edificios |
| [Pynite](https://github.com/JWock82/Pynite), MIT; c4454a2 (2026-09-24) | Python FEM; [FEModel3D](https://github.com/JWock82/Pynite/blob/c4454a2/Pynite/FEModel3D.py), [MatFoundation](https://github.com/JWock82/Pynite/blob/c4454a2/Pynite/MatFoundation.py), [result tests](https://github.com/JWock82/Pynite/blob/c4454a2/Testing/test_member_internal_results.py), [report tests](https://github.com/JWock82/Pynite/blob/c4454a2/Testing/test_reporting.py) | Referencia de integración/resultados y cimentación numérica; no implementa diseño normativo de concreto |
| [pyntc / norma-ntc](https://github.com/rafse/norma-ntc), MIT; 1cf64d0 (2026-03-13), pre-alpha en PyPI | Python; [concrete checks](https://github.com/rafse/norma-ntc/blob/1cf64d0/src/pyntc/checks/concrete.py), [reference decorator](https://github.com/rafse/norma-ntc/blob/1cf64d0/src/pyntc/core/reference.py), [tests](https://github.com/rafse/norma-ntc/tree/1cf64d0/tests/checks) | “NTC” es norma italiana 2018, no NTC CDMX; interesante sólo por metadatos de cláusula/ecuación |
| [FoundationDesign](https://github.com/kunle009/FoundationDesign), GPL-3.0; HEAD 3960e4a (2025-07-23) | Python: [zapata aislada](https://github.com/kunle009/FoundationDesign/blob/3960e4a/FoundationDesign/foundationdesign.py), [combinada](https://github.com/kunle009/FoundationDesign/blob/3960e4a/FoundationDesign/combinedfootingdesign.py), [prueba](https://github.com/kunle009/FoundationDesign/blob/3960e4a/tests/test_PadFoundationDesign.py); incluye cargas, flexión, punzonamiento, deslizamiento y gráficos | Útil para flujo; commit antiguo y copyleft requieren revisión legal |
| [FreeCAD-Reinforcement](https://github.com/amrit3701/FreeCAD-Reinforcement); encabezados dicen LGPL v2+, pero checkout no trae licencia raíz; HEAD 9f424ac (2026-02-22) | Python/FreeCAD Arch; [StraightRebar.py](https://github.com/amrit3701/FreeCAD-Reinforcement/blob/9f424ac/StraightRebar.py), [vigas](https://github.com/amrit3701/FreeCAD-Reinforcement/tree/9f424ac/BeamReinforcement), [zapatas](https://github.com/amrit3701/FreeCAD-Reinforcement/tree/9f424ac/FootingReinforcement), [BBS](https://github.com/amrit3701/FreeCAD-Reinforcement/blob/9f424ac/BarBendingSchedule/BBSfunc.py) | Detalle geométrico/BBS, no cálculo resistente; aclarar licencia antes de reutilizar |
| [concretedesignpy](https://github.com/project-alpha-development/concretedesignpy), README/config declaran MIT, sin LICENSE raíz observado; HEAD 705259b (2026-08-15) | [CLAUSES](https://github.com/project-alpha-development/concretedesignpy/blob/705259b/CLAUSES.md), [beam_moment](https://github.com/project-alpha-development/concretedesignpy/blob/705259b/concretedesignpy/calculators/beam_moment.py), [QA recomputation](https://github.com/project-alpha-development/concretedesignpy/blob/705259b/tests/test_qaqc_independent_recomputation.py), [calcsheet](https://github.com/project-alpha-development/concretedesignpy/blob/705259b/concretedesignpy/webapp/templates/_calcsheet.html) | Buen caso para aprender de etiquetas de cláusula, pero limita módulos a NSCP/ACI-14 aunque otros textos indiquen 318-19 |
| [PyRCD](https://github.com/TabishIzhar/PyRCD), MIT; un commit 588731b (2024-02-05), sin suite encontrada | Python/Plotly, archivo [RCbeam.py](https://github.com/TabishIzhar/PyRCD/blob/588731b/PyRCD/RCbeam.py) mezcla diseño, búsqueda de sección, detalle y gráficos | Prototipo visual; constantes embebidas y cálculo sin validación suficiente |
| [OpenSees](https://github.com/OpenSees/OpenSees) y [OpenSees Studio](https://github.com/ogunc/opensees-studio), licencia propia del solver con restricción comercial / Studio AGPL-3.0, 73b8d5d (2026-05-22) | [licencia OpenSees](https://opensees.github.io/OpenSeesDocumentation/developer/license.html), [arquitectura](https://github.com/ogunc/opensees-studio/blob/73b8d5d/docs/architecture.md), [runner](https://github.com/ogunc/opensees-studio/blob/73b8d5d/src/opensees_studio/services/opensees_runner.py), [captura](https://github.com/ogunc/opensees-studio/blob/73b8d5d/docs/screenshots/main_window.png) | Referencia no lineal/arquitectónica; no copiar sin revisar términos |
| [RC-FIAP](https://github.com/vfceball/RC-FIAP), envoltura MIT; HEAD 802b713 (2023-08-24) | Python GUI educativa de pushover/IDA; inspeccionado [RC_FIAP_main.py](https://github.com/vfceball/RC-FIAP/blob/802b713/RC_FIAP_main.py); usa OpenSees | Referencia pedagógica, repositorio antiguo y sin tests encontrados; revisar motor y licencias |

**PROPUESTA.** Leer StructLib para viewport/estados; Mento para resultados por combinación/unidad; concrete-properties para sección e interacción; fib para segmentación por edición y Pynite para el límite de análisis; pyntc sólo para metadatos. El motor FStructure debe continuar con referencias y validación propias NTC.

---

## Investigación visual y UI/UX

### Capturas de interfaz estudiadas

La procedencia detallada de cada archivo está en [assets/README.md](assets/README.md). Los fabricantes conservan la autoría de las pantallas.

![ClearCalcs: formulario de viga con sección y campos](assets/clearcalcs-concrete-beam-input.png)

**Figura 1.** **Fuente/producto:** [imagen de ayuda para viga de concreto de ClearCalcs](https://s3.amazonaws.com/helpscout.net/docs/assets/5c09df402c7d3a31944ed720/images/5ff512dabb5c6f7434e0e112/file-Xxsl72PkYk.png). **Consulta:** 25-09-2026. **Patrón:** sección dibujada contigua a dimensiones, unidad, material, recubrimiento y apoyos. **Utilidad:** vincular parámetros con su representación y aclarar unidades. Parte de las flechas son anotaciones de la documentación.

![ClearCalcs: página resumen de reporte](assets/clearcalcs-report-page.png)

**Figura 2.** **Fuente/producto:** [reporte de ejemplo ClearCalcs](https://s3.amazonaws.com/helpscout.net/docs/assets/5c09df402c7d3a31944ed720/attachments/5ff5137cfd168b7773531eac/US-Concrete-Beam---B1.pdf). **Consulta:** 25-09-2026. **Patrón:** resumen, ratios, datos, diagramas y chequeos en una página. **Utilidad:** estudiar jerarquía del reporte. Esta muestra de 2021 cita ACI 318-14/IBC 2018; no es referencia normativa vigente.

![ProtaStructure: editor de refuerzo de viga](assets/prota-rebar-editor.png)

**Figura 3.** **Fuente/producto:** [editor de refuerzo ProtaStructure PS 2022](https://support.protasoftware.com/portal/en/kb/articles/reinforcement-data-editor-ps-2022). **Consulta:** 25-09-2026. **Patrón:** barras editables por claro/patrón, refuerzo requerido, diagramas y acceso a resumen/detalle. **Utilidad:** comparar armado requerido y proporcionado y dar contexto visible a edición/copiado de barras.

![RFEM 6: tabla de ratios por miembro](assets/rfem-design-ratios-table.png)

**Figura 4.** **Fuente/producto:** [tutorial de diseño de concreto RFEM 6 de Dlubal](https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6-tutorial-concrete-design-en-us/003081). **Consulta:** 25-09-2026. **Patrón:** tabla por miembro, ubicación, combinación, verificación y ratio (ejemplo ACI 318-19). **Utilidad:** enlazar resultado gobernante con ubicación y estado normativo.

![RFEM 6: diálogo de detalle de verificación](assets/rfem-design-check-details.png)

**Figura 5.** **Fuente/producto:** [detalle de verificación del tutorial RFEM 6 de Dlubal](https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6-tutorial-concrete-design-en-us/003081). **Consulta:** 25-09-2026. **Patrón:** fuerzas, propiedades, refuerzo, variables intermedias, ecuación y cláusula en un mismo panel. **Utilidad:** llevar cada ratio a un cálculo explicable y reproducible.

![RFEM 6: diagrama de esfuerzos de sección](assets/rfem-stress-diagram.png)

**Figura 6.** **Fuente/producto:** [diagrama de sección del tutorial RFEM 6 de Dlubal](https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6-tutorial-concrete-design-en-us/003081). **Consulta:** 25-09-2026. **Patrón:** tensiones calculadas en acero y concreto representadas dentro de la sección. **Utilidad:** conectar resultado, geometría y estado local; no es un plano constructivo.

### Arquitectura de información y comportamiento

**PROPUESTA.** Mantener los modos de proyecto y de miembro aislado separados, pero con los mismos motores y vocabulario.

| Área | Contenido y responsabilidad |
|---|---|
| Cabecera | Norma/edición, paquetes compatibles de cargas/sismo/fundación, grupo, unidad, versión del modelo/análisis |
| Navegador | Edificio → piso/eje → familia → elemento; búsqueda, lotes y filtros por estado |
| Canvas | Modelo o croquis sincronizado; capas independientes de demanda, ratio, acero requerido/proporcionado y selección |
| Inspector | Geometría/material/condiciones; fuente de cada campo; edición relevante al elemento |
| Tabla | Check, estado, ratio, demanda, capacidad, combo y ubicación; filtros/orden y navegación hacia el miembro |
| Panel inferior | Gráficas, fórmulas/variables, norma/evidencia, advertencias, acero e historial |
| Reporte | Snapshot de diseño, memoria, cuadros de armadura y esquemas con estado preliminar/revisión |

Wireframe de escritorio:

| Izquierda | Centro | Derecha |
|---|---|---|
| Pisos, tipos, grupos, filtros y búsqueda | Modelo con selección/overlay; debajo gráfico o tabla de checks | Inspector del miembro y resultado seleccionado |
| Lista de elementos con estado | Herramientas existentes de zoom/selección | Tabs: Resultado, Detalle, Acero, Fuente, Historial |

En móvil/tablet, conservar el patrón actual Dibujo/Datos/Resultados con una vista a la vez y un sumario sticky del estado.

### Entradas, resultados y edición

- Empezar por geometría/materias/cargas o por el objeto seleccionado, no por campos irrelevantes. Mostrar opciones avanzadas sólo cuando la tipología activa las necesite.
- Situar croquis/sección al lado del campo que define, con flechas de eje, cara, recubrimiento, capas y unidad.
- Unidad siempre visible; conversiones explícitas y catálogo contextual por norma/país. No inferir unidad desde el valor.
- Diferenciar acciones (fuente), combinación (factor), demanda concurrente y envolvente; permitir abrir el caso original desde el diseño.
- Distinguir acero requerido de acero proporcionado. Editor posterior debe modificar barras por selección de diámetro, número/espaciamiento, zona y capa; actualizar dibujo/check de inmediato y permitir deshacer/comparar.
- La edición que cambie rigidez/masa vuelve a análisis global; un cambio sólo local de detalle invalida checks, servicio dependiente y reportes. Informar motivo.
- Mostrar ecuación resumida por defecto; expandir valores y símbolos, rama elegida, supuestos y fuente, como patrón de RFEM.
- Alternativas A/B con mismas cargas, edición y modelo; ratios/mínimos y peso/cantidad de acero visibles.
- Tabla a modelo y modelo a tabla deben preservar filtro, combinación, ubicación y selección.
- El PDF se arma del mismo snapshot, con estado de alcance y reporte versionado; rotular plano preliminar donde no haya información constructiva.

### Estados, color y accesibilidad

**PROPUESTA.** Estado visible con texto/icono/color: Error, Pendiente, No diseñado, No aplica, Fuera de alcance, Warning, No cumple, Cumple y Desactualizado. Una advertencia puede existir junto a resistencia que cumple. Ratio requiere unidad, escala/leyenda y límite aplicable. El estado total de miembro no es Cumple si falta dato o quedó una verificación normativa sin ejecutar.

Reusar tokens/componentes del design system; controles de teclado y foco visible, etiquetas de estado accesibles, hit targets claros, contraste y navegación por tabla. El color no es el único canal. Proveer tooltips para símbolos/abreviaturas y atajos para siguiente/anterior chequeo, búsqueda, escape y alternar datos/resultados. No crear controles sin comportamiento.

---

## Propuesta para FStructure

### Modos, navegación y secuencia

**PROPUESTA.** FS-A04 puede agruparse en cinco fases visibles:

1. **Base de diseño:** país/jurisdicción, edición, paquetes compatibles, grupo, ductilidad, sistema, exposición y unidades.
2. **Modelo y acciones:** seleccionar miembro existente o crear caso aislado; revisar materiales, apoyo, cargas, combinación, origen y versión.
3. **Análisis y diseño:** resolver/recuperar fuerzas; proponer sección/acero; separar resistencia, servicio y estabilidad.
4. **Revisión y armado:** navegar ratios; explicar checks; modificar detalle y repetir sólo cálculos afectados.
5. **Emisión:** historial, comentario/revisión, memoria PDF y tablas/esquemas.

<pre>
Base normativa y unidades
         ↓
Geometría, materiales, acciones y versión del modelo
         ↓
Análisis → fuerzas concurrentes/envolventes
         ↓
Diseño: resistencia → servicio → detalle → cabida
         ↓
Revisión: check → ubicación → variables → cláusula/evidencia
         ↓
Snapshot: reporte + dibujos + historial
</pre>

### Interacción con modelo 2D/3D

La selección debe llegar a FS-A04 desde el workspace por referencia neutral de objeto y snapshot de demanda. El módulo no debe importar directamente el motor 2D ni el renderer 3D. Una fila gobiernante ilumina miembro+piso+eje+ubicación; cambiar a Acero o Resultado conserva selección. Overlays de resistencia, demanda, cuantía y barras se activan individualmente y tienen leyenda. Los dibujos SVG existentes pueden ser la primera vista de acero; el render 3D de barras requiere contrato serializable común y no debe bloquear el MVP.

### Warnings y resultado agregado

| Estado | Significado | Ejemplo |
|---|---|---|
| Error | Entrada inválida | Claro/espesor cero |
| Pendiente | Falta input del que depende diseño | Capacidad de suelo del informe |
| No diseñado | Aún no corrió esa etapa | Servicio no evaluado |
| No aplica | Rama no activada, con razón | Torsión no activada con hipótesis visibles |
| Fuera de alcance | Programa no calcula esa rama | Detalle de ductilidad alta no evaluado |
| Warning | Supuesto/criterio requiere juicio | Valor complementario de una guía de proyecto |
| No cumple | Resistencia, detalle o servicio incumple | Ratio excedido o separación insuficiente |
| Cumple | Checks aplicables completos y suficientes | Cumple en NTC, edición y combo especificados |
| Desactualizado | Cambio en input/modelo/norma posterior al run | Run de análisis para otra sección |

Un miembro con “Pendiente” o “Fuera de alcance” debe mostrar “Revisión incompleta”, no “Cumple”, aunque una verificación de resistencia sí pase.

### Reportes

El PDF debería incluir portada/proyecto y revisión; base y edición; unidades/materiales; geometría/modelo/método; acciones y combos; miembro/combos/estaciones; demandas y capacidades con factores y ratio; servicio/estabilidad; armadura propuesta/proporcionada; warnings/exclusiones; referencias y snapshot/hash; dibujos y tablas seleccionadas. Las cimentaciones enlazan el estudio geotécnico y separan capacidad del suelo de diseño estructural. Las salidas que no sean plano de construcción se marcan como cálculo/revisión preliminar.

---

## Modelo de datos e integración

| Entidad conceptual | Datos requeridos |
|---|---|
| DesignBasis | Jurisdicción, perfiles/ediciones compatibles, grupo/ductilidad, sistema de unidades, exposición, hashes/evidencia |
| ModelReference | Id/tipo de elemento neutral, piso/ejes, geometría, unidad, sourceVersion, origen enlazado/aislado |
| MaterialSnapshot | Clase/tipo/grado, f’c/fy y unidades, estándar de producto, peso/módulo/exposición si aplican |
| LoadCase / Combination | Acción fuente, patrón, factor, estado ULS/SLS, edición de la regla y referencia |
| DemandSet | Vector concurrente N-Mx-My-Vx-Vy-T, desplazamiento, estación y combo, analysisRunId |
| DesignRun | Input snapshot, norma, motor/solver, versionado, hash, timestamp, flags, estado |
| DesignCheck | id/elemento/cláusula; demanda; resistencia nominal; factor; capacidad; ratio/unidad; ramas/variables; combo/ubicación; estado/evidencia |
| ReinforcementProposal | barras/capas/zona/coordenadas, spacing, longitudes/anchaje/empalme/confinamiento; requerido/proporcionado/factibilidad |
| ReviewRecord | actor, versión, comentario, decisión, fecha y cambio |
| ReportSnapshot | referencias exactas a modelo/analysis/design/material/norma y salida |

### Autoridad e invalidación

La capa workspace proporciona referencia y datos serializables; los motores de FS-A04 consumen DTOs en unidades explícitas. Mantener motores puros y referencias por norma, como ahora. El modo lectura del modelo debe preceder a la edición/escritura. Versionar el diseño aparte sin sobrescribir la fuente del proyecto; mantener snapshots anteriores. Los cálculos largos deberían usar mecanismo worker serializable y un id de análisis.

| Cambio | Invalidar |
|---|---|
| Geometría, apoyo, rigidez, carga global | Análisis y todas las demandas/checks dependientes |
| Material | Capacidad/servicio/detalle; análisis sólo si afecta masa/rigidez/peso |
| Norma, edición, grupo, ductilidad/combo | Combos/demandas pertinentes, checks y reporte |
| Barra/espaciamiento/gancho/empalme | Capacidad, servicio/detalle dependiente y reporte; análisis global si cambia rigidez |
| Sólo estilo del reporte | Salida renderizada; mantener run reproducible |
| Versión del solver | Nueva ejecución según política; preservar histórica con etiqueta de versión |

Un armado sólo se aplica al modelo si hay contrato de undo, migración y atribución. Si el acero influye en rigidez del análisis, explicitar qué modelo se ha vuelto obsoleto.

---

## Riesgos y decisiones abiertas

### Riesgos

1. Compartir base de ACI no equivale a cumplimiento NTC/NSR/E.060/Eurocode.
2. Un estado verde puede ocultar checks pendientes/fuera de alcance.
3. Una envolvente desacoplada puede crear combinación ficticia para P-M-V-T.
4. qa/asentamiento es geotecnia, no resistencia del concreto.
5. Acero requerido no equivale a detalle construible.
6. Una sección/material/norma cambiada debe invalidar solo los datos afectados y señalar qué quedó viejo.
7. La diferencia del umbral β₁ (30 MPa de texto NTC frente a 28 MPa de implementación continua) debe resolverse y documentarse.
8. Diseño gravitacional no certifica ductilidad sísmica ni análisis de segundo orden.
9. Proyectos con GPL/AGPL/licencia ambigua y normas de pago no son código trasladable sin análisis de licencia.

### Decisiones que conviene fijar

- ¿La primera base integral es NTC-CDMX 2023, dejando ACI como perfil posterior licenciado?
- ¿Qué solver produce las fuerzas autoritativas por tipo de miembro y cómo se preserva el vector concurrente?
- ¿Armado editado es propiedad del proyecto o alternativa de diseño; y cuándo afecta rigidez global?
- ¿Qué salida se llama cálculo preliminar, informe de coordinación o documento emitible?
- ¿Qué referencias/valores de geotecnia son obligatorios para cada cimiento?
- ¿Qué grados de acero/material/catalogo local se permiten según sistema y edición?
- ¿Qué rol puede marcar reportes como revisados y qué significa la aprobación en el producto?

### Criterios de aceptación del futuro módulo

- Cada ratio abre elemento, combinación/estado, ubicación, fuerzas concurrentes y verificación.
- Cada check expone edición/cláusula, demanda/capacidad/factor, unidad, variables/ramas y evidencia.
- Warning identifica origen, implicación y acción; no se oculta al cerrar panel.
- Cambios de inputs conservan historial y marcan resultados antiguos.
- Cumple total requiere que todos los checks aplicables de alcance se hayan evaluado con datos suficientes.
- El armado se ve, es factible con restricciones declaradas y se puede revalidar.
- El reporte reproduce snapshot con hash y versión de solver/norma.
- Navegación entre tabla/modelo/detalle conserva filtros y ubicación.
- La integración respeta aislamiento entre FS-A01/02/03/04 y datos locales.

---

## Roadmap

| Fase | Objetivo | Evidencia de cierre |
|---|---|---|
| 0. Normativa/unidades | Resolver β₁, cerrar mapa de cláusulas/ramas y contrato DTO | Matriz implementado/no implementado con referencias; no reclamar cobertura abierta |
| 1. Vínculo read-only | Selección de miembro y captura de demandas concurrentes/versiones | De modelo a tabla a check gobernante sin reescribir el modelo |
| 2. Revisión por lote | Vigentes beam/column/footing en tabla con filtros, fuentes, estados | Cada fila abre el detalle y explica branch/ratio |
| 3. Armado editable | Cambiar barras/zonas y validar spacing/cover/development/lap/confinement | Comparación antes/después y correcta invalidación |
| 4. PDF/historial | Snapshot, memoria, fuentes, reportes y revisión | Reproducibilidad del PDF y estado claramente rotulado |
| 5. Losas | Definir placa/1D/2D/franjas, punching/transferencia/servicio/detalle | Casos independientes, dibujo, mapas y acero dispuesto |
| 6. Muros | Separar muro estructural/contención/diafragma y ductilidad | Estados, carga y geotecnia claros por subfamilia |
| 7. Cimentaciones ampliadas | Corrida/combinada/losa de cimentación/contratrabe/dado/cabezal | Reacciones y estudio geotécnico vinculados |
| 8. Otros perfiles | ACI/EC2, presfuerzo, prefabricado, anclaje especial | Texto/licencia/errata/pruebas completas para cada perfil |

**MVP recomendado.** Completar el vínculo y revisión del alcance existente antes de sumar muchos tipos. Después incorporar una familia acotada de losa; losas, muros y sistemas de cimentación necesitan capítulos de análisis y servicio completos, no sólo un formulario de entrada.

---

## Bibliografía

### Normativa y autoridad

1. RCDF CDMX, [portal oficial](https://data.consejeria.cdmx.gob.mx/index.php/articulo-leyes-y-reglamentos/28-reglamentos/35-reglamentodeconstruccionesparaeldistritofederal), art. 53 y arts. 137–140.
2. Gaceta CDMX, [acuerdo de actualización de NTC, 06-11-2023](https://data.consejeria.cdmx.gob.mx/portal_old/uploads/gacetas/dc972b251726e01c75111932799419fc.pdf), transitorios pp. 203–205.
3. CDMX, [compendio oficial de NTC 2023](https://data.consejeria.cdmx.gob.mx/portal_old/uploads/gacetas/b3c4f4ff37241d0a93cc6742a8b0bf2f.pdf), y [portal ISC NTC](https://www.isc.cdmx.gob.mx/directores-res/cursos-de-actualizacion-2022/normas-tecnicas-complementarias-2023).
4. Gaceta CDMX, [aviso de revisión NTC 2024–2029](https://data.consejeria.cdmx.gob.mx/portal_old/uploads/gacetas/85f5cf08afd478d1090c3db06e15051d.pdf).
5. ACI, [318 Code Portal](https://www.concrete.org/topicsinconcrete/318buildingcodeportal.aspx), [ACI CODE-318-25/TOC](https://www.concrete.org/store/productdetail.aspx?ItemID=318U25&Language=English&Units=US_Units), [vista previa 318-19](https://www.concrete.org/Portals/0/Files/PDF/Previews/318-19_preview.pdf), [ACI 318 PLUS](https://www.concrete.org/publications/aci318plus.aspx), [curso cambios 318-25](https://aciuniversity.concrete.org/Listing/ACI-318-25-Changes-to-the-Concrete-Design-Standard-2801).
6. ACI, [355.2-24 anclajes mecánicos](https://www.concrete.org/store/productdetail.aspx?Format=PROTECTED_PDF&ItemID=355224&Language=English&Units=US_Units), [355.4-24 adhesivos](https://www.concrete.org/store/productdetail.aspx?Format=PROTECTED_PDF&ItemID=3554U24&Language=English&Units=US_Units), [preview 355.4-24](https://www.concrete.org/Portals/0/Files/PDF/Previews/355.4-24_preview.pdf), [preview 355.5-24 barras postinstaladas](https://www.concrete.org/Portals/0/Files/PDF/Previews/355.5-24_preview.pdf), [440.11-22 GFRP](https://www.concrete.org/store/productdetail?ItemID=44011U22&Language=English&Units=US_Units), [SPEC-301-20](https://www.concrete.org/store/productdetail.aspx?ItemID=301U20&Language=English&Units=US_Units).
7. ASCE, [SEI 7-22](https://www.asce.org/publications-and-news/codes-and-standards/asce-sei-7-22), [SEI/ASCE 7 overview](https://www.asce.org/communities/institutes-and-technical-groups/structural-engineering-institute/asce-7-and-sei-standards).
8. Comisión Europea/JRC, [Eurocode 2](https://eurocodes.jrc.ec.europa.eu/EN-Eurocodes/eurocode-2-design-concrete-structures), [segunda generación](https://eurocodes.jrc.ec.europa.eu/second-generation-eurocodes), [milestones 12-01-2026](https://eurocodes.jrc.ec.europa.eu/news/second-generation-eurocodes-milestones-achieved), [JRC144386](https://publications.jrc.ec.europa.eu/repository/handle/JRC144386).
9. Colombia, [Ministerio de Vivienda](https://www.minvivienda.gov.co/), y [IDRD Bogotá](https://www.idrd.gov.co/); Perú, [SENCICO/RNE](https://www.gob.pe/institucion/sencico/informes-publicaciones).
10. CFE, [ejemplo de documento de contratación que cita manuales CFE de viento/sismo](https://portales-transparencia.cfe.mx/internetparatodos/28%20Procedimientos%20de%20Contratacin/JUAF/2023/4T_AT_CFETEIT-CA-0065-2022_VP2022.pdf).

### Software profesional y visual

11. CSI: [ETABS diseño interactivo](https://docs.csiamerica.com/help-files/etabs/Menus/Design/Concrete_Frame_Design/CF_Interactive_Concrete_Frame_Design.htm), [ETABS resultados](https://docs.csiamerica.com/help-files/etabs/Menus/Design/Display_Design_Info.htm), [SAP2000](https://www.csiamerica.com/products/sap2000/features), [SAFE proceso](https://docs.csiamerica.com/help-files/safe/Getting_Started/General_Modeling_Process_and_Tips.htm), [SAFE franjas](https://docs.csiamerica.com/help-files/safe/Program_Output/Integrated_Strip_Forces.htm), [SAFE RC PDF](https://docs.csiamerica.com/manuals/safe/SAFE%20RC%20Design.pdf), [CSiCOL](https://www.csiamerica.com/products/csicol).
12. Bentley: [RCDC](https://bentleysystems.service-now.com/community?id=kb_article_view&sysparm_article=KB0111695), [RAM Structural System](https://bentleysystems.service-now.com/community?id=kb_article&sysparm_article=KB0117768), [RAM Concept](https://www.bentley.com/products/ram-concept).
13. RISA: [resultados de concreto](https://help.risa.com/risahelp/risa3d/Content/ConcreteMembers/Concrete-Design-Results.htm), [ADAPT](https://help.risa.com/risahelp/adaptbuilder/Content/UI/ResultDisplayViewer-panel.htm).
14. Tekla: [estados](https://support.tekla.com/doc/tekla-structural-designer/2026/rev_reviewmemberdesign), [review](https://support.tekla.com/doc/tekla-structural-designer/2026/ref_reviewribbon), [ratios](https://support.tekla.com/doc/tekla-structural-designer/2026/des_applyutizationratios).
15. Autodesk: [Robot losas](https://help.autodesk.com/cloudhelp/2022/ENU/Robot-GSG/files/Tutorials/Robot_GSG_Tutorials_Tut_Plate_Design_html.html), [alcance de concreto](https://help.autodesk.com/cloudhelp/2025/ENU/RSAPRO-UsersGuide/files/GUID-07532EC8-6712-4642-9C60-7A43EB2993F7.htm).
16. Dlubal: [RFEM tablas](https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6-tutorial-concrete-design-en-us/003081), [filtros](https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6-concrete-design/004021), [detalle](https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6-concrete-design/000561).
17. IDEA StatiCa: [muros/regiones D](https://www.ideastatica.com/concrete/walls-and-details), [miembro](https://www.ideastatica.com/concrete-member-design). SkyCiv: [RC design](https://skyciv.com/structural-software/reinforced-concrete-design/), [section designer](https://skyciv.com/docs/skyciv-section-builder/general-section-designer/getting-started/).
18. ClearCalcs: [guía actual de viga, ACI 318-19](https://calcs.com/docs/calculators/us/beams/concreteBeamRectangularUSAACI318-19), [PDF de ejemplo de 2021, ACI 318-14/IBC 2018](https://s3.amazonaws.com/helpscout.net/docs/assets/5c09df402c7d3a31944ed720/attachments/5ff5137cfd168b7773531eac/US-Concrete-Beam---B1.pdf), [captura de entrada](https://s3.amazonaws.com/helpscout.net/docs/assets/5c09df402c7d3a31944ed720/images/5ff512dabb5c6f7434e0e112/file-Xxsl72PkYk.png). La página antigua de ayuda redirige a la guía actual ACI 318-19; la captura y el reporte archivado sí corresponden a la muestra ACI 318-14.
19. ENERCALC: [viga](https://media.enercalc.com/sel_help_20/concretebeam.htm), [columna](https://media.enercalc.com/sel_help_20/concretecolumn.htm). Prota: [editor de armado](https://support.protasoftware.com/portal/en/kb/articles/reinforcement-data-editor-ps-2022), [PDF novedades](https://cdn.protasoftware.com/documents/protastructure-suite-2024-whats-new.pdf).
20. CYPE: [CYPECAD](https://info.cype.com/es/software/cypecad/), [NTC 2023](https://info.cype.com/es/codes/ntc-2023/), [implementación](https://info.cype.com/es/novedad/implementacion-de-normativa-7/).

### Código local auditado y repositorios abiertos

21. FStructure: [alcance del taller](../../design/design-workbench.md), [registro normativo](../../design/normative-sources.json), [perfiles](../../../src/design/elements/codes.ts), [resultados compartidos](../../../src/design/elements/shared.ts), [viga](../../../src/design/elements/beam.ts), [análisis](../../../src/design/elements/beamAnalysis.ts), [columna](../../../src/design/elements/column.ts), [zapata](../../../src/design/elements/footing.ts).
22. FStructure: [Workbench](../../../src/features/design/workbench/DesignWorkbench.tsx), [layout](../../../src/features/design/workbench/WorkbenchLayout.tsx), [persistencia](../../../src/features/design/workbench/workbenchStorage.ts), [adapter](../../../src/features/workspace/adapters/DesignSurface.tsx), [oráculo](../../../validation/python/elements_oracle.py).
23. Código/repos: [StructLib](https://github.com/Pravin-surawase/structural_engineering_lib), [Mento](https://github.com/mihdicaballero/mento), [concrete-properties](https://github.com/robbievanleeuwen/concrete-properties), [fib StructuralCodes](https://github.com/fib-international/structuralcodes), [Pynite](https://github.com/JWock82/Pynite), [pyntc](https://github.com/rafse/norma-ntc), [FoundationDesign](https://github.com/kunle009/FoundationDesign), [FreeCAD-Reinforcement](https://github.com/amrit3701/FreeCAD-Reinforcement), [concretedesignpy](https://github.com/project-alpha-development/concretedesignpy), [PyRCD](https://github.com/TabishIzhar/PyRCD), [OpenSees](https://github.com/OpenSees/OpenSees), [OpenSees Studio](https://github.com/ogunc/opensees-studio), [RC-FIAP](https://github.com/vfceball/RC-FIAP).

---

**Fin del estudio.** Las capturas con procedencia están en [assets/README.md](assets/README.md). No se han declarado nuevas verificaciones implementadas en FStructure.
