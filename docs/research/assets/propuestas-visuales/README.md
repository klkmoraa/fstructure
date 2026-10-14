# Propuestas visuales de FStructure

Generadas en un chat nuevo de la cuenta de la persona en ChatGPT, mediante el navegador integrado. Se envió el mensaje de marca de la sección 3 de [prompt-codex-continuacion.md](../../../plans/prompt-codex-continuacion.md) y cada propuesta por separado, en orden.

Conversación: [Crear pantallas FStructure](https://chatgpt.com/c/6acfec20-08ec-83e8-892d-8924f6d99098).

La persona considera estas imágenes genéricas y poco logradas; por eso las nueve quedan en estado `revisar` como exploración, aunque varias coinciden con todos los textos solicitados. No son referencia canónica ni propuestas aprobadas de producto. La continuación en código partirá de la app oficial y de su brandbook. Ninguna imagen valida cálculo estructural. Las horas son las de descarga inmediatamente posterior a la generación (America/Mexico_City, UTC−06:00), porque ChatGPT no expone la hora exacta del render.

| Número | Archivo | Estado | Fecha y hora de generación observada | Coincidencia de textos y observaciones |
|---|---|---|---|---|
| 01 | [01-home.png](01-home.png) | revisar | 2026-10-14 14:56:44 −06:00 | Título, seis mosaicos, dos columnas, tarjetas y recientes coinciden en día y noche. |
| 02 | [02-modelo-2d-vacio.png](02-modelo-2d-vacio.png) | revisar | 2026-10-14 14:58:53 −06:00 | Coinciden el título, las cinco opciones, la carga de ejemplo, los dos botones y el dock. La miniatura rotulada Pratt es esquemática y requiere revisión técnica antes de usarla como referencia estructural. |
| 03 | [03-viga-continua.png](03-viga-continua.png) | revisar | 2026-10-14 15:03:59 −06:00 | Una corrección textual: se eliminaron cargas y longitudes inventadas. RA, RB, RC y ambos momentos coinciden; las etiquetas no cruzan la curva. |
| 04 | [04-armadura-axial-noche.png](04-armadura-axial-noche.png) | revisar | 2026-10-14 15:05:15 −06:00 | Coincide «N máx 24.00 kN», sin cifras añadidas y fuera de las barras; noche, colores y miniatura presentes. El patrón de diagonales no representa claramente una Pratt simétrica: revisar geometría. |
| 05 | [05-revision-tres-estados.png](05-revision-tres-estados.png) | revisar | 2026-10-14 15:08:46 −06:00 | Una corrección textual: eliminados los identificadores numéricos de barras y el punto final añadido. Coinciden los tres estados y porcentajes; no aparece «Revisión incompleta». |
| 06 | [06-proyectos-sin-resultados.png](06-proyectos-sin-resultados.png) | revisar | 2026-10-14 15:10:50 −06:00 | Texto principal y botón exactos, legibles a 390 × 844. La insignia «1» de Filtros no parece concordar con los dos chips visibles; hora 9:41 decorativa. |
| 07 | [07-corte-zapata.png](07-corte-zapata.png) | revisar | 2026-10-14 15:13:10 −06:00 | Todos los textos y valores coinciden. Revisar geometría: d/2 aparece bajo la huella del pedestal y las líneas críticas no se dimensionan desde su cara. |
| 08 | [08-dock-movil-noche.png](08-dock-movil-noche.png) | revisar | 2026-10-14 15:15:37 −06:00 | Mesa 3D con una acción en cabecera, cuatro iconos sin texto en dock, dibujo protagonista. Hora 9:41 decorativa. |
| 09 | [09-columna-encabezado.png](09-columna-encabezado.png) | revisar | 2026-10-14 15:19:24 −06:00 | Una corrección textual eliminó todas las cifras inventadas. El título y el botón local están en una línea; siguen f’c con apóstrofo en vez de f′c, dos botones «Proponer sección» y acciones moradas fuera del canon. |

Se conservan los originales descargados fuera del repositorio. Las imágenes de escritorio se normalizan a 1440 × 900 y las de teléfono a 390 × 844. Los PNG entregados se comprimen con paleta indexada y se revisan visualmente para conservar la legibilidad; límite de 300,000 bytes por imagen.

## Verificación de la entrega

- Nueve archivos PNG, siete de escritorio y dos de teléfono; ninguno supera 300,000 bytes.
- Revisión visual independiente de textos y legibilidad de los nueve archivos.
- Corrección textual solicitada una vez en 03, 05 y 09; no hubo segundo intento.
- El generador respondió con imágenes sin la confirmación textual adicional pedida; la coincidencia se comprobó sobre los archivos descargados.
- `npm run verify`: typecheck en verde. Sólo se agregaron imágenes y este registro; no se cambió código de la app.
