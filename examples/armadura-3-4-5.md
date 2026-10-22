# Armadura 3–4–5 triangulada

Importa `armadura-3-4-5.fusionstructure.json` desde la sección Importar de FStructure.

Reconstrucción de una imagen, no del archivo original: N1=(0,0), N2=(0,4), N3=(3,4), N4=(3,3), N5=(1.5,4), en metros. N1 articulado y N4 con rodillo que restringe Y. Cargas: 5 tf hacia la derecha en N2 y 1.5 tf hacia abajo en N5. Sin peso propio.

Se conservan las cinco barras dibujadas y se añaden N1–N5 y N1–N4. Ambas son barras de armadura articuladas. La primera triangula el nodo cargado; la segunda impide el movimiento lateral libre del extremo inferior derecho. La geometría original tiene dos mecanismos en el análisis lineal.

Las propiedades no pueden obtenerse de la imagen: se usa E=200 GPa y A=0.01 m² como referencia uniforme, sin selección ni comprobación de resistencia de una sección real. Sustituye estas propiedades por las del ejercicio antes de interpretar desplazamientos. I=0 porque las barras sólo tienen rigidez axial.

Referencia de equilibrio, con fuerzas positivas hacia arriba/derecha: Rx(N1)=−5 tf, Ry(N1)=−5.916666667 tf, Ry(N4)=7.416666667 tf. La reacción negativa en N1 requiere un apoyo capaz de tomar levantamiento en esta idealización.

La aplicación no añade barras ni modifica apoyos automáticamente en los proyectos existentes. Este archivo es una alternativa triangulada explícita para abrir y revisar por separado.
