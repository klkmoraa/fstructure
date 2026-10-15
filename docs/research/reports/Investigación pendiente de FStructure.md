# Investigación pendiente de FStructure

**Cierre documental: 14 de octubre de 2026.** Se completó la investigación solicitada en la sección 2 del prompt de continuación y se incorporaron sus resultados al [plan de normas y mejoras](../../plans/2026-10-14-plan-final-normas-mejoras.md). El resultado es una investigación documental con fuentes primarias, fecha y límites; no es una implementación normativa ni una validación profesional de cálculos.

## Entregables y cobertura

| Alcance solicitado | Resultado y documento |
|---|---|
| ACI vigente, español, precios, estudiante, docentes, IMCYC y universidades mexicanas | [Acceso legal a ACI 318](../aci-318-acceso-legal.md): vías y condiciones comprobadas; siete catálogos con sus intentos y limitaciones, sin inventar tenencias. |
| NSR-10, E.060, Eurocódigo 2 y Código Estructural | [Normas: estado y acceso](../normas-estado-y-acceso.md): actos oficiales, propuestas frente a normas, calendario europeo, NA gratuito y mapa técnico preliminar del Código Estructural. Incluye límites para CSA/ABNT. |
| Estados vacíos, etiquetas, tablas y controles táctiles | [Referencias visuales](../referencias-visuales.md): Carbon, Cloudscape, Supabase, Jutro, d3fc, Vega/Vega-Lite, Observable Plot y Excalidraw; criterios propuestos para V1–V9 bajo el canon oficial. |
| Propuestas de comunidad y licencias | [Comunidad y licencias](../propuestas-comunidad.md): issues/Q&A de Excalidraw, PyNite y anaStruct; ausencia de propuestas verificadas en Frame3DD; licencias y desambiguación de SFAP. |

Las [notas de investigación](../research_notes/Investigación%20pendiente%20de%20FStructure/) conservan el rastreo por tema. Los entregables distinguen **Verificado** de **No verificado**; la falta de acceso no prueba que un libro, licencia o acto normativo no exista.

## Conclusiones que cambian el plan

**ACI español existe.** ACI registra CODE-318-25 Spanish con fecha 29-09-2026. Se corrigió la afirmación de que no había edición española. La compra inglesa muestra US$309 público/US$184 miembro y PLUS US$299/US$169 anuales; el precio español, MXN y total final para México no se comprobaron. Tampoco se confirmó una copia gratuita autorizada de acceso general ni una tenencia universitaria utilizable. FStructure sigue **pendiente de copia legal**. [Publicación oficial ACI](https://www.concrete.org/publications/internationalconcreteabstractsportal.aspx?id=51752098&m=details); condiciones y precios enlazados en el entregable ACI.

**Acceso oficial y vigencia deben comprobarse por separado.** El Título C del IDRD abre, pero hace falta cotejar las cláusulas del motor con los modificatorios. El DS 010-2009-VIVIENDA incluye E.060 y se publicó el 9-may-2009, aunque se firmó el día 8; la existencia de propuestas posteriores no demuestra su aprobación. [Título C, IDRD](https://www.idrd.gov.co/sites/default/files/documentos/Construcciones/3titulo-c-nsr-100.pdf); [decreto en El Peruano](https://busquedas.elperuano.pe/dispositivo/NL/346173-9).

**Sí hay un Anejo Nacional gratuito de consulta**, el danés DK NA:2024 para DS/EN 1992-1-1+AC:2008. Es primera generación y no sustituye el EN completo ni el anejo de otro país. La transición europea llega a publicación nacional en septiembre de 2027 y retirada en marzo de 2028. [Portal oficial danés](https://www.bygningsreglementet.dk/nationale-annekser/nationale-annekser/nationale-annekser/?Layout=ShowAll); [calendario JRC](https://eurocodes.jrc.ec.europa.eu/second-generation-eurocodes).

**El Código Estructural necesita leer anejos antes de implementarse.** El art. 45 remite a Anejos 19/21, con bases en Anejo 18. Se documentó la corrección de 2024 y ejemplos de anclaje/fiabilidad; las páginas y coeficientes completos de flexión, cortante, columnas y zapatas siguen como trabajo técnico previo al perfil. [BOE, RD 470/2021](https://www.boe.es/eli/es/rd/2021/06/29/470).

**Las referencias visuales ahora cubren los huecos de tablas y táctil.** Los criterios de aceptación son propuestas medibles, no hallazgos de pruebas realizadas ni reglas normativas. Se corrigió anaStruct a LGPL-3.0 y se distinguieron OpenSeesPy y su motor; SFAP continúa sin repo/licencia confirmados. No se copiaron código ni medios externos.

## Correcciones y límites del cierre

Se corrigieron referencias a `structuralDesignMigration.test.ts`, que no existe: `normativeRegistry.test.ts` comprueba fuentes, páginas y hashes, y `normativeEvidence.test.ts` correspondencia de constantes. La deuda registrada actual está vacía. La prohibición documental de versionar PDFs sigue vigente, pero no se encontró una prueba automática que la imponga. Un límite de una línea tampoco equivale a permiso universal de reproducción.

Quedan explícitos: adquisición/licencia ACI, catálogo universitario e IMCYC no confirmados, acceso actual a bytes E.060 desde Drive, cotejo de modificatorios, anejos españoles completos, país/NA de segunda generación, última edición ABNT/acceso CAPES y licencia de SFAP. No se cambiaron motores, evidencia JSON, datos guardados ni `main`. Las nueve propuestas de código siguen siendo una exploración separada, descrita en su [registro de validación](../propuestas-codigo-2026-10-14.md).

La publicación de este cierre se hace sólo mediante commit/push de documentación a `plan/normas-y-mejoras-2026-10-14`, sin PR. La implementación y las comprobaciones técnicas pendientes permanecen identificadas como tales.
