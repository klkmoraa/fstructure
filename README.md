# FStructure

Aplicación y motor estructural 2D de FusionStructure. La aplicación se publica
en https://klkmoraa.github.io/fstructure/. El proyecto conserva el
modelo, comandos, análisis, educación, exportaciones y persistencia propios de
la superficie planar; Space 3D vive en un repositorio hermano.

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
