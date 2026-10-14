# FStructure · propuestas de interfaz en código

Fecha: 14 de octubre de 2026.
Registro de entrega en la rama `plan/normas-y-mejoras-2026-10-14`. El código y su commit permanecen en `feature/propuestas-visuales-brandbook`.

La dirección inicial de nueve imágenes generadas se descartó por genérica. La persona aprobó la galería de nueve propuestas hecha con código a partir de la app y el brandbook oficiales. Esa aprobación cubre la exploración visual; no convierte las muestras en funciones de producto ni en resultados estructurales.

## Relación con el canon

El canon local está en `docs/brandbook/README.md` y `src/design-system/`: la marca FStructure usa la ménsula oficial de `brand.tsx`; las superficies, los colores de acción y señal, las escalas y los temas vienen de `tokens.css`; la tipografía local viene de `fonts.css`; los campos, botones y controles segmentados reutilizan `components/controls`. Las escenas del Inicio y los modelos 3D usan activos existentes. Las nueve vistas agregan un estudio de propuestas alrededor de ese sistema; no declaran una identidad o un sistema visual paralelo.

La galería mantiene papel y carbón como superficies, salmón de Análisis para acciones y las señales del dominio para diagramas. Los diagramas SVG representan geometría explícita, no ilustración fotográfica. En Noche, `src/proposals/proposals.css` asigna `--sc-color-text-muted` y `--sc-color-text-tertiary` a la tinta secundaria ya publicada (`#8b9599`) sólo dentro de `.proposal-gallery`, para las notas de esta vista. `src/design-system/tokens.css` y las fuentes no se modificaron.

## Las nueve vistas

| Vista | Alcance visible en la propuesta |
|---|---|
| Inicio | Mantiene las dos entradas oficiales: cálculo por separado y proyecto completo. Enumera las ocho herramientas y remite al taller oficial cuando no hay una vista propia. |
| Arranque 2D | Presenta cinco geometrías, generación de una viga con claro de muestra y el estado de dibujo. No implementa el editor ni el análisis de la app. |
| Viga continua | Alinea DCL y momento, separa extremos de las curvas y vincula ambos diagramas a un cursor de lectura. Los valores se identifican como muestra y la curva como esquemática. |
| Axial Pratt | Muestra una Pratt simétrica, geometría neutra y el axil N expresado en kN; la leyenda se puede abrir y cerrar. No hay cálculo asociado. |
| Revisión | Permite alternar Cumple, No cumple y Faltan datos, y mostrar todas las comprobaciones o sólo las pendientes. Los porcentajes y estados son demostrativos. |
| Proyectos | Incluye búsqueda, tipo y filtro de fecha. «Limpiar filtros» recupera los registros de muestra. La altura registrada se conserva: 411 px a 1440 px y 421 px a 390 px, en Día y Noche. |
| Corte de zapata | Sitúa M, d/2 y d desde la cara del pedestal, con cotas y presión; las referencias son desplegables. El esquema no calcula ni comprueba normativa. |
| Mesa móvil | Muestra 3D/Diseño, cuatro herramientas, selección, orientación y capas. Carga geometría de la suite en WebGL de forma diferida y usa escenas oficiales de respaldo. |
| Columna | Une campos con una sección que responde a base y peralte. Editar 35 cm actualiza la vista; «Proponer sección» enseña una alternativa de 40 × 45 cm marcada como muestra, no calculada. Los campos conservan unidades. |

La interacción se limita a la exploración: navegar y copiar enlaces, cambiar tema, filtrar muestras y ajustar controles locales. La ruta y el tema viajan en el fragmento de URL; el resto del estado vive en React en memoria. No se conecta con proyectos guardados ni con motores de cálculo. El texto de cada vista delimita los datos ilustrativos y remite la revisión estructural a la app oficial.

## Aislamiento y apertura

La galería entra por `proposals.html` y `vite.proposals.config.ts`; sus componentes están en `src/proposals/` y la salida del build se separa en `dist-proposals/`. No importa `App`, contextos de proyecto ni motores de cálculo, y no registra service worker ni usa workers, IndexedDB o `localStorage`. `ScenePreview` se solicita al abrir la vista 08 y limpia los recursos WebGL al desmontarse. La galería no se añadió a las rutas de la aplicación publicada.

La rama de código parte de `origin/main` / `52fdda8`. El commit de código es `09de120`. La documentación vive por separado en la rama del plan; capturas y registro visual están en `qa-artifacts/proposals/final/`. La entrada HTML lleva `noindex,nofollow`; el acceso descrito aquí es local. No se publicó la app ni se abrió un PR.

## Verificación y revisión

El lote final de capturas registra nueve vistas × Día/Noche × 1440/390 px: 36 entradas en `qa-artifacts/proposals/final/render-checks.json`, con `active: H1`, cero imágenes rotas y `overflow: false`. También existe `user-1280-home.jpg`, la captura de Home a 1280 px. `list-height-checks.json` guarda las cuatro mediciones de altura de Proyectos. La recaptura final incluye el estado de foco acordado.

El registro de código informa `npm run verify` con salida 0: typecheck, Oxlint sobre seis archivos, dos pruebas relacionadas y build de la app. `npm run build:proposals` terminó con salida 0. La verificación `npm run architecture:check` consta por separado. El alcance de `verify` se define en `scripts/verify.mjs`: siempre ejecuta typecheck; para cambios `.ts`/`.tsx` ejecuta Oxlint y `vitest related`; para cambios de configuración de build/package incluye build de la app. No se describe aquí un comando como si cubriera una comprobación que no contiene.

La revisión independiente dio **PASS limitado** a los dos hallazgos y la recaptura que evaluó. La pasada inicial señaló el recorte de una anotación redundante en Pratt y contraste insuficiente en Noche. Pratt se corrigió al retirar esa anotación y expresar el axil en kN; Noche usa la tinta secundaria oficial `#8b9599` en el alias local de la galería. El contraste medido en las superficies revisadas fue al menos 5.42:1. También se corrigió el estado de foco de las capturas. Este PASS cubre esos materiales y su recaptura; no es un nuevo audit global de interfaz.

El detector Impeccable señaló una transición de ancho, que se retiró, y un advisory de retícula que se acepta porque sólo cubre lienzos técnicos. No se reparó drift previo del brandbook ni se cambió el canon global.

## Comandos existentes

```sh
npm run dev:proposals
npm run build:proposals
npm run preview:proposals -- --port 5188
npm run verify
npm run architecture:check
```

`dev:proposals` abre Vite en `127.0.0.1:5187`; `build:proposals` compila TypeScript y genera la galería con su configuración; `preview:proposals` sirve ese build localmente. Para el gate de los cambios se usa `verify`; `architecture:check` comprueba las dependencias de foundation y la arquitectura de aplicación única. El resultado de la revisión estructural y el cálculo permanecen en la app oficial.

Abre [la galería en desarrollo](http://127.0.0.1:5187/proposals.html) o [el build compilado](http://127.0.0.1:5188/proposals.html). «Teléfono» permite comparar el formato móvil y «Ver sólo pantalla» reduce la galería a la propuesta. Cada vista conserva su enlace, por ejemplo `#view=column&theme=dark`.
