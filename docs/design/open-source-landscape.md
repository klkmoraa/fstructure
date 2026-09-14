# Panorama open source para Diseño Estructural

Fecha de corte: 2026-09-14. Esta comparación reemplaza la investigación del prototipo y usa únicamente documentación o repositorios oficiales de cada proyecto. No incorpora ninguna de estas herramientas como dependencia ni copia código; por tanto, las licencias se registran para la evaluación futura, no como dictamen jurídico.

## Comparación

| Herramienta | Lenguaje y runtime | 2D / 3D | Capacidades relevantes | Licencia publicada | Decisión para FStructure |
| --- | --- | --- | --- | --- | --- |
| OpenSees / OpenSeesPy | Framework nativo principalmente C++, expuesto mediante intérpretes Tcl y Python; OpenSeesPy es la interfaz Python 3. | El model builder admite dimensión espacial 1, 2 o 3. | Elementos finitos para sistemas estructurales y geotécnicos; análisis estático/transitorio, dinámica, no linealidad, materiales y secciones extensibles. | Licencia propia de UC Regents: uso/distribución no comercial e interno bajo condiciones; incorporar en un producto comercial requiere permiso. OpenSeesPy declara la misma restricción para redistribución comercial. | Referencia y posible backend avanzado aislado. No entra al runtime v1 ni puede redistribuirse sin revisión/licencia explícita. |
| Frame3DD | Ejecutable y biblioteca de código ANSI C, con archivos de entrada/salida de texto. | Marcos y armaduras 2D y 3D. | Análisis estático y dinámico elástico, rigidez geométrica, desplazamientos, reacciones, fuerzas internas, frecuencias, modos y participación modal. | GNU GPL v3 o posterior. | Buen oráculo de marcos lineales; el copyleft impide integrarlo sin una decisión de distribución consciente. No sustituye diseño normativo. |
| XC | Núcleo C++ con utilidades e interfaz/modelado en Python. | Elementos 0D, 1D, 2D y 3D. | Análisis lineal/no lineal, estático/dinámico, secciones de fibras, activación por fases y herramientas de códigos estructurales en progreso. | GNU GPL v3. | Referencia amplia para ingeniería civil y validación; integración web y obligaciones GPL son mayores que el alcance v1. |
| CalculiX | Dos ejecutables nativos: CrunchiX (solver, fuentes Fortran/C) y GraphiX (pre/postprocesador C/OpenGL). | Programa estructural 3D; incluye familias de elementos sólidos, shells y vigas dentro del modelo 3D. | Cálculo lineal/no lineal, estático, dinámico y térmico; mallado, cálculo y postproceso, con formato de entrada compatible en estilo con Abaqus. | GNU GPL v2 o posterior. | Candidato futuro para FEA 3D por proceso externo; sobredimensionado para el flujo 2D-first y no es diseñador normativo. |
| FreeCAD | Aplicación desktop C++/Python con GUI Qt, kernel OpenCASCADE y API Python. | Modelador paramétrico 3D con sketch 2D; FEM coordina mallado y solvers externos como CalculiX. | CAD paramétrico, pre/postproceso FEM, objetos BIM y automatización; no es por sí solo un solver normativo embebible en web. | Código FreeCAD bajo LGPL 2 o posterior; documentación/sitio bajo CC BY 3.0. Dependencias y workbenches externos pueden tener licencias propias. | Referencia de workflow e interoperabilidad desktop. No copiar UI ni usarlo como runtime web. |
| IfcOpenShell | Biblioteca C++ con bindings Python; también puede operar desde JavaScript mediante Pyodide. | BIM/IFC 3D y modelos analíticos estructurales; no realiza análisis 2D/3D por sí sola. | Leer/escribir/validar IFC, geometría, autoría y relaciones; Ifc2CA traduce modelos analíticos IFC hacia Code_Aster. | LGPL 3.0 o posterior. | Mejor candidato futuro para intercambio IFC y preservación de IDs/unidades/procedencia; se mantiene separado del solver y del diseño normativo. |

## 2D frente a 3D

La primera integración permanece 2D-first. Solver2D ya tiene un modelo semántico, demandas exactas y una UI TypeScript; añadir un motor 3D antes de validar asignación → demanda → refuerzo → evidencia multiplicaría grados de libertad, transformaciones y casos de interoperabilidad sin mejorar la primera viga rectangular.

Las herramientas se agrupan en tres papeles distintos que no deben confundirse:

1. OpenSees/OpenSeesPy, XC, Frame3DD y CalculiX son motores o marcos de análisis; ninguno vuelve automáticamente verificable una cláusula de diseño CDMX.
2. FreeCAD es principalmente una plataforma de autoría/pre/postproceso desktop que puede orquestar solvers.
3. IfcOpenShell preserva y transforma información IFC; no calcula la respuesta estructural ni el refuerzo.

El runtime de producto continúa TypeScript en navegador/worker. Python queda permitido sólo para oráculos y fixtures de validación. Cualquier adaptador futuro debe ejecutarse detrás de un contrato versionado, conservar unidades/ejes/identificadores/procedencia y comparar resultados contra casos independientes antes de influir en decisiones del usuario.

## Fuentes primarias y licencias

### OpenSees / OpenSeesPy

- [Documentación oficial de OpenSees](https://opensees.github.io/OpenSeesDocumentation/): alcance estructural/geotécnico y respuesta dinámica.
- [Model builder oficial](https://opensees.github.io/OpenSeesDocumentation/user/manual/model/model.html): dimensiones 1D/2D/3D e interfaces Tcl/Python.
- [Repositorio oficial](https://github.com/OpenSees/OpenSees) y [texto de licencia/copyright](https://github.com/OpenSees/OpenSees/blob/master/COPYRIGHT).
- [Documentación oficial de OpenSeesPy](https://openseespydoc.readthedocs.io/en/latest/): runtime Python y condición de redistribución comercial.

### Frame3DD

- [Sitio oficial de Frame3DD](https://frame3dd.sourceforge.net/): capacidades, ANSI C y licencia GPL-3.0-or-later.
- [Repositorio mantenido por el autor](https://github.com/hpgavin/frame3dd) y [licencia](https://github.com/hpgavin/frame3dd/blob/master/LICENSE).

### XC

- [Repositorio oficial de XC](https://github.com/xcfem/xc): capacidades 0D–3D, C++/Python y licencia GPL-3.0.
- [Texto de licencia GPL-3.0](https://github.com/xcfem/xc/blob/master/LICENSE).

### CalculiX

- [Sitio oficial de CalculiX](https://www.calculix.de/): alcance 3D, análisis y licencia GPL-2.0-or-later.
- [Descargas y fuentes oficiales](https://www.dhondt.de/): fuentes de CrunchiX/GraphiX, manuales y casos.

### FreeCAD

- [Repositorio oficial de FreeCAD](https://github.com/FreeCAD/FreeCAD): stack C++/Python, CAD 3D y licencia.
- [Workbench FEM oficial](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/FEM_Workbench.md): flujo FEM y solvers externos.
- [Política de licencias oficial](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/License.md): LGPL2+ para código y CC BY 3.0 para documentación/sitio.

### IfcOpenShell

- [Introducción oficial](https://docs.ifcopenshell.org/introduction.html): C++/Python/JavaScript, IFC, validación e Ifc2CA.
- [Referencia del núcleo](https://docs.ifcopenshell.org/ifcopenshell.html): alcance y licencia LGPL-3.0-or-later.
- [Bindings Python oficiales](https://docs.ifcopenshell.org/ifcopenshell-python.html).

## Riesgos y puerta de adopción

- “Open source” no implica compatibilidad automática con un producto distribuido: OpenSees usa condiciones propias; Frame3DD/XC/CalculiX son GPL; FreeCAD/IfcOpenShell son LGPL con versiones distintas.
- La licencia debe revisarse otra vez en el commit/versión exactos elegidos, incluyendo dependencias transitivas y forma de enlace o ejecución.
- Ningún resultado de estas herramientas se presentará como certificado. La adopción exige corpus reproducible, tolerancias explícitas, trazabilidad de versión y revisión de dominio.
