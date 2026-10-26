# Análisis móvil: avisos accionables y lectura inicial

## Caso reproducido

Base: `b2c60eb8710ebcd40b52a16023124ffaff621946`. Viga horizontal de 13 m, articulación en N1, rodillo vertical en N2, 10 kN hacia abajo en N2 y rigidez EI relativa. El solver ya resolvía este modelo: reacción vertical de 10 kN en N2, cero en N1 y esfuerzos internos nulos dentro de la tolerancia. La carga está aplicada directamente sobre el apoyo. El único hallazgo era `relative-stiffness`.

La interfaz trataba cualquier hallazgo del Doctor como «problemas» y escogía Axial por no encontrar un momento distinto de cero. Eso hacía parecer fallido un cálculo válido de una viga.

## Cambios

- El aviso describe el `AnalysisResult` de la corrida solicitada, no otro diagnóstico recalculado sobre un proyecto posiblemente distinto.
- Éxito, rigidez relativa, advertencias, fallo y equilibrio de fuerzas sin estabilidad tienen mensajes distintos en español e inglés.
- La rigidez relativa continúa indicada tanto en el aviso como en el Doctor. No se convierte en material físico ni habilita desplazamientos físicos por apariencia.
- Los errores numéricos y estructurales siguen siendo errores. El equilibrio parcial de una armadura no se anuncia como solución estable ni como resultado de diseño.
- Acciones explícitas «Abrir Model Doctor» o «Ver resultados», separadas del cierre, con área táctil mínima de 44 px, foco visible y tokens del brandbook.
- Un id estable reemplaza el aviso anterior de análisis. Los temporizadores se limpian al desmontar y se pausan con foco o puntero sobre el aviso. Errores y advertencias no desaparecen automáticamente.
- La lectura inicial depende del tipo de miembro: Momento para pórticos/vigas, Axial para armaduras. Un momento nulo no cambia el tipo de estructura.

## Verificación realizada

- TDD: antes del cambio, 5 de 9 pruebas del hook y 4 de 5 de la notificación fallaban. Después pasan.
- `npm run check`: 229 archivos, 1603 pruebas, siete referencias Python y build completados. No se modificó código del motor.
- `npm run verify`: typecheck, lint de los nueve archivos TypeScript afectados y pruebas relacionadas en verde.
- `npm run lint:design`: guía de diseño en línea.
- `node scripts/smoke.mjs`: 64 de 64 pantallas en verde.
- Matriz Chromium con entrada táctil: 320×844, 390×844, 844×390 y 1440×900, Día/Noche. Analizar → aviso informativo → abrir Doctor → cerrar → analizar otra vez → recargar → analizar. Momento activo, reacción de 10 kN conservada, aviso no duplicado, sin desbordamiento de la página y sin errores de consola en esos recorridos.
- Caso negativo en navegador: quitar ambos apoyos produce aviso de error; su acción muestra «Análisis fallido», la falta de restricciones y «No se generaron resultados».
- Regresiones del motor: 10 kN en cada apoyo de la viga de 13 m; y 10 kN en el centro, con reacciones de 5 kN y |Mmax| = 32.5 kN·m.
- Los hashes de los diez archivos de código/pruebas transferidos a GitHub coinciden con los archivos ejecutados en el entorno de verificación.

## Límites

La comprobación es con Chromium emulado, no con un iPhone físico. No constituye certificación del cálculo estructural ni de cumplimiento normativo. Permanecen las advertencias previas del linter y de tamaño de chunks; cero errores de lint. La cámara y el zoom guardados no se reinician en este cambio: un modelo recuperado puede requerir «Ajustar modelo a la vista», especialmente a 320 px. Esta entrega no modifica el algoritmo de encuadre, el guardado ni la estabilidad del solver.
