# Viga de concreto reforzado — v1 experimental

La superficie **Diseño** de FStructure Solver2D propone refuerzo para una viga de marco de concreto reforzado y sección rectangular. Es un flujo experimental de revisión y aprendizaje: no certifica un diseño ni sustituye a la persona responsable del proyecto, la revisión de cargas, el modelo ni los detalles constructivos.

Es la pestaña **Modelo 2D** del taller de diseño; las vigas, columnas y zapatas independientes del modelo se documentan en [design-workbench.md](design-workbench.md).

## Cómo usarla

1. Modele y analice una viga de marco con una sección rectangular y un material de concreto del catálogo. Las propiedades numéricas del miembro deben coincidir con los registros del catálogo.
2. Cree una combinación última y una de servicio, ambas con jurisdicción `Ciudad de México`, edición `2023` y una URL de procedencia. Selecciónelas explícitamente en Diseño.
3. Seleccione la viga en el canvas, abra **Diseño** desde la barra superior o desde la tarjeta compacta de Resultados y cree la asignación. El recubrimiento, los aceros preferidos y las ramas de estribo quedan guardados con el proyecto y participan en deshacer/rehacer.
4. Pulse **Calcular diseño**. El worker corre el solver para ambas combinaciones y toma los extremos exactos de momento, cortante y deformación; el resultado se mantiene sólo en memoria y se invalida si cambian modelo, combinaciones o asignación.
5. Revise Configuración, Demandas, Refuerzo y Detalle/evidencia. Los esquemas transversal y longitudinal son informativos; no son planos de fabricación.

Diseño es un panel acoplado en X2, un drawer en M1 y una pantalla completa en K0. Es mutuamente excluyente con Resultados para preservar el área de trabajo y comparte la selección actual del miembro.

## Alcance implementado

- Sección rectangular de catálogo, concreto normal Clase 1, `25 ≤ f'c ≤ 70 MPa`, sistema de baja ductilidad, elemento no presforzado y dos ramas de estribo.
- Viga con `L/h ≥ 5`, `h/bw ≤ 6`, `h ≥ 250 mm` y fuerza axial de compresión nula en el resultado de análisis.
- Flexión positiva y negativa, área mínima y máxima, cortante, cuantía/separación de estribos, separaciones de barras y control de agrietamiento por espaciamiento.
- Deflexión elástica inmediata con inercia efectiva. El adaptador declara basalto para el agregado mientras el catálogo todavía no conserva esa procedencia; es la alternativa de menor módulo de la tabla aplicable y, por ello, conservadora para ese cálculo.
- Selección determinista de barras y estribos a partir de las listas preferidas: primero déficit, luego exceso, número de barras, preferencia y diámetro.

## Evidencia normativa y trazabilidad

La norma inicial es la **Norma Técnica Complementaria para Diseño y Construcción de Estructuras de Concreto, Ciudad de México, edición 2023**. El producto no redistribuye su PDF. Cada cálculo valida la URL oficial, el SHA-256 `293f22316a59ec2ec64d1f64f0749f49ba8849ded15b289cd88cc171c55ae62a` y el conjunto de cláusulas verificadas que usa.

El registro legible por máquina conserva páginas, extractos breves, hashes y ecuaciones implementadas en [normative-sources.json](normative-sources.json). La referencia oficial es el [anexo electrónico de la Gaceta](https://data.consejeria.cdmx.gob.mx/portal_old/uploads/gacetas/b3c4f4ff37241d0a93cc6742a8b0bf2f.pdf). Si falta catálogo, procedencia de combinación, fiabilidad del análisis o evidencia completa, el resultado se bloquea en vez de inventar una demanda.

El núcleo TypeScript se compara con un oráculo Python independiente y fixtures JSON compartidos. El gate `npm run design:oracle` ejecuta ese contraste; `npm run check` lo incluye antes del build.

## Exclusiones y límites explícitos

No están resueltos torsión, secciones T/L, acero de compresión, vigas profundas, columnas, losas, muros, anclajes, desarrollo, traslapes, detallado sísmico, fabricación, combinaciones no trazables, concreto ligero, alta ductilidad ni presfuerzo. La conclusión de deflexión total también se marca como `not-evaluated`: esta v1 no incorpora fluencia, contracción ni efectos de largo plazo, y conserva fisuración refinada como pendiente.

Un resultado disponible significa solamente `complete-within-v1`: que las precondiciones y verificaciones programadas de este alcance sí se ejecutaron. No equivale a una aprobación de seguridad, constructibilidad o cumplimiento integral de obra.

## Ruta posterior

La siguiente expansión debe conservar el mismo contrato de asignaciones persistidas y resultados derivados: primero más secciones y reglas de acero/detallado; después presfuerzo como dominio separado con evidencia y fixtures propios; y luego diafragmas como restricciones/distribución 2.5D antes de introducir un modelo 3D o interoperabilidad IFC. La investigación de OpenSees, Frame3DD, XC, CalculiX, FreeCAD e IfcOpenShell está en [open-source-landscape.md](open-source-landscape.md); no autoriza incorporar sus dependencias ni su UI al runtime actual.
