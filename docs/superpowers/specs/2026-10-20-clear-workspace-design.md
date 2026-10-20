# FStructure: una mesa más clara

## Objetivo

Simplificar la interfaz existente para empezar, dibujar y leer resultados con menos controles y texto permanentes. El usuario delega las decisiones y pide publicar la actualización; AGENTS.md indica actuar, verificar y actualizar main.

## Decisiones

- Home: proyecto abierto y recientes primero; herramientas compactas, sin hero decorativo antes de las acciones.
- Mesa 2D: Seleccionar, Nodo, Barra y Apoyo visibles; Carga reúne sus tres tipos; Más reúne operaciones ocasionales. La herramienta activa sigue identificable y se conservan atajos, generador y edición de selección.
- Móvil: selector nativo del modo en una única fila; historial disponible en Más. Analizar sigue siendo la acción principal. No duplicar el control del Inspector en escritorio.
- Inicio 2D: cinco estructuras y dibujo libre, con títulos breves y sin instrucciones repetidas.
- Armaduras: reutilizar `MemberResult.trussState`, N positivo en tensión y negativo en compresión. Mostrar estado y magnitud en la unidad elegida, con patrón y texto además de color; leyenda compacta y selección desde resultados.
- Los resultados son derivados del análisis vigente. Un resultado ausente, fallido, no fiable o no finito no se presenta como barra sin esfuerzo. No pintar la lectura durante edición ni encima de las filas de diagramas.

## Límites

Conservar marca, temas Día/Noche, accesibilidad de teclado y funciones existentes. No cambiar motores, esquemas guardados ni límites entre territorios. Sin dependencias nuevas ni red desde la aplicación. El estado axial no es una comprobación de resistencia ni pandeo.

## Verificación

Pruebas de comportamiento para acceso a herramientas/selector y resultados axiales. Triángulo 3–4–5: AB = +22.5 kN y AC/BC = −37.5 kN. `npm run verify`, `npm run check`, smoke en 1440/390 Día/Noche y recorrido de armadura/menús/modelo editado. Actualizar capturas y ficha de marca, README y TODO.
