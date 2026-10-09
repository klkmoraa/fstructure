# Problemas propios y distribución de acero · 9 de octubre de 2026

Estado: verificado para publicación.

## Decisiones del producto

Aula permite capturar un problema propio o construir un modelo vacío. El inicio Ejercicio de Diseño abre formularios sin dimensiones ni cargas supuestas. El selector que reemplazaba toda una sección por un preset y la guía de respuestas prefabricadas se retiran de la mesa; los datos guardados se conservan.

La propuesta de acero mantiene geometría, materiales, acciones y recubrimiento. Dimensionar una sección es una acción distinta. El estudio experimental compara soluciones discretas de acero con su capacidad; As propuesta no se presenta como una solución analítica normativa de As requerida.

## Referencias y alcance de grupos

El registro [normative-sources.json](normative-sources.json) conserva la evidencia y huellas de las fuentes utilizadas por los motores. Los extractos registrados de NTC 2023 §14.2.1 y §14.2.3, NSR C.7.6.1/.3 y E.060 §7.6.1/.3 cubren separación libre entre barras. NTC §14.7.3.3 distingue barras y paquetes para el diámetro transversal; eso no prueba un máximo universal de tres barras por paquete.

La investigación adicional de los PDF oficiales fue bloqueada por HTTP 403 del entorno; no se presenta como una nueva revisión del texto completo ni como una comprobación nueva de sus SHA. No se añadieron ecuaciones normativas a partir de ese acceso fallido.

«Grupos separados» usa 1–3 barras por esquina y 0–3 por centro de cara. Ese límite de tres es una preferencia de composición. Cada barra ocupa una posición real, con la separación geométrica existente del laboratorio. Los grupos no son paquetes en contacto. La resistencia, el área y el dibujo consumen las mismas coordenadas. El estudio sigue siendo Experimental: cortante, confinamiento sísmico, equilibrio biaxial completo y diseño normativo de paquetes requieren ampliaciones con evidencia.

## Comprobación numérica

Referencia independiente para viga 300×600 mm, recubrimiento 40 mm, estribo 9.5 mm y seis barras continuas Ø19.1 por lecho: primera capa con cuatro barras a 59.05 mm del paño; segunda con dos a 103.15 mm. Centroide = (4×59.05 + 2×103.15)/6 = 73.75 mm. El motor entrega d = 600−73.75 = **526.25 mm**, igual a la referencia (tolerancia 1e−8 mm), y As = 1719.1266 mm² por lecho.

En las acciones del borrador de columna (Pu 900 kN, Mux 80 kN·m, Muy 40 kN·m), la propuesta fija NTC conserva 400×500 mm y encuentra 16 barras Ø12.7 mm (2 por ancho, 8 por profundidad), As 2026.8299 mm², estado `pass`. Para Ø450 mm conserva el diámetro y propone 13 barras Ø12.7, As 1646.7993 mm², estado `pass`. Son comprobaciones del motor y sus hipótesis existentes, no una certificación del proyecto.

El laboratorio coloca 24 barras Ø19.1 en 600×600 mm (tres por esquina y tres por centro de cara). La separación libre mínima medida entre todos los pares es 40 mm; al reducir la sección a 200×200 mm informa que las barras no caben. Para la sección propia 300×550 mm, N=0 y M=100 kN·m, búsqueda de catálogo con φ=0.75 encuentra 2 superiores y 4 inferiores Ø15.9, utilización 0.874254. Se evaluaron 220 candidatos; en Chromium local la búsqueda pura tardó unos 62 ms. Las dimensiones y el momento permanecieron intactos.

## Navegador y recuperación

Chromium real, escritorio 1440×1000 y teléfono 390×844, Día/Noche: sin errores de página ni desbordamiento horizontal. Las capturas se incluyen en [brandbook](../brandbook/index.html).

- Aula ofrece únicamente problema propio y modelo vacío. El botón de Diseño abre Ejercicio con tres formularios incompletos. Crear un ejercicio de modelo deja cero nodos y barras; el proyecto anterior conserva sus diez miembros.
- La sección propia abre geometría, recubrimiento, materiales y N/M vacíos. Capturar 30×55 cm, recubrimiento 4 cm, f′c 250 kg/cm², fy 4200 kg/cm², N=0 y M=100 kN·m permite proponer Ø15.9 sin cambiar esos datos.
- Guardar, recargar y descargar PDF conserva clave, ubicación, acciones y armado. El PDF individual tiene siete páginas e incluye sus entradas reproducibles y alcance Experimental. Otro PDF de siete páginas conserva las 24 barras, grupos 3+3 y separación libre de 40 mm.
- Un problema incompleto se conserva al iniciar otra pieza. Los campos heredados `exercise-beam-simple` y `constructor` sobreviven la recarga sin mostrar una guía antigua.
- La propuesta real de columna mantiene 40×50 cm y las tres acciones dadas; devuelve Ø12.7 con 2 barras por ancho y 8 por profundidad. La viga propia de seis corridas por lecho, sin bastones, dibuja doce barras en cuatro alturas.
- Grupos 3+3 en sección 60×60 cm dibujan 24 centros distintos. Al reducir a 30×55 cm se retira el dibujo incompatible; Proponer acero recupera un grupo 1+1 Ø19.1 manteniendo la sección.
- Retrasar la carga del worker y editar M, o cancelar explícitamente, evita aplicar la respuesta vieja. Se observaron dos solicitudes reales al worker y ningún error de página.
- Importar un JSON inválido desde Home se rechaza y conserva tanto el modelo como la rama Diseño, comparados completos antes/después.

Los JSON, PDF y scripts de comprobación viven en `qa-artifacts/problemas-armado/`, ignorado por Git. Se corrigieron selectores de roles de la prueba de navegador y se esperó el guardado diferido de 600 ms antes de capturar IndexedDB; esos ajustes no modificaron el producto.

## Gate de entrega

La verificación de cambios (`npm run verify -- 517024cfc1a2823300afd8795db65fc081612297`) pasó después de corregir la sincronización del foco inicial de una prueba: **62 suites / 435 pruebas**, typecheck, lint de 43 archivos y **5 casos del oráculo Python**. La navegación por teclado conserva sus aserciones originales.

Tres revisiones de tarea, sus arreglos acotados y una revisión global independiente con agentes Luna alto quedaron limpias. La revisión global contrastó el rango hasta `d594e7d` y la documentación/capturas del controlador; no identificó findings reproducibles. El reporte temporal con estado QA anterior queda sustituido por esta ficha.

`npm run check` terminó con exit 0: **173 suites / 1194 pruebas**, **20 pruebas de arquitectura**, **5 casos del oráculo Python**, lint, typecheck y build. El build mantiene el aviso existente de chunks grandes; no impide compilar.

La entrega se integra en `main` y se publica mediante el workflow de GitHub Pages. El controlador confirma el commit `deploy:` correspondiente al SHA de entrega en `FETCH_HEAD`, ya que este checkout sigue únicamente `main`.

## Decisiones operativas

1. Se usó el checkout aislado existente en `main`, con commit/push autorizados por el usuario y AGENTS. Si esa interpretación fuera incorrecta, habría que revertir un commit revisable.
2. El máximo de tres por grupo se implementó como preferencia de barras separadas, sin afirmar un límite normativo universal. El coste de este alcance es dejar los paquetes en contacto pendientes de evidencia específica.
3. Se generaron los briefs y paquetes de revisión localmente porque los recursos de scripts de la skill no estaban disponibles. El formato puede diferir del script original; se conservaron las revisiones y gates.
