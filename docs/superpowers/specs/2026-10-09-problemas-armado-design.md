# Problemas propios y armado visible

La persona trae un enunciado: una sección, sus materiales y acciones. Necesita calcular y ajustar su acero, sin elegir un ejemplo resuelto ni perder su sección. La mesa actual reparte estos datos entre demasiados grupos y algunas propuestas cambian las dimensiones.

## Decisión de interfaz

Una ficha editable, sin asistente de pasos. Primero «Datos del problema» (geometría, recubrimiento, materiales y acciones); enseguida «Acero y distribución», junto al dibujo y resultado. Identificación, hipótesis de esbeltez, factores y detalles menos frecuentes se abren bajo demanda. Las unidades, el método, la base de acciones y el alcance permanecen visibles. La vista móvil conserva entrada, dibujo y resultado accesibles.

Aula ofrece resolver una sección con acciones dadas o construir un modelo vacío. Se retiran sus tarjetas de ejemplos y el selector de ejemplos del diálogo de ejercicio. El inicio Ejercicio de Diseño ofrece tres formularios: sección con N/M dados, columna con Pu/Mux/Muy dados y viga con claros/cargas propios. Se vacían sus dimensiones, materiales y acciones imprescindibles; cero explícito sigue siendo una acción válida. Las hipótesis y controles de configuración tienen valores iniciales identificables, pero no hay una respuesta calculada antes de capturar el problema. Los proyectos y piezas guardados, incluso los antiguos ejercicios, se conservan.

Se retira la guía de vigas con respuestas de ejemplos y el selector de presets que reemplaza los datos de una sección. No se elimina el campo heredado `exercise` ni los lectores de documentos existentes.

## Acero con geometría fija

«Proponer acero» conserva sección, materiales, acciones y recubrimiento. En columna busca diámetros del catálogo y cantidades por cara, usando el motor normativo existente. «Proponer sección» queda como acción distinta y explícita. En Estudio de sección se puede buscar sólo el diámetro elegido o el catálogo; muestra As propuesta, cantidad, diámetro y utilización real del modelo. No se llama «As requerida» a un mínimo discreto entre candidatos.

Una configuración manual congestionada puede corregirse con una propuesta si el resto de los datos es válido. Una búsqueda sin solución no cambia el borrador. El cálculo pesado usa un worker; editar, cambiar norma, desmontar o cancelar invalida la búsqueda y descarta cualquier respuesta antigua. No añade dependencias ni comunicaciones externas.

## Distribución real

Se corrige el lecho de viga en dos capas: cálculo de centroide y dibujo deben utilizar las mismas barras, diámetros e identidades. Barras continuas que pasan a la segunda capa no se convierten en refuerzo adicional y no causan un fallo de dibujo. Se mantienen los límites actuales de dos capas y las separaciones del motor.

Estudio de sección añade «Grupos separados» en rectángulos y cuadrados. Cada esquina tiene 1–3 barras; cada centro de cara 0–3. Son posiciones individuales con separación libre, nunca círculos superpuestos ni paquetes en contacto. El total es 4 × (barras por esquina + barras por centro de cara). El dibujo, la resistencia y las cantidades usan esas mismas coordenadas. El paso entre centros es diámetro + separación libre geométrica requerida. Las caras y las esquinas conservan simetría. Las combinaciones que no caben se rechazan.

El máximo de tres por grupo es una preferencia de acomodo solicitada. No hay evidencia verificada en el registro de fuentes que lo convierta en un límite normativo universal. Los extractos registrados NTC 2023 §14.2.1/14.2.3, NSR C.7.6.1/.3 y E.060 §7.6.1/.3 sí respaldan separaciones entre barras; los paquetes reales necesitan otras comprobaciones. El laboratorio mantiene su condición Experimental y no se amplía a un diseño normativo de paquetes, cortante, confinamiento o flexión biaxial.

## Compatibilidad y límites

- Español; actuar sin preguntas; agentes Luna con razonamiento alto; commit en main y push tras verificación.
- Node 24, React 19 y TypeScript existentes; ninguna dependencia nueva.
- Cero pérdida de datos: documentos v1–v6 y borradores heredados siguen abriendo; iniciar un formulario propio usa el resguardo existente de memoria.
- Nada sale del dispositivo sin acción explícita; sin telemetría ni red implícita.
- Home ligera, diálogos y mesa lazy; fronteras 2D/3D intactas.
- Resultados derivados se invalidan al editar; nunca aplicar una propuesta calculada con entradas anteriores.
- Las formas no rectangulares conservan las distribuciones existentes; no adquieren grupos ficticios.
- Los dibujos y PDF deben reflejar los datos propios, los grupos y el alcance experimental.

## Evidencia de aceptación

Una sección rectangular capturada conserva dimensiones y cargas al proponer acero; una sección congestionada se puede corregir o informa que no cabe. Una columna rectangular y una circular conservan dimensiones con la propuesta de acero. Una viga con seis barras continuas en dos capas calcula un centroide de referencia y dibuja seis barras sin extras inventados. Un ejercicio incompleto no publica resultados ni se rellena con un ejemplo. Se guarda y reabre junto con una pieza anterior; un documento inválido deja el trabajo intacto. Se revisan Día/Noche y móvil, grupos de hasta tres, búsquedas canceladas, memoria y PDF. Pasan pruebas relacionadas, arquitectura, oráculos y el gate completo antes de publicar.
