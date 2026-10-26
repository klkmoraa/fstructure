# FStructure — arcilla discreta

## Intención
La interfaz se percibe tosca. Conservar la materia clay, la identidad de Análisis y todas las funciones, reduciendo volumen repetido, marcos y competencia entre acciones. Prioridad móvil; ambos temas y escritorio.

## Decisión de diseño
Una capa común de presentación sobre los componentes existentes: sombras de contacto pequeñas, luz interior fina y profundidad reservada a superficies flotantes y acciones principales. Las bandejas tienen materia; sus teclas en reposo no repiten otra caja. Activo, foco, pulsación y deshabilitado siguen siendo distintos.

Alternativas consideradas: aplanar todo elimina el clay pedido; rediseñar navegación y flujos multiplica riesgo sin resolver la causa visual. Se elige refinar el sistema existente, por criterio del implementador dentro de la libertad solicitada, no como una maqueta aprobada por el usuario.

## Alcance
- Base de materia y controles compartidos, Inicio y sus secciones.
- Barra de proyecto, herramientas, pestañas de resultados, zoom, menús y paneles de las tres mesas.
- Iconos sin recuadro interior redundante, etiquetas con peso moderado, grupos separados por espacio y línea discreta.
- Retícula técnica menos dominante, sin cambiar las señales ni las cifras.

## Invariantes
No cambia cálculo, almacenamiento, exportación, geometría, textos ni navegación. No se ocultan funciones. Radios, fuentes y colores de marca permanecen. Objetivos táctiles existentes >=44 px, campos móviles de 16 px, foco visible y movimiento reducido. Sin librerías nuevas. No se aplica material a líneas técnicas, SVG ni tablas numéricas.

## Referencias
- https://emilkowal.ski/skill
- https://github.com/emilkowalski/skills/tree/main/skills/emil-design-eng
- https://github.com/emilkowalski/skills/tree/main/skills/apple-design
- https://developer.apple.com/design/human-interface-guidelines/buttons
- Canon y componentes existentes de FusionStructure.

La reducción de intensidad de sombras es una adaptación de producto solicitada, no un cambio al repositorio del canon. El agente de revisión externo devolvió 401 y no produjo una revisión; la verificación se realiza directamente y con pruebas automatizadas.
