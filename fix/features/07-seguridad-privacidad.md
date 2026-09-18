# Seguridad y privacidad

<a id="id-013"></a>

## [ ] ID-013 — Incorporar auditoría reproducible de dependencias

- Categoría: seguridad / cadena de suministro
- Prioridad: media
- Estado: abierta
- Problema demostrado: no pudo ejecutarse una auditoría de advisories: `npm` no estaba disponible y `pnpm audit` rechaza el `package-lock.json`.
- Evidencia: `pnpm audit --prod` termina con `ERR_PNPM_AUDIT_NO_LOCKFILE`; el repositorio usa `package-lock.json` y CI sí instala con `npm ci`.
- Impacto: no hay señal registrada sobre vulnerabilidades conocidas en dependencias de producción.
- Alcance: elegir el package manager autoritativo, ejecutar auditoría compatible con el lockfile y definir triage/excepciones con vencimiento.
- Fuera de alcance: declarar el producto seguro sólo por ausencia de advisories o actualizar dependencias sin pruebas.
- Dependencias: ninguna.
- Tareas relacionadas: ID-016.
- Criterios de aceptación:
  - [ ] Un checkout limpio puede ejecutar la auditoría con el runtime documentado.
  - [ ] CI registra resultados de dependencias de producción y falla según una política explícita.
  - [ ] Excepciones incluyen advisory, exposición, responsable, mitigación y caducidad.
  - [ ] El lockfile no cambia fuera de una actualización deliberada y revisada.
- Estrategia de pruebas: ejecutar instalación bloqueada y auditoría en CI; simular el parser/política con un fixture conocido sin introducir una dependencia vulnerable real.
- Riesgos: falsos positivos, ruptura por indisponibilidad del registry o actualizaciones automáticas incompatibles.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.

<a id="id-014"></a>

## [ ] ID-014 — Resolver el companion ReportLab no alcanzable

- Categoría: privacidad / arquitectura
- Prioridad: media
- Estado: abierta
- Problema demostrado: `src/utils/reportlabEnhancer.ts` implementa envío de PDF/payload a un endpoint configurable, pero no tiene importadores y su contrato de privacidad no está integrado.
- Evidencia: búsqueda de referencias sin consumidores; el resto del producto auditado no realiza tráfico de red activo.
- Impacto: el código muerto confunde el modelo de amenazas; si se conecta sin diseño explícito podría enviar datos del proyecto fuera del dispositivo.
- Alcance: decidir entre retirar el módulo o convertirlo en una capacidad opt-in con destino, consentimiento, minimización y errores visibles.
- Fuera de alcance: desplegar un servicio ReportLab, autorizar transferencia de datos o convertir la app local-first en servicio cloud.
- Dependencias: ninguna.
- Tareas relacionadas: ID-018.
- Criterios de aceptación:
  - [ ] La decisión y el flujo de datos quedan documentados en arquitectura y UI.
  - [ ] Si se retira, no quedan referencias ni documentación que prometa la capacidad.
  - [ ] Si se integra, está desactivado por defecto y muestra destino/datos antes de enviar.
  - [ ] Las pruebas cubren consentimiento, cancelación, red caída, timeout y no envío accidental.
- Estrategia de pruebas: análisis estático de importadores y red; si se integra, servidor falso local y assertions de payload/consentimiento sin usar datos reales.
- Riesgos: exfiltración involuntaria, exposición de geometría/cálculos o mantener una falsa opción que nunca funciona.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.
