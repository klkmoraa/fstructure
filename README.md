# FStructure

Aplicación web de cálculo estructural de FusionStructure. Publicada en
https://klkmoraa.github.io/fstructure/. Local-first y **experimental**: no es
software certificado ni sustituye la revisión de una persona responsable.

## Mesas

Una sola Home: retoma el proyecto abierto, entra directo a un modo de la mesa
y reúne proyectos, plantillas, aula, importación y biblioteca.

| Código | Mesa | Qué hace | Código fuente |
| --- | --- | --- | --- |
| FS-A01 | FStructure | Una sola mesa con tres modos. **2D**: marcos, vigas y armaduras; lineal, P-Delta, pandeo, modos, influencia. **3D**: pórticos y armaduras espaciales al modo de ETABS/SAP2000 (rejilla de ejes y pisos, plantas y alzados, diafragmas rígidos, diagramas P·V2·V3·T·M2·M3; lineal, P-Delta, modal, espectro CQC y pandeo en un worker); «Traer del 2D» extruye el pórtico plano en pórticos paralelos. **Diseño**: vigas, columnas, zapatas y la estructura completa en concreto con NTC-CDMX 2023, NSR-10 y E.060, desde el Modelo 2D o desde un eje del Modelo 3D | `src/features`, `src/engine`, `src/design`, `src/features/design`; modo 3D en `src/modules/space3d` (licencia MIT propia) |

El interruptor 2D | 3D | Diseño de la barra cambia sólo las herramientas del
modo: proyecto, guardado y barra son los mismos. Los datos pasan entre modos
sólo por los puentes declarados de `src/integrations`.

Rutas: `?surface=welcome` (Home, con `&view=<sección>`), `?project=<id>&tool=model2d`
(mesa) y `&mode=3d` o `&mode=design` (modo de FStructure). Elementos finitos
(FS-A03) se retiró: sus enlaces abren la Home y los estudios guardados se
conservan en el proyecto.

## Interfaz y lectura de armaduras

La Home reúne el proyecto abierto y los recientes antes de las herramientas.
La mesa 2D deja a mano selección, nudos, barras y apoyos; **Carga** agrupa las
cargas y **Más** reúne las operaciones secundarias. La herramienta activa
sigue visible al cerrar su menú. En teléfono, 2D, 3D y Diseño comparten un
selector compacto; Deshacer y Rehacer están en las utilidades de la mesa.

Para leer una armadura 2D, pulsa **Analizar** y elige **N · Axial**. Las barras
indican **T · tensión (+)**, **C · compresión (−)** o **0 · sin esfuerzo**, con
color, patrón de línea y fuerza en las unidades del proyecto. La leyenda
muestra la lectura completa de la barra seleccionada. En una armadura pura,
**Resultados → Axial** ofrece además una tabla de todas las barras: elegir
una fila selecciona ese miembro en el modelo.

En pantallas pequeñas sólo se muestran cifras donde hay espacio y sobre la
barra seleccionada. La clasificación usa el resultado actual del solver;
un resultado ausente o no confiable no se presenta como fuerza cero. Esta
lectura describe la fuerza axial, no comprueba la resistencia ni el pandeo
del miembro.

Las capturas y criterios de la interfaz están en
[la ficha del brandbook](docs/brandbook/index.html).

## Desarrollo

```sh
npm ci
npm run dev       # servidor local
npm run verify    # pruebas mínimas de lo que cambió
npm run check     # gate completo (el que corre CI antes de publicar)
```

`npm run lint:design` revisa la guía visual y sólo avisa. Las escenas en
arcilla de la Home se regeneran con `node scripts/render-suite-scenes.mjs` con
el servidor de desarrollo encendido.

Cada push a `main` corre el gate y publica en la rama `gh-pages`.
