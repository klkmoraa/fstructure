# Panorama open source para Diseño Estructural

Fecha de corte: 2026-09-14. Esta comparación reemplaza la investigación del prototipo y usa únicamente documentación o repositorios oficiales de cada proyecto. No incorpora ninguna de estas herramientas como dependencia ni copia código; por tanto, las licencias se registran para la evaluación futura, no como dictamen jurídico.

## Comparación

| Herramienta | Lenguaje y runtime | 2D / 3D | Capacidades relevantes | Licencia publicada | Decisión para FStructure |
| --- | --- | --- | --- | --- | --- |
| OpenSees / OpenSeesPy | Framework nativo principalmente C++, expuesto mediante intérpretes Tcl y Python; OpenSeesPy es la interfaz Python 3. | El model builder admite dimensión espacial 1, 2 o 3. | Elementos finitos para sistemas estructurales y geotécnicos; análisis estático/transitorio, dinámica, no linealidad, materiales y secciones extensibles. | Licencia propia de UC Regents: uso/distribución no comercial e interno bajo condiciones; incorporar en un producto comercial requiere permiso. OpenSeesPy declara la misma restricción para redistribución comercial. | Sólo referencia documental u oráculo externo de validación. Queda explícitamente fuera del runtime, del producto y del plan aprobado; no se contempla como backend. |
| Frame3DD | Ejecutable y biblioteca de código ANSI C, con archivos de entrada/salida de texto. | Marcos y armaduras 2D y 3D. | Análisis estático y dinámico elástico, rigidez geométrica, desplazamientos, reacciones, fuerzas internas, frecuencias, modos y participación modal. | GNU GPL v3 o posterior. | Buen oráculo de marcos lineales; el copyleft impide integrarlo sin una decisión de distribución consciente. No sustituye diseño normativo. |
| XC | Núcleo C++ con utilidades e interfaz/modelado en Python. | Elementos 0D, 1D, 2D y 3D. | Análisis lineal/no lineal, estático/dinámico, secciones de fibras, activación por fases y herramientas de códigos estructurales en progreso. | GNU GPL v3. | Referencia amplia para ingeniería civil y validación; integración web y obligaciones GPL son mayores que el alcance v1. |
| CalculiX | Pendiente de verificación contra una revisión oficial inmutable. | Pendiente de verificación contra una revisión oficial inmutable. | Pendiente de verificación contra una revisión oficial inmutable. | Pendiente de verificación contra una revisión oficial inmutable. | No se adopta, integra ni usa como oráculo mientras falte esa evidencia. |
| FreeCAD | Aplicación desktop C++/Python con GUI Qt, kernel OpenCASCADE y API Python. | Modelador paramétrico 3D con sketch 2D; FEM coordina mallado y solvers externos como CalculiX. | CAD paramétrico, pre/postproceso FEM, objetos BIM y automatización; no es por sí solo un solver normativo embebible en web. | Código FreeCAD bajo LGPL 2 o posterior; documentación/sitio bajo CC BY 3.0. Dependencias y workbenches externos pueden tener licencias propias. | Referencia de workflow e interoperabilidad desktop. No copiar UI ni usarlo como runtime web. |
| IfcOpenShell | Biblioteca C++ con bindings Python; también puede operar desde JavaScript mediante Pyodide. | BIM/IFC 3D y modelos analíticos estructurales; no realiza análisis 2D/3D por sí sola. | Leer/escribir/validar IFC, geometría, autoría y relaciones; Ifc2CA traduce modelos analíticos IFC hacia Code_Aster. | LGPL 3.0 o posterior. | Mejor candidato futuro para intercambio IFC y preservación de IDs/unidades/procedencia; se mantiene separado del solver y del diseño normativo. |

## 2D frente a 3D

La primera integración permanece 2D-first. Solver2D ya tiene un modelo semántico, demandas exactas y una UI TypeScript; añadir un motor 3D antes de validar asignación → demanda → refuerzo → evidencia multiplicaría grados de libertad, transformaciones y casos de interoperabilidad sin mejorar la primera viga rectangular.

Las herramientas se agrupan en tres papeles distintos que no deben confundirse:

1. OpenSees/OpenSeesPy, XC y Frame3DD son motores o marcos de análisis; ninguno vuelve automáticamente verificable una cláusula de diseño CDMX. CalculiX no se clasifica hasta fijar evidencia oficial inmutable.
2. FreeCAD es principalmente una plataforma de autoría/pre/postproceso desktop que puede orquestar solvers.
3. IfcOpenShell preserva y transforma información IFC; no calcula la respuesta estructural ni el refuerzo.

El runtime de producto continúa TypeScript en navegador/worker. Python queda permitido sólo para oráculos y fixtures de validación ejecutados fuera del producto. Ningún adaptador runtime de estas herramientas forma parte del producto ni del plan aprobado; reconsiderarlo exigiría una decisión arquitectónica y un plan nuevos.

## Evidencia primaria fijada

Las afirmaciones de la tabla se apoyan en estas revisiones inmutables. Un enlace `blob/<commit>` o `tree/<commit>` queda fijado a los bytes de ese commit; una página viva no sustituye esa evidencia.

| Herramienta | Revisión fijada | Evidencia inmutable de capacidades/licencia |
| --- | --- | --- |
| OpenSees / OpenSeesPy | OpenSees `v3.8.0` / `6e55293513192aa05c7e1205e66a5a1a1ed088c4`; documentación `372fbf28e6daf80494d02c8732ccfae0735aff8c`; OpenSeesPy `v3.8.0.1` / `37416272ef52a0dea5620b4c583d1a793d014088` | [model builder](https://github.com/OpenSees/OpenSeesDocumentation/blob/372fbf28e6daf80494d02c8732ccfae0735aff8c/source/user/manual/model/model.rst), [COPYRIGHT](https://github.com/OpenSees/OpenSees/blob/6e55293513192aa05c7e1205e66a5a1a1ed088c4/COPYRIGHT), [licencia de OpenSeesPy](https://github.com/zhuminjie/OpenSeesPy/blob/37416272ef52a0dea5620b4c583d1a793d014088/pip/openseespy/LICENSE.md) |
| Frame3DD | commit `58d66510c120785dcf0ea1ffe67d2eccd545c348` | [README de capacidades](https://github.com/hpgavin/frame3dd/blob/58d66510c120785dcf0ea1ffe67d2eccd545c348/README.md), [licencia](https://github.com/hpgavin/frame3dd/blob/58d66510c120785dcf0ea1ffe67d2eccd545c348/LICENSE) |
| XC | commit `c6a4332e3561a2b4dea912095a1342e3b94f25bc` | [README de capacidades](https://github.com/xcfem/xc/blob/c6a4332e3561a2b4dea912095a1342e3b94f25bc/readme.md), [licencia](https://github.com/xcfem/xc/blob/c6a4332e3561a2b4dea912095a1342e3b94f25bc/license.txt) |
| CalculiX | release oficial declarada `2.23`; no se identificó revisión VCS oficial inmutable | El [archivo fuente versionado](https://www.dhondt.de/ccx_2.23.src.tar.bz2), SHA-256 `9c88385c10fb04f5dc6c4e98027a51bebdd8aee3920e05190d6c1dd08357d6e7`, no es una URL inmutable/contenido direccionado. Capacidades y licencia quedan pendientes. |
| FreeCAD | tag `1.0.2` / `256fc7eff3379911ab5daf88e10182c509aa8052`; documentación `0499378a238ce4c77c643b9cc4a03d0947381e45` | [README del producto](https://github.com/FreeCAD/FreeCAD/blob/256fc7eff3379911ab5daf88e10182c509aa8052/README.md), [licencia del código](https://github.com/FreeCAD/FreeCAD/blob/256fc7eff3379911ab5daf88e10182c509aa8052/LICENSE), [FEM Workbench](https://github.com/FreeCAD/FreeCAD-documentation/blob/0499378a238ce4c77c643b9cc4a03d0947381e45/wiki/FEM_Workbench.md), [política de licencias](https://github.com/FreeCAD/FreeCAD-documentation/blob/0499378a238ce4c77c643b9cc4a03d0947381e45/wiki/License.md) |
| IfcOpenShell | commit `23f3874de19d398451f8926722dc33c21aff5b74` | [introducción/capacidades](https://github.com/IfcOpenShell/IfcOpenShell/blob/23f3874de19d398451f8926722dc33c21aff5b74/src/ifcopenshell-python/docs/introduction.rst), [README](https://github.com/IfcOpenShell/IfcOpenShell/blob/23f3874de19d398451f8926722dc33c21aff5b74/README.md), [LGPL-3.0](https://github.com/IfcOpenShell/IfcOpenShell/blob/23f3874de19d398451f8926722dc33c21aff5b74/COPYING.LESSER) |

## Páginas vivas, sólo para orientación

[OpenSees](https://opensees.github.io/OpenSeesDocumentation/), [OpenSeesPy](https://openseespydoc.readthedocs.io/en/latest/), [Frame3DD](https://frame3dd.sourceforge.net/), [XC](https://github.com/xcfem/xc), [CalculiX](https://www.dhondt.de/), [FreeCAD](https://www.freecad.org/) e [IfcOpenShell](https://docs.ifcopenshell.org/) pueden cambiar sin conservar los bytes revisados. No son reproducibles y no sustentan por sí solas las afirmaciones registradas.

## Riesgos y puerta de adopción

- “Open source” no implica compatibilidad automática con un producto distribuido: OpenSees usa condiciones propias; Frame3DD/XC son GPL; FreeCAD/IfcOpenShell son LGPL con versiones distintas. CalculiX queda sin clasificación hasta fijar evidencia oficial inmutable.
- La licencia debe revisarse otra vez en el commit/versión exactos elegidos, incluyendo dependencias transitivas y forma de enlace o ejecución.
- Ningún resultado de estas herramientas se presentará como certificado. La adopción exige corpus reproducible, tolerancias explícitas, trazabilidad de versión y revisión de dominio.
