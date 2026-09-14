# Handoff del brandbook a Diseño Estructural

Fecha de corte: 2026-09-14. Fuente canónica local: `/Users/crismora/Desktop/FusionStructureBrand/brandbook-site`, snapshot Git limpio `315d5ac583340223d35f9cdfd1f658af8bf4ea65`. Archivos cotejados: `app/brand/system.ts`, `app/brand/generated/palette.ts`, `app/brand/copy.ts`, `app/atlas.css`, `app/globals.css` y las secciones Typography, Iconography, Patterns y Handoff.

La integración no copia CSS ni componentes del brandbook. Aplica estas decisiones mediante `src/design-system/tokens.css`, `material.css`, `fonts.css`, los controles/superficies existentes y el broker de presentación. Cuando el brandbook y un alias de su página Atlas difieren, gobiernan los datos exportables de `system.ts` y su guarda ya incorporada en Solver2D.

## Color

El chrome es neutro; el color comunica familia, señal técnica o estado. No se tiñen paneles completos.

| Rol | Día | Noche | Token de Solver2D |
| --- | --- | --- | --- |
| Marca/núcleo | `#1AA57A` | `#1AA57A` | `--fs-family-nucleo` |
| Análisis / acción primaria | `#ED4B46` | `#FF8E80` | `--fs-family-analisis` |
| Modelo | `#7657D5` | `#A990FF` | `--fs-family-modelo` |
| Civil | `#468C09` | `#72CF4A` | `--fs-family-civil` |
| Proyecto | `#D9720A` | `#F3C553` | `--fs-family-proyecto` |
| Conexiones | `#3A72E3` | `#72A1FF` | `--fs-family-interop` |
| Aprendizaje | `#C94A8F` | `#F07DB5` | `--fs-family-aprendizaje` |

Las señales técnicas se conservan por significado: axial `#0F95D1/#63C5FF`, momento `#ED4B46/#FF8E80`, cortante `#468C09/#55C990`, deformada `#8B5CF6/#9B87FF`, influencia/fluencia `#D85AC9/#EF7AB9` y atención `#D9720A/#F3C553`. La superficie de Diseño deberá usar la familia Análisis para su acción primaria y los tokens de señal sólo para datos, diagramas y checks correspondientes.

La rampa neutral canónica es:

| Paso | Día | Noche |
| --- | --- | --- |
| 000 | `#FFFEFA` | `#0E1113` |
| 050 | `#F7F6F1` | `#14171A` |
| 100 | `#EDEFE9` | `#1B1F22` |
| 200 | `#DDE2DC` | `#252A2E` |
| 300 | `#C6CDC6` | `#333A3E` |
| 400 | `#A7B1A9` | `#465055` |
| 500 | `#7E8A84` | `#5E6A6F` |
| 600 | `#5C6A6F` | `#8B9599` |
| 700 | `#3F4A50` | `#B4BDC0` |
| 900 | `#14171A` | `#F2F4F3` |

## Tipografía y números

- Display: Space Grotesk, con Inter y `ui-sans-serif` como fallback. Se reserva para títulos que orientan, no para cifras densas.
- Interfaz: Inter con fallbacks de sistema. Es la familia de controles, listas y texto operativo.
- Datos: IBM Plex Mono con fallbacks monoespaciados. Las cifras usan números tabulares, unidad junto al valor, signo visible, precisión no inflada, escala declarada y versión/procedencia junto al resultado.
- Plus Jakarta Sans es el acento editorial del brandbook; la superficie técnica no lo introduce porque el design system actual no lo expone como token de producto.
- La escala editorial del brandbook va de Display `clamp(46px, 7vw, 108px)` a Etiqueta `10.5px/1.2`. En producto se usan los roles densos existentes (`--sc-font-size-*`), no tamaños literales nuevos.

## Espaciado, radios y objetivos

El brandbook publica la escala base `4, 8, 12, 16, 24, 32, 48, 64px`. Solver2D adapta esa cadencia a su densidad con `--sc-space-1..8 = 4, 8, 12, 16, 20, 24, 32, 40px`; Diseño debe consumir esos tokens y reservar los saltos grandes para separación estructural, nunca para inflar controles.

Los radios canónicos exportables son dato `6px`, control `12px`, tarjeta `18px`, panel/modal `24px` y píldora `999px`. Los valores Atlas heredados de `10/18/28px` son aliases visuales de la página del brandbook y no se copian. Los objetivos mínimos existentes son `30px` con puntero y `44px` con tacto.

## Elevación y materia

Una sola luz entra desde arriba-izquierda y la sombra cae abajo-derecha. La elevación significa solapamiento, no importancia:

- Plano: rejillas, tablas y filas técnicas; sin volumen adicional.
- Interior: cavidad interactiva con `--sc-shadow-inset`.
- Elevado: paneles, barras e inspector con `--sc-shadow-raised`.
- Flotante: popovers y avisos que cubren contenido con `--sc-shadow-lg`.
- Hoja: superficie nacida de un borde con `--sc-shadow-sheet`.
- Modal: decisión interruptiva con velo y `--sc-shadow-modal`.

No se añaden glows, degradados decorativos, fuentes de luz por componente ni tarjetas elevadas dentro de otra tarjeta. Pulsar desplaza `1.5px` y cambia a la cavidad; foco, borde y estado permanecen distinguibles.

## Iconografía

Se reutilizan Lucide y `src/design-system/icons/structural.tsx`; no entran los iconos del prototipo. Un glifo de dominio se dibuja en retícula de 48 unidades con 8 de aire, trazo único 2.6, extremos redondos, uniones a inglete, estructura en color de familia y dato en grafito. Los nudos son visibles, no se usan metáforas prestadas y todo glifo nuevo debe distinguirse sin etiqueta a `20px`. Los iconos de acción llevan nombre accesible aun cuando M1/K0 oculten la etiqueta.

## Responsive y movimiento

El brandbook colapsa su retícula a una columna y convierte el rail en overlay a `920px`, además de respetar `prefers-reduced-motion`. En Solver2D gobierna el resolutor único de composición, no un media query nuevo:

- X2: ancho expandido calculado por presupuesto de canvas (aprox. `1042–1130px`, según altura), rail con etiquetas y Diseño acoplado.
- M1: por encima de `1023px` cuando X2 no cabe, rail compacto y Diseño en drawer sin reflow.
- K0: `≤1023px`, Diseño a pantalla completa; `≤700px` activa el submodo teléfono.
- La frontera X2/M1 usa una banda de histéresis total de `24px`; K0 y teléfono cruzan exactamente para coincidir con el CSS existente.

Las transiciones usan la escala y easings existentes; con movimiento reducido se elimina animación no esencial. El panel entra desde el borde que lo originó, una comparación conserva ejes y escala, y un proceso muestra avance real o declara que no puede estimarlo.

## Checklist para la futura superficie Diseño

- Usar sólo tokens `--sc-*`/`--fs-*` y componentes públicos del design system.
- Mantener modelo, demanda, refuerzo, check y evidencia en una jerarquía legible y densa.
- No usar color para decorar ni para sustituir texto/ícono de estado.
- Presentar límites y procedencia junto a cada resultado; el producto propone y explica, la responsabilidad técnica sigue en la persona.
- Verificar Día/Noche, teclado, tacto, movimiento reducido y las composiciones X2/M1/K0 contra ambos conceptos aceptados.
