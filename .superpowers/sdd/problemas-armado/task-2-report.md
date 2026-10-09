# Task 2 — grupos separados y búsqueda de diámetros

## Estado

Implementado en `main`. Commit de implementación: `bde1ff0dcb1ea2662625b7de7a5b2c3da64c5984` (`Add grouped section reinforcement search`). Sin push.

## Cambios

- `SectionStudioInput` admite `barLayout: 'zones'` con conteos de esquina y cara. El total debe coincidir con `4 × (esquina + cara)`; la distribución sólo acepta sección cuadrada o rectangular.
- Las coordenadas siguen las reglas c1/c2/c3 y f1/f2/f3 del brief. Se comprueba que cada centro quede dentro del contorno del acero y se mide la distancia entre todos los pares. Zonas congestionadas o fuera de la sección son inválidas; no se escala ni se superponen barras para simular acomodo.
- La búsqueda acepta un catálogo opcional, descarta valores no finitos/no positivos y duplica diámetros, y elige el menor As factible con orden de desempate determinista. Sin catálogo conserva el diámetro ingresado. En zonas prueba esquina 1–3 y cara 0–3; otras distribuciones mantienen el recorrido hasta 24 barras.
- El adaptador agrega los valores iniciales `1`/`1`, calcula el total de zonas, informa conteos inválidos y permite `preset: 'custom'` sin sustituir los valores actuales.
- La memoria muestra distribución, separación mínima de todos los pares y criterio geométrico experimental. Aclara que tres barras por grupo es una opción de acomodo, no un límite normativo.

## TDD y verificación

Rojo inicial: `npx vitest run src/design/concrete/sectionStudio.test.ts src/features/design/workbench/concreteStudioModel.test.tsx` terminó con 5 fallos en las nuevas pruebas y 37 pruebas previas verdes. Detectó la falta de zonas, búsqueda de catálogo y adaptación. Una expectativa inicial de rechazo perpendicular usaba resistencia última; corregí el caso para usar el escenario de esfuerzos admisibles que ya tenía ese rechazo. Después agregué `custom` preservando el borrador y observé su rojo: se esperaba ancho `71` y el preset lo reemplazaba por `40`.

Verde final:

```text
npx vitest run src/design/concrete/sectionStudio.test.ts src/features/design/workbench/concreteStudioModel.test.tsx
Test Files  2 passed (2)
Tests       42 passed (42)
```

```text
npm run typecheck
> tsc -b --noEmit
(exit 0)
```

`git diff --check` terminó sin errores. Las pruebas relacionadas cubren 24 coordenadas simétricas en 600×600, congestión en 200×200, conteos inválidos, forma circular, catálogo con entradas inválidas/duplicadas, propuesta que reduce diámetro frente al armado manual congestionado, geometría y As reportados, demanda sin mutación, reporte de grupos y compatibilidad existente.

## Alcance pendiente / concerns

`ConcreteStudio.tsx` no cambió según la división de tareas; la interfaz debe conectar estos campos y la opción de catálogo en Task 3. El motor y los adaptadores de sección ya exponen y reportan la información que esa conexión necesita. No se ejecutó la suite global; el controlador indicó que hará el gate global.
