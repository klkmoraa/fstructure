# Referencias normativas públicas

Este directorio guarda **enlaces y metadatos**, nunca los documentos. Las normas
se consultan en su fuente y el repositorio registra la edición, la cláusula y el
extracto verificado, no el capítulo copiado.

La regla está fijada por la prueba `impide incorporar PDFs normativos al
repositorio único` (`src/design/structuralDesignMigration.test.ts`): cualquier
`.pdf` versionado la hace fallar. Vale para toda norma, incluidas las NTC de la
Ciudad de México: que un documento sea de consulta pública no implica licencia
para redistribuirlo desde un repositorio público publicado en GitHub Pages.

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
