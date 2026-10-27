# Encuadre móvil y selección — plan de implementación

> Ejecución directa con Superpowers; Codex vuelve a indicar Not logged in.

**Goal:** abrir y encuadrar modelos largos en móvil sin recortes, y ofrecer acciones de selección comprensibles y reversibles.
**Architecture:** corregir la escala mínima de encuadre y zoom en las funciones geométricas existentes; conservar sus llamadas de apertura y no introducir efectos de reencuadre durante edición. El dock conserva sus acciones y expone etiquetas visibles. Deshacer/Rehacer queda accesible junto a las herramientas sin cambiar el historial del modelo.
**Tech Stack:** React/TypeScript/CSS, Vitest, Playwright Chromium/WebKit.
**Spec:** continuación del bloque aprobado en la conversación. Base 2bd4a6265a1f3d06b6fae173f9fa5fda085afa9f.

## Restricciones
No solver, geometría estructural, unidades, rutas, dependencias de producto ni datos guardados. No mover cámara al añadir nodos, arrastrar, abrir campos ni cambiar selección. Retener cámaras manuales al cambiar de modo; el nuevo fit se usa en apertura y por petición explícita. Clay discreto, dos temas, objetivos táctiles >=44px.

## Tareas
- [x] Reproducir viga de 13m a 320px y zoom tras ajustar; pruebas antes del cambio.
- [x] Ajustar límites de cámara y verificar cargas/decoración/modelos grandes.
- [x] Acciones con texto y acceso local a Deshacer/Rehacer; no añadir otro nivel de menús ni ocultar funciones.
- [x] Recorridos reales: abrir, ajustar, seleccionar, editar, eliminar/deshacer, analizar, recargar y rotar. WebKit se ejecutó en emulación, no en iPhone físico.
- [x] check, verify, lint:design y smoke. Ocho hashes de código/pruebas comprobados. Ficha y captura en docs/brandbook/mobile-fit-selection-2026-10-26.md.
- [ ] Confirmar CI, publicación y recorrido en la web pública después de actualizar main.

## Decisiones de revisión
El encuadre inicial existente es suficiente al corregir su mínimo de escala. No se añade un reajuste continuo que contradiga la manipulación manual. Para recuperar una eliminación se usa el historial actual en el dock, no una notificación con una referencia de deshacer que pueda quedarse obsoleta. Las pruebas de WebKit esperan la medición real del SVG; el botón Analizar puede aparecer antes de que el lienzo haya terminado de medirse.
