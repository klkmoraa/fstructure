# Barras curvas nativas — corrección del generador

Una barra circular se guarda como **un miembro con dos nudos extremos** y geometría `curve: { kind: 'circular-arc', bulge }`. Se dibuja con un arco SVG exacto, no con una cadena de barras visibles. El anillo utiliza dos semicírculos unidos en dos nudos, sin duplicar extremos. La entrada antigua `segments` ya no decide la topología física.

En el inspector de una barra de marco existente, **Geometría de la barra → Curva circular** conserva sus identificadores y extremos. La flecha con signo cambia su curvatura; **Invertir curvatura** cambia el lado. Se conserva el historial de edición y la normalización de guardado/importación. El esquema 11 impide que lectores antiguos descarten la geometría en silencio.

## Cálculo

El análisis estático lineal experimental construye una malla privada de elementos rectos para la integración numérica y después recupera **un resultado por miembro físico y sólo resultados nodales físicos**. Esa malla no se guarda ni se agrega al editor. La curva geométrica es analítica; los resultados numéricos siguen siendo aproximados. La comparación con el voladizo semicircular de Euler–Bernoulli con extensión axial verifica el desplazamiento de punta frente a Castigliano. La integración de cargas y peso propio usa longitud de arco.

La comprobación de equilibrio utiliza escalas de fuerza y momento dimensionalmente homogéneas; no divide el residuo numérico de un eje descargado por ese mismo residuo. Conserva los umbrales originales y todos los demás errores del solver. Las pruebas incluyen desequilibrios inyectados que deben seguir rechazándose.

## Límites explícitos

- Aperturas de hasta 180° por miembro; un anillo es una pareja de arcos.
- No se convierten ni borran automáticamente modelos segmentados anteriores: podrían contener apoyos, cargas o juntas deliberadas.
- P-Delta/contactos, liberaciones traslacionales, zonas rígidas y cargas generadas sobre curvas no están verificados; se rechazan en lugar de calcular la cuerda recta.
- La transferencia a 3D y el diseño de concreto de miembros rectos se detienen ante curvas; no certifican arcos.
- Espejo se bloquea en modelos con curvas mientras no se verifique la inversión geométrica completa. Mover y rotar conservan la curvatura relativa a sus extremos.
- Una división explícita o la inserción deliberada de un nudo sobre el arco sí crea una junta física. Un punto sobre la cuerda imaginaria no corta el arco.

El ajuste de cámara, las referencias geométricas auxiliares y las salidas de dibujo ajenas al lienzo requieren una revisión visual adicional. Las pruebas automatizadas no sustituyen la revisión estructural profesional.
