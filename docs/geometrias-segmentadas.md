# Geometrías segmentadas — estado experimental

Esta rama incorpora tres familias en el núcleo `generateStructure`:
- `circular-arch`: claro, flecha y divisiones (2–200). El arco menor/semicircular admite flecha > 0 y <= claro/2; extremos en (0,0) y (claro,0).
- `circular-ring`: radio y divisiones (3–200). El último miembro cierra contra el primer nudo sin duplicarlo. No se asignan apoyos implícitos.
- `pitched-portal`: claro, alturas izquierda/derecha y cumbrera opcional dentro del claro y por encima de ambas columnas.

Todas las familias usan `GeneratorMemberProperties`, el origen opcional, el validador estructural, la misma política de IDs y el límite de entidades. Son **aproximaciones por barras rectas** y no elementos finitos curvos.

## Pendiente antes de habilitar en la interfaz
1. Añadir las tres opciones al formulario de generación, con controles y validaciones en español.
2. Usar `prepareStructureGeneration` y `applyPreparedStructureGeneration` para vista previa y confirmación con un solo undo.
3. Revisar los apoyos de anillos, que requieren una decisión explícita del usuario.
4. Comprobar el análisis con un caso de referencia y refinamiento de malla, incluidos esfuerzos, desplazamientos y reacciones.
5. Revisar el paso a 3D y Diseño: las subdivisiones geométricas no deben convertirse automáticamente en conexiones de piso ni en diseño completo de un arco.
6. Probar escritorio y móvil, claro/oscuro, guardar/reabrir, importación y CI.

**No declarar las geometrías como listas para producción ni fusionar automáticamente** sin ejecutar las pruebas y revisar el resultado visual. El análisis estructural sigue siendo experimental.
