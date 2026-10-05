# Recorrido de uso · 2D, 3D y Diseño

Revisión del 4 de octubre de 2026 con `npm run dev` y el navegador de Codex. La segunda revisión adopta tres entradas y conexiones dentro de cada herramienta, según la elección del usuario.

## Atascos y cambios

| Lugar | Atasco | Cambio |
| --- | --- | --- |
| Bienvenida | Cuatro recorridos, presentación repetida y frases flotantes ocupaban espacio antes de trabajar. | Tres entradas: Modelar 2D, Modelar 3D y Diseñar un elemento. Recursos compactos y funciones en un desplegable cerrado. |
| 2D | Los pasos para cargar, analizar y continuar estaban dispersos. La clasificación del caso necesaria para Diseño quedaba escondida. | Siguiente paso visible y acceso a Casos de carga. La persona elige la categoría; no se modifica automáticamente. |
| 2D → 3D | Para extruir el marco había que entrar al 3D y buscar Traer del 2D. | Crear 3D desde este marco abre directamente la preparación. Reemplazar un 3D existente conserva la confirmación y Deshacer. |
| 3D | Tras transferir cargas de barra, el resumen mostraba cero cargas y la guía pedía añadirlas. | Lienzo, lista y guía cuentan tanto cargas nodales como cargas de barra. La lista permite localizar la barra cargada. |
| Diseño | El origen y las acciones importantes quedaban dentro de Datos; había instrucciones repetidas. | Origen permanente, datos, comprobaciones, propuesta, aplicación y regreso accesibles. Se recortó texto sin quitar los límites del cálculo. |
| Conexiones | Un formulario previo podía prevalecer sobre el modelo solicitado. | La entrada explícita desde 2D o 3D abre Estructura con el modelo correspondiente. La entrada independiente abre una viga suelta. |

## Evidencia en el navegador

- **Solo 2D:** marco de 6 m × 4 m, bases empotradas y carga de −12 kN/m en la viga. Reacciones verticales: 36 + 36 = 72 kN, igual a la carga aplicada. Los resultados se consultan sin cambiar de modo.
- **2D → Diseño:** caso clasificado como permanente; propuesta de secciones de 2.10 a 1.25 m³. Aplicar modifica el 2D y Deshacer recupera 2.10 m³.
- **2D → 3D → Diseño:** dos pórticos, separados 5 m: 8 nudos, 8 barras, 4 apoyos y 2 cargas distribuidas. Análisis 3D: suma de reacciones verticales de 144 kN. Diseño identifica Modelo 3D y su eje. Propuesta de 5.70 a 3.37 m³; Aplicar regresa al 3D. Después de salir al 2D y volver, Deshacer recupera 5.70 m³. El 2D conserva sus 4 nudos, 3 barras y carga original.
- **Herramientas independientes:** en la primera revisión se recorrieron Nuevo edificio con el 2D vacío y viga, columna, zapata y pórtico rápido sin modelo. En la segunda se revisan de nuevo las tres entradas y la fuente independiente de Diseño.
- **Pantallas:** bienvenida y mesas en Día/Noche; bienvenida y Diseño a 390 × 844. Origen y acciones visibles con paneles cerrados, sin desbordamiento horizontal.

## Verificación mínima

`npm run verify`: tipos y 133 pruebas relacionadas; tres selectores de texto antiguos se ajustaron y se repitieron sólo esos casos. También pasó `npm run architecture:check`.

Se modificó una prueba existente para comprobar que el acceso desde 2D abre la preparación sin escribir antes de confirmar. Se añadió una regresión para el conteo de cargas de barra en el 3D, observando primero el fallo y después el resultado correcto. Los casos dirigidos de persistencia/ruta pasaron, junto con tipos y lint de los archivos afectados. No se añadieron pruebas de estilo o copy. La publicación conserva la puerta de calidad obligatoria del repositorio.

Los borradores usan el documento existente, sin cambio de esquema. Deshacer/Rehacer se conserva entre modos durante la sesión; el historial no se conserva tras recargar. Las propuestas escriben sólo al pulsar Aplicar. Los límites experimentales permanecen visibles.

## Capturas

- [Inicio Día](brandbook/assets/flujo-inicio-dia.jpg) · [Inicio móvil](brandbook/assets/flujo-inicio-movil.jpg)
- [2D Noche](brandbook/assets/flujo-2d-noche.jpg) · [3D Noche](brandbook/assets/flujo-3d-noche.jpg)
- [Diseño desde 3D Día](brandbook/assets/flujo-diseno-dia.jpg) · [Diseño desde 3D móvil](brandbook/assets/flujo-diseno-movil.jpg)
- [Pórtico rápido independiente Día](brandbook/assets/flujo-elemento-dia.jpg)
