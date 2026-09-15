# Entorno estructural unificado

## Objetivo

FusionStructure debe sentirse como una sola aplicación mientras el usuario modela en 2D, diseña elementos, abre el modelo espacial o consulta FEM lineal experimental.

## Arquitectura

`ProjectProvider` sigue siendo la autoridad del proyecto activo. `WorkspaceShell` y `AppShellLayout`, la composición completa de Modelo 2D, son el único shell. Diseño continúa como superficie retenida por su broker. Modelo 3D y FEM son modos nativos que sustituyen el contenido del escenario central dentro de ese mismo shell; no crean otra página, pestaña ni ruta.

El adaptador host `src/integrations/planar2dToSpace3d.ts` proyecta el modelo 2D a un `Planar2DToSpace3DHandoffV1`. Conserva geometría, propiedades, casos, combinaciones y cargas nodales que tienen equivalente. Los datos sin equivalente se muestran como notas de transferencia. El proyecto espacial se guarda con un namespace derivado del ID del proyecto 2D, por lo que regresar al 3D recupera el trabajo espacial asociado.

## Interacción

- Toda la mesa de trabajo usa `?surface=workspace2d`; las URLs históricas de módulo se normalizan a esa ruta.
- La barra existente de Modelo 2D conserva su diseño y contiene el control directo **3D**. No existe selector de cuatro pantallas ni cabecera adicional.
- Diseño abre la superficie nativa sobre el modelo 2D activo.
- Modelo 3D sustituye el escenario central con la copia espacial asociada al proyecto y conserva el marco de Modelo 2D.
- FEM sustituye ese mismo escenario como modo `Experimental`, resuelve elasticidad lineal 2D TRI3/QUAD4 y publica sus diagnósticos sin presentarse como certificación.
- Crear y renombrar el proyecto conserva el flujo existente de Modelo 2D.

## Dirección visual

Se reutiliza la fundación visual existente: papel `#f4f5f6`, superficie `#ffffff`, tinta `#17201d`, texto secundario `#53605b`, regla `#d8ddda` y señal estructural violeta `#6f58f5`. Instrument Sans gobierna la interfaz y Geist Mono los datos técnicos. El control 3D se integra como una acción propia de la barra original; en 3D el lienzo conserva el protagonismo y en FEM el camino Modelo → Malla → Solver → Resultados explica el alcance futuro.

## Límites

Los motores 2D y 3D conservan dominios, historial y resultados independientes. La transferencia 2D→3D es explícita y versionada; no existe sincronización bidireccional. FEM mantiene documentos, mallas y snapshots propios dentro del bundle unificado.

## Verificación

Se requiere compilación TypeScript/Vite, pruebas enfocadas de los controles de la barra y una comprobación manual de 2D → Diseño → 3D → FEM en la misma mesa. Se verifica que los modos conservan `?surface=workspace2d` y no abren pestañas nuevas.
