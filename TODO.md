# Pendiente

Lista corta y viva. Se tacha o se borra al terminar; el detalle va en el commit.

## Producto

- [ ] FEM: editor mínimo de placa, apoyos y cargas (la malla ya se dibuja y colorea por von Mises, desplazamiento y calidad).
- [ ] Proyectos por herramienta: miniatura y resumen propios en los recientes de 3D, FEM y Diseño (hoy muestran datos del 2D).
- [ ] Mesas de 3D, FEM y Diseño con barra según el brandbook, y deshacer/rehacer en FEM y Diseño.
- [ ] Título de pestaña por herramienta («Solver 3D · FusionStructure»).

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
- [ ] Auditoría de dependencias en CI.
