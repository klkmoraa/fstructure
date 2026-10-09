# Validación de la ampliación de concreto — 9 de octubre de 2026

Estado: **en implementación**. Los planes A/B/C/D están autorizados; esta ficha registra evidencia obtenida, sin declarar completos los bloques pendientes.

## Base y conservación de datos

Base `bc931aeb`: `npm run check` terminó con código 0; 173 suites/1194 pruebas, 5 pruebas Python de referencia, lint, TypeScript, arquitectura y build. La instancia cloud conserva Node 24/npm 11, dependencias y el arranque reproducible ya guardado; Vite respondió con el HTML de la aplicación.

Almacenamiento estructurado v7: commits `d8acdb9e` y `7d9b71c4`. `npm run verify`: 36 archivos/246 pruebas. La revisión independiente detectó y se corrigieron omisión de detalles al preservar el borrador en start/open, falta de preflight en el setter y límite de lectura local incompatible con payloads tipados válidos. Revisión posterior: Spec PASS/Calidad APPROVED.

Chromium comprobó la conservación de una carga incompleta y un bastón personalizado al iniciar otra pieza, abrir desde memoria y recargar. El modelo original de 10 barras permaneció intacto y no hubo errores de página. Las pruebas anteriores de esquemas/keys/capacidad se amplían en los siguientes bloques; no son todavía validación visual del editor futuro.

## Editor de cargas y armado de viga

Commit `e0373070`, pendiente de revisión independiente de la tarea. `npm run verify`: 46 archivos/379 pruebas y 5 pruebas Python, código 0. Los casos parciales, puntuales y triangulares comprueban equilibrio y máximos en raíces de cortante; éstas se obtienen también por combinación. El informe usa As requerida/mínima/colocada y d de los mismos lechos físicos.

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

Editor de cargas/armado; flexión directa y alternativas; snapshots/navegador; reacción→zapata; despiece/exportaciones; losa/franja y sección libre/biaxial/servicio. Cada tarea tiene revisión y pruebas propias. El cierre exige navegador Día/Noche/teléfono, migraciones/invalidimport/undo/cancel, coherencia PDF/SVG/CSV, npm run check completo, revisión consolidada y comprobación del despliegue.

Las fuentes oficiales completas de losas no pudieron recuperarse (403 del proxy). Los mínimos y reglas de sección existentes sólo se habilitan bajo su alcance registrado; cortante/peralte/servicio/detalle sin evidencia aplicable quedan pendientes. No se fabricaron hashes, fechas de cotejo ni certificaciones.
