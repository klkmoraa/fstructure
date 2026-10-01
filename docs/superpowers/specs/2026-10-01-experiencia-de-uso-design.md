# Experiencia de uso de FStructure

El usuario pide mejorar cómo se usa cada apartado, sección y control de la app.
La revisión se hace sobre los flujos existentes, con el canon visual actual.
`AGENTS.md` autoriza decidir sin preguntas y publicar una vez verificado.

## Hallazgos comprobados

- Las cuatro mesas conservan su aislamiento y su propia bienvenida.
- El nombre del proyecto abre un formulario que no se cierra con Escape ni
  devuelve el foco al control al guardar o cancelar.
- Los controles compactos dependen de iconos y de pistas al pasar el puntero.
- En las bienvenidas de 3D/FEM/Diseño, `/` se anuncia junto al buscador pero
  no enfoca la búsqueda; Inicio tampoco desplaza el contenido.
- Los recientes de esas herramientas muestran geometría y conteos de 2D.
- Las recuperaciones llenan la bienvenida con decenas de decisiones idénticas.
- El menú 3D se desplaza horizontalmente y oculta opciones en teléfonos.
- FEM muestra un recorrido estático; el documento y sus campos calculados
  existen pero no se pueden consultar en la mesa.
- Diseño calcula al editar, pero no explica ese comportamiento; un error al
  copiar la memoria queda sin respuesta visible.

## Diseño elegido

Mejorar los controles y las vistas actuales por herramienta. Una reforma del
shell completo aumentaría el riesgo sobre navegación y persistencia; una guía
sola dejaría los apartados FEM sin acceso a sus datos. Se combina orientación
breve y contextual con correcciones funcionales de los recorridos existentes.

1. **Común:** ayuda específica de la herramienta con pasos, nombres de botones
   y gestos reales. Disponible en las cuatro barras; se cierra con Escape y
   devuelve el foco. Renombrar también conserva foco y permite cancelar.
2. **Entrada y proyectos:** Inicio vuelve al principio; `/` enfoca buscar y
   Escape cierra navegación/búsqueda. Recientes aislados enseñan metadatos
   del archivo, sin atribuirles geometría 2D. Las recuperaciones se consultan
   desde un desplegable que conserva todas las copias y decisiones.
3. **2D:** los controles compactos conservan nombres y pistas al enfocar;
   la guía explica dibujar, apoyos, cargas, cálculo, resultados y exportación.
4. **3D:** menús accesibles sin desplazamiento horizontal en teléfono y paneles
   de comandos que caben en el ancho. Ayuda sobre selección, asignación y vistas.
5. **FEM:** vistas Modelo, Malla y Resultados; material, apoyos y cargas reales;
   malla SVG del documento; tensiones y desplazamientos con tablas y unidades.
   La vista de resultados explica la falta de análisis o su diagnóstico.
   Una importación inválida conserva el estudio anterior.
6. **Diseño:** explicar cálculo automático, datos y alcance del veredicto;
   permitir volver a Datos cuando hay valores inválidos; responder al error
   del portapapeles; exportar, memoria y paneles siguen usando su lógica actual.

## Restricciones y aceptación

- React/TypeScript/CSS existentes, sin dependencias adicionales.
- Mantener las cuatro herramientas aisladas y el almacenamiento local.
- No cambiar solvers, unidades internas ni alcance normativo.
- Usar los tokens del canon; resultados con sus señales, sin rojo de acción.
- Controles táctiles de al menos 44 px en los recorridos modificados.
- Teclado, foco visible, Escape y movimiento reducido respetados.
- No borrar ni reemplazar datos del usuario durante la revisión.
- Pruebas de comportamiento para foco, navegación, importación y resultados;
  inspección visual para copy/CSS, sin pruebas que congelen el estilo.
- `npm run verify`, `npm run check`, revisión en claro/oscuro y móvil;
  capturas y ficha actualizadas en `docs/brandbook/`.
- Commit y push a main tras verificar; comprobar el despliegue de Pages.
