# FStructure · Sistema de diseño

Brandbook de la familia de FStructure, derivado del brandbook global de FusionStructure.
Abre `index.html` en el navegador: siete fichas (sistema, logos, Día y Noche,
componentes reales, interfaces, herramientas y auditoría).

- `logos/`: marca de FStructure — la ménsula con la franja en el color de su familia (Día, Noche e icono de app).
- `assets/`: capturas de la app en Día y Noche.
- Ficha de interfaces y capturas de las mesas actualizadas el 1 de octubre de 2026: [guía en móvil](assets/guia-movil.png), navegación, vistas FEM y revisión de datos de Diseño. El modo Diseño (todos los ejes del Modelo 3D, con «Guardar los N ejes en la memoria») se actualizó el 3 de octubre de 2026.
- Capturas de Diseño en Día/Noche actualizadas el 3 de octubre de 2026 con el Pórtico (vigas y columnas juntas, envolvente de momento sobre el marco y matriz de miembros). La ficha refleja el quinto elemento y el cursor de lectura de los diagramas.
- Capturas de Inicio, FStructure y su modo Diseño actualizadas el 3 de octubre de 2026: tres mesas en el Inicio (Diseño ya no es herramienta aparte), interruptor Modelo | Diseño en la barra de FStructure (plantilla «Pórtico de concreto») y la mesa Estructura diseñando ese modelo. Las bandas de diagrama y el cursor de lectura son comunes (`src/design-system/components/diagramBands`): el modo Diseño y la Lámina de Resultados usan las mismas.
- Capturas de Inicio y de los tres modos de FStructure actualizadas el 3 de octubre de 2026: dos mesas en el Inicio (el Solver 3D es el modo 3D), interruptor 2D | 3D | Diseño, el modo 3D con la plantilla «Pórtico de concreto» traída del 2D en tres pórticos y analizada, y Diseño · Estructura diseñando el eje 1 de ese modelo 3D.
- Capturas de Diseño en Día/Noche actualizadas el 3 de octubre de 2026 con la vista «Todos los ejes»: planta del edificio traído del 2D en tres pórticos, ejes y columnas coloreados por utilización y la tabla de ejes; las columnas se rotulan con la rejilla del 3D (CA, CB, CC).
- Lienzo editable (Claude Design): https://claude.ai/artifact/RQDCZQKA7yTZXdbmwSSdjf

El código manda: si `src/` y este documento discrepan, se corrige el documento.
