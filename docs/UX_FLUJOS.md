# Recorrido de uso · 2D, 3D y Diseño

Revisión del 4 de octubre de 2026, con `npm run dev`, en el navegador de Codex. Se trabajó con proyectos de prueba nuevos; no se alteraron los ejemplos ni los motores.

## Atascos encontrados y correcciones

| Flujo | Atasco observado | Cambio |
| --- | --- | --- |
| Bienvenida | Las rutas de trabajo se mezclaban con plantillas, importación y Aula; «Solver 2D» ocultaba el alcance de la mesa. En tableta, una columna ancha recortaba la última opción. | Cuatro elecciones explícitas al principio: Modelar 2D, Modelar 3D, Diseñar un elemento y Modelar y diseñar. Recursos después; anchura contenida. En móvil las cuatro elecciones caben en la primera pantalla. |
| Solo 2D | Lienzo vacío sin secuencia; los apoyos del generador estaban en un acordeón de colocación. Activar cargas sobre una selección múltiple dejaba el inspector estorbando el dibujo. | Guía permanente con el siguiente paso: generar/dibujar, apoyos, cargas, analizar y resultados. Apoyos visibles en el generador. Los accesos a apoyos/cargas limpian la selección y cierran el inspector. |
| Solo 3D | Había guía de creación y análisis, pero al llegar a resultados no se ofrecía la continuación a Diseño. | Modo y origen permanentes, acceso a resultados y «Diseñar los ejes». La creación de edificio sigue dentro del propio 3D. |
| Solo Diseño | La entrada podía recuperar el último formulario y su fuente, aunque se hubiera pedido un elemento independiente. El origen se perdía al cerrar Datos. | «Diseñar un elemento» abre una viga independiente. Viga, columna, zapata y pórtico rápido muestran su origen y acceso directo a Datos/Comprobaciones. |
| 2D → Diseño / 3D → Diseño | Un formulario suelto o pórtico rápido guardado podía prevalecer sobre el modelo solicitado. | La intención explícita abre Estructura con el modelo correcto; la banda identifica Modelo 2D o Modelo 3D y su eje. |
| Diseño → Proponer → aplicar → regresar | Proponer y el regreso quedaban dentro de Datos. El historial del 3D y de los formularios desaparecía al desmontar el modo. | Proponer, aplicar y regresar visibles en la banda. El historial se conserva por proyecto y formulario durante la sesión; Deshacer/Rehacer funciona después de salir y volver. |

## Recorridos comprobados

- **2D independiente:** proyecto vacío → marco de un vano de 6 m y altura de 4 m, bases empotradas → carga de −12 kN/m en la viga → análisis → diagramas y reacciones. Las reacciones verticales suman 72 kN, igual a la carga aplicada. El cambio de sección propuesto desde Diseño se aplicó y se deshizo en 2D.
- **3D independiente:** proyecto con 2D vacío → Nuevo edificio, un vano de 5 × 4 m y altura de 3 m → 8 nudos, 8 barras y 24 cargas → análisis → deformada, esfuerzos y resultados. Después se abrió el diseño de sus ejes.
- **Diseño independiente:** proyecto nuevo sin barras → bienvenida «Diseñar un elemento» → viga, columna, zapata y pórtico rápido → diagramas y comprobaciones, sin construir un modelo.
- **Conservación del formulario:** base de viga de 25 a 30 cm → salir al 2D → volver a Diseño/Viga → conserva 30 cm → Deshacer vuelve a 25 cm → Rehacer recupera 30 cm.
- **Puentes:** modelo 2D → Diseño y modelo extruido al 3D → Diseño → Proponer → aplicar las secciones → regresar. En 3D se salió y volvió antes de Deshacer; Rehacer siguió disponible. El test compara las propiedades completas con el modelo original y la propuesta.
- **Responsive:** Día/Noche y Diseño a 390 × 844; origen visible con paneles cerrados. Bienvenida móvil: las cuatro opciones visibles, sin recorte horizontal. También se corrigió y revisó el recorte del ancho de tableta.

## Verificación mínima

Se ejecutó `npm run verify` (tipos, lint y 151 pruebas relacionadas). Una prueba detectó la pérdida del historial del 3D al reabrir tras una propuesta; se corrigió la comparación entre borradores normalizados y se repitió únicamente ese caso, que pasó. También pasaron los casos dirigidos de entrada desde el modelo y navegación/bienvenida, la prueba de historial de formularios y `npm run architecture:check`. No se añadieron pruebas de estilo ni de texto. La publicación utiliza la puerta de calidad obligatoria del repositorio.

Los borradores siguen en el documento existente del proyecto, sin cambio de esquema. Deshacer/Rehacer se conserva entre modos durante la sesión; no se promete conservar el historial tras recargar el navegador. Las propuestas no escriben hasta pulsar Aplicar; los reemplazos conservan su confirmación. Los límites experimentales de cálculo y diseño permanecen visibles.

## Capturas

- [Inicio Día](brandbook/assets/flujo-inicio-dia.jpg) · [Inicio móvil](brandbook/assets/flujo-inicio-movil.jpg)
- [2D Noche](brandbook/assets/flujo-2d-noche.jpg) · [3D Noche](brandbook/assets/flujo-3d-noche.jpg)
- [Diseño desde 3D Día](brandbook/assets/flujo-diseno-dia.jpg) · [Diseño desde 3D móvil](brandbook/assets/flujo-diseno-movil.jpg)
- [Pórtico rápido independiente Día](brandbook/assets/flujo-elemento-dia.jpg)
