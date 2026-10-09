# Diseño para proyectos, piezas y aula

## Objetivo y autorización

Facilitar el trabajo de viviendas y edificios de concreto armado: diseñar el modelo completo, trabajar piezas independientes y resolver ejercicios de clase con datos editables. El usuario pidió una actualización grande, autorizó que decidamos y ejecutemos todo sin más consultas y pidió agentes `gpt-6-luna` con razonamiento `high`.

## Arquitectura

Conservar la mesa y los motores existentes. Añadir un catálogo de arranques y una entrada Proyecto / Pieza / Ejercicio al taller; reutilizar la memoria y los borradores por proyecto. La Home abrirá este selector y cambiar desde 2D/3D seguirá llevando directamente al modelo o al miembro elegido. Los puentes del workspace siguen siendo la única frontera con 3D.

El catálogo y las operaciones de memoria son independientes de la presentación. El diálogo usa Dialog, Tabs y controles del sistema de diseño. No añade dependencias, servicios, telemetría ni conexiones implícitas.

## Materiales y refuerzo

- Ofrecer resistencias habituales como valores sugeridos editables: f′c 150, 200, 250, 300, 350 y 400 kg/cm²; fy 2800, 4200, 5000 y 6000 kg/cm². No presentar esas cifras como equivalencias exactas de grados ASTM ni como permiso normativo. Mantener los valores existentes al abrir proyectos anteriores.
- Mantener el catálogo longitudinal #2.5–#11 y los filtros longitudinales existentes. Crear un catálogo transversal que además incluya #2, nominal 6.4 mm. Identificarlo correctamente en láminas, cantidades y memoria.
- El selector transversal se usa en vigas, columnas, pórticos, contratrabes y el estudio experimental de secciones. No cambiar los diámetros de la búsqueda automática.
- Columnas conservan sus comprobaciones normativas de diámetro. Una viga con diámetro transversal menor que 9.5 mm debe emitir una advertencia complementaria explícita de alcance: su aceptación normativa no está verificada. No inventar cláusulas, aprobar un diámetro no comprobado ni quitar fallos para habilitar la #2. La advertencia debe propagarse en estructura y contratrabes.
- Los diámetros de estribo y fy transversal de vigas/pórticos deben poder encontrarse sin desplegar Avanzado.

## Vigas y apoyos

Añadir rodillo explícito al contrato BeamEnd además de pin, fixed y free. Mantener el significado numérico de los ejemplos y borradores existentes. Un apoyo pin legado puede conservar la estabilización horizontal automática existente; el rodillo nuevo nunca restringe X. Debe existir un punto de estabilización horizontal: rechazar dos extremos roller si ninguno empotra o articula. Dibujos y memoria distinguen el rodillo, y coinciden con el modelo analizado.

Ofrecer configuraciones rápidas apoyada, empotrada–apoyada, doblemente empotrada, voladizo izquierdo/derecho y continua. La configuración de apoyos no debe borrar claros ni cargas existentes. Continua puede agregar un segundo claro cuando sólo hay uno; cualquier cambio debe ser deshacible. Mantener secciones rectangular, T y L y sus límites de ancho efectivo.

## Arranques

**Proyecto:** diseñar el Modelo 2D o los ejes del Modelo 3D existentes; ofrecer pórticos de ejemplo de vivienda de un nivel y edificio de tres niveles como datos iniciales editables. Cuando no exista un modelo utilizable, explicarlo y ofrecer crear/modelar con los controles existentes. El pórtico de ejemplo no sustituye el modelo sin la acción explícita ya existente.

**Pieza:** viga apoyada, continua, voladizo, T y L; columna rectangular/circular; cimentación aislada, corrida, combinada, de lindero y losa de cimentación; estudio de sección. Cada opción muestra qué datos abre. Las cimentaciones siguen con entrada manual: no anunciar asociación automática a apoyos del edificio.

**Ejercicio:** al menos viga simplemente apoyada, voladizo, carga puntual, columna, zapata y pórtico. Problema y supuestos visibles antes de elegir, datos precargados y editables después. Para ejemplos de estática de viga mostrar una referencia de servicio independiente de la norma: qL²/8, qL²/2 o PL/4 según corresponda; indicar si se omite peso propio. Conservar las comprobaciones y el alcance experimental en los resultados.

Los arranques de pieza/ejercicio conservan la norma actual. Cambiar de elemento continúa conservando sus borradores, sin inicializarlos otra vez.

## Protección de datos

Antes de un arranque que sustituya un borrador, conservar en memoria tanto el borrador abierto como el del tipo de destino si son distintos. Preservar también borradores con datos incompletos: la memoria puede recuperarlos aunque no calcule. No duplicar instantáneas equivalentes ni sobrescribir una pieza guardada al crear otra. Una memoria llena o sin presupuesto para conservar el trabajo aborta el arranque antes de cualquier escritura y deja los campos actuales intactos.

La operación usa el mismo formato de memoria v6, sus límites de 60 piezas y sus presupuestos totales de tamaño; no se necesita migración destructiva. El límite de campos por registro pasa de 64 a 96: el formulario de cimentaciones ya tiene 79 campos y el límite antiguo impide guardarlo completo. Abrir una entrada existente y guardar como nuevo mantienen el comportamiento actual. El diálogo puede cerrarse para continuar el trabajo vigente. El acceso Nuevo diseño existe también en teléfono y en la vista aislada usada por pruebas.

## Validación y entrega

Pruebas significativas de nuevos apoyos con soluciones analíticas, advertencias de #2 y mínimos de columna; valores de materiales y conversiones; cada receta calcula con el motor previsto; creación de piezas preserva borradores y aborta de manera atómica al llenarse la memoria. Reabrir un proyecto conserva las piezas y su norma. Verificar la entrada de la Home, el acceso desde modelos, navegación por teclado, claro/oscuro y móvil, sin desbordamiento horizontal.

Ejecutar npm run verify y npm run check. Actualizar documentación del taller, TODO y ficha/capturas de marca. Hacer revisión independiente, commit y push a main según AGENTS.md únicamente tras las comprobaciones. No usar force push ni descartar cambios remotos.

## Alcance de esta actualización

La actualización amplía el trabajo con los motores de concreto actuales. Nuevos motores de acero estructural, losas, muros, resortes 3D y torsión resistente requieren evidencia y desarrollo propio; quedarán enumerados en TODO, sin añadir selectores que simulen verificaciones inexistentes.
