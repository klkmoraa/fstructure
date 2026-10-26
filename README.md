# FStructure

Aplicación web de cálculo estructural de FusionStructure. Publicada en
https://klkmoraa.github.io/fstructure/. Local-first y **experimental**: no es
software certificado ni sustituye la revisión de una persona responsable.

## Encuadre y alineación de texto · 26 de octubre de 2026

Tarjetas, títulos, campos, botones y cifras comparten reservas y alineaciones
según su función. Los nombres largos se acomodan en móvil, las cotas quedan
dentro del dibujo y la pieza activa permanece visible en su selector.
[Ficha de encuadre, medidas y capturas](docs/brandbook/text-alignment-2026-10-26.md).

## Alineación visual · 25 de octubre de 2026

Home, Modelo 2D, Modelo 3D, Diseño y sus editores auxiliares comparten el canon
de FusionStructure: arcilla funcional, tipografía y roles de color, con datos
y gráficos planos para conservar su lectura. Alcance, criterios, verificación
y capturas en la [ficha de alineación de marca](docs/brandbook/brand-alignment-2026-10-25.md).

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

La Home ofrece navegación persistente a Inicio, Proyectos, Plantillas y
Recursos; en teléfono queda al pie. El proyecto abierto precede a las
herramientas y los recientes siguen disponibles debajo y en Proyectos.
La mesa 2D deja a mano selección, nudos, barras y apoyos; **Carga** agrupa las
cargas y **Más** reúne las operaciones secundarias. La herramienta activa
sigue visible al cerrar su menú. En teléfono, 2D, 3D y Diseño comparten un
selector compacto; Deshacer y Rehacer están en las utilidades de la mesa.
El dock 2D muestra etiquetas y la hoja Más dispone de cierre y navegación por
teclado. Los campos táctiles usan al menos 16 px y el zoom de página permanece
disponible fuera del lienzo. El segundo toque sobre una selección ambigua abre
los objetos superpuestos; arrastrar y pellizcar conservan el modelo. El dock
3D muestra sus seis nombres y devuelve la selección al cerrar el inspector.
Diseño ofrece Dibujo, Datos y Resultados estables, zoom por botones y accesos
directos a cargas, sección y armado de la viga. El teclado ajusta el espacio
de edición en las tres mesas. [Ficha táctil y capturas actuales](docs/brandbook/mobile-canvas-flow-2026-10-26.md).

Para leer una armadura 2D, pulsa **Analizar** y elige **N · Axial**. Las barras
indican **T · tensión (+, azul)**, **C · compresión (−, rojo)** o **0 · sin esfuerzo**, con
color, patrón de línea y fuerza en las unidades del proyecto. La leyenda
muestra la lectura completa de la barra seleccionada. **El diagrama axial N se conserva**
sobre todas las barras, con sus ordenadas, escala y lectura por cursor; en
**Resultados → Axial** el gráfico individual y la tabla global están disponibles
al mismo tiempo. Elegir una fila selecciona ese miembro en el modelo.

**Fluencia** abre el mapa del índice elástico estimado η con escala de 0 a 200 %,
marcador en **100 % del Fy declarado**, cobertura y máximo evaluado. La barra
seleccionada muestra su η sin sustituir su color de demanda; las barras sin Fy
verificable quedan punteadas y nunca se interpretan como η = 0. Desde el mapa
puedes volver a Axial y viceversa sin perder el resultado. **Este mapa no
certifica fluencia, resistencia, estabilidad ni cumplimiento normativo:** no
incluye pandeo ni factores de diseño.

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
