# Validación del taller de concreto — 2026-10-01

## Referencias del motor de Secciones

Las referencias analíticas y la integración por fibras están en `src/design/concrete/sectionStudio.test.ts`. La cuadratura independiente corta franjas horizontales de 0.025 mm, calcula sus intersecciones con los lados y descuenta los discos de acero comprimidos; no reutiliza el recorte poligonal del motor. La circular se contrasta con franjas de 0.05 mm.

| Caso | Referencia y comprobación |
| --- | --- |
| Rectángulo 300 × 500 mm | A = 150000 mm²; Ix = bh³/12; Iy = hb³/12. |
| Círculo D = 400 mm | A = π·200² mm²; Ix = Iy = π·200⁴/4 mm⁴. |
| Triángulo b = 500, h = 600 mm | A = 150000 mm²; Ix = bh³/36; Iy = hb³/48; centroide y distancias normales de recubrimiento. |
| RU, cuadrado 400 mm, 8Ø20, f′c = 30 MPa, fy = 420 MPa | Compresión uniforme φ[0.85f′c(Ag−As)+fyAs] y tensión −φfyAs. |
| RU, rectángulo 300 × 550 mm, 2Ø20 superiores y 4Ø20 inferiores, φ = 0.75 | N = 800 kN / M = 80 kN·m y flexión pura M = 80 kN·m: capacidad, equilibrio y posición del eje neutro se contrastan con fibras; tolerancias de aceptación 0.05 kN y 0.005 kN·m. |
| RU, triángulo, eje a 35° | Fuerza y ambos momentos contra fibras. El momento perpendicular activa «Revisión direccional»; no se acepta como solución biaxial. |
| EA, compresión uniforme | Sección transformada, Ec = 4700√f′c y Es = 200000 MPa. |
| EA, flexión pura | N = 0 y M = 80 kN·m por equilibrio de sección fisurada, sin concreto a tensión. |
| EL | f′c/γc y fy/γs, sin volver a reducir por φ; factores inferiores a 1 se rechazan. |

Se prueban además momentos positivos/negativos, tracción, demanda nula, secciones inviables, barras solapadas, recubrimientos imposibles, valores no finitos, búsqueda de armado acotada, ganchos estimados y cuantificación. Las propuestas que dejan un momento perpendicular sin resolver se rechazan.

## Integración y navegador

- `npm run verify`: typecheck, lint, pruebas relacionadas y cinco pruebas del oráculo Python.
- `npm run check`: arquitectura, 986 pruebas en 135 archivos, oráculo Python y build de producción.
- Revisión independiente del motor, detallado y adaptación a la memoria.
- Escritorio y móvil en Día/Noche; seis formas, tres filosofías y cuatro láminas sin coordenadas NaN/Infinity. Selector móvil con cuatro herramientas completas a 320 px, sin desbordamiento horizontal.
- Proyecto real: guardar, recargar y recuperar geometría, recubrimiento, filosofía y elemento añadido a la memoria. Compatibilidad de documentos v1/v2 y escritura v3 cubierta por pruebas.
- PDF descargado desde el navegador: siete páginas y las cuatro láminas del elemento. La memoria identifica la filosofía como modelo experimental y conserva datos, cantidades y huella de entrada.
- Columnas normativas: separación propia al centro/extremos, comprobación de cortante con la separación más abierta y actualización de elevación/cantidades. La hélice dibuja un paso completo por vuelta; una prueba independiente comprueba medias vueltas, vueltas completas y extremos.

## Límites del resultado

Secciones es un modelo académico de sección aislada, con deformación en una dirección. No implementa una norma completa, combinaciones automáticas, diseño biaxial general, segundo orden, estados de servicio del miembro, cortante ni detalle sísmico. Esos límites aparecen en la interfaz y la memoria; los elementos normativos existentes conservan sus comprobaciones y sus propios límites. Las cantidades no incluyen traslapes ni desperdicio y no equivalen a un despiece de taller.

La evidencia anterior corresponde a validación local. La publicación requiere además la puerta de calidad de GitHub Actions y comprobar la aplicación desplegada.
