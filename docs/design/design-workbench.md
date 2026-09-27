# Taller de diseño de elementos — experimental

La herramienta **Diseño** (FS-A04) abre un taller aislado con tres elementos: Viga, Columna y Zapata. No lee el Modelo 2D: cada elemento se captura en el propio taller. Es una herramienta de revisión y aprendizaje; no certifica un diseño ni sustituye a la persona responsable del proyecto.

## Normas disponibles

El selector **Norma de diseño**, arriba de cada formulario, aplica una de tres normas a los tres elementos. Cada perfil vive en `src/design/elements/codes.ts`:

| Norma | Documento oficial registrado | Cláusulas |
| --- | --- | --- |
| NTC-CDMX 2023 (México) | Anexo electrónico de la Gaceta Oficial de la CDMX, concreto y criterios y acciones | 55 + 3 |
| NSR-10 Título C (Colombia) | Título C publicado por el Ministerio (Decreto 926 de 2010), copia alojada por el IDRD de Bogotá | 36 |
| E.060 Concreto Armado 2009 (Perú) | Enlace de SENCICO en la página oficial del RNE (D.S. 010-2009-VIVIENDA) | 34 |

La tabla resume las diferencias implementadas:

| Tema | NTC-CDMX 2023 | NSR-10 | E.060 |
| --- | --- | --- | --- |
| Combinaciones | 1.3/1.5 (B), 1.5/1.7 (A), 0.9 favorable | 1.4D y 1.2D + 1.6L | 1.4CM + 1.7CV |
| φ en flexión | 0.65 → 0.90 entre εty y εty + 0.003 | 0.65 → 0.90 entre εty y 0.005 | 0.90 |
| φ en flexocompresión | igual que en flexión | igual que en flexión | 0.70 → 0.90 cuando φPn baja de min(0.1f′cAg, φPb) |
| φ en cortante y penetración | 0.75 (0.65 penetración con sismo) | 0.75 | 0.85 |
| φPn,máx | 0.65 P0 | 0.75 · 0.65 P0 | 0.80 · 0.70 P0 |
| Acero máximo en vigas | 0.9 Asb | εt ≥ 0.004 | 0.75 Asb |
| Acero mínimo en vigas | 0.25√f′c/fy ≥ 1.4/fy | igual | 0.22√f′c/fy y φMn ≥ 1.2Mcr |
| Ie | tabla 13.4.3.2 | Branson | Icr si M > Mcr |
| Flechas | total ≤ 5 + L/240 o 3 + L/480 | viva ≤ ℓ/360; posterior ≤ ℓ/240 o ℓ/480 | igual que NSR |
| Agrietamiento | separación s (tabla 13.6.2) | separación s (C.10.6.4) | Z ≤ 26 kN/mm |
| Desarrollo | tabla 14.4.2.4 con ψg | tabla C.12.2.2 | tabla 12.1 (2.6/2.1) y ec. 12-1 |
| Esbeltez en columnas | H/r con r = h/√12; emín siempre | kℓu/r ≤ 34 − 12M1/M2 ≤ 40, r = 0.3h | igual que NSR; kℓu/r ≤ 100 |
| Marcos con desplazamiento | Fas = 1/(1 − λest) ≤ 1.5 | δs = 1/(1 − Q) ≤ 1.5 y M ≤ 1.4 M1er orden | δs ≤ 1.5 y Q ≤ 0.60 |
| Estribos de columna | so y Lo en extremos, hx | 16db, 48de, menor dimensión, regla de 150 mm | igual que NSR |
| Zapatas: cortante como viga | 0.66λsρ^(1/3)√f′c | 0.17√f′c | 0.17√f′c |
| Zapatas: peralte y separación | d ≥ 150; s ≤ 2h y 450 | d ≥ 150; s ≤ 3h y 450 | d ≥ 300; s ≤ 3h y 400 |

## Base normativa

Toda comprobación declara su referencia (`ClauseReference` en `src/design/elements/shared.ts`). Las referencias de las normas apuntan a cláusulas **registradas con evidencia** en [normative-sources.json](normative-sources.json): página del PDF oficial, extracto transcrito y su SHA-256. Tres pruebas lo vigilan:

- `codes.test.ts` recorre diseños de las tres normas: toda cláusula citada existe en el registro de su norma, ninguna comprobación cita otra norma y cada cláusula registrada de NSR-10 y E.060 la usa algún perfil.
- `normativeEvidence.test.ts` exige que cada constante de un bloque `implementation` aparezca en sus extractos. La deuda que quedaba en la NTC (Ec, fr, β1, FR de cortante, MR, VcR y los límites de estribos) quedó saldada el 2026-09-23.
- `structuralDesignMigration.test.ts` valida hashes, páginas y fuentes.

Los PDF no se versionan. Los extractos de E.060 transcriben la coma decimal como punto.

`complementary` marca lo que no proviene de una cláusula verificada y la interfaz lo muestra en cursiva con «◇». Quedan: la presión admisible del suelo (dato del estudio geotécnico), la estática del núcleo y de la presión última, la separación práctica mínima de estribos (5 cm), el aviso de columna en tensión y, sólo en E.060, el Jc de sección rectangular (la norma no da la expresión; NTC y NSR sí, en su comentario).

Decisión deliberada: la ec. 3.6.1 de la NTC escribe β1 = 0.85 hasta 30 MPa con un salto a 0.836; el código usa el umbral continuo de 28 MPa (como NSR y E.060), que da un β1 menor entre 28 y 30 MPa, del lado seguro. El bloque `implementation` de la cláusula 3.6.1 transcribe la norma (30 MPa) y el campo hermano `engineDeviation` declara la desviación del motor, para que el registro no se lea como comportamiento del código.

## Alcance por elemento

**Viga continua (1 a 6 claros).** Análisis con el solver 2D con la carga muerta y viva de cada claro como casos separados y envolvente por superposición sobre todas las combinaciones de la norma. Flexión con el φ de la norma, cuantías mínima y máxima, corridas + bastones con cortes a max(d, 12db) y ld, cortante y estribos por claro, agrietamiento, deflexiones con la inercia efectiva por claro reanalizada en el solver y la diferida ξ/(1 + 50ρ′). Anclaje en los apoyos extremos con el ancho del apoyo: recta, gancho estándar (ldh) o insuficiente. Traslapes Clase B de las corridas. Rechaza vigas de gran peralte según la norma.

**Columna rectangular con estribos.** Diagrama de interacción por compatibilidad con el φ de la norma, φPn,máx, momentos mínimos, Bresler (NTC 5.4.1.2, E.060 10.18, comentario CR10.3.6 de NSR) con contorno para carga axial baja, esbeltez en marcos arriostrados y con desplazamiento lateral (índice de estabilidad y momentos M2s), cuantías, cortante, estribos y traslape Clase B.

**Zapata aislada rectangular.** Planta por presión admisible y núcleo, presión trapecial por momentos, flexión en el paño, cortante como viga a d, penetración con transferencia γv·M (y λs en la NTC), acero mínimo (con el adicional de NTC 6.7.6.1.2 cuando vuv > 0.17FRλs√f′c), banda central 2/(β + 1), separación máxima, peralte mínimo y anclaje recto o con gancho desde el paño.

## Tipos de elemento

- **Viga rectangular, T o L.** Con patín, `widthMm` es el alma bw y `flange` da el ancho efectivo bf (lo fija quien diseña) y el espesor hf. Con momento positivo la resistencia sale del equilibrio del bloque equivalente de 3.6.1 en patín y alma, y el acero máximo con la regla de cada norma aplicada a ese bloque (`maximumSteelForBlock`); con negativo rige el alma rectangular. La inercia bruta, la agrietada (eje neutro en patín o alma) y Mcr por signo usan la sección T. El peso propio es el del alma bajo la losa: la losa va en la carga muerta. Fuera de alcance: ancho efectivo de norma, acero mínimo con patín en tensión y cortante entre alma y losa.
- **Columna rectangular o circular.** La circular usa `widthMm` como D, barras en la circunferencia y estribo circular; la interacción integra el segmento circular comprimido (contrastada con una integración por fibras) y rige la peor de dos orientaciones del arreglo. Flexión con el momento resultante √(Mx² + My²), r = D/4, cortante resultante con bw = D y d = 0.8D (complementario). El zuncho no se diseña.
- **Zapata aislada, corrida o combinada.** Corrida (`stripFooting.ts`): por metro de muro, voladizo desde el paño (mampostería: a la mitad entre eje y paño, complementario), cortante a d, acero transversal y de distribución. Combinada (`combinedFooting.ts`): dos columnas alineadas, longitud que centra la resultante de servicio (borde izquierdo al paño o voladizo dado), zapata rígida con presión lineal, envolventes de V y M a lo largo, penetración por columna con perímetro de borde o esquina (αs 30/20, complementario), bandas transversales de ancho c + d (complementario). Con NTC, si el cortante sin estribos no alcanza, el lecho en tensión sube hasta ρ = 0.5 % antes de engrosar; cada lecho sube de diámetro para dejar al menos 10 cm entre barras.
- **Varillas.** Catálogo #2.5 a #11 para barras y estribos.

## Diseño más fácil

- **Cargas desde la losa (viga):** ancho tributario × muerta y viva de la losa (+ muros) y «Aplicar a los claros».
- **Proponer (viga):** la sección de menor área, en anchos de 20 a 50 cm y peralte hasta 3 veces el ancho, que no reprueba ninguna comprobación con el armado propuesto.
- **Proponer (columna):** crece la sección de 5 en 5 cm y en cada tamaño prueba diámetros y número de barras; se queda con el primer tamaño con cuantía ≤ 2.5 %.
- Las zapatas ya dimensionan planta y peralte solas.

## Revisión, alcance y memoria

- **Estado honesto.** `src/design/elements/scope.ts` declara por elemento y norma lo que la norma pide y el taller no calcula (torsión, combinaciones accidentales, ductilidad, geotecnia, concurrencia de la demanda capturada, ramas ψe/λ del desarrollo…). Mientras haya algo ahí, lo que cumple se titula «Cumple lo evaluado» con «Revisión incompleta», nunca «Cumple» a secas.
- **Trazabilidad.** Cada comprobación puede llevar `location` (dónde rige: estación, lecho, claro, perímetro) y `combination` (de dónde sale la demanda y si es envolvente o captura concurrente). Hoy la llevan flexión, cortante y deflexión de viga; flexocompresión y cortante de columna; presión, penetración, cortante y flexión de zapata.
- **Revisión.** El panel de resultados filtra (Todas · Atender · Sin evaluar) y ordena por utilización.
- **Armado propio (viga).** «Armado: Propuesto | Propio». Con propio se fijan las corridas arriba y abajo, si se agregan bastones donde falten o no, y una separación uniforme de estribos (vacía: se calcula). El motor (`BeamDesignInput.provided`) revalida flexión, cuantías, separaciones, anclaje y cortante con ese armado, y la mesa lo compara con el propuesto (estado, cociente que rige y kg de acero). La columna ya se diseña con el armado que se captura; la zapata elige la separación.
- **Cuantificación.** `src/design/elements/takeoff.ts` estima acero (kg por pieza) y concreto (m³) de cada elemento: piezas rectas, ganchos a 12db donde el anclaje los pide, estribos con ganchos de 135° y sin traslapes ni desperdicio. Es para comparar y para la memoria, no para planos de taller.
- **Identificación.** Cada elemento lleva clave («V-1») y ubicación; encabezan la memoria.
- **Memoria de un elemento.** «Copiar memoria» (texto) y «PDF». El PDF (`designReportPdf.ts`, cargado al pedirlo) trae portada con responsiva, datos de entrada en unidades de trabajo, armado y comparación, láminas (los mismos SVG de la mesa en tema Día, rasterizados por `figureRaster.ts`), comprobaciones con trazabilidad, valores intermedios, cuantificación, notas, alcance e instantánea con la entrada del motor y su huella SHA-256.
- **Memoria del proyecto.** «Memoria» guarda elementos (su borrador, no el resultado) en el documento del taller y los recalcula con el motor vigente al abrirlos o exportarlos. El PDF conjunto abre con índice (clave, elemento, ubicación, estado, cociente, acero), totales de acero y concreto y bloque de responsiva. Abrir un elemento con cambios sin guardar pide confirmación. La barra sobre los resultados dice si el elemento abierto está guardado.
- **Deshacer/rehacer.** Cada formulario lleva su historial (los cambios seguidos se agrupan); botones en la barra superior y Ctrl/⌘+Z fuera de los campos de texto.
- **Modelo por elemento.** `beamModel.tsx`, `columnModel.tsx` y `footingModel.tsx` pasan del borrador a la entrada del motor y a la memoria; los usan la mesa y la memoria del proyecto.

## Datos y persistencia

Los borradores del taller (norma, elemento y datos de cada formulario) y la memoria del proyecto se guardan en la rama `design` del bundle unificado del proyecto abierto, como documento `fstructure-design-workbench` validado al leerlo (`workbenchStorage.ts`). La versión 2 añade `memory` (hasta 60 elementos); un documento v1 se lee tal cual y se reescribe como v2. No forman parte del modelo 2D: no cambian la procedencia (`sourceVersion`), no invalidan el análisis y no entran al historial de deshacer, igual que los estudios FEM. Sin sesión de proyecto (pruebas o vista aislada) se guardan en el navegador.

## Validación

`validation/python/elements_oracle.py` recalcula columnas, zapatas y los bloques de las tres normas con algoritmos distintos a los del motor: bisección sobre el eje neutro acotando antes la raíz Pn = 0, integración numérica de presiones y una malla fina de acero. Sus fixtures (`validation/fixtures/elements/`) cubren la NTC (columna biaxial esbelta, zapata con sismo), NSR-10 (columna biaxial arriostrada, zapata con momentos) y E.060 (columna en marco con desplazamiento, zapata con momentos), además de φ, acero requerido, desarrollo y ganchos. Se contrastan desde TypeScript (`elements.fixtures.test.ts`) y desde Python (`npm run design:oracle`).

## Fuera de alcance

- Detallado sísmico de ductilidad media y alta (NTC caps. 7 y 8, NSR C.21, E.060 cap. 21).
- Análisis de segundo orden explícito, necesario cuando δs > 1.5.
- Torsión, secciones T/L y acero de compresión en flexión (que se desprecia, del lado seguro).
- Zapatas corridas o combinadas, pedestales, volteo y deslizamiento.
- Presfuerzo, losas y muros.
- Modificadores favorables de ganchos (ψr, ψc, 0.7 o 0.8), que se toman iguales a 1, y traslapes a compresión.

La lista que ve la persona usuaria vive en `scope.ts`; si cambia el alcance, se cambia ahí y aquí.
