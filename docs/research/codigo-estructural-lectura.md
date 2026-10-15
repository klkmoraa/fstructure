# Código Estructural de España (RD 470/2021) · lectura dirigida y registro

Estado: **identificado, en lectura, sin perfil.** Este documento cubre las fases 1 y 2 del plan de normas: fuentes oficiales con hash, mapa de los temas que el taller de Diseño ya calcula y análisis de brecha del motor. No habilita ninguna norma en la app ni cambia valores normativos existentes. El registro (`docs/design/normative-sources.json`, entrada `codigo-estructural-2021`) queda `pending`, sin cláusulas verificadas y con la puerta bloqueada.

Lectura hecha el 2026-10-15.

## Fuentes oficiales

| Documento | URL (PDF oficial del BOE) | SHA-256 de los bytes | Páginas |
| --- | --- | --- | --- |
| Real Decreto 470/2021, de 29 de junio, por el que se aprueba el Código Estructural (BOE núm. 190, 10-08-2021, BOE-A-2021-13681, pp. 97664–99452) | https://www.boe.es/eli/es/rd/2021/06/29/470/dof/spa/pdf | `bad9e8d07be7ca46ae1549122438ef2ce704e8fc81cc926a9eb904b190b289ad` | 1789 (67 353 218 bytes) |
| Corrección de errores del RD 470/2021 (BOE núm. 29, 02-02-2024, BOE-A-2024-1989, pp. 13450–13453) | https://www.boe.es/eli/es/rd/2021/06/29/470/corrigendum/20240202/dof/spa/pdf | `5f1edd15e75c04dd1f1d42a314c616cee6d0bcb11fbce3df18aee95bb100cc9f` | 4 (344 498 bytes) |

Fichas ELI: https://www.boe.es/eli/es/rd/2021/06/29/470 y https://www.boe.es/eli/es/rd/2021/06/29/470/corrigendum/20240202. Los PDF se descargaron fuera del repositorio; no se versionan.

Página del PDF = página del BOE − 97663 (el PDF del RD empieza en la 97664). En la corrección, página del PDF = página del BOE − 13449.

### Estructura localizada

| Parte | Páginas del PDF |
| --- | --- |
| Disposición transitoria única (aplicación a proyectos y obras) | 3 |
| Título 2 «Estructuras de hormigón», capítulos 7 a 16, artículos 26 a 78 | 63–227 |
| Cap. 9 Durabilidad (arts. 43–44: recubrimientos, tablas 43.4.1 y 44.2.1.1.a/b) | 115–128 |
| Cap. 10 Dimensionamiento y comprobación (arts. 45–47) | 128 |
| Art. 49 Elaboración y armado (49.5: anclaje simplificado, tabla 49.5.1.2.a) | 131–146 |
| Anejo 18 Bases de cálculo | 560–621 |
| Anejo 19 Proyecto de estructuras de hormigón. Reglas generales y para edificación | 622–828 |
| Anejo 21 Reglas de proyecto en puentes de hormigón | 903–983 |

Hallazgos de estructura que condicionan el trabajo:

- **El artículo 45 no trae fórmulas:** remite el análisis, el dimensionamiento y la comprobación a los **Anejos 19 y 21**. El Título 2 aporta materiales, durabilidad (recubrimientos) y ejecución (incluido el anclaje simplificado del art. 49.5). Todo el cálculo del taller sale del Anejo 19; el Anejo 21 es de puentes y queda fuera del alcance actual.
- **Los coeficientes de acciones de edificación no están en el Código Estructural.** El Anejo 18, apéndice A.1, remite al **Código Técnico de la Edificación** (CTE) y fija la ecuación 6.10. Sin registrar el CTE DB-SE (otro documento oficial) no se pueden verificar γG, γQ ni ψ.
- **La disposición transitoria** exime los proyectos encargados antes de la entrada en vigor si las obras empiezan en un año (edificación) o tres (obra civil). Es informativa para la app: no cambia fórmulas.
- **La corrección de 2024 toca temas del taller:** reescribe la longitud básica de anclaje simplificada del art. 49.5.1.2 (el texto de 2021 decía «≤» y el corregido «≮», no menor que), completa el 8.4.1 del Anejo 19 y cambia valores de la tabla 43.2.1.a (columna XO, de 0,60 a 0,65). Cualquier cláusula futura de esos apartados debe citar ambos documentos.

## Método y limitaciones de la lectura

- Texto extraído con `pdftotext -layout` (poppler 24.02.0). **Las ecuaciones del Anejo 19 no salen como texto** (están dibujadas como trazos), y con ellas se pierden símbolos dentro de las frases (γc, αcc, k1…). Por eso cada extracto lleva su modo:
  - **texto**: la línea extraída, con los espacios colapsados a uno y recortada; se comprobó con un script que aparece tal cual en la página indicada.
  - **visual**: transcripción de una línea hecha mirando la página renderizada (`pdftoppm`, 100–110 ppp). El hash es el de esa transcripción, no de bytes del PDF; no es reproducible con `pdftotext` y debe revisarse a ojo antes de pasar al registro.
- El SHA-256 de cada extracto es del UTF-8 exacto que aparece entre comillas invertidas.
- La coma decimal se conserva como en la norma. Un extracto por fila, de una línea como máximo; no se copian párrafos.
- Ninguna cifra viene de memoria ni de resúmenes. Donde la norma coincide en forma con el Eurocódigo 2 no se da por buena la coincidencia: sólo cuenta lo leído en este PDF.

## Mapa tema → artículo/anejo → página → extracto

38 extractos: 14 de texto comprobado y 24 visuales.

| Tema | Cláusula | Página PDF (BOE) | Modo | Extracto | SHA-256 del extracto |
| --- | --- | --- | --- | --- | --- |
| Alcance y vigencia | Disposición transitoria única | RD 3 (BOE 97666) | texto | `Lo dispuesto en este real decreto no será de aplicación a los proyectos cuya orden de` | `c9d47acf32a98b3f12e88e77d17fa419d24a8432c04a9db0c1568618becc6db4` |
| Remisión del Título 2 | Art. 45 | RD 128 (BOE 97791) | texto | `en los Anejos 19 y 21.` | `d47256236e5dd136c34c112c079567ad7b093f207748b6638fb3bc502d9f65ff` |
| Coeficientes parciales de materiales | A19 2.4.2.4, tabla A19.2.1 | RD 641 (BOE 98304) | texto | `Permanente o Transitoria 1,5 1,15 1,15` | `003067d84ba9e3493317e1f4ecde6c8d27ecf069aa4631f01aff222fe5955557` |
| Coeficientes parciales de materiales (accidental) | A19 2.4.2.4, tabla A19.2.1 | RD 641 (BOE 98304) | texto | `Accidental 1,3 1,0 1,0` | `8ca27aa9b1466957c93169b962dc8fd1e72102a595b9959d7d9ae872bf98c530` |
| Coeficientes parciales de acciones (edificación) | A18 Apéndice A.1 | RD 593 (BOE 98256) | texto | `Se adoptará lo establecido en el Código Técnico de la Edificación.` | `c9f083885ebd8e83ccab22ae73c4a39cb2e4562c0ef4144c1ef343542c22d348` |
| Combinación ELU (edificación) | A18 Apéndice A.1 | RD 593 (BOE 98256) | texto | `verificación se realizará de acuerdo a la ecuación 6.10.` | `37537daa2a6e89f692b64ba4cf24ad20d04db9d7a375c62ce750deb087298851` |
| Combinación ELU (expresión) | A18 6.4.3.2(3), ec. (6.10) | RD 590 (BOE 98253) | visual | `∑j≥1 γG,j Gk,j "+" γP P "+" γQ,1 Qk,1 "+" ∑i>1 γQ,i Ψ0,i Qk,i (6.10)` | `1b8919830836acdcf22d32104d45c98c4a960c51118fd9f4a59b20f0c2ba13e6` |
| Resistencia de cálculo del hormigón | A19 3.1.6(1), ec. (3.15) | RD 650 (BOE 98313) | visual | `fcd = αcc fck / γc (3.15)` | `aae40119663ff46fbe6adab595d5fa0c03fe64d5f0d5b3adc594e3db888571e7` |
| Resistencia de cálculo del hormigón (αcc) | A19 3.1.6(1) | RD 650 (BOE 98313) | visual | `Con carácter general, su valor será αcc = 1,00` | `42d3c2a64dbddf96c6952039f4adf82e9826ced91756489493e5bde034355cd0` |
| Deformación última del hormigón | A19 3.1, tabla A19.3.1 | RD 645 (BOE 98308) | texto | `εcu3(‰) 3,5 3,1 2,9 2,7 2,6 2,6 para fck ≥ 50 N/mm2` | `0bbd927e3d716c8f9e98d8ae9c5c0385ca5f8e624a2b8566f756fe6d459ff445` |
| Bloque rectangular λ | A19 3.1.7(3), ec. (3.19) | RD 651 (BOE 98314) | visual | `λ = 0,8 para fck ≤ 50 N/mm2 (3.19)` | `ae4c9696d03739da3dedeb56f45ca186219e2ef685dc0fec65c49c16efab1318` |
| Bloque rectangular η | A19 3.1.7(3), ec. (3.21) | RD 652 (BOE 98315) | visual | `η = 1,0 para fck ≤ 50 N/mm2 (3.21)` | `200fc02b42532e2c5f1e52a3694967d8fc8c37d3fb7790361c89c775a45d402f` |
| Flexión simple: hipótesis | A19 6.1(2) | RD 694 (BOE 98357) | texto | `- Se desprecia la resistencia a tracción del hormigón,` | `935bd66fdc5093fd5301aefce7606e036a28381ee22492a386817eb124450550` |
| Cortante sin armadura | A19 6.2.2(1), ec. (6.2.a) | RD 696 (BOE 98359) | visual | `VRd,c = [CRd,c k (100 ρl fck)^(1/3) + k1 σcp] bw d (6.2.a)` | `7ffe5440a299b4c5d3d6d0bf9b6267db00997bf36a12468e79ae44c9920acea7` |
| Cortante sin armadura (CRd,c) | A19 6.2.2(1) | RD 697 (BOE 98360) | visual | `CRd,c = 0,18/γc` | `962ca508600de8177eb97f922407f9d4a1b51d37f59b7a476462da6c9e8d09a7` |
| Cortante sin armadura (vmin) | A19 6.2.2(1), ec. (6.3) | RD 697 (BOE 98360) | visual | `vmin = 0,035 k^(3/2) · fck^(1/2) (6.3)` | `a49227c53c4610eeb9c67b82add87121408c8a896a4336fc1d7e19d24e218e7b` |
| Cortante con armadura (θ) | A19 6.2.3(2), ec. (6.7) | RD 699 (BOE 98362) | visual | `0,5 ≤ cot θ ≤ 2 (6.7)` | `822acef713a03acb9bda8352c5c54ce0c064dc9c44be38cd6c2a80fe98cdb86c` |
| Cortante con armadura (VRd,s) | A19 6.2.3(3), ec. (6.8) | RD 699 (BOE 98362) | visual | `VRd,s = (Asw/s) z fywd cot θ (6.8)` | `197ecb4f8cab853bf862956275150b00cad7812e97c9dbb95da3d469148befd4` |
| Cortante con armadura (VRd,max) | A19 6.2.3(3), ec. (6.9) | RD 700 (BOE 98363) | visual | `VRd,max = αcw bw z ν1 fcd/(cot θ + tan θ) (6.9)` | `6da83869f28786ecbc8a4847c77027ccdd2a0f58bdf343dc99046185e904f0d9` |
| Cuantía mínima de vigas | A19 9.2.1.1(1), ec. (9.1) | RD 761 (BOE 98424) | visual | `As,min = (W/z) · (fctm,fl / fyd) (9.1)` | `12d737dd3f6c867a7dc87a164297070989e87fd492674747e083facb7a53f803` |
| Cuantía máxima de vigas | A19 9.2.1.1(3) | RD 761 (BOE 98424) | visual | `no debe superar As,max = 0,04 Ac fuera de las zonas de solape.` | `1ed7798b9aff6d1cc48686667fcaf793fe59c6ed462ec8930021e0a11d0ae4c6` |
| Cuantía mínima de pilares | A19 9.5.2(2), ec. (9.12) | RD 771 (BOE 98434) | visual | `As,min = 0,10 NEd / fyd (9.12)` | `c283850efaedd9fce8ff6fbf961007126cc53bdde5536d495ada1ce1ed5ce8f1` |
| Cuantía máxima de pilares | A19 9.5.2(3) | RD 771 (BOE 98434) | texto | `0,08 Ac dentro de las mismas.` | `40c14ec3ec745c000f128603ebbf596737bbfff6e19ff4dcf79f39116d6c0e6c` |
| Esbeltez límite de soportes | A19 5.8.3.1(1), ec. (5.13) | RD 677 (BOE 98340) | visual | `λlim = 20 · A · B · C/√n (5.13)` | `40ac575adf499926215f21764620d24c75958aec00c4516d1d3422ac146a5388` |
| Esbeltez de soportes | A19 5.8.3.2(1), ec. (5.14) | RD 678 (BOE 98341) | visual | `λ = l0/i (5.14)` | `87157e96171ab33c8577e92bd28a59e0a0de06b907906219073656f7de5432cc` |
| Efectos de segundo orden despreciables | A19 5.8.2(6) | RD 677 (BOE 98340) | texto | `(6) Los efectos de segundo orden pueden ignorarse si son inferiores al 10% de los efectos de primer` | `bf627a9d639dc0cf10e73660c09bfe48dd1d6bb39759dccb19185e33d7c68fca` |
| Punzonamiento sin armadura | A19 6.4.4(1), ec. (6.47) | RD 715 (BOE 98378) | visual | `VRd,c = CRd,c k (100 ρl fck)^(1/3) + k1 σcp ≥ (vmin + k1 σcp) (6.47)` | `6f5098013cbef08ab34512f287b615f39039e431f7a294dc902a856c987a4f9b` |
| Punzonamiento sin armadura (k1) | A19 6.4.4(1) | RD 715 (BOE 98378) | visual | `k1 = 0,1` | `3dd5cb056cd9be0c4bf6613bfb2ae850f94a6aab6e888f58783f90cec3576642` |
| Punzonamiento con armadura (kmáx) | A19 6.4.5(1) | RD 716 (BOE 98379) | texto | `aplicación de la armadura de punzonamiento, cuyo valor es 1,5.` | `2da43dfa93070da3dfcce8402d6bf0d4a17cb3bac7a7e300de4de57e1a1b3397` |
| Anclaje: tensión de adherencia | A19 8.4.2(2), ec. (8.2) | RD 744 (BOE 98407) | visual | `fbd = 2,25 η1 η2 fctd (8.2)` | `2d56942c67a686da9704f110b3f115c16307a0aa29c901467c7fa357a621c846` |
| Anclaje: longitud básica | A19 8.4.3(2), ec. (8.3) | RD 745 (BOE 98408) | visual | `lb,rqd = (ϕ/4)(σsd/fbd) (8.3)` | `9410a8d23e5a674d3c26fbba15dbc42866e62aeaa2b568e2ebab419f703d2836` |
| Anclaje: longitud neta | A19 8.4.4(1), ec. (8.4) | RD 745 (BOE 98408) | visual | `lbd = α1 α2 α3 α4 α5 lb,rqd ≥ lb,min (8.4)` | `66fd55e0e72fe173014959c4c877431903e67d4bb3e5a5b594698f7ed4154637` |
| Anclaje simplificado (Título 2) | Art. 49.5.1.2, tabla 49.5.1.2.a | RD 140 (BOE 97803) | texto | `25 1,2 1,5` | `7335542ba0ef360c100fa4dc3d59d701bec1468466bb63d0d3ba97a5a6c1c6bc` |
| Anclaje simplificado (corrección 2024) | Corrección BOE-A-2024-1989, pág. 97803 | Corr. 2 (BOE 13451) | visual | `lbI = m ∅² ≮ (fyk/20) ∅` | `e3dce33437ae7f8b048e586f58dfb5a79d9189410e76fd5e1a0168b44f472545` |
| Solapo | A19 8.7.3(1), ec. (8.10) | RD 749 (BOE 98412) | visual | `l0 = α1 α2 α3 α5 α6 lb,rqd ≥ l0,min (8.10)` | `8311e2e638c72d1068c083af3902bd09c9e42c713566ea3bdbdfcedcd47bfd08` |
| Solapo (α6) | A19 8.7.3, tabla A19.8.3 | RD 750 (BOE 98413) | visual | `α6 1 1,15 1,4 1,5` | `76530835f2839cd930902590d8119fa0e905bcac121ef1973c8c052038e45439` |
| Recubrimientos: margen | Art. 43.4.1, tabla 43.4.1 | RD 123 (BOE 97786) | texto | `Otros casos. 10` | `e0261dae6467ed20341b63cae83d7354b7d40fb46d20837949257c97a52f6a57` |
| Recubrimientos: mínimo por durabilidad | Art. 44.2.1.1, tabla 44.2.1.1.a | RD 124 (BOE 97787) | texto | `X0 Cualquiera. fck ≥ 25 15 25` | `7426e322396e726be0f91504b3d49817410a7c80899f3c919a4a65d1f2762a57` |

Lectura por tema, en una frase cada uno:

- **Coeficientes parciales de materiales.** Tabla A19.2.1: γc = 1,5 y γs = 1,15 en situación persistente o transitoria; 1,3 y 1,0 en accidental. Los apartados 2.4.2.6 y 2.4.2.7 permiten reducirlos (acero hasta 1,10; hormigón hasta 1,40 o 1,35 prefabricado) con control intenso y distintivos de calidad.
- **Coeficientes de acciones y combinaciones ELU.** Formato de la ec. 6.10 del Anejo 18; para edificación los valores son los del CTE (apéndice A.1).
- **Diagrama de cálculo del hormigón.** fcd = αcc·fck/γc con αcc = 1,00 en general (3.1.6); bloque rectangular con λ = 0,8 y η = 1,0 hasta fck = 50 N/mm² (3.1.7(3)); εcu3 = 3,5 ‰ hasta 50 N/mm² (tabla A19.3.1).
- **Flexión simple.** Hipótesis de 6.1(2) con los diagramas de 3.1.7 y 3.2; no hay factor φ ni zona de transición.
- **Cortante.** Sin armadura: ec. 6.2.a con efecto tamaño k, cuantía ρl ≤ 0,02, CRd,c = 0,18/γc, k1 = 0,15 y mínimo vmin (6.3). Con armadura: celosía de ángulo variable con **0,5 ≤ cot θ ≤ 2** (6.7), VRd,s (6.8) y VRd,max con ν1 y αcw (6.9).
- **Cuantías.** Vigas: As,min = (W/z)·(fctm,fl/fyd) (9.1) y As,max = 0,04 Ac. Pilares: φmín 12 mm, As,min = 0,10 NEd/fyd (9.12) y por cara 0,05 NEd/fyc,d; As,max = 0,04 Ac (0,08 Ac en solapes).
- **Pandeo.** Esbeltez λ = l0/i (5.14) frente a λlim = 20·A·B·C/√n (5.13); longitud efectiva con flexibilidades k1, k2 (5.15 arriostrado, 5.16 no arriostrado); métodos de rigidez nominal (5.8.7) o curvatura nominal (5.8.8).
- **Punzonamiento.** Ec. 6.47 con k1 = 0,1; en zapatas, perímetros dentro de 2d y vRd = CRd,c·k·(100ρl·fck)^(1/3)·2d/a ≥ vmin·2d/a (6.50); con armadura, kmáx = 1,5 (6.52).
- **Anclaje y solapo.** fbd = 2,25·η1·η2·fctd (8.2), lb,rqd (8.3), lbd con α1…α5 (8.4), mínimos lb,min; solapo l0 con α6 según el porcentaje solapado (tabla A19.8.3); alternativa simplificada del Título 2 (art. 49.5.1.2, coeficiente m) corregida en 2024.
- **Recubrimientos.** cnom = cmin + Δcdev (art. 43.4.1; Δcdev 0, 5 o 10 mm según control) y cmin por clase de exposición, cemento, fck y vida útil (tablas 44.2.1.1.a/b, más 44.3–44.5).

## Lo que no se pudo verificar

- **Ecuaciones como texto.** Ninguna ecuación del Anejo 19 es extraíble; las 24 filas visuales necesitan una segunda lectura independiente (otra persona o un OCR de fórmulas) antes de pasar a `verifiedClauses`, o registrarse con otra regla de evidencia que el registro hoy no contempla.
- **Coeficientes de acciones y ψ para edificación.** Están en el CTE DB-SE, no en este documento. Bloqueo para cualquier combinación.
- **Valores que faltan leer en detalle** (localizados, no transcritos): tabla A19.3.1 completa (fctm, Ecm, εc2, εc3), excentricidad mínima de 6.1(4), coeficientes α1–α5 de la tabla A19.8.2, perímetros críticos de 6.4.2, cuantía mínima de cortante de 9.2.2, armadura de zapatas de 9.8.2 y estados límite de servicio (7.3 fisuración, 7.4 flechas).
- **Anejo 21** (puentes): identificado, no leído; fuera del alcance del taller.
- **Corrección de 2024**: leída completa; afecta a 8.4.1, 8.4.3, 8.4.4 del Anejo 19 y al art. 49.5.1.2. No se encontró otra corrección posterior en la ficha ELI consultada.

## Análisis de brecha del motor

El motor del taller es de familia ACI: resistencia nominal × φ (`flexureFactor`, `columnFactor`, `shearFactor`, `twoWayShearFactor`, `compressionFactor`), bloque de Whitney con β1 y εcu = 0,003, cortante 0,17√f′c y punzonamiento ACI. El Código Estructural aplica coeficientes parciales a los materiales (fcd, fyd) y no tiene φ; el cortante, el pandeo, el punzonamiento y las cuantías mínimas son otras fórmulas. **No sirve poner φ = 1 y cambiar f′c por fcd:** cambian la deformación última, el bloque (λ, η), la cuantía balanceada, el cortante del hormigón y la forma de los mínimos. Tampoco se reutiliza ninguna fórmula ACI/NTC por parecido.

Qué habría que generalizar (archivos en `src/design/elements/` salvo indicación):

| Pieza | Hoy (ACI/NTC) | Código Estructural | Cambio |
| --- | --- | --- | --- |
| Formato de seguridad (`DesignCode` en `codes.ts`) | `flexureFactor`, `tensionControlledStrain`, `columnFactor`, `axialTransition`, `compressionFactor`, `maximumAxialCoefficient`, `shearFactor`, `twoWayShearFactor` | γc, γs por situación; fcd = αcc·fck/γc, fyd = fyk/γs | Nuevo campo `safetyFormat: 'resistance-factor' \| 'partial-material'` y funciones `designConcreteStrength` / `designSteelStrength`; los motores dejan de multiplicar «φ × nominal» directamente |
| Bloque de compresión (`shared.ts`: `flexuralCapacity`, `requiredFlexuralSteelMm2`, `CONCRETE_ULTIMATE_STRAIN`; `equivalentBlockStrengthMpa` y `betaOne` de `concrete/ntcConcrete2023`) | 0,85f′c, β1, εcu = 0,003, cuantía balanceada 600β/(fy + 600) | η·fcd sobre λx, εcu3 de la tabla A19.3.1 | Un `StressBlock` por perfil (deformación última, λ, intensidad) inyectado en flexión, viga T y `flexureExercise` |
| Diagrama de interacción (`column.ts`, ~990 líneas) | Compatibilidad con εcu = 0,003, φ según εt, φPn,máx, Bresler | Mismo equilibrio con εcu3 y límite εc2/εc3 en compresión centrada, sin φ; flexión esviada de 5.8.9 | Parametrizar deformaciones y retirar φ del lazo; la flexión biaxial es otra estrategia |
| Esbeltez (`ColumnRules`) | `neglectCap` 34 − 12M1/M2, `cmMinimum`, `swayNeglectLimit`, `maximumStabilityIndex`, δns | λlim = 20ABC/√n; l0 con k1, k2; rigidez o curvatura nominal | Los campos actuales tienen forma ACI: sustituirlos por una estrategia `slenderness(code)` con dos implementaciones |
| Cortante de vigas (`beam.ts` ~l. 890–970) y de columnas | 0,17√f′c, mínimos 0,062√f′c y 0,35, tope 0,66√f′c, constantes en el motor | VRd,c con k y ρl; VRd,s con cot θ ∈ [0,5, 2]; VRd,max con ν1, αcw | Sacar las constantes del motor a un `shearModel` del perfil; el motor debe conocer ρl anclado en cada sección y elegir θ |
| Punzonamiento (`footing.ts` l. 363, `combinedFooting`, `strapFooting`, `matFoundation`) | Perímetro a d/2, mín(0,33; 0,17(1 + 2/β); 0,083(2 + αs·d/b0))√f′c | Perímetros dentro de 2d con 2d/a, ρl en dos direcciones, carga excéntrica con β | Geometría de perímetros nueva compartida por las cuatro cimentaciones |
| Cuantías (`BeamRules.minimumSteel`, `ColumnRules.ratioMin/ratioMax`, `FootingRules.minimumSteelRatio`) | Fórmulas en f′c y fy; mínimo de columna constante (1 %) | Mínimo de viga con W, z y fctm,fl; mínimo de pilar proporcional a NEd | Ampliar firmas (módulo resistente, axil de cálculo) |
| Anclaje y solapo (`DevelopmentOptions`, `developmentLength`, `hookedDevelopmentMm`, `spliceLengthMm`) | ψt, ψe, ψs; ldh; traslape clase B = 1,3 ld | fbd, lb,rqd con σsd, α1…α5, lb,min; α6 según % solapado | Opciones nuevas (posición de adherencia, σsd, % solapado) y la firma de `spliceLengthMm` |
| Combinaciones (`loadCombinations`, `lateralCombinations`) | Un factor de muerta y uno de viva por grupo | Ec. 6.10 con valores del CTE | Forma de `LoadCombination` probablemente suficiente para G + Q; los valores esperan al CTE |
| Materiales (`elasticModulusMpa`, `ruptureModulusMpa`, entradas de la interfaz) | f′c de cilindro, fy | fck, fyk, Ecm y fctm de tabla, designación HA-25 / B 500 S | Etiquetas por perfil y tabla de propiedades |
| Recubrimientos | Dato de entrada | cnom = cmin + Δcdev por exposición | Comprobación nueva opcional |
| Servicio (`crack`, `deflection`, `inertia`) | Modelos NTC/ACI | 7.3 y 7.4 (sin leer) | Fuera de esta fase |

Los perfiles también los consumen `structure.ts`, `frame.ts`, `reinforcementAlternatives.ts`, las propuestas de secciones (`features/design/workbench/columnProposal.ts`, `features/workspace/adapters/modelSectionProposalTask.ts`), la memoria y el PDF del taller: cada cambio de firma se propaga ahí.

**Tamaño estimado.** Del orden de 2 500 a 3 500 líneas tocadas entre motor y pruebas, sin contar la interfaz:

| Bloque | Tamaño |
| --- | --- |
| Formato de seguridad + bloque de compresión + flexión (vigas, T, ejercicio) | M–L |
| Diagrama de interacción y esbeltez de columnas | L |
| Modelo de cortante (vigas, columnas, cortante como viga en zapatas) | M |
| Punzonamiento en las cuatro cimentaciones | M–L |
| Anclaje, solapo y cuantías | M |
| Perfil `codigo-estructural-2021`, cláusulas verificadas y oráculo independiente | M |
| Combinaciones | S, después de registrar el CTE DB-SE |

En conjunto L–XL: varias semanas de trabajo en 6 a 8 cambios separados, cada uno con su prueba de valor de referencia y tolerancia. Conviene hacer primero la generalización con NTC, NSR y E.060 sin cambiar resultados (las pruebas actuales deben quedar idénticas) y sólo después enchufar el perfil español.

## Siguientes pasos (fase 3 en adelante, no hechos aquí)

1. Segunda lectura de las 24 filas visuales y decisión sobre cómo registrar evidencia de ecuaciones dibujadas.
2. Registrar el CTE DB-SE como documento oficial para los coeficientes de acciones.
3. Generalizar el motor (tabla anterior) sin cambiar resultados de las normas actuales.
4. Pasar cláusulas a `verifiedClauses`, crear el perfil y abrir la puerta del registro sólo para lo verificado.
