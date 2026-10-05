# Propuestas de secciones por grupo

El pórtico rápido y los modelos 2D y 3D parten de una referencia uniforme que cumple. Después prueban recortes de 5 cm en las vigas de cada nivel y las columnas de cada entrepiso. Cada recorte vuelve a analizar el modelo completo y a comprobar las combinaciones de la norma elegida. El descenso termina cuando ningún recorte admisible ahorra concreto y cumple: es un mínimo local, no una optimización global.

El volumen usa las longitudes reales de cada barra, sin duplicar las columnas compartidas del 3D. En 3D las vigas se agrupan por eje y elevación, las columnas por entrepiso; cada candidato comprueba todos los ejes, con la flexión biaxial ya disponible. Sólo se modifican barras de concreto verticales u horizontales con sección en el plano vertical. Las inclinadas, giradas fuera de ese plano y otros materiales conservan sus propiedades.

La aplicación es explícita. En 2D es un cambio del historial del proyecto; en 3D el puente `space3dSections` calcula A, Iy, Iz y J, conserva E/G, densidad, orientación, apoyos, cargas y geometría, y el workspace entrega un único cambio al historial espacial. Una comparación del documento fuente rechaza propuestas caducadas. Las dimensiones no finitas o no positivas se rechazan.

Los límites de torsión y detallado sísmico siguen declarados como no evaluados; una propuesta que cumple lo evaluado no constituye diseño integral. El armado de columnas se calcula por sección con al menos 1 %; el modelo almacena propiedades geométricas y el borrador de Diseño almacena el criterio de armado.

Validación: NTC-CDMX 2023, NSR-10 y E.060; volumen no mayor que la referencia; recortes de 5 cm; columnas compartidas de varios ejes; conservación de datos, aplicación/Deshacer y guardar/reabrir con IndexedDB real de prueba.
