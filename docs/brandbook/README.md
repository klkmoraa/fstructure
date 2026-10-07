# FStructure · Sistema de diseño

Brandbook de la familia de FStructure, derivado del brandbook global de FusionStructure.
Abre `index.html` en el navegador: siete fichas (sistema, logos, Día y Noche,
componentes reales, interfaces, herramientas y auditoría).

- `logos/`: marca de FStructure — la ménsula con la franja en el color de su familia (Día, Noche e icono de app).
- `assets/`: capturas de la app en Día y Noche.
- Mesas (2D, 3D, Diseño y FEM) y capturas principales actualizadas el 7 de octubre de 2026: una sola barra superior (proyecto y estado · modo 2D | 3D | Diseño · acciones sólo icono, en teléfono en dos filas), sin franja de origen y con el tema y la guía en el menú «⋯». Chrome común (`mesaChrome.css`): misma altura de barra, mismo dock (icono en reposo, nombre sólo en el activo) y mismo pie de estado en las cuatro mesas; al cambiar de modo cada pieza se anima por separado.
- Flujos de uso actualizados el 4 de octubre de 2026: [tres entradas al iniciar](assets/flujo-inicio-dia.jpg), [inicio móvil](assets/flujo-inicio-movil.jpg), [2D independiente](assets/flujo-2d-noche.jpg), [3D independiente](assets/flujo-3d-noche.jpg), [Diseño desde 3D](assets/flujo-diseno-dia.jpg), [origen visible en móvil](assets/flujo-diseno-movil.jpg) y [pórtico rápido sin modelo](assets/flujo-elemento-dia.jpg). [Registro de atascos, correcciones y evidencia](../UX_FLUJOS.md). La ficha Interfaces incluye estas capturas: conexiones dentro de las herramientas, menos texto y cargas de barra incluidas en el resumen del 3D.
- Ficha de interfaces y capturas de las mesas actualizadas el 1 de octubre de 2026: [guía en móvil](assets/guia-movil.png), navegación, vistas FEM y revisión de datos de Diseño. El modo Diseño (todos los ejes del Modelo 3D, con «Guardar los N ejes en la memoria») se actualizó el 3 de octubre de 2026 y, con «Ver en 3D» y «Proponer», el 4 de octubre.
- Capturas de Diseño en Día/Noche y [propuesta en móvil](assets/design-grupos-movil.jpg) actualizadas el 4 de octubre de 2026 con la propuesta por nivel para el Modelo 2D.
- Capturas de Diseño en Día/Noche actualizadas el 3 de octubre de 2026 con el Pórtico (vigas y columnas juntas, envolvente de momento sobre el marco y matriz de miembros). La ficha refleja el quinto elemento y el cursor de lectura de los diagramas.
- Capturas de Inicio, FStructure y su modo Diseño actualizadas el 3 de octubre de 2026: tres mesas en el Inicio (Diseño ya no es herramienta aparte), interruptor Modelo | Diseño en la barra de FStructure (plantilla «Pórtico de concreto») y la mesa Estructura diseñando ese modelo. Las bandas de diagrama y el cursor de lectura son comunes (`src/design-system/components/diagramBands`): el modo Diseño y la Lámina de Resultados usan las mismas.
- Capturas de Inicio y de los tres modos de FStructure actualizadas el 3 de octubre de 2026: dos mesas en el Inicio (el Solver 3D es el modo 3D), interruptor 2D | 3D | Diseño, el modo 3D con la plantilla «Pórtico de concreto» traída del 2D en tres pórticos y analizada, y Diseño · Estructura diseñando el eje 1 de ese modelo 3D.
- Capturas de Diseño en Día/Noche actualizadas el 3 de octubre de 2026 con la vista «Todos los ejes»: planta del edificio traído del 2D en tres pórticos, ejes y columnas coloreados por utilización y la tabla de ejes; las columnas se rotulan con la rejilla del 3D (CA, CB, CC).
- Lienzo editable (Claude Design): https://claude.ai/artifact/RQDCZQKA7yTZXdbmwSSdjf

El código manda: si `src/` y este documento discrepan, se corrige el documento.

- [Propuesta por nivel del 3D](assets/design-grupos-3d.jpg): comprueba todos los ejes, muestra el volumen candidato y sólo escribe al pulsar «Aplicar al 3D»; Deshacer pertenece al modo 3D.

- [Propuesta 3D en móvil y tema Día](assets/design-grupos-3d-movil.jpg), comprobada a 390 × 844.

- Modelo 2D 4 × 4 con análisis por casos y propuesta en workers: [Día](assets/design-worker-4x4-dia.jpg), [Noche](assets/design-worker-4x4-noche.jpg), [móvil](assets/design-worker-4x4-movil.jpg). Se revisó edición durante el cálculo e invalidación de una propuesta terminada.

- Acero en modo Diseño: [Día](assets/design-acero-dia.jpg), [Noche](assets/design-acero-noche.jpg), [móvil](assets/design-acero-movil.jpg). Caso analítico independiente de 100 kN; componente de fluencia total, combinación del modelo, selección T1 y límites visibles. Se comprobó el desplazamiento móvil hasta las comprobaciones pendientes y el regreso a T1 en el 2D.
