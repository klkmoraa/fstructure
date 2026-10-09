# Diseño: piezas organizadas y ejercicios acompañados

## Intención y alcance

Continuar la ampliación de Diseño para viviendas y edificios de concreto armado, piezas independientes y tareas de clase. La persona pidió investigar, proponer y ejecutar sin preguntas; esta entrega elige mejoras del flujo existente, no nuevos motores normativos. Se mantienen los agentes Luna con razonamiento alto.

La investigación del código y de `docs/research/concrete-design/CONCRETE_DESIGN_RESEARCH.md` encontró que el PDF ya reúne estados y cantidades, pero Memoria no permite localizar ni seleccionar piezas. La referencia de los ejercicios desaparece al cerrar el selector. Además, sólo `start` comprueba el presupuesto del documento completo antes de cambiar datos.

Se compararon tres caminos: ampliar familias de cálculo (requiere evidencia normativa nueva), agregar más recetas similares (aporta poco frente a las 23 existentes) y mejorar organización/recuperación/aprendizaje. Se elige el tercero por su utilidad inmediata y porque utiliza cálculos ya comprobados.

## Memoria segura

Todas las mutaciones del hook comprueban forma, límite de 60 piezas, presupuesto de memoria de 180,000 caracteres y `storage.canWrite` del documento completo antes de cambiar estado o escribir. Se mantienen 240,000 caracteres, 16 entradas, 96 campos y compatibilidad v1–v6. El almacenamiento del navegador conserva su política existente ante indisponibilidad; no se promete una transacción física entre claves de localStorage.

Abrir una pieza conserva las instantáneas diferentes del borrador actual y del borrador destino, aunque no calculen, con la norma vigente antes del cambio. No reemplaza piezas guardadas y deduplica con la comparación existente. Si no cabe, deja todo intacto y mantiene el diálogo abierto. Las filas/niveles omitidos de registros antiguos se cargan con sus defaults, evitando datos residuales de otra pieza. Se retira la confirmación que ofrecía descartar cambios: la apertura es conservadora por defecto.

Duplicar una fila guarda una copia de sus campos, filas, niveles y norma, con nuevo id/fecha y clave única de hasta 32 caracteres. No abre la copia ni cambia la asociación activa. El sufijo comienza en « · copia» y continúa « · copia 2», etc. Las fuentes de modelo conservan su vínculo al modelo vigente: se copian datos, no modelos.

## Organización y entregas

Extraer la interfaz de Memoria a un módulo propio; el hook sigue concentrado en persistencia y recuperación. La lista ofrece búsqueda por clave, ubicación, título y norma, sin distinguir mayúsculas ni tildes; filtros de tipo, norma y estado. Estados: cumple, revisión pendiente, no cumple y datos incompletos. «Cumple lo evaluado» sigue declarando el alcance parcial.

El resumen muestra conteos del conjunto guardado. Buscar/filtrar no cambia datos ni el conjunto exportado por omisión. Las filas calculables tienen selección accesible; hay acciones para seleccionar las visibles y limpiar selección. La selección permanece al cambiar filtros, se depura al quitar piezas y no permite seleccionar registros que no calculan. Se distinguen claramente «Exportar memoria (N)» y «Exportar selección (N)»; ambas usan el exportador actual. La selección mantiene el orden de Memoria e incluye sólo ids elegidos calculables. Ningún filtro exporta un subconjunto en silencio. Lista vacía y búsqueda sin coincidencias tienen mensajes diferentes y un atajo para limpiar filtros.

Duplicar está disponible en cada fila, incluso incompleta. Un rechazo de capacidad muestra un aviso concreto sin modificar la lista. Abrir, guardar, guardar como nuevo y quitar siguen disponibles. Los controles siguen el sistema de diseño, teclado, tema oscuro y teléfono; el diálogo no desborda horizontalmente.

## Aula: tres casos de viga

Agregar el campo corto `exercise` con default vacío al borrador de viga. Las tres recetas analíticas guardan su id en ese campo; las recetas de piezas mantienen el valor vacío. No se añade una entrada al documento ni se cambia la versión. Al guardar/reabrir, la guía permanece. Una acción «Ocultar guía» limpia sólo ese campo y es deshacible mediante el historial actual.

La guía conserva el problema inicial y sus hipótesis, y calcula una referencia para los valores actuales cuando siguen correspondiendo al caso idealizado:

- Simple: un claro, apoyos simples estables, sin peso propio ni cargas puntuales; q = CM + CV y |M| = qL²/8. Inicio L=5 m, q=10 kN/m: 31.25 kN·m.
- Voladizo: un claro, empotre/libre, sin peso propio ni cargas puntuales; |M| = qL²/2. Inicio L=2 m, q=5 kN/m: 10 kN·m.
- Puntual: un claro con apoyos simples estables, sin peso propio ni cargas uniformes, una puntual al centro; P = P CM + P CV y |M| = PL/4. Inicio L=4 m, P=10 kN: 10 kN·m.

Se muestra la fórmula, sustitución/unidades, momento de servicio calculado por `analyzeBeam`, y diferencia absoluta en kN·m. Se suman las respuestas muertas y vivas por estación antes de obtener la magnitud máxima; no se compara contra Mu factorizado. Cambios de L/q/P actualizan ambos valores. Si se cambia la hipótesis (peso propio, apoyos, varios claros, punto fuera del centro u otras cargas), se explica qué cambió y se suspende la comparación. Datos incompletos no producen cero ni una respuesta anterior. La concordancia elástica no cambia el estado normativo del elemento. La guía pertenece a la interfaz de estudio en esta entrega; el PDF existente conserva el diseño y sus datos, sin prometer exportar la guía.

## Validación y entrega

Pruebas conductuales primero: abortar mutaciones por límite total, guardar/reabrir borradores incompletos sin pérdida, copiar filas sin afectar el activo, filtros y selecciones que no alteren el PDF completo, referencias del solver con tolerancia 1e-6 y suspensión de referencias incompatibles. Navegador real en Día/Noche y 390 × 844, guardado/recarga, archivo inválido y PDF de selección. Actualizar documentación, TODO y ficha/capturas del brandbook. Revisión por tarea y final, `npm run verify`, `npm run check`, commit/push a main en fast-forward y comprobación del despliegue.
