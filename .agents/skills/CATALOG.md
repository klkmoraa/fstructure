# Catálogo de skills de FStructure

Revisión: 2026-09-18. Las referencias se fijan a commits inmutables. Ninguna skill local contiene scripts ejecutables ni `AGENTS.md` anidados.

## Integradas

| Nombre | Uso | Origen | URL oficial | Revisión | Licencia | Cambios locales | Dependencias/red | Motivo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fstructure-workflows` | Modelo, solver, unidades, workers, persistencia, undo/redo e interoperabilidad propios | Creación local a partir de la auditoría del repositorio | Este repositorio | 2026-09-18 | MIT del repositorio | Skill y tres referencias propias | Ninguna | Conserva contratos de dominio que una IA genérica no puede inferir con seguridad. |
| `security-best-practices` | Revisión de seguridad explícita para JavaScript/TypeScript/React | OpenAI `openai/skills` | https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/security-best-practices | `49f948faa9258a0c61caceaf225e179651397431`, 2026-09-18 | Apache-2.0 (`LICENSE.txt` incluido) | Adaptada a FStructure: sólo conserva referencias JavaScript frontend y React/TypeScript; cinco espacios finales normalizados | Sin scripts; referencias contienen enlaces que se consultan sólo bajo demanda | Aporta un checklist mantenido y específico del stack para archivos, XSS, URLs, storage, PWA y supply chain sin cargar tecnologías ajenas. |
| `accessibility-review` | Auditorías de accesibilidad de UI y diseños | Anthropic `knowledge-work-plugins` | https://github.com/anthropics/knowledge-work-plugins/tree/6780219cc091b518145c57766b845b6707c06afa/design/skills/accessibility-review | `6780219cc091b518145c57766b845b6707c06afa`, 2026-09-18 | Apache-2.0 ([aviso](ANTHROPIC-NOTICE.md)) | Se eliminó acoplamiento a connectors y se actualizó de WCAG 2.1 AA a 2.2 AA | Ninguna | Añade una revisión repetible de teclado, foco, contraste, zoom, lector de pantalla y targets táctiles. |
| `design-system` | Auditar, documentar y extender el sistema de diseño | Anthropic `knowledge-work-plugins` | https://github.com/anthropics/knowledge-work-plugins/tree/6780219cc091b518145c57766b845b6707c06afa/design/skills/design-system | `6780219cc091b518145c57766b845b6707c06afa`, 2026-09-18 | Apache-2.0 ([aviso](ANTHROPIC-NOTICE.md)) | Se eliminó acoplamiento a connectors | Ninguna | Ayuda a conservar tokens, estados, variantes y contratos accesibles del design system raíz. |
| `testing-strategy` | Diseñar planes y matrices de prueba proporcionales | Anthropic `knowledge-work-plugins` | https://github.com/anthropics/knowledge-work-plugins/tree/6780219cc091b518145c57766b845b6707c06afa/engineering/skills/testing-strategy | `6780219cc091b518145c57766b845b6707c06afa`, 2026-09-18 | Apache-2.0 ([aviso](ANTHROPIC-NOTICE.md)) | Ninguno | Ninguna | Complementa la matriz específica de FStructure con selección estructurada de unitarias, integración y E2E. |
| `documentation` | README, arquitectura, runbooks y onboarding | Anthropic `knowledge-work-plugins` | https://github.com/anthropics/knowledge-work-plugins/tree/6780219cc091b518145c57766b845b6707c06afa/engineering/skills/documentation | `6780219cc091b518145c57766b845b6707c06afa`, 2026-09-18 | Apache-2.0 ([aviso](ANTHROPIC-NOTICE.md)) | Ninguno | Ninguna | Mantiene documentación útil, orientada a audiencia y sin duplicar fuentes de verdad. |

## Superpowers global

No se copia en `.agents/skills/`. Codex y Claude tienen Superpowers 6.3.0 habilitado desde el marketplace oficial; el checkout local corresponde al commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`, tag público `v6.3.0`. `git describe` añade `-dirty` únicamente por un `AGENTS.md` retirado del empaquetado y el marcador runtime `.in_use/`; los archivos funcionales coinciden con el commit oficial. El repositorio oficial es https://github.com/obra/superpowers y la licencia es MIT. Los planes versionados en `docs/superpowers/` y los artefactos ignorados en `.superpowers/sdd/` demuestran uso en FStructure. Su proceso complementa, pero no sustituye, `AGENTS.md` ni el backlog.

## Fuentes evaluadas pero no integradas

| Fuente | Revisión | Decisión |
| --- | --- | --- |
| Vercel `react-best-practices` | `vercel-labs/agent-skills@063bee94c3f4df8453406c830b0a7df0f2860278` | No integrada: el snapshot declara MIT en frontmatter pero no incluye archivo de licencia; además trae un `AGENTS.md` anidado y una fracción grande de reglas Next.js/servidor ajenas a esta SPA Vite. Las reglas React aplicables se pueden consultar en origen sin redistribuirlas. |
| OpenAI `frontend-testing-debugging` | `openai/plugins`, revisada 2026-09-18 | No integrada: depende del Browser plugin/Playwright y se solapa con la skill global `playwright`; el repositorio no debe acoplarse a un harness concreto. |
| Otras skills Anthropic de diseño/negocio y las skills de depuración, TDD, code review y verificación incluidas por Superpowers | Paquetes globales y `anthropics/knowledge-work-plugins@6780219cc091b518145c57766b845b6707c06afa`, revisados 2026-09-18 | No integradas: son ajenas al producto o duplican procesos ya cubiertos por Superpowers. Se versionaron sólo accesibilidad, design system, estrategia de pruebas y documentación. |
| Superpowers | `obra/superpowers@b36e0829c6d0140e93cfef2ca599b1b07d4a7797`, `v6.3.0` | No integrada localmente: ya está instalada, habilitada y actualizada en Codex y Claude. |
| OpenSees, Frame3DD, XC, CalculiX, FreeCAD e IfcOpenShell | Revisiones registradas en `docs/design/open-source-landscape.md` | No son skills. Son motores/herramientas de referencia con licencias, físicas y runtimes distintos; no deben injertarse como instrucciones ni dependencias por esta preparación. |
| Autodesk/DWG/IFC y documentación normativa | Fuentes oficiales evaluadas por alcance | No integradas: FStructure implementa hoy DXF parcial, Gmsh 4.1 ASCII y formatos propios. Manuales protegidos o especificaciones completas no se copian a skills; ampliar interoperabilidad exige una tarea y licencia compatibles. |

## Mantenimiento

Antes de actualizar una fuente externa, leer `SKILL.md`, referencias requeridas, licencia y cualquier script; revisar red, telemetría y subidas; fijar un nuevo commit; validar y actualizar esta tabla. No instalar por nombre o popularidad si duplica una skill global o contradice el alcance local-first.
