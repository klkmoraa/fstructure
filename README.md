# FusionStructure — app integrada

En esta carpeta se ejecutan Modelo 2D, Diseño estructural, Modelo 3D y FEM dentro de una sola app React/Vite. Todo permanece marcado **Experimental** y trabaja local-first.

```sh
npm install
npm run dev
# Compilación de producción, incluida comprobación de TypeScript:
npm run build
```

La aplicación tiene enlaces compatibles con GitHub Pages: `?project=<id>&tool=<tool>`. El **Inicio** sigue el brandbook de FusionStructure: presenta las cuatro herramientas de la familia Análisis (FS-A01 FStructure, FS-A02 Solver 3D, FS-A03 Elementos finitos, FS-A04 Diseño) junto al pórtico 3D, y es el único lugar desde el que se elige una. Cada herramienta abre primero su propia bienvenida —FStructure conserva la original; Solver 3D, Elementos finitos y Diseño tienen la suya, con sus entradas, recientes y capacidades— y desde ahí su mesa de trabajo. Cada herramienta abre **aislada**, en su propia mesa: `WorkspaceShell` es el shell del Modelo 2D y `ToolShell` el de Diseño, Modelo 3D y FEM. Ninguna ofrece saltos a otra ni comparte atajos, superficies o estado de interfaz; la marca de la barra vuelve al Inicio. El gate `npm run architecture:check` rechaza cualquier import de producción entre herramientas.

- **2D + Diseño (Experimental):** integración existente del [PR #7](https://github.com/klkmoraa/fstructure/pull/7), commit `288bedd`. Diseño trabaja sobre el proyecto 2D actual.
- **3D (Experimental):** fuentes locales de `fusionstructure-space3d` en `src/modules/space3d`. El adaptador host crea una copia espacial versionada del proyecto 2D y conserva el trabajo 3D asociado a ese ID. Las pérdidas o aproximaciones aparecen antes del análisis.
- **FEM (Experimental):** `src/modules/fem/FemSurface.tsx` conecta el motor local `src/modules/fem/femEngine.ts`. Resuelve elasticidad lineal 2D con TRI3/QUAD4 (esfuerzo y deformación plana), publica desplazamientos, reacciones, tensiones, principales, von Mises, calidad y equilibrio, e importa mallas Gmsh 4.1 ASCII. Los estudios quedan en el bundle local y pueden exportarse como JSON/VTK. MITC4/TET4 se admiten en el codec pero se rechazan hasta disponer de su formulación física.

Las cuatro herramientas comparten aplicación, sistema de diseño y el proyecto como contenedor, pero no datos: cada una guarda su propia rama y ninguna deriva de otra. El Solver 3D abre vacío si todavía no tiene modelo y Diseño trabaja con sus propios elementos.

La primera entrega FEM usa documentos serializables propios y no tiene topes fijos de nodos o elementos; la admisión de memoria pertenece al runtime común. Cualquier intercambio con 2D/3D debe pasar por un adaptador explícito de unidades y grados de libertad.

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
