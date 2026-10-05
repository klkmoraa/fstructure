# FStructure · Sistema de diseño

Brandbook de la familia de FStructure, derivado del brandbook global de FusionStructure.
Abre `index.html` en el navegador: siete fichas (sistema, logos, Día y Noche,
componentes reales, interfaces, herramientas y auditoría).

- `logos/`: marca de FStructure — la ménsula con la franja en el color de su familia (Día, Noche e icono de app).
- `assets/`: capturas de la app en Día y Noche.
- Ficha de interfaces y capturas de las cuatro mesas actualizadas el 1 de octubre de 2026: [guía en móvil](assets/guia-movil.png), navegación, vistas FEM y revisión de datos de Diseño.
- Capturas de Diseño en Día/Noche actualizadas el 3 de octubre de 2026 con el Pórtico (vigas y columnas juntas, envolvente de momento sobre el marco y matriz de miembros). La ficha refleja el quinto elemento y el cursor de lectura de los diagramas.
- Capturas de Inicio, FStructure 2D y Diseño actualizadas el 3 de octubre de 2026 con la fusión Modelo 2D → Diseño: fila «Modelar y diseñar» en el Inicio, botón «Diseñar» en la barra del 2D (plantilla «Pórtico de concreto») y la mesa Estructura diseñando ese modelo. Las bandas de diagrama y el cursor de lectura ahora son comunes (`src/design-system/components/diagramBands`): Diseño y la Lámina de Resultados del 2D usan las mismas.
- Lienzo editable (Claude Design): https://claude.ai/artifact/RQDCZQKA7yTZXdbmwSSdjf

El código manda: si `src/` y este documento discrepan, se corrige el documento.
