# Referencias normativas públicas

Este directorio guarda **enlaces y metadatos**, nunca los documentos. Las normas
se consultan en su fuente y el repositorio registra la edición, la cláusula y el
extracto verificado, no el capítulo copiado.

La política del registro `docs/design/normative-sources.json` declara
`localNormativePdfsAllowed: false` y redistribución mediante enlaces. La auditoría
documental del 2026-10-14 no encontró una prueba que impida automáticamente
versionar un PDF: no debe atribuirse esa garantía a un test inexistente.
`src/design/normativeRegistry.test.ts` valida fuentes, páginas y hashes de los
extractos; `src/design/normativeEvidence.test.ts` contrasta las constantes con
sus extractos. Ninguna de esas comprobaciones concede derechos de reproducción.
Que un texto sea consultable públicamente no autoriza a redistribuirlo desde
este repositorio publicado en GitHub Pages.

El [estado y acceso de normas](../../research/normas-estado-y-acceso.md) y las
[vías legales de ACI](../../research/aci-318-acceso-legal.md) documentan las fuentes,
la consulta del 2026-10-14 y sus límites. ACI sigue pendiente de copia licenciada.

| Norma | Fuente | Uso en el prototipo |
| --- | --- | --- |
| NTC Concreto CDMX 2017 | [SMIE](https://www.smie.org.mx/uploads/1/2022-11/normas_tecnicas_complementarias_diseno_construccion_estructuras_concreto_2017.pdf) | Concreto simple, reforzado y presforzado; unidades, estados límite y detallado |
| NTC Acero CDMX 2020 | [SMIE](https://www.smie.org.mx/uploads/1/2022-11/ntc_acero_2020.pdf) | Referencia de diseño y construcción de acero |
| NTC Sismo CDMX 2020 | [SMIE](https://www.smie.org.mx/uploads/1/2022-11/normas_tecnicas_complementarias_diseno_sismo_2020.pdf) | Referencia sísmica pública con comentarios |
| NTC Viento CDMX 2017 | [SMIE](https://www.smie.org.mx/uploads/1/2022-11/normas_tecnicas_complementarias_diseno_viento_2017.pdf) | Referencia de viento |
| NTC Concreto CDMX 2023 | [Gaceta Oficial CDMX](https://data.consejeria.cdmx.gob.mx/portal_old/uploads/gacetas/b3c4f4ff37241d0a93cc6742a8b0bf2f.pdf) | Edición implementada; cláusulas y evidencia en `docs/design/normative-sources.json` |

Los códigos ACI/AISC/ASCE y los manuales PCI/PTI se mantienen igual: enlace y
metadatos hasta contar con una fuente o licencia que permita redistribución.

## Cómo verificar una cláusula

1. Descargar la norma desde su fuente a una ruta **fuera** del repositorio.
2. Registrar en `docs/design/normative-sources.json` la cláusula, la página, el
   extracto textual y su `sha256`, junto al `sourceSha256` del documento.
3. No agregar el archivo al control de versiones.
