# Pendiente

Lista corta y viva. Se tacha o se borra al terminar; el detalle va en el commit.

## Producto

- [ ] FEM: dibujar la malla y colorearla por von Mises, desplazamiento y calidad; editor mínimo de placa, apoyos y cargas.
- [ ] Proyectos por herramienta: miniatura y resumen propios en los recientes de 3D, FEM y Diseño (hoy muestran datos del 2D).
- [ ] Mesas de 3D, FEM y Diseño con barra según el brandbook, y deshacer/rehacer en FEM y Diseño.
- [ ] Título de pestaña por herramienta («Solver 3D · FusionStructure»).

## Limpieza

- [ ] Retirar el puente 2D↔3D que ya no se usa: `src/integrations/*`, `modules/space3d/integrations`, el traspaso y «re-derivar» dentro de `Space3DWorkspace`, y `executeApprovedSpace3DSync` del store.
- [ ] Dividir los archivos más grandes (`Space3DWorkspace.tsx`, `WorkspaceShell.tsx`, `ProjectContext.tsx`).
- [ ] Decidir el complemento ReportLab (`requirements-reportlab.txt`, `utils/reportlabEnhancer.ts`): conectarlo o quitarlo.

## Rendimiento y distribución

- [ ] Bajar el bundle inicial; cargar las citas (190 KB) sólo donde se muestran.
- [ ] Escenas del Inicio en WebP.
- [ ] PWA: instalación, offline y actualización coherentes.
- [ ] Publicar con el flujo oficial de Pages (artefacto) en vez de escribir en `gh-pages`.

## Pruebas (sólo si aportan)

- [ ] Humo E2E de las cinco pantallas de entrada (Inicio y cuatro bienvenidas) con capturas en claro, oscuro y móvil.
- [ ] Matriz de importación/exportación: un archivo válido y uno inválido por formato.
- [ ] Auditoría de dependencias en CI.
