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

Decisión deliberada: la ec. 3.6.1 de la NTC escribe β1 = 0.85 hasta 30 MPa con un salto a 0.836; el código usa el umbral continuo de 28 MPa (como NSR y E.060), que da un β1 menor entre 28 y 30 MPa, del lado seguro.

## Alcance por elemento

**Viga continua (1 a 6 claros).** Análisis con el solver 2D con la carga muerta y viva de cada claro como casos separados y envolvente por superposición sobre todas las combinaciones de la norma. Flexión con el φ de la norma, cuantías mínima y máxima, corridas + bastones con cortes a max(d, 12db) y ld, cortante y estribos por claro, agrietamiento, deflexiones con la inercia efectiva por claro reanalizada en el solver y la diferida ξ/(1 + 50ρ′). Anclaje en los apoyos extremos con el ancho del apoyo: recta, gancho estándar (ldh) o insuficiente. Traslapes Clase B de las corridas. Rechaza vigas de gran peralte según la norma.

**Columna rectangular con estribos.** Diagrama de interacción por compatibilidad con el φ de la norma, φPn,máx, momentos mínimos, Bresler (NTC 5.4.1.2, E.060 10.18, comentario CR10.3.6 de NSR) con contorno para carga axial baja, esbeltez en marcos arriostrados y con desplazamiento lateral (índice de estabilidad y momentos M2s), cuantías, cortante, estribos y traslape Clase B.

**Zapata aislada rectangular.** Planta por presión admisible y núcleo, presión trapecial por momentos, flexión en el paño, cortante como viga a d, penetración con transferencia γv·M (y λs en la NTC), acero mínimo (con el adicional de NTC 6.7.6.1.2 cuando vuv > 0.17FRλs√f′c), banda central 2/(β + 1), separación máxima, peralte mínimo y anclaje recto o con gancho desde el paño.

## Datos y persistencia

Los borradores del taller (norma, elemento y datos de cada formulario) se guardan en la rama `design` del bundle unificado del proyecto abierto, como documento `fstructure-design-workbench` v1 validado al leerlo (`workbenchStorage.ts`). No forman parte del modelo 2D: no cambian la procedencia (`sourceVersion`), no invalidan el análisis y no entran al historial de deshacer, igual que los estudios FEM. Sin sesión de proyecto (pruebas o vista aislada) se guardan en el navegador.

## Validación

`validation/python/elements_oracle.py` recalcula columnas, zapatas y los bloques de las tres normas con algoritmos distintos a los del motor: bisección sobre el eje neutro acotando antes la raíz Pn = 0, integración numérica de presiones y una malla fina de acero. Sus fixtures (`validation/fixtures/elements/`) cubren la NTC (columna biaxial esbelta, zapata con sismo), NSR-10 (columna biaxial arriostrada, zapata con momentos) y E.060 (columna en marco con desplazamiento, zapata con momentos), además de φ, acero requerido, desarrollo y ganchos. Se contrastan desde TypeScript (`elements.fixtures.test.ts`) y desde Python (`npm run design:oracle`).

## Fuera de alcance

- Detallado sísmico de ductilidad media y alta (NTC caps. 7 y 8, NSR C.21, E.060 cap. 21).
- Análisis de segundo orden explícito, necesario cuando δs > 1.5.
- Torsión, secciones T/L y acero de compresión en flexión (que se desprecia, del lado seguro).
- Zapatas corridas o combinadas, pedestales, volteo y deslizamiento.
- Presfuerzo, losas y muros.
- Modificadores favorables de ganchos (ψr, ψc, 0.7 o 0.8), que se toman iguales a 1, y traslapes a compresión.
