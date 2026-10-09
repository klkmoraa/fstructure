# Acero explicable y edición de la pieza

Fecha: 9 de octubre de 2026. Alcance autorizado: ampliación A de [la investigación](../../research/ampliacion-concreto-2026-10-09.md); continúa con B, C y D en planes separados.

La persona puede introducir una sección rectangular y un momento último dado, obtener As requerida, mínima y proporcionada, y comprobar su armado sin inventar una viga o una carga equivalente. El formulario inicia con las acciones vacías en un problema nuevo. Explica unidades, peralte efectivo real y las reglas del perfil elegido, con referencias registradas y limitaciones del miembro. La flexión simple no acredita cortante, estabilidad, desarrollo, servicio ni una sección con axial o flexión biaxial.

La Viga permite varias cargas puntuales y distribuidas parciales o lineales por claro, con caso CM/CV, signo y posiciones explícitos. La edición de bastones y estribos muestra una elevación y controles precisos por región. La geometría usada en cálculo, dibujo y cantidades coincide. Las regiones inválidas o solapadas producen diagnóstico; el formulario conserva entradas incompletas sin calcularlas como cero. Las cargas heredadas siguen funcionando; las nuevas son adicionales, con explicación de esta suma.

El guardado usa una extensión tipada v7 para datos estructurados de viga. Conserva lectura v1–v6, campos desconocidos anteriores, borradores incompletos, apertura/duplicado/deshacer y preflight atómico de memoria/importación. No serializa arrays dentro de campos cortos ni aumenta los límites existentes. Los resultados derivados se invalidan al editar entradas.

La comparación de acero ofrece hasta tres opciones con dimensiones fijas: menor acero, menor variedad y diámetros disponibles escogidos. Comprueba cada candidato con el motor y el mismo detalle físico, distingue opciones inviables y evita estados engañosos de éxito. Aplica sólo por acción explícita y deshacible; cancela/invalida búsquedas ante cambios. Los motores pesados se ejecutan en workers.

Restricciones: español; agentes Luna con razonamiento alto; sin dependencias nuevas, backend ni red implícita; separación territorial de AGENTS.md; Home carga diferida. Perfil no respaldado o check no evaluado nunca se presenta como cumple. Interfaces simples: datos principales, dibujo y resultado próximos; detalles secundarios plegables; teclado, Día/Noche y teléfono de 390 px. Exportación PDF y memoria reproducen las mismas entradas y exclusiones.

Verificación: referencia independiente de estática y flexión con tolerancia; carga parcial/triangular/puntual y equilibrio; congestión/bastones inválidos; migración, guardar/reabrir, importación inválida, memoria llena, undo y cancelación; navegador móvil y escritorio. Cada tarea termina con pruebas relacionadas y revisión independiente; al integrar todos los bloques se ejecuta npm run check y se publica según AGENTS.md.
