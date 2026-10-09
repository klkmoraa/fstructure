# Validación de Diseño: proyectos, piezas y aula

Comprobación de la actualización del 8 de octubre de 2026. El catálogo contiene 23 arranques editables: 4 de Proyecto, 13 de Pieza y 6 de Ejercicio. Utilizan los motores existentes y no implican aprobación del diseño.

## Cálculo y materiales

| Caso analítico, sin peso propio | Referencia de servicio | Comprobación |
| --- | --- | --- |
| Viga simple, L = 5 m, q = 10 kN/m | qL²/8 = 31.25 kN·m | Solver real, tolerancia 1e-6 |
| Voladizo, L = 2 m, q = 5 kN/m | qL²/2 = 10 kN·m, magnitud | Solver real, tolerancia 1e-6 |
| Puntual al centro, L = 4 m, P = 10 kN | PL/4 = 10 kN·m | Solver real, tolerancia 1e-6 |
| Rodillo izquierdo y apoyo derecho, L = 4 m, q = 10 kN/m | Mmáx = 20 kN·m | Restricciones y resultado del solver |

Las pruebas también ejecutan cada receta editable en su motor, comprueban el empotre con rodillo y rechazan dos rodillos sin estabilización horizontal. Las configuraciones rápidas conservan claros y cargas y se deshacen como un cambio.

El selector de resistencia actualiza el campo numérico real y conserva la conversión de kg/cm² a MPa. El catálogo longitudinal y las búsquedas automáticas permanecen iguales; el transversal incorpora #2 nominal de 6.4 mm. Las columnas conservan su fallo de diámetro cuando corresponde. En vigas, contratrabes y conjuntos, el aviso de aceptación pendiente llega a comprobaciones, estados de miembros, dibujos y resúmenes. El fallo conserva prioridad frente a una advertencia.

## Guardado y recuperación

Las pruebas cubren captura de borradores incompletos actual y destino, deduplicación de instantáneas equivalentes, ausencia de piezas sin borrador previo y creación independiente de piezas guardadas. La comparación completa defaults omitidos por registros antiguos sin reescribir sus campos; conserva claves desconocidas y valores explícitos incompletos o inválidos como datos distintos. Los inicios desde un modelo conservan materiales y norma; no escriben el modelo.

El arranque aborta antes de cualquier escritura cuando no cabe el respaldo: 60 piezas, presupuesto de memoria de 180,000 caracteres o documento completo de 240,000 caracteres y 16 entradas. La regresión del presupuesto completo usa un documento válido cercano al límite y comprueba datos intactos, ausencia de persistencia y reapertura. Las versiones v1–v6 siguen legibles; se comprueba el roundtrip de los 79 campos de cimentación y el rechazo de registros mayores de 96 campos.

## Navegador

Chromium del sistema, escritorio 1440 × 1000 y teléfono 390 × 844, Día y Noche:

- Home → selector con tres pestañas; 13 opciones de pieza; navegación de pestañas por teclado y carga real del ejercicio de viga simple.
- Edición de f′c/fy sugeridos, selección #2 y advertencia visible. El PDF descargado tiene siete páginas y conserva las marcas «Estribos … #2» y la advertencia de aceptación normativa.
- Corte real de zapata corrida con marca «#2 @ 5 cm · 7 #3 long.»; la memoria de lindero queda cubierta por pruebas. La sugerencia avanzada de f′c de la columna actualiza el campo editable a 350 kg/cm²; la prueba de integración comprueba persistencia y conversión a MPa.
- Viga V-A y zapata Z-B guardadas, recarga del proyecto y reapertura desde Memoria: dimensiones, carga, estribo, norma E.060 y los 79 campos de cimentación conservados. Cancelar Nuevo diseño mantiene el borrador.
- Modelo de concreto de diez barras → Diseño → pórtico rápido de vivienda: el origen nuevo se respeta y los nudos y barras del modelo permanecen iguales.
- Archivo JSON inválido rechazado; el modelo de concreto guardado permanece intacto.
- Sin errores de página en los recorridos. Sin desbordamiento horizontal del selector o la mesa móvil; herramientas del dock de aproximadamente 60 × 52 px. Se inicia la receta puntual después de desplazar el selector y se vuelve a abrir desde Nuevo diseño.

Las capturas están enlazadas en [el brandbook](../brandbook/README.md).

## Comprobaciones automáticas

- `npm run verify -- c34bbc9759177c6806c262a144980935ef0ff983`: typecheck, lint de 46 archivos, 347 pruebas relacionadas y oráculo de diseño; código de salida 0.
- `npm run verify -- 7acd7782daa799f2797aadbdb28463d55524abdb`, después del cierre de revisión: typecheck, lint de 8 archivos y 138 pruebas relacionadas; código de salida 0.
- `npm run check`, repetido tras el cierre de revisión: 163 archivos y 1,118 pruebas Vitest, 20 pruebas de arquitectura, 5 del oráculo Python y build; código de salida 0.
- `git diff --check`: sin errores.

Los motores nuevos de acero estructural, losas, muros, torsión resistente y resortes 3D continúan en [TODO](../../TODO.md). La ampliación del catálogo no sustituye esas verificaciones.

La revisión independiente completa y su rerevisión de cierre, ambas con Luna en razonamiento alto, quedaron aprobadas sin hallazgos pendientes.
