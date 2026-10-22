# Armadura con apoyo fijo y móvil: equilibrio parcial

Importa `armadura-fijo-movil.fusionstructure.json`. Reconstruye la segunda imagen: cuatro barras axiales, N1=(0,0), N2=(0,4), N3=(3,4), N4=(3,3), en metros; apoyo articulado fijo en N1 y rodillo vertical en N4; carga de 1 tf hacia abajo en N3. No añade barras ni restricciones.

El modelo conserva un mecanismo horizontal en N4. El cálculo lineal de desplazamientos no tiene solución única. Sin embargo, las ecuaciones de equilibrio de nudos tienen fuerzas únicas para esta carga: N3–N4 = −1 tf (compresión), las otras barras = 0, Ry(N4) = +1 tf y las demás reacciones = 0.

FStructure muestra estos valores como **Equilibrio de fuerzas · Experimental**, separados del resultado estructural ordinario. No representan una estructura estable, no incluyen desplazamientos ni deformada y no alimentan fluencia, diseño ni combinaciones de resultados. Si una carga actúa en la dirección del mecanismo y no puede equilibrarse, no se muestran fuerzas parciales. Tampoco se aplica a mezclas con pórticos, barras unilaterales, resortes o fuerzas no únicas.

Las propiedades de referencia son E=200 GPa y A=0.01 m²; no se conocen las del ejercicio a partir de la foto. El equilibrio de este caso no depende de ellas. No se incluye peso propio.

Fundamento: las fuerzas de cada barra de una armadura articulada actúan en su eje y deben satisfacer el equilibrio de cada nudo. La estabilidad se evalúa por separado; véase [Mississippi State University: estabilidad de armaduras](https://www.ae.msstate.edu/vlsm/truss/stability_assessment/stability_assessment.htm).
