# Validación de la ampliación de concreto — 9 de octubre de 2026

Estado: **en implementación**. Los planes A/B/C/D están autorizados; esta ficha registra evidencia obtenida, sin declarar completos los bloques pendientes.

## Base y conservación de datos

Base `bc931aeb`: `npm run check` terminó con código 0; 173 suites/1194 pruebas, 5 pruebas Python de referencia, lint, TypeScript, arquitectura y build. La instancia cloud conserva Node 24/npm 11, dependencias y el arranque reproducible ya guardado; Vite respondió con el HTML de la aplicación.

Almacenamiento estructurado v7: commits `d8acdb9e` y `7d9b71c4`. `npm run verify`: 36 archivos/246 pruebas. La revisión independiente detectó y se corrigieron omisión de detalles al preservar el borrador en start/open, falta de preflight en el setter y límite de lectura local incompatible con payloads tipados válidos. Revisión posterior: Spec PASS/Calidad APPROVED.

Chromium comprobó la conservación de una carga incompleta y un bastón personalizado al iniciar otra pieza, abrir desde memoria y recargar. El modelo original de 10 barras permaneció intacto y no hubo errores de página. Las pruebas anteriores de esquemas/keys/capacidad se amplían en los siguientes bloques; no son todavía validación visual del editor futuro.

## Editor de cargas y armado de viga

Implementación `e0373070`, correcciones `44e03b44`/`1dacdf98`, revisión independiente final Spec PASS/Calidad APPROVED. `npm run verify`: 46 archivos/379 pruebas y 5 pruebas Python, código 0. Los casos parciales, puntuales y triangulares comprueban equilibrio y máximos en raíces de cortante; éstas se obtienen también por combinación. El informe usa As requerida/mínima/colocada y d de los mismos lechos físicos.

La integración detectó un ciclo de renderizado por un array de errores nuevo en cada render; se corrigió estabilizando su dependencia. La reproducción aislada terminó en 2.60s después del arreglo y las 28 pruebas de la mesa pasaron. Chromium volvió a comprobar detalles, memoria, PDF, recarga, teclado/deshacer, Día/Noche y 390px con cero errores de página y consola; pdftotext confirmó cargas y coordenadas. La búsqueda de geometría imposible sigue asignada a la integración de worker cancelable de A4, antes de publicar; esta tarea sola no se publica.

## Oráculos externos realmente ejecutados

Se instalaron en un venv temporal, sin dependencias nuevas del producto, estos clones MIT fijados:

- section-properties 3.10.2, commit `1e12d48b3ccb9ee1b7df8e2ac357c633cc004bdf`.
- concrete-properties 0.8.0, commit `13bfb7bfd75b265bcd418e2f8ed72106a0362678`.

Secciones: rectángulo 400×500mm y anillo exterior 400×500 con hueco central 200×200mm; cuatro barras Ø16 en (±150,±200)mm; fc 25 MPa, Ec 23500 MPa, Es 200000 MPa, fy 420 MPa, εcu 0.003. Concreto sin tracción, compresión lineal limitada a 0.85fc; acero elastoplástico. Son leyes experimentales, sin reducción normativa local. Las propiedades geométricas analíticas y section-properties coincidieron con error relativo máximo 2.37×10⁻¹⁵.

Se descartó una configuración inicial de la curva última que extrapolaba concreto a tracción. La ley final incorporó tramo plano de tensión cero y aserciones de estrés en deformaciones negativas antes de regenerar resultados.

Se detectó una discontinuidad angular en la partición de `CPGeom.split_section` de concrete-properties ([pre.py del commit consultado](https://github.com/robbievanleeuwen/concrete-properties/blob/13bfb7bfd75b265bcd418e2f8ed72106a0362678/src/concreteproperties/pre.py)): los ángulos ±π/2 exactos o vecinos de NumPy cambian ramas de clasificación de polígonos y producen un momento transversal espurio de 2.16 kN·m en una sección simétrica. Perturbar ±10⁻⁷ rad devuelve el componente pequeño a ≈51.58 N·mm; refinar malla 40→10 mm no cambia el vector. La diferencia de residual axial de 0.0193 N no explica ese salto.

Estos puntos singulares no se aceptan aumentando tolerancias. Los fixtures futuros usarán ángulos estables o referencias analíticas, con transformación de ejes explícita y control independiente de equilibrio/simetría. La ejecución externa demuestra capacidades del paquete bajo esas leyes; todavía no demuestra equivalencia con el motor TypeScript, cumplimiento NTC/NSR/E.060 ni servicio de un miembro.

Los informes originales, scripts y resultados temporales se conservan en `qa-artifacts/ampliacion-total-2026-10-09/`; sólo los fixtures fiables y su procedencia se trasladarán a validación versionada al implementar la sección libre.

## Pendiente para el cierre integrado

Flexión directa y alternativas; snapshots/navegador; reacción→zapata; despiece/exportaciones; losa/franja y sección libre/biaxial/servicio. Cada tarea tiene revisión y pruebas propias. El cierre exige navegador Día/Noche/teléfono, migraciones/invalidimport/undo/cancel, coherencia PDF/SVG/CSV, npm run check completo, revisión consolidada y comprobación del despliegue.

Las fuentes oficiales completas de losas no pudieron recuperarse (403 del proxy). Los mínimos y reglas de sección existentes sólo se habilitan bajo su alcance registrado; cortante/peralte/servicio/detalle sin evidencia aplicable quedan pendientes. No se fabricaron hashes, fechas de cotejo ni certificaciones.

## Capacidad reducida de sección libre — contrato previo a implementación

La comparación aprobada admite un factor manual opcional, vacío por defecto y explícitamente Experimental. No atribuye un factor a una norma sin respaldo. A N de cálculo fijo, la curva reducida usa el cálculo nominal a N/φ y escala sus acciones por φ; pruebas de equilibrio, φ=1 y dominio axial deben cubrir este cambio antes de declararlo implementado. No afecta al servicio elástico.

## Guardado general — hallazgo de auditoría, corrección asignada A5

La aceptación de lotes completos debe preceder cambios visibles e historial en formularios, filas, selección, memoria y revisión de acero. El sink real del proyecto es `session.saveDesign`; actualmente su rechazo se absorbe. A5 incluye distinción de borrador pendiente/confirmación durable y reintento sin descartar trabajo. El fallback localStorage queda separado del proyecto normal. Estas garantías están planificadas, todavía no declaradas implementadas.

## A2 cierre revisado — 1dacdf98

El lote de detalle y activación de armado propio, y la restauración completa de viga, se prevalidan juntos. El rechazo conserva campos, resultado, memoria y stacks de deshacer/rehacer. Fixture válido de 60 piezas cercano a 240000 caracteres cubre detalle que cabe solo y lote que no cabe. Verify de la corrección: 38 archivos/258 pruebas, focal final 2/2; revisión independiente Spec PASS/Quality APPROVED. Chromium posterior conserva carga puntual y parcial, bastón y estribos, teclado/undo/recarga/memoria/PDF; Día/Noche/390px sin errores de página o consola ni desbordamiento. A3 en implementación; A4/A5/B/C/D todavía pendientes.

## A3 prueba de navegador durante integración

Chromium comprobó inicio propio con acción/geometría/materiales vacíos; Mu 200 kN·m con b400/h600mm, fc25/fy420MPa y barras Ø15.9 da As1022.85mm² (10.23cm²), coherente con la referencia independiente bajo el peralte real. Mu vacío deshabilita reporte/PDF; cero explícito se acepta; Mu negativo selecciona el lecho superior. Guardado, memoria, PDF y recarga conservaron las acciones. Sin errores de página/consola ni desbordamiento390px. Las capturas detectaron contraste insuficiente de texto SVG en oscuro y un estado demasiado largo en móvil; se asignaron al implementador antes de la revisión de tarea. Dimensionamiento y revisión independientes de A3 aún pendientes.

## A3 cierre revisado — 0e4f4a2f

Flexión directa `2ecd90aa` y correcciones `9f912103`/`0e4f4a2f`: revisión independiente final Spec PASS/Quality APPROVED. La ecuación convierte N·mm a kN·m e imprime el factor obtenido con As requerida, bloque y deformación; las referencias del perfil son informativas. Mu=0 usa el factor compartido y no un respaldo de cero. Sólo se solicitan y validan barras del lecho activo; el crudo del otro lecho se conserva.

Verify final: 21 archivos/186 pruebas relacionadas y Python 5/5, código 0; focal de la última corrección 19/19. Chromium posterior: acciones, memoria, PDF, recarga, dimensionamiento real en worker, preview no mutante, Aplicar/Deshacer y Día/Noche/390px, sin errores de página/consola. PDF de Mu=0 confirma φ0.900/As0/a0/equilibrio0; el de Mu200 confirma φ0.900/As1022.85/a50.54/equilibrio200 y referencias. El defecto menor de escala SVG para secciones anchas queda asignado a A4 o a la corrección integrada. A4/A5/B/C/D siguen pendientes; no se publica una entrega parcial.

## A4 implementación en revisión — 950e5ab4

Alternativas en cuatro dominios y búsqueda de geometría de viga en workers: verify de la implementación, 33 archivos/249 pruebas y Python 5/5, código 0. Chromium confirmó cancelación de q1000 en 317ms y propuesta q4 de 20×35cm, aplicación/deshacer, existencias vacías y subconjunto Ø15.9, tres opciones desde acero requerido e invalidación al editar Mu. Se corrigieron el evento de checkbox liberado por React, importaciones de interfaz en el worker, NaN en preview con dimensiones incógnitas y símbolos de barras solapados. La repetición correspondiente quedó sin errores; 16Ø9.5 tiene cero solapes dibujados y el reporte usa dimensiones reales.

La revisión de tarea pide completar la comparación del acomodo físico antes de aplicar y ordenar “Menos diámetros” por variedad del armado efectivo. Se corrigen en ronda 1, con métricas completas de viga bajo comprobación. A4 todavía no se declara cerrada; A5 y B/C/D continúan después de su revisión limpia.

## A4 corrección de comparación física — navegador

Chromium comprobó tres vistas previas con centros y diámetros del acomodo real, separaciones visibles y ninguna modificación del borrador antes de aplicar. Las capturas Día/Noche de escritorio y móvil390px se inspeccionaron; sin desbordamiento ni errores de página/consola. La variedad de diámetros y las métricas completas de ambos lechos y bastones de viga se someten a re-revisión independiente antes de cerrar A4.

El importador portable visible de Home rechazó un archivo inválido conservando modelo y Diseño completos (10 barras, 9 nodos). Esa ruta no importa documentos de Diseño; la frontera del bundle y la rama futura se comprueban separadamente en A5.

## A4 cierre revisado — 80986a4d

La re-revisión independiente confirmó F1/F2 atendidos, Spec PASS/Quality APPROVED, sin problemas nuevos en el diff de corrección. El DTO y las tarjetas muestran acomodo, capas y separaciones efectivas; el ranking usa variedad longitudinal y área como desempate. Verify final: 16 suites/126 pruebas y Python5/5, código0. A5 inicia la protección general de guardado; B/C/D y cierre integrado siguen pendientes.

## A5 guardado — evidencia de integración antes de revisión

Chromium comprobó rechazo de detalles conocidos malformados antes de modificar el bundle o la copia de trabajo; un documento de versión futura se conserva exacto, abre en solo lectura y permite volver al modelo. Guardar cambios del modelo mantiene esa rama futura. No hubo errores de página/consola ni desbordamiento en 390px.

Un fallo inyectado en el repositorio realmente utilizado conserva Mu200 en el borrador y Mu0 en el último guardado durable. Reintentar con un clic normal confirma Mu200; el aviso y su botón de 44px se inspeccionaron en Día/Noche y móvil. La prueba inicial reveló que el escenario de dibujo interceptaba el botón; se corrigió la capa del aviso y el punto de clic ahora alcanza el botón. El primer intento de inyección usaba otra instancia del módulo por su URL HMR; se corrigió el harness antes de atribuir un fallo al producto.

La regresión posterior de A1–A4 terminó con código0 en cuatro recorridos: cargas/regiones propias y PDF/memoria/recarga, flexión directa y lecho por signo, dimensionamiento en worker con Aplicar/Deshacer y alternativas de acero con existencias. Todos conservaron acciones y campos; sin errores de página/consola ni desbordamiento390px. A5 espera verify final y revisión independiente; B/C/D siguen pendientes.

## A5 cierre revisado — 5afaa6cb

Revisión independiente Spec PASS/Quality APPROVED, sin findings. Verify final tras CSS: 66 archivos/447 pruebas, TypeScript/lint y arquitectura20/20. El controller ejecutó y comprobó por separado guardas, conservación de versiones futuras, fallo/reintento real y los cuatro recorridos A1–A4 descritos arriba. A completo; B/C/D y cierre integrado siguen en ejecución, sin publicación parcial.

## B1 proveedor nativo — comprobación de navegador durante implementación

Workers reales en Chromium devolvieron el vector simultáneo de los objetivos originales de la viga 2D: servicio M3=12.8kN·m y cortantes izquierdo3.6/derecho−6.4kN; combinación1.3D+1.5L M3=19.04kN·m. La barra 3D inclinada conservó su base local y N−8/Vy−6/Mz−24, y su reacción global de combinación×2 Fy20/Mz60. La columna vertical rectangular de catálogo devolvió N−200/Vy5/Vz10/My−20/Mz10 y reacción global (−10,200,−5,−15,0,30), con unidades kN/kN·m. Coinciden con las referencias independientes preparadas para B2/C. Cancelar devuelve AbortError y la estación fuera del miembro se rechaza; sin errores de página/consola. El primer harness pidió ocho jobs simultáneos y activó correctamente el límite de seis; la comprobación de resultados se ajustó a dos lotes de cuatro. B1 aún requiere cierre de pruebas y revisión.

## Hallazgo visual de integración A4 pendiente de corrección

Los cuatro recorridos adicionales de columna rectangular/circular, viga propia y sección experimental conservaron campos en preview/Apply/Undo/recarga, con SVG finitos y sin errores. La inspección visual de viga detectó un control desalineado: una propuesta guarda/reporta Ø7.9mm, pero el selector filtrado muestra Ø12.7mm. El navegador lo reprodujo (crudo7.9, control12.7). Se programó corrección específica antes de publicar, preservando valores heredados y haciendo coincidir propuestas con su dominio editable. No se atribuye un mínimo normativo nuevo a ese filtro.

## B1 cierre revisado — 4f35676e

Implementación e248d598 y corrección4f35676e: revisión independiente final Spec PASS/Quality APPROVED. Se corregía clasificación de HSS/tubos como sólidos; quedan other con dimensiones nulas, conservando identidad/material. La cobertura comprueba también los rectángulos sólidos de catálogo. Verify de implementación:34 archivos/290 pruebas y Python5; fix final:16 archivos/84 pruebas y Python5, focal12. Proveedor nativo original/cancelable disponible; B2 UI/procedencia/navegador aún pendiente. Antes sigue la corrección específica del selector de diámetro de A4.

## A4 diámetro — corrección de integración revisada f364d1dd

Las nuevas propuestas de viga pertenecen al dominio que permiten editar sus campos. Un diámetro heredado fuera del filtro y un crudo incompleto se representan fielmente, sin reemplazarlos por el primer diámetro disponible. Revisión independiente Spec PASS/Quality APPROVED; verify40 archivos/280 pruebas, Python5, focal7/7 y crudo4/4. Chromium posterior confirmó raw/control15.9 y12.7, cambio sólo de acero, preview intacto, Aplicar/Deshacer/recarga y conservación exacta de7.9/incompleta con selección explícita15.9. Día/Noche y390px inspeccionados, sin errores ni desbordamiento. Dos recorridos intermedios se interrumpieron durante una edición con HMR y se conservaron como diagnóstico; los mismos runners sobre el código estable pasaron.
