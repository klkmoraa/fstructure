# Task 2 — Catálogo de arranques y conservación de piezas

## Entrega

- `designStarts.ts` exporta `DesignStartCategory`, `DesignStart` y 23 recetas: 4 de Proyecto, 13 de Pieza y 6 de Ejercicio. Incluye Modelo 2D/3D, pórticos editables de vivienda de un nivel y edificio de tres niveles, las familias de vigas/columnas/cimentaciones/sección del spec y seis ejercicios.
- Las recetas parten de copias de los defaults vigentes. Las tres referencias analíticas de viga declaran cargas, apoyos y omisión de peso propio; los demás ejercicios describen sus hipótesis y no garantizan cumplir.
- `DesignMemory.start` captura los borradores existentes actual y destino, incluso incompletos, antes de reemplazarlos; no materializa defaults sin borrador. Deduplica una pieza equivalente por elemento, norma y datos, preflighta el límite de 60 piezas y 180,000 caracteres antes de cualquier write, luego limpia la asociación activa y aplica el arranque. Los inicios de fuente conservan todos los campos del pórtico y sólo cambian `source`; no escriben el código ni modifican el modelo.
- `MAX_FIELDS` sube de 64 a 96. Se mantienen el tamaño total de documento (240,000), las 16 entradas, 8 filas, 60 piezas y el presupuesto de memoria.

## Verificación

- Rojo inicial observado: faltaba el módulo `designStarts`, no existía `start`, y el roundtrip rechazaba los 79 campos de `FOOTING_DEFAULTS` con el límite de 64.
- `npm test -- src/features/design/workbench`: 19 archivos, 121 pruebas aprobadas. Incluye recetas enviadas a sus motores; el solver de vigas reproduce 31.25, 10 y 10 kN·m con tolerancia de 1e-6.
- `npm run typecheck`: aprobado.
- `npm run lint`: código de salida 0; reportó advertencias preexistentes en otros archivos del repositorio.
- `git diff --check`: aprobado.

## Cobertura de riesgos

Las pruebas comprueban borradores incompletos actual y destino, equivalencia con piezas guardadas y claros por defecto omitidos en documentos antiguos, ausencia de piezas fantasma, abortos sin writes por capacidad y presupuesto, independencia y reapertura de piezas, y conservación de materiales/código en arranques de fuente. Storage hace roundtrip de los 79 campos de cimentación tanto como borrador como memoria, rechaza registros de 97 campos y lee versiones v1–v6.

Las fuentes de modelo requieren un Modelo 2D/3D disponible para calcular; su receta conserva la intención de entrada. La aprobación estructural de ejemplos depende de los datos editables y no se promete.

## Archivos de Task 2

- `src/features/design/workbench/designStarts.ts`
- `src/features/design/workbench/designStarts.test.ts`
- `src/features/design/workbench/designMemory.tsx`
- `src/features/design/workbench/designMemory.test.tsx`
- `src/features/design/workbench/workbenchStorage.ts`
- `src/features/design/workbench/workbenchStorage.test.tsx`
