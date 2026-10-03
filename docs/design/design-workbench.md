# Taller de diseño de elementos — experimental

La herramienta **Diseño** (FS-A04) abre un taller aislado con Viga, Columna, Pórtico, Zapata y Secciones. No lee el Modelo 2D: cada elemento se captura en el propio taller. Es una herramienta de revisión y aprendizaje; no certifica un diseño ni sustituye a la persona responsable del proyecto.

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
| Con acción lateral (Pórtico) | 1.1 (CM + CV ± S), 0.9 favorable (CyA 3.4.1 b y c) | 1.2D + 1.0L ± 1.0E y 0.9D ± 1.0E, **complementarias** (B.2.4.2 sin registrar) | 1.25 (CM + CV) ± CS y 0.9CM ± CS, **complementarias** (9.2.3 sin registrar) |
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

**Pórtico de vigas y columnas.** Marco plano de 1 a 5 claros y 1 a 5 niveles, base empotrada o articulada, con o sin desplazamiento lateral (arriostrado: cada nivel restringido por otro sistema). Se analiza con `src/design/frame/frameAnalysis.ts`, rigidez directa con una sola factorización para todos los casos, validada contra el solver 2D (`frameAnalysis.test.ts`): la muerta y la viva de cada claro de cada nivel van en casos separados, más el peso propio de las columnas, la acción lateral (repartida entre los nudos del nivel) y una carga unitaria por nivel que da la rigidez de cada entrepiso. `src/design/elements/frame.ts` superpone esos casos:

- **Vigas.** Cada nivel se diseña con el motor de la viga continua (`designBeam` con un proveedor de análisis): la envolvente lleva la viva alternada por claro y nivel y, en las combinaciones laterales, la acción en ambos sentidos; la flecha vuelve a analizar el marco con las inercias agrietadas de esa viga. El ancho de apoyo para anclar es el peralte de la columna. Los momentos son al eje (del lado seguro).
- **Columnas.** Por combinación y sentido de la acción lateral se arman cuatro estados concurrentes (Pu máx., Pu mín. y momento máximo en cada sentido) con Pu, M1, M2 y V de la misma selección de casos; βdns sale de la parte sostenida de cada estado. El motor de la columna revisa cada estado con la altura libre (entrepiso menos peralte de viga), M2ns y M2s separados, la curvatura y M1/M2 del análisis. k es 1.0 en marcos arriostrados y, con desplazamiento, el del nomograma de Jackson y Moreland con ψ = Σ(EI/L) columnas/Σ(EI/L) vigas (base empotrada ψ = 1, articulada ψ = 10; complementario), al menos 1.0, o el que se capture. El índice de estabilidad de cada entrepiso es ΣPu·Δ/(V·h) con la rigidez lateral del propio marco y la carga vertical factorizada de cada combinación.
- **Conjunto.** La revisión lista una comprobación por miembro (lo que rige, con su ubicación y combinación), las combinaciones, la deriva elástica por entrepiso (informativa: la compara la norma de sismo), el índice de estabilidad, k y una relación ΣMc/ΣMv con resistencias de diseño por nudo, sólo informativa. El alcance declarado del pórtico suma nudos, segundo orden explícito, análisis sísmico, flexión fuera del plano, momentos al paño y torsión.
- **Mesa.** Lámina del pórtico con utilización (gris hasta 60 %, tinta hasta 90 %, aviso hasta 100 % y error arriba), envolventes de momento (del lado de la tensión), cortante y axial con sus valores, y deformada lateral o de servicio; un clic, un toque o el teclado eligen el miembro. Una matriz Nivel × (Viga, C1…Cn) en Resultados hace lo mismo. Con una viga elegida se ven sus envolventes, armado y cortes; con una columna, su diagrama de interacción con la nube de estados del pórtico, la sección y la elevación. Los datos admiten cargas desde la losa por nivel, factores de inercia para el análisis y k propio.

## Diagramas

- Cada banda rotula el máximo y el mínimo de cada tramo y el valor de cada apoyo, descartando los que se enciman con uno mayor.
- La banda de cortante dibuja la resistencia de diseño φVn con los estribos de cada zona, como la de momento dibuja φMn.
- En la mesa, la elevación de la viga tiene un cursor de lectura: puntero, toque o flechas (Inicio/Fin, Escape) muestran x, el claro, M⁺u/φMn, M⁻u/φMn, Vu/φVn y Δ en la sección. La lámina de la memoria es la misma sin cursor.

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

## Secciones y tres filosofías de cálculo

**Secciones** es el cuarto elemento del taller. Calcula una sección aislada de concreto con carga axial y flexión en una dirección: cuadrada, rectangular, circular, triangular, hexagonal u octagonal. Los polígonos se integran con su geometría real; la circular usa integrales analíticas. El recubrimiento se mide a la cara exterior del refuerzo transversal. Las coordenadas de las barras, los estribos y las grapas que se dibujan provienen del motor.

Tiene ejemplos editables de flexión de viga, columna corta, franja de losa por metro y pedestal; dos niveles de captura, simple y avanzado; acero perimetral o por lechos en rectángulos; estribo cerrado, cerrado con grapas y hélice circular. La búsqueda de armado propone un número de barras del diámetro actual que cubre axial/flexión y separación geométrica, manteniendo visibles sus limitaciones. La sugerencia transversal es geométrica: para calcular cortante y detallado normativo se usan los elementos Viga y Columna.

| Filosofía | Demanda | Modelo del cálculo experimental |
| --- | --- | --- |
| EA: esfuerzos admisibles | Servicio | Sección elástica fisurada, concreto sin resistencia a tensión, compatibilidad y equilibrio; compara esfuerzos con fracciones editables de f′c y fy. |
| RU: resistencia última | Última capturada, o servicio multiplicado por un factor explícito | Bloque equivalente y compatibilidad, concreto desplazado por las barras; reducción φ editable sobre la resistencia nominal. |
| EL: estados límite | Última capturada, o servicio multiplicado por un factor explícito | El mismo modelo resistente con f′c/γc y fy/γs, sin aplicar además φ. Los estados de servicio del miembro quedan sin evaluar. |

Estos modelos no implementan por completo NTC, ACI o Eurocódigo: φ no se deduce de ductilidad, no hay combinaciones automáticas y no se verifica el detalle sísmico. Cambiar de filosofía conserva las demandas numéricas; la interfaz identifica si corresponden a servicio o a últimas. El factor global es explícito y no sustituye las combinaciones de acciones. La memoria identifica la filosofía como **modelo experimental**, separada del perfil normativo de los otros elementos.

Las láminas muestran sección y recubrimiento, envolvente N–M firmada con la demanda, deformación/compresión y elevación de estribos. El modelo de deformación impone una dirección: cuando genera un momento perpendicular lo declara, porque una proyección N–M no basta para resolver flexión biaxial arbitraria. Para las columnas rectangulares/circulares normativas, la mesa Columna conserva la evaluación biaxial y la esbeltez existentes.

Las cantidades son volumen bruto geométrico de concreto y masa del acero dibujado. El neto descontando acero es adicional; no se agregan traslapes ni desperdicio. Los longitudinales son rectos; los estribos y grapas incluyen una estimación de ganchos de 10 diámetros por extremo y la hélice no incluye sus vueltas de anclaje. No es un despiece constructivo.

Las hipótesis de compatibilidad se apoyan en el [manual de referencia LRFD de FHWA](https://www.fhwa.dot.gov/bridge/pubs/nhi15047.pdf); la comparación de esfuerzos permisibles y factores parciales se documenta en el [Handbook 2 de JRC](https://eurocodes.jrc.ec.europa.eu/sites/default/files/2021-12/handbook2.pdf). Las ecuaciones implementadas se verifican con equilibrio, integraciones independientes y geometrías analíticas en `sectionStudio.test.ts`.

**Estribos propios en Columna.** Separación al centro, separación en extremos Lo para NTC y paso uniforme del zuncho circular. Vacío conserva la propuesta. El motor revisa la separación exacta, cortante con la separación más abierta, refuerzo transversal mínimo y límites del perfil elegido. Se muestran propuesta, valor propio y máximos, y se actualizan elevación, cantidades y PDF. El diagrama puede mostrar X/Y, curvas nominales y reducidas; el punto balanceado usa el factor del perfil y la demanda circular coincide con la que evalúa el motor.

## Datos y persistencia

Los borradores del taller (norma, elemento y datos de cada formulario) y la memoria del proyecto se guardan en la rama `design` del bundle unificado del proyecto abierto, como documento `fstructure-design-workbench` validado al leerlo (`workbenchStorage.ts`). La versión 2 añade `memory` (hasta 60 elementos); la versión 3 incluye secciones experimentales en esa memoria; la versión 4 añade pórticos: borradores `frame`, `frame-bays` y `frame-stories` y, en la memoria, elementos `frame` con `rows` (claros) y `levels` (niveles). Se leen documentos v1 a v4 y las siguientes escrituras usan v4 conservando sus borradores y elementos. No forman parte del modelo 2D: no cambian la procedencia (`sourceVersion`), no invalidan el análisis y no entran al historial de deshacer, igual que los estudios FEM. Sin sesión de proyecto (pruebas o vista aislada) se guardan en el navegador.

## Validación

La ampliación de geometrías, filosofías, armado y diagramas tiene su [registro de validación del 2026-10-01](concrete-studio-validation-2026-10-01.md), con referencias numéricas, persistencia, revisión visual y exportación PDF.

`validation/python/elements_oracle.py` recalcula columnas, zapatas y los bloques de las tres normas con algoritmos distintos a los del motor: bisección sobre el eje neutro acotando antes la raíz Pn = 0, integración numérica de presiones y una malla fina de acero. Sus fixtures (`validation/fixtures/elements/`) cubren la NTC (columna biaxial esbelta, zapata con sismo), NSR-10 (columna biaxial arriostrada, zapata con momentos) y E.060 (columna en marco con desplazamiento, zapata con momentos), además de φ, acero requerido, desarrollo y ganchos. Se contrastan desde TypeScript (`elements.fixtures.test.ts`) y desde Python (`npm run design:oracle`).

El pórtico se valida en dos niveles: `frameAnalysis.test.ts` compara axial, cortante, momento y desplazamientos con el solver 2D en un marco de dos claros y dos niveles con apoyos mixtos; `frame.test.ts` compara la envolvente de la viga y la compresión de la columna con el solver 2D cargado con la combinación factorizada, la rigidez lateral, la deriva y el índice de estabilidad, la simetría, el marco arriostrado, las tres normas con acción lateral y el factor k contra el nomograma (ψA = ψB = 1 → 1.32).

## Fuera de alcance

- Detallado sísmico de ductilidad media y alta (NTC caps. 7 y 8, NSR C.21, E.060 cap. 21).
- Análisis de segundo orden explícito, necesario cuando δs > 1.5.
- Torsión, selección normativa del ancho efectivo T/L y contribución resistente del acero de compresión en el cálculo de las vigas normativas.
- Estabilidad geotécnica por volteo y deslizamiento.
- Presfuerzo, muros y diseño integral de losas y pedestales. Los ejemplos de Secciones sólo revisan una sección aislada; no resuelven esos miembros completos.
- Modificadores favorables de ganchos (ψr, ψc, 0.7 o 0.8), que se toman iguales a 1, y traslapes a compresión.

La lista que ve la persona usuaria vive en `scope.ts`; si cambia el alcance, se cambia ahí y aquí.
