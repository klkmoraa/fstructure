# Rendimiento

<a id="id-006"></a>

## [ ] ID-006 — Reducir el bundle inicial y las importaciones ineficaces

- Categoría: rendimiento / arquitectura de entrega
- Prioridad: alta
- Estado: abierta
- Problema demostrado: el build produce un JS inicial de 2.091,52 kB, CSS de 690,66 kB y worker PDF de 2.228,48 kB; Vite avisa de cinco familias de imports dinámicos que no separan chunks.
- Evidencia: salida reproducible de `npm run build`; los avisos señalan `structuralEditing`, `projectCommand`, `pDelta`, `projectRepository` y `calculationPdf`.
- Impacto: mayor tiempo de descarga, parseo y arranque, especialmente en móviles; la separación aparente puede dar una falsa sensación de lazy loading.
- Alcance: medir composición, corregir límites de chunks y diferir superficies/exportadores pesados con presupuestos explícitos.
- Fuera de alcance: microoptimizar el solver sin perfiles, eliminar capacidades o cambiar resultados numéricos.
- Dependencias: ID-003.
- Tareas relacionadas: ID-005, ID-012, ID-017.
- Criterios de aceptación:
  - [ ] Existe una línea base automatizada y presupuestos aprobados para JS/CSS iniciales y workers.
  - [ ] Las cinco advertencias se eliminan o se documentan con una razón comprobada.
  - [ ] El chunk inicial disminuye de forma material según el presupuesto acordado.
  - [ ] Portada y las cuatro superficies mantienen sus flujos y no duplican módulos en runtime.
- Estrategia de pruebas: analizar chunks antes/después, ejecutar build de producción y smoke con caché fría; comparar tiempos y tamaños sin aceptar sólo cambios de nombre.
- Riesgos: crear demasiadas solicitudes pequeñas, mover coste al primer clic o romper workers/rutas de assets en Pages.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.
