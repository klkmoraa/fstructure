# Análisis sin avisos rutinarios — plan

> Ejecución directa con Superpowers; el usuario pide quitar el aviso, no reducirlo.

**Objetivo:** analizar sin popups de éxito o rigidez relativa y reducir texto redundante sin ocultar errores reales.
**Base:** 9bbfd73c7f1bf4192aa05311f36635877b74917b.
**Arquitectura:** el hook sólo presenta los avisos warning/error de la política existente. No modifica `analysisFeedback`, sus severidades, sus diagnósticos ni la duración de las advertencias. Éxito e información no generan popup. Las notas existentes conservan los diagnósticos y reducen sólo su texto introductorio.
**Stack:** React/TypeScript, Vitest, Playwright.
**Restricciones:** no solver, umbrales, datos, apoyos, cargas, almacenamiento ni dependencias de producto. No ocultar toasts mediante CSS. Las advertencias físicas/numéricas, errores y equilibrio parcial siguen visibles. Se conservan nombres accesibles y etiquetas útiles de herramientas.

**Ruling:** el intento amplio fue bloqueado antes de editar; se limita la implementación a confirmaciones informativas y copy. No se implementa borrado automático de errores anteriores; siguen cerrándose con su control explícito.

- [x] Probar primero silencio de éxito/referencia y conservar advertencias físicas/numéricas y errores ajenos al análisis.
- [x] Filtrar sólo confirmaciones rutinarias antes de emitirlas; recortar caption e introducción de Notas.
- [x] Actualizar pruebas de la política anterior; mantener regresiones de severidad y datos sin mutar.
- [x] Probar en navegador: tres análisis, resultados, notas, modelo inválido y advertencias importantes, móvil Día/Noche.
- [x] Ejecutar suite completa, verify, lint:design y smoke; documentar.
- [ ] Publicar y comprobar la web pública con el mismo recorrido.
