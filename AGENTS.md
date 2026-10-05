# FusionStructure — reglas persistentes

Este archivo define cómo trabajar en este repositorio. FusionStructure es experimental: ninguna carpeta, módulo, solver, esquema, worker, persistencia o superficie visual debe tratarse como definitiva.

## Autoridad

Cuando exista una discrepancia, el orden es:

1. código ejecutable y pruebas;
2. puertas automatizadas;
3. documentación canónica;
4. historial de Git;
5. planes, ideas o conversaciones anteriores.

Un plan no demuestra que algo esté implementado. La implementación y sus pruebas sí aportan evidencia, aunque una puerta verde tampoco convierte una función experimental en software profesional certificado.

## Sin áreas protegidas

No existe una política de archivos protegidos en este repositorio. Cualquier parte puede rediseñarse, reescribirse, reemplazarse o eliminarse cuando el cambio esté justificado y se actualicen sus referencias, migraciones, pruebas y documentación.

Esta regla es técnica y de proceso. No significa que desaparezcan la licencia MIT, los derechos de autor o las licencias de dependencias y estándares externos.

## Calidad mínima

La validación por defecto debe ser proporcional al cambio y consumir el mínimo tiempo posible.

- No ejecutar `npm run check`, la suite completa ni pruebas no relacionadas por rutina.
- Para UI, estilos, copy, composición y refactors sin impacto de dominio: usar únicamente la comprobación más barata que detecte errores del cambio, normalmente build o typecheck y, cuando aporte valor, una revisión visual puntual.
- Para solver, matemáticas, unidades, cargas, combinaciones, análisis, import/export estructural o resultados: ejecutar sólo las pruebas focalizadas directamente relacionadas y añadir un caso pequeño de referencia cuando cambie el comportamiento numérico.
- Para persistencia, migraciones, undo/redo o formato de proyecto: ejecutar sólo las pruebas focalizadas del flujo tocado y comprobar que un proyecto existente puede abrirse/guardarse sin pérdida.
- Ejecutar la suite completa únicamente si el usuario la pide expresamente, si se prepara una release importante o si un cambio transversal hace imposible aislar una verificación menor.
- No crear pruebas nuevas para cambios puramente visuales salvo que exista una regresión concreta que valga la pena fijar.
- Indicar brevemente qué se verificó y qué no; no presentar como validado aquello que no se ejecutó.

La ausencia de una prueba no es evidencia de que la función funcione, pero tampoco justifica ejecutar pruebas irrelevantes.

## Dirección de producto

El producto se organiza alrededor de un proyecto común. Las futuras superficies deben poder relacionarse con:

- identidad, contexto, ubicación, unidades y fases;
- modelo físico y modelo analítico;
- entradas, hipótesis, resultados y procedencia;
- documentos, revisiones, incidencias y aprobaciones;
- cantidades, costos, recursos y programa;
- campo, seguridad, cambios y expediente final;
- educación, ejemplos y explicaciones.

Una feature nueva debe declarar qué entidad del proyecto modifica, qué validaciones necesita, cómo se deshace, cómo se guarda, cómo se exporta y cómo se prueba.

## Trabajo experimental

- Diferenciar siempre `Disponible`, `Experimental`, `Planeado` y `No comprometido`.
- No esconder limitaciones detrás de una interfaz pulida.
- No describir el producto como patentado, certificado, protegido o listo para obra si no existe evidencia específica.
- Mantener las unidades y las conversiones explícitas.
- Tratar resultados derivados como resultados versionados, no como datos de entrada.
- Preferir formatos abiertos y adaptadores aislados.
- Evitar que la interfaz sea la única fuente de reglas de negocio.

## Foundation local

- `src/foundation` es propiedad local y exclusiva de este repositorio: aquí viven las unidades, el álgebra lineal, los tipos numéricos y sus pruebas.
- No agregar `@fusionstructure/foundation` ni imports o dependencias hacia productos hermanos, incluidos sus subpaths internos. Los consumidores de este producto usan las fuentes locales de `src/foundation`.
- Un cambio local de Foundation requiere únicamente la verificación mínima y focalizada de este repositorio. No requiere una publicación, prueba o PR coordinados en un producto hermano.

## Flujo de cierre

El usuario autorizó actualizar el repositorio en esta sesión. Para cambios posteriores, no hacer push ni abrir un Pull Request salvo que se solicite explícitamente en esa sesión.

Si el cambio toca una superficie crítica, dejar una nota de decisión o una prueba reproducible. Si una verificación falla, reportar el fallo exacto y no presentarlo como éxito.
