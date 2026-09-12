# Plataforma FStructure

Este directorio centraliza las integraciones nativas del navegador y del sistema operativo:

- `fileSystem.ts`: abstracción mínima para la File System Access API (`showOpenFilePicker` y `showSaveFilePicker`), con fallback transparente a descargas portables estándar.
- `launchedFile.ts`: gestión de la Launch Queue API para apertura directa de proyectos `.fstructure` asociados desde el sistema de archivos del sistema operativo.

## Estado de PWA y Service Worker

FStructure está diseñada para ejecutarse como aplicación web cliente estática y desplegarse directamente en GitHub Pages.

- **Instalación y metadatos:** Cuenta con Web App Manifest (`site.webmanifest`, `site-dark.webmanifest`), iconos adaptativos y metadatos para visualización en modo `standalone` (pantalla completa sin barra de navegación del navegador).
- **Service Worker:** Actualmente **no tiene Service Worker activo** (`sw.js`). Las actualizaciones de la aplicación se distribuyen de forma directa en cada despliegue a GitHub Pages sin almacenamiento en caché intermedio en el cliente, evitando desincronizaciones de bundle o bloqueos de versiones antiguas.
