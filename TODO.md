# Pendiente

Lista corta y viva. Se tacha o se borra al terminar; el detalle va en el commit.

## Producto

- [x] Chrome común de las mesas (`mesaChrome.css`): barra, tarjeta, dock y pie con la misma geometría; la transición de modo anima cada pieza por separado y 3D ↔ Diseño comparten shell.
- [ ] Proyectos por herramienta: miniatura generada de cada modelo 3D o elemento de Diseño; hoy usan la escena de la herramienta y el resumen de su rama local.
- [ ] Modo Diseño con el lenguaje del modo Modelo (el 3D ya lo tiene: dock, fichas, banda de resultados, franja de estado).
- [x] 2D en teléfono: dock dinámico con cápsula contextual (coordenadas y valor de la carga con el teclado completo del teléfono, ajuste, P · q · M, sentido de la carga, acciones de la selección), barras encadenadas, apoyos en mosaicos, Inspector en filas con «Avanzado» por fila, sin zoom de página ni reencuadres solos.
- [ ] Llevar el dock dinámico (cápsula contextual) al 3D y a Diseño en teléfono.
- [x] Una sola Home (FEM retirado): proyecto abierto, tarjetas 2D · 3D · Diseño, recientes y secciones en la URL.
- [ ] Exportar o reabrir los estudios FEM que quedaron guardados en proyectos viejos (hoy se conservan intactos en el registro, sin interfaz).
- [ ] 3D: resortes en apoyos, brazos rígidos y viga de Timoshenko (hoy se rechazan con aviso).
- [ ] 3D: combinar el espectro con casos estáticos (envolventes máx./mín.) y excentricidad accidental del diafragma.
- [ ] 3D: dibujo rápido de columnas y vigas sobre la rejilla (un clic por eje o por vano) y losas como áreas.
- [x] Mesa única 2D · 3D · Diseño: el Solver 3D es el modo 3D de FStructure, con transición animada, «Traer del 2D» y diseño de un eje del 3D en Estructura.
- [x] Diseño desde el 3D: columnas en flexión biaxial, todos los ejes con planta (la columna común toma el mayor cociente), eje ~15× más rápido y «Editar en 3D» al alzado del eje.
- [x] Diseño desde el 3D: k e índice de estabilidad propios de la dirección perpendicular, torsión de vigas contra ¼·φ·Tcr, todos los ejes en un worker y el edificio completo en la memoria/PDF.
- [ ] Diseño desde el 3D: diseñar el refuerzo por torsión (estribos cerrados y acero longitudinal) cuando Tu supera el umbral; necesita la cláusula registrada (NTC-C 5.8, C.11.5, 11.5).
- [x] Traer del 2D: diafragma rígido por nivel al extruir y el f′c del concreto del 2D.
- [x] Modo 3D: la cámara orbital vuelve tal cual al regresar al modo y un redimensionado no la reencuadra.

## Diseño (de `docs/research/concrete-design`)

- [x] Entrada Proyecto / Pieza / Ejercicio desde Home y «Nuevo diseño» en la mesa: 23 arranques editables, modelos existentes, vivienda de un nivel, edificio de tres niveles y seis ejercicios con hipótesis visibles.
- [x] Iniciar otra pieza conserva borradores completos e incompletos en Memoria, sin sobrescribir lo guardado; aborta antes de escribir si no cabe. Persistencia de los 79 campos de cimentación y compatibilidad del taller v1–v6.
- [x] Materiales con resistencias sugeridas editables, catálogo transversal desde #2, fy transversal visible y configuraciones rápidas de apoyos de viga con rodillo explícito. Las revisiones pendientes conservan ese estado en dibujos, cantidades y PDF.
- [x] Memoria: abrir conserva borradores actual y destino; duplicar cualquier fila mantiene el activo; todas las mutaciones verifican presupuestos antes de escribir.
- [x] Memoria organizada: búsqueda, filtros por tipo/norma/estado, resumen de alcance y PDF completo o selección sin perder filas ocultas seleccionadas.
- [x] Aula: guía persistente en las tres vigas de referencia, comparación CM + CV de servicio con valores editados, suspensión de hipótesis y ocultar/deshacer.
- [ ] Extender las guías educativas a columnas y cimentaciones con referencias independientes, y preparar una entrega de Aula que incluya el planteamiento y la comparación de servicio; el PDF actual sigue siendo de diseño.
- [ ] Registrar y verificar el alcance normativo de estribos de viga menores de 9.5 mm para cada perfil. Hoy se pueden capturar y se declaran como aceptación pendiente; las columnas conservan sus comprobaciones existentes.
- [x] Calculadora experimental de seis secciones, tres filosofías, flexión/N–M, armado por lechos/perímetro, recubrimiento, cantidades y memoria PDF. El momento perpendicular pendiente se declara sin aprobarlo.
- [x] Separación propia de estribos y paso del zuncho en las columnas existentes, revisión de cortante y límites, grapas y elevación ligadas al cálculo.
- [ ] Extender los modelos experimentales de sección a normativa verificada, equilibrio biaxial completo, servicio de miembro y cortante resistente; los modelos EA/EL actuales identifican expresamente sus hipótesis.
- [ ] Armado propio por zonas en la viga (bastones y estribos por claro); hoy se fijan corridas, bastones sí/no y una separación uniforme.
- [ ] Columnas zunchadas, de lindero con contratrabe, losas de cimentación y dados: necesitan cláusulas registradas (FR y φPn,máx del zuncho, αs de borde, ancho efectivo del patín).
- [ ] Normas para ampliar el taller: torsión (NTC 5.8), losas, muros y combinaciones accidentales necesitan el texto oficial registrado con evidencia en `docs/design/normative-sources.json`.
- [ ] Confirmar con la NTC 6.7.4 si el umbral de acero mínimo por penetración (6.7.6.1.2) usa el esfuerzo combinado con transferencia de momento; hoy usa vuv directo y la nota lo avisa.
- [x] Tres mesas: Diseño es el modo Diseño de FStructure (interruptor Modelo | Diseño), Estructura diseña el modelo por omisión, el pórtico rápido pasa al modelo (deshacible) y las bandas de diagrama son comunes (Lámina en Resultados).
- [x] Modelo y Diseño: «Diseñar» desde el Inspector (o la barra seleccionada en el 2D o el 3D) abre su diseño, y «Ver en el Modelo» / «Ver en 3D» la deja seleccionada.
- [x] Alcance inicial de barras inclinadas/acero: vigas de concreto hasta 30° comprobadas con longitud real y acciones locales en las tres normas; acero de armadura A992 + I AISC en tensión pura usa la fluencia total NTC existente, con combinación del modelo, worker y selección desde el Inspector.
- [x] Memoria y PDF del componente inicial de acero: selecciones por proyecto recalculadas, persistencia v6 compatible y PDF no concluyente con modelo adjunto reproducible.
- [ ] Ampliar acero a fractura neta, conexiones, compresión/pandeo, flexión/cortante e interacciones con evidencia oficial. Definir el papel de diagonales de concreto fuera de la clasificación actual y verificar axial–flexión y encuentros inclinados.
- [x] Modo Diseño: análisis por casos del Modelo 2D en worker, incluidos recálculos con inercia agrietada; mensajes sin funciones, caché por revisión y cancelación al editar. La búsqueda de propuestas del pórtico y los modelos 2D/3D también corre en worker.
- [x] Estructura (antes Pórtico): vigas y columnas analizadas juntas (viva alternada, acción lateral, k del nomograma, índice de estabilidad del marco) y cada miembro diseñado con los motores de viga y columna. Diagramas con valores por tramo, φVn y cursor de lectura.
- [x] Proponer secciones: pórtico rápido y Modelo 2D (viga y columna con el menor volumen de concreto que cumplen, columnas al 1 %; en el modelo se aplica a pedido y se deshace en el 2D).
- [x] Proponer secciones por nivel: vigas por elevación y columnas por entrepiso, menor o igual volumen que la propuesta uniforme, armado por sección y aplicación deshacible en el Modelo 2D; persistencia v5 compatible con v1–v4.
- [x] Proponer secciones para todos los ejes del 3D, con columnas compartidas comprobadas en ambas direcciones, grupos por nivel y aplicación explícita deshacible en 3D.
- [ ] Pórtico rápido con cargas puntuales y voladizos.
- [ ] Pórtico: llevar el cálculo a un worker; un 5 × 5 con sismo tarda ~0.3 s en el hilo principal.
- [ ] Registrar con evidencia las combinaciones sísmicas de NSR-10 (B.2.4.2) y E.060 (9.2.3); hoy el pórtico las aplica como complementarias y lo dice.

## Limpieza

- [ ] El modo sin shell de `Space3DWorkspace` (barra local) sólo lo usan pruebas: migrarlas al shell y retirarlo.
- [ ] Dividir los archivos más grandes (`Space3DWorkspace.tsx`, `WorkspaceShell.tsx`, `ProjectContext.tsx`).

## Rendimiento y distribución

- [x] Bajar el bundle inicial: la mesa, three.js y los diálogos de la Home se cargan aparte (JS inicial 452 → 149 KB gzip, CSS 225 → 15 KB al quitar dos fuentes incrustadas sin uso).
- [ ] Escenas de la Home en WebP.
- [x] PWA sin conexión: `sw.js` (generado en `vite.config.ts`) guarda la Home, la mesa y los workers; PDF, imágenes y fuentes al usarse. Una versión nueva toma el control al cerrar la app.
- [ ] Aviso discreto «Nueva versión lista · Recargar» cuando hay un service worker en espera.
- [ ] Publicar con el flujo oficial de Pages (artefacto) en vez de escribir en `gh-pages`.

## Pruebas (sólo si aportan)

- [ ] Humo E2E de las pantallas de entrada (Home y sus secciones) con capturas en claro, oscuro y móvil.
- [ ] Matriz de importación/exportación: un archivo válido y uno inválido por formato.
- [ ] Confirmar la entrega del PDF de Diseño en Safari: Chromium sin «compartir» ya descarga el PDF (probado con el del pórtico, 13 páginas con láminas).
- [ ] Auditoría de dependencias en CI.
