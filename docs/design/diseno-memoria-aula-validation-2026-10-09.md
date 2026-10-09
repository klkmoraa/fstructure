# Validación: Memoria organizada y Aula

Continuación del 9 de octubre de 2026. La ampliación parte de los 23 arranques entregados anteriormente y trabaja sobre los motores y normas actuales. La investigación de producto y código priorizó recuperar y organizar piezas y separar referencias elásticas de servicio del estado normativo del diseño.

## Recuperación y copias

Las pruebas de Memoria cubren forma, ids únicos, 60 piezas, 180,000 caracteres y preflight del documento completo, manteniendo 240,000 caracteres, 16 entradas, 96 campos y lectura v1–v6. Hay fixtures válidos cerca de los límites que comprueban rechazo sin escrituras, persistencia ni cambio del activo. Abrir conserva borradores actual y destino; registros antiguos con filas o niveles omitidos reciben sus defaults y no heredan datos de otra pieza.

Chromium real comprobó un proyecto de concreto con diez barras y piezas V-01, Z-01 y C-01. Al dejar f′c de C-01 vacío y abrir V-01, quedó una instantánea incompleta recuperable y la columna originalmente guardada permaneció intacta. Duplicar Z-01 creó «Z-01 · copia» sin abrirla, sin cambiar el borrador V-01 de base 34 cm y sin alterar el modelo. Recargar conservó el borrador.

La copia conserva filas, niveles, norma y fuente; el id/fecha/clave son nuevos. Las copias desde el modelo siguen vinculadas al modelo vigente. La protección de presupuesto no representa una transacción física entre claves de localStorage cuando el navegador no ofrece almacenamiento.

## Organización y PDF

Chromium comprobó la búsqueda, filtros de tipo y ausencia de coincidencias con restablecimiento. Se seleccionó V-01, se ocultó mediante búsqueda, se agregó Z-01 y se filtró después a columnas: las dos selecciones permanecieron y el botón completo siguió indicando cuatro reportes. Duplicar V-01 desde la fila no cambió C-01 como pieza activa; la copia apareció de nuevo después de recargar.

Se descargaron y extrajeron los textos de ambos PDF: la selección tiene 12 páginas y contiene V-01/Z-01, sin C-01; la memoria completa tiene 27 páginas y contiene las tres piezas y la estructura del modelo guardada. Los filtros no modificaron el conjunto completo ni el orden de la selección.

Escritorio 1440 × 1000 y teléfono 390 × 844 en Día/Noche: sin errores de página ni desbordamiento horizontal del diálogo o la tabla; acciones de fila de 40 × 40 px en teléfono. Las capturas se tomaron después de terminar la animación del diálogo para mostrar su estado estable, y se revisaron visualmente.


## Referencias vivas de Aula

Chromium real comprobó los tres arranques: viga simple 31.25 kN·m, voladizo 10 kN·m y puntual centrada 10 kN·m, con referencia y solver iguales en pantalla. Al editar la viga simple a L = 6 m y CM = 12 kN/m, ambos mostraron 54 kN·m; al agregar CV = 2 kN/m al voladizo, ambos mostraron 14 kN·m. Las pruebas de solver usan tolerancia de 1e-6 y también cubren CM + CV puntual, geometría rectangular/T, hipótesis incompatibles y datos inválidos.

La comparación suma respuestas CM/CV por estación antes de extraer el máximo absoluto. Las familias compatibles de estos tres ejercicios comparten la distribución espacial de ambas cargas: sus fixtures no distinguen una regresión que sumara picos independientes; el código revisado sí conserva el orden correcto. Una combinación de distribuciones diferentes queda fuera de las hipótesis comparables de estas referencias.

Activar peso propio suspendió la comparación con explicación y retiró las cifras; dejar L vacío conservó la guía con «Datos incompletos», sin una referencia caducada. Restaurar los datos recuperó 54 kN·m. Ocultar/deshacer, recargar y abrir Aula-01 desde Memoria recuperaron el ejercicio. Una pieza de viga común no mostró guía. El identificador guardado fue `exercise-beam-simple`; el modelo mantuvo sus diez barras.

Día/Noche en 1440 × 1000 y 390 × 844: guía sin desbordamiento horizontal, sin errores de página y capturas revisadas visualmente. En teléfono se comprobó el acceso mediante Datos. La referencia es educativa de servicio; no agrega un estado de aprobación normativa y no se incluye en el PDF de diseño.

## Importación inválida

En el mismo proyecto, se entregó un JSON `{"broken":true}` al importador real. Mostró «el archivo debe contener las listas nodes y members»; se comparó el modelo antes/después mediante JSON canónico: permaneció intacto, con nueve nodos y diez barras, sin errores de página.


## Cierre de revisión

Las revisiones independientes por tarea y la revisión integral detectaron una expectativa de apertura antigua, el lookup heredado de ids de ejercicio, una brecha de cobertura de selección y una nota de compatibilidad desactualizada. La prueba de apertura ahora verifica el respaldo automático; el evaluator sólo acepta ids propios del catálogo. Chromium abrió y recargó documentos válidos con `constructor`, `toString`, `__proto__` y `hasOwnProperty`: sin guía, sin errores de página y conservando diez barras. La regresión de Memoria cambia una fuente Modelo 2D válida a ausente y de vuelta: la fila inválida se excluye de ambas exportaciones y su selección no reaparece sola al recuperar la fuente. La nota de persistencia distingue v5/v6 y lectura v1–v6.

«Ocultar guía» mide 85.5 × 40 px en teléfono; las acciones de fila de Memoria miden 40 × 40 px. Los informes de revisión no ejecutaron suites: la verificación reproducible corresponde a los comandos del gate y a Chromium real, cuyos resultados se registran a continuación.


## Verificación automática

- `npm run verify -- dacd6699eb343376fe66e47d63b9eac50678d921`: salida 0; typecheck, lint de 19 archivos, 38 suites/318 pruebas relacionadas y 5 referencias del oráculo Python aprobadas.
- `npm run check`: salida 0; lint, TypeScript, comprobación de fronteras, 20 pruebas de arquitectura, 167 suites/1,168 pruebas, 5 referencias del oráculo Python y build Vite aprobados.
- `git diff --check`: salida 0. Las capturas y el diálogo se revisaron en Chromium real, Día/Noche y teléfono; ambos PDF se descargaron y sus contenidos se verificaron.

Los gates mantienen avisos existentes de lint, canvas no implementado en jsdom e importación dinámica/tamaño de chunks durante build; no fallaron los comandos y el navegador real no registró errores. No se añadieron dependencias ni nuevas ecuaciones normativas. La revisión integral y su única rerevisión acotada cerraron los hallazgos implementables; el alcance de los fixtures CM + CV queda documentado arriba.

La publicación usa el workflow existente: `main` → gate de calidad → commit `deploy: <SHA de main>` en `gh-pages`. La entrega se cierra tras confirmar ese commit remoto con `FETCH_HEAD`.
