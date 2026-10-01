# Pendiente

Lista corta y viva. Se tacha o se borra al terminar; el detalle va en el commit.

## Producto

- [ ] FEM: colorear por desplazamiento y calidad; editor mínimo de placa, apoyos y cargas. Malla, von Mises y tablas ya se consultan en la mesa.
- [ ] Proyectos por herramienta: miniatura generada de cada modelo 3D, malla FEM o elemento de Diseño; hoy usan la escena de la herramienta y el resumen de su rama local.
- [ ] Mesas de FEM y Diseño con el lenguaje de la 2D (la de 3D ya lo tiene: dock, fichas, banda de resultados, franja de estado), y deshacer/rehacer en FEM.
- [ ] 3D: resortes en apoyos, brazos rígidos y viga de Timoshenko (hoy se rechazan con aviso).
- [ ] 3D: combinar el espectro con casos estáticos (envolventes máx./mín.) y excentricidad accidental del diafragma.
- [ ] 3D: dibujo rápido de columnas y vigas sobre la rejilla (un clic por eje o por vano) y losas como áreas.

## Diseño (de `docs/research/concrete-design`)

- [x] Calculadora experimental de seis secciones, tres filosofías, flexión/N–M, armado por lechos/perímetro, recubrimiento, cantidades y memoria PDF. El momento perpendicular pendiente se declara sin aprobarlo.
- [x] Separación propia de estribos y paso del zuncho en las columnas existentes, revisión de cortante y límites, grapas y elevación ligadas al cálculo.
- [ ] Extender los modelos experimentales de sección a normativa verificada, equilibrio biaxial completo, servicio de miembro y cortante resistente; los modelos EA/EL actuales identifican expresamente sus hipótesis.
- [ ] Armado propio por zonas en la viga (bastones y estribos por claro); hoy se fijan corridas, bastones sí/no y una separación uniforme.
- [ ] Columnas zunchadas, de lindero con contratrabe, losas de cimentación y dados: necesitan cláusulas registradas (FR y φPn,máx del zuncho, αs de borde, ancho efectivo del patín).
- [ ] Normas para ampliar el taller: torsión (NTC 5.8), losas, muros y combinaciones accidentales necesitan el texto oficial registrado con evidencia en `docs/design/normative-sources.json`.
- [ ] Confirmar con la NTC 6.7.4 si el umbral de acero mínimo por penetración (6.7.6.1.2) usa el esfuerzo combinado con transferencia de momento; hoy usa vuv directo y la nota lo avisa.
- [ ] Vínculo con el modelo (selección de miembro y demandas concurrentes): choca con el aislamiento de herramientas; decidir si se abre un puente de datos declarado en `src/integrations`.

## Limpieza

- [ ] El modo sin shell de `Space3DWorkspace` (barra local) sólo lo usan pruebas: migrarlas al shell y retirarlo.
- [ ] Dividir los archivos más grandes (`Space3DWorkspace.tsx`, `WorkspaceShell.tsx`, `ProjectContext.tsx`).

## Rendimiento y distribución

- [ ] Bajar el bundle inicial; cargar las citas (190 KB) sólo donde se muestran.
- [ ] Escenas del Inicio en WebP.
- [ ] PWA: instalación, offline y actualización coherentes.
- [ ] Publicar con el flujo oficial de Pages (artefacto) en vez de escribir en `gh-pages`.

## Pruebas (sólo si aportan)

- [ ] Humo E2E de las cinco pantallas de entrada (Inicio y cuatro bienvenidas) con capturas en claro, oscuro y móvil.
- [ ] Matriz de importación/exportación: un archivo válido y uno inválido por formato.
- [ ] Confirmar la entrega del PDF de Diseño en Safari/Chrome: la generación pasa las pruebas, pero el navegador integrado no confirmó compartir/descargar.
- [ ] Auditoría de dependencias en CI.
