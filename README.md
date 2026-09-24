# FStructure

Aplicación web de cálculo estructural de FusionStructure. Publicada en
https://klkmoraa.github.io/fstructure/. Local-first y **experimental**: no es
software certificado ni sustituye la revisión de una persona responsable.

## Herramientas

El Inicio presenta cuatro herramientas aisladas. Cada una abre su propia
bienvenida y después su mesa de trabajo; ninguna comparte datos ni interfaz con
otra.

| Código | Herramienta | Qué hace | Código fuente |
| --- | --- | --- | --- |
| FS-A01 | FStructure | Modelo 2D: marcos, vigas y armaduras; lineal, P-Delta, pandeo, modos, influencia | `src/features`, `src/engine` |
| FS-A02 | Solver 3D | Marcos espaciales con 6 GDL por nudo, generador, lineal/P-Delta/modal/pandeo | `src/modules/space3d` (licencia MIT propia) |
| FS-A03 | Elementos finitos | Elasticidad lineal 2D con TRI3/QUAD4, Gmsh 4.1, JSON/VTK | `src/modules/fem` |
| FS-A04 | Diseño | Vigas, columnas y zapatas de concreto con NTC-CDMX 2023, NSR-10 y E.060 | `src/design`, `src/features/design` |

Rutas: `?surface=welcome` (Inicio), `?surface=home&tool=<id>` (bienvenida) y
`?project=<id>&tool=<id>` (mesa).

## Desarrollo

```sh
npm ci
npm run dev       # servidor local
npm run verify    # pruebas mínimas de lo que cambió
npm run check     # gate completo (el que corre CI antes de publicar)
```

`npm run lint:design` revisa la guía visual y sólo avisa. Las escenas en
arcilla del Inicio se regeneran con `node scripts/render-suite-scenes.mjs` con
el servidor de desarrollo encendido.

Cada push a `main` corre el gate y publica en la rama `gh-pages`.
