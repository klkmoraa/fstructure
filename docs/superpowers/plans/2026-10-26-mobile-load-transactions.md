# Edición móvil fiable y respuesta táctil

## Acuerdo y alcance
Primera entrega acordada: editor de cargas atómico y respuesta de pulsación consistente. Conservar clay discreto, solver, guardado y rutas. El encuadre y los cambios globales de navegación quedan para otro bloque; no cambiar la cámara durante una edición.

## Implementación
1. Reproducir cancelar, dato inválido y dirección aplicada antes de confirmar mediante pruebas del dock real.
2. Extraer borrador de carga: magnitud, ángulo y sentido se aplican juntos, en una entrada de historial. Cancelar/Escape descartan sin mutar; datos inválidos mantienen borrador y foco; cambio de proyecto/selección/herramienta invalida el editor. Conservar unidades, precisión, cargas de barra y metadatos.
3. Corregir selectores de reposo que pisan pulsado/expandido; verificar CSS real en navegador con puntero abajo, sin congelar apariencia en tests de texto.
4. Ejecutar pruebas específicas, check completo, verify, lint de diseño, smoke y matriz móvil; comprobar publicación con el mismo modelo sintético.

## Registro
Base: 6daf23d8384c66bf62d4944313083b0062bf3d35. Worktree aislado /vercel/interaction.
Agentes: Codex instalado en el entorno de prueba devuelve «Not logged in». No hay despacho autenticado; ejecución directa conforme a executing-plans. No se atribuye revisión independiente.
