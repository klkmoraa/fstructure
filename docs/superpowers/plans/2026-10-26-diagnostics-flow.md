# Diagnóstico sin desvíos — plan

**Objetivo:** que analizar un ejercicio con EI relativa permita seguir viendo el diagrama sin mandar a Model Doctor ni mantener una alerta genérica encima.
**Base:** 55e1d0a0a44075be04473264bdc139786d8d4877. Worktree aislado, ejecución directa.
**Causa reproducida:** viga con rodillo izquierdo y guía derecha: Ry=10 kN, Mr=28.91 kN·m; calidad numérica fiable, avisos relative-stiffness y small-displacement-assumption derivados de EI de referencia. El feedback trataba esta combinación como advertencia genérica permanente; con sólo relative-stiffness enlazaba a Doctor.
**Restricciones:** no alterar solver, validación, umbrales, apoyos, cargas, persistencia ni dependencias. No declarar validez física a partir de la calidad numérica. Mantener todos los avisos originales inspeccionables. Los fallos y las advertencias ajenas a la referencia conservan su gravedad.

- [x] Pruebas rojas del aviso de rigidez relativa, la combinación reproducida, errores reales, calidad limitada y advertencias mixtas.
- [x] Todos los avisos de análisis abren Resultados. La referencia relativa, incluso si su deformada excede la hipótesis lineal, se explica como limitación informativa; nunca como resultado físico validado.
- [x] Aviso compacto de cálculo y acceso persistente a los diagnósticos originales dentro de Resultados, sin tener que abrir Doctor. No quitar los avisos del motor.
- [x] Pruebas de navegación explícita, errores, pantalla 320/390 px Día/Noche; check completo, build y smoke. Publicar sólo archivos verificados.
