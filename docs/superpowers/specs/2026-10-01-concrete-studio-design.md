# Calculadora de concreto y armado editable

Fecha: 2026-10-01. Alcance autorizado: ampliación autónoma de FS-A04, incluyendo cálculos, diagramas, geometría, armado, recubrimiento y cuantificación.

## Resultado

El taller conserva sus vigas, columnas y cimentaciones normativas y añade **Secciones**, una calculadora experimental para flexión y fuerza axial con flexión en una dirección elegida. Incluye secciones cuadradas, rectangulares, circulares, triangulares, hexagonales y octagonales; ejemplos de viga, columna corta, franja de losa y pedestal. Cada dato cambia el resultado y el dibujo.

Las tres filosofías se interpretan como esfuerzos admisibles (demanda de servicio y modelo elástico), resistencia última (demanda mayorada y reducción explícita φ) y estados límite (resistencias de materiales divididas entre factores parciales). Se explican las hipótesis sin presentar los dos modelos académicos nuevos como una implementación normativa completa. Estados límite de servicio, ductilidad sísmica, torsión y segundo orden se declaran fuera de alcance cuando corresponda.

## Arquitectura y decisiones

- Motor puro en `src/design/concrete/sectionStudio.ts`: geometría real convexa, colocación del acero, compatibilidad y equilibrio; entrada finita validada y resultados derivados.
- Componentes y adaptación a la memoria en `src/features/design/workbench/`: el mismo resultado alimenta los diagramas, la memoria y el PDF.
- Cuarto elemento del selector del taller. Se guardan borradores, filosofía y factores en la rama Diseño del proyecto, sin importar datos de 2D, 3D o FEM.
- Migración aditiva del documento a v3, compatible con v1/v2. La memoria acepta el nuevo tipo sin perder elementos anteriores.
- Los perfiles normativos existentes de columna añaden separación propia de estribos al centro y extremos. El motor revisa nuevamente cortante y límites de detallado; el dibujo y la cuantificación reflejan el armado capturado.

Se eligió ampliar el taller existente frente a reemplazar sus motores o introducir una aplicación separada: mantiene proyectos, memorias y verificaciones anteriores. El cálculo académico se distingue del diseño por normas para evitar asociar factores editables a cláusulas que no los respaldan.

## Visuales

Sección acotada, barras y recubrimiento, interacción N–M con demanda, distribución de tensiones o deformaciones y elevación de estribos. Todos derivados de la geometría/armado utilizados en el cálculo. Paneles y navegación móvil usan los componentes y tokens actuales del producto.

## Verificación

Pruebas de referencia geométrica y equilibrio; comparación independiente de capacidades; cambio de signo de momento en geometrías no simétricas; rechazo de secciones imposibles y valores no finitos; factores y demandas diferentes entre filosofías; separación manual de estribos y cuantificación; guardar, abrir, recalcular y exportar el nuevo tipo. Gate completo `npm run check`, navegador en escritorio/móvil y Día/Noche, actualización de capturas del brandbook. Publicación según AGENTS después de pasar los checks.
