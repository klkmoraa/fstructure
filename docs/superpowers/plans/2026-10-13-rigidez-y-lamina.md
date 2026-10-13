# Constantes de rigidez y lámina del DCL completo

Ejecución directa, sin agentes, autorizada por la libertad de implementación solicitada y AGENTS.md.

**Objetivo:** ejercicios con EI, E o I constante, con o sin valor, factor global (incluido 2EI) y factor propio de cada barra. Capas comparte fila con resultados y ACM se convierte en una lámina del DCL completo: toda la viga o todo el marco, con N/V/M alineados, sin aplanar barras individuales.

**Modelo:** `settings.stiffnessDefaults` guarda modo, valor opcional y factor predeterminado. `member.stiffnessFactor` identifica barras vinculadas a esa base. E/I numéricos siguen siendo la entrada única de todos los motores; comandos materializan la base y conservan A y la propiedad independiente. Sin valor se usa una referencia declarada, con advertencia de desplazamientos relativos. Los proyectos anteriores conservan todos sus valores; esquema v9 valida los nuevos datos. Ediciones físicas/catálogos desvinculan la constante correspondiente. Todo pasa por el historial reversible.

- [x] Pruebas primero: 2EI reduce a la mitad la flecha de un voladizo; E e I independientes, cambios de base, nuevos miembros, deshacer, reapertura y rechazo de datos inválidos.
- [x] Dominio: tipos, constantes, comandos y migración. Base EI sólo para pórticos; E también para armaduras.
- [x] Interfaz: bloque de rigidez con selector compacto EI/E/I, modo con/sin valor y factor; en una barra se puede usar la base o sus propiedades propias. Configuración disponible en Aula y Completo; aplicar a todas es acción explícita.
- [x] Lámina: conservar el DCL con cargas y reacciones y repetir toda su geometría en N/V/M, usando la misma cámara y los mismos renderizadores para barras, nudos, apoyos, rótulas y zonas rígidas. El área se desplaza verticalmente; las copias nunca se comprimen para entrar simultáneamente.
- [x] Capas: fila superior común sin superposición y menú accesible por teclado.
- [x] Verificar con `npm run verify`, `npm run check`, `npm run lint:design` y navegador Día/Noche, móvil y escritorio. Actualizar ficha y capturas; commit y push publicable.

Referencia final: imagen de la viga con voladizo suministrada por el usuario y aclaración de dibujar el marco/viga completo. Coordenadas verificadas entre DCL y las tres copias, con tramos y voladizo; controles alineados en Día/Noche, móvil y horizontal. Los bundles v8 conservan sus bytes y checksum al leer; migran a v9 al guardar.
