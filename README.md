# FusionStructure — app integrada

En esta carpeta se ejecutan Solver 2D, Diseño estructural y Solver 3D dentro de una sola app React/Vite. FEM tiene una entrada reservada y está **Planeado**.

```sh
npm install
npm run dev
# Compilación de producción, incluida comprobación de TypeScript:
npm run build
```

La aplicación tiene una única ruta de trabajo: `?surface=workspace2d`. `WorkspaceShell` y `AppShellLayout` conservan el diseño original de Modelo 2D: una sola barra y una sola mesa. El botón directo **3D** adapta esa mesa al modelo espacial; no abre una pestaña, una ruta ni otra aplicación. FEM se abre desde Utilidades en el mismo espacio y se identifica como planeado.

- **2D + Diseño (Experimental):** integración existente del [PR #7](https://github.com/klkmoraa/fstructure/pull/7), commit `288bedd`. Diseño trabaja sobre el proyecto 2D actual.
- **3D (Experimental):** fuentes locales de `fusionstructure-space3d` en `src/modules/space3d`. El adaptador host crea una copia espacial versionada del proyecto 2D y conserva el trabajo 3D asociado a ese ID. Las pérdidas o aproximaciones aparecen antes del análisis.
- **FEM (Planeado):** punto de entrada `src/modules/fem/FemSurface.tsx`. No contiene motor ni resultados simulados.

La integración comparte aplicación y proyecto visible dentro de la misma mesa de trabajo. 2D y 3D conservan historiales y resultados propios; el paso 2D→3D es una transferencia explícita y no una sincronización bidireccional. Se mantienen los formatos de exportación de cada motor. Las fuentes 3D conservan su licencia MIT.

Para continuar FEM: agregar modelo y validación propios, worker y resultados versionados dentro de `src/modules/fem`; conectar su superficie existente. Cualquier intercambio con 2D/3D debe pasar por un adaptador explícito de unidades y grados de libertad.

---

# FStructure

Aplicación y motor estructural 2D de FusionStructure. La aplicación se publica
en https://klkmoraa.github.io/fstructure/. El proyecto conserva el
modelo, comandos, análisis, educación, exportaciones y persistencia propios de
la superficie planar. El módulo Space 3D está incorporado en este repositorio;
su origen histórico se conserva como repositorio hermano y su licencia MIT se
mantiene junto al código importado.

## Estado

`Experimental`: el corpus numérico y las migraciones se validan en cada gate,
pero el producto no es normativo ni software certificado para obra.

## Desarrollo

```text
npm ci
npm run check
npm run dev
```

La procedencia del corte y la separación de dominios están en
[MIGRATION.md](MIGRATION.md).

## Diseño de concreto reforzado

La barra superior y Resultados incluyen **Diseño**, el primer flujo vertical
experimental para una viga rectangular de concreto reforzado. Corre el solver
para combinaciones última y de servicio explícitamente trazables, propone
acero longitudinal/estribos y conserva evidencia NTC CDMX 2023 junto al
resultado derivado. No es un cálculo certificado ni un plano de fabricación.

El uso, precondiciones, evidencia, límites y ruta de ampliación están en
[docs/design/concrete-beam-v1.md](docs/design/concrete-beam-v1.md). El gate de
entrega ejecuta TypeScript, el oráculo Python independiente y sus fixtures:

```text
npm run check
```

## Foundation local y flujo rápido

Las unidades, el álgebra lineal y sus tipos numéricos se mantienen como código
local en `src/foundation`, junto con sus pruebas. Este producto no consume el
paquete archivado `@fusionstructure/foundation` ni dependencias o subpaths de
productos hermanos.

Para un cambio diario de Foundation, ejecuta el gate y las pruebas focalizadas
en este repositorio:

```text
npm run architecture:check
npm run architecture:test
npm run test -- src/foundation/units.test.ts src/foundation/linearAlgebra.test.ts
```

Para una entrega, `npm run check` ejecuta primero el gate de arquitectura y su
prueba, antes de la suite normal y el build. La validación y el Pull Request de
un cambio local de Foundation pertenecen solamente a este repositorio.
