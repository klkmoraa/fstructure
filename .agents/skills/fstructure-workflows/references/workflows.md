# Flujos, persistencia e interoperabilidad

## Mutación y undo/redo

Preparar la mutación fuera de React cuando sea posible. Un comando declara descripción, modelo siguiente y si invalida análisis. Las transacciones de arrastre o edición continua crean una sola entrada coherente de historial. Deshacer/rehacer restaura el modelo y limpia selecciones/resultados incompatibles sin fabricar entidades nuevas.

## Persistencia y recuperación

El flujo canónico es normalizar → validar representación JSON finita y acíclica → serializar canónicamente → checksum → escritura con revisión esperada. Conservar recuperación y conflicto por proyecto. Un fallo de guardado no puede borrar la copia de trabajo ni desbloquear una revisión conflictiva sin reabrir la autoridad.

Probar siempre:

- proyecto actual y versión anterior;
- campos opcionales `undefined` emitidos por normalizadores;
- `NaN`, infinito, ciclos, arrays dispersos y objetos de runtime;
- dos escritores/revisiones en conflicto;
- recuperación después de bytes corruptos;
- abrir/guardar/reabrir sin pérdida de unidades o procedencia.

## Importación y exportación

Rechazar por tamaño antes de leer y por claims antes de descomprimir. Validar firma, rutas, duplicados, profundidad, ratio y tamaño total. Una extensión o MIME es una pista, no prueba.

- JSON/expediente: validar versión, checksum y coherencia entre payload, proyecto y resultados.
- PDF: tratarlo como documento/adjunto potencialmente hostil; no extraer un modelo si la procedencia nativa no se verifica.
- DXF: aceptar sólo las entidades/unidades planas documentadas; advertir omisiones y geometría no plana.
- Gmsh/FEM: aceptar únicamente el subconjunto 4.1 ASCII y formulaciones físicas implementadas.
- SVG/PNG/CSV/PDF/VTK: exportar desde el mismo modelo/resultado canónico y liberar recursos temporales.

## Enlaces 2D, 3D y FEM

El paso 2D→3D es explícito, versionado y con informe de pérdidas. No existe sincronización bidireccional automática. Cualquier futura ida/vuelta debe declarar mapeo de unidades, grados de libertad, releases, apoyos, cargas, materiales y entidades no representables.

## Privacidad y errores

Por defecto, archivos y métricas permanecen en el dispositivo. Antes de enviar un expediente a un companion o servicio, mostrar destino, contenido, finalidad y alternativa local. Ante cancelación o error, conservar el último estado válido y ofrecer reintento/recuperación; no silenciar un fallo de integridad.
