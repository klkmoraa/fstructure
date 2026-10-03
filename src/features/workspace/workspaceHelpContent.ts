import type { ToolId } from '../../shared/contracts';

type Guide = { steps: readonly [string, string][]; controls: readonly [string, string][] };

/** Vocabulario de los controles existentes. No importa ni accede a datos de las mesas. */
/** Una guía por mesa y una por cada modo de FStructure (3D y Diseño). */
export const workspaceHelpContent: Record<'es' | 'en', Record<ToolId | 'space3d' | 'design', Guide>> = {
  es: {
    model2d: {
      steps: [
        ['Dibuja la estructura', 'Elige Nodo y coloca los puntos. Con Miembro une dos nudos. Generar estructura abre un modelo paramétrico para revisar antes de crearlo.'],
        ['Asigna apoyos y propiedades', 'Selecciona un nudo o una barra y abre Panel para editar sus datos. La herramienta Apoyo se aplica sobre un nudo.'],
        ['Coloca las cargas', 'Carga puntual se coloca sobre un nudo; Carga distribuida y Momento tienen su propio control. Experiencia de cálculo reúne modo, casos y combinaciones.'],
        ['Analiza y revisa', 'Pulsa Analizar y después Resultados. Consulta reacciones, diagramas y deformada. Si el análisis falla, revisa el diagnóstico antes de cambiar el modelo.'],
        ['Diseña', 'Cambia a Diseño en la barra: la mesa Estructura diseña en concreto las vigas y columnas del modelo con sus casos de carga. Modelo vuelve al dibujo.'],
        ['Conserva el trabajo', 'El menú de tres puntos reúne exportación, memoria PDF, unidades y hojas de datos. El nombre del proyecto se edita en la barra superior.'],
      ],
      controls: [
        ['Seleccionar', 'Toca un elemento para editarlo; una zona vacía permite quitar la selección.'],
        ['Desplazar y zoom', 'Usa Desplazar para mover la vista. Los botones +, − y Ajustar cambian sólo la cámara.'],
        ['Cancelar', 'Escape cancela la acción activa. Deshacer recupera una edición del modelo.'],
        ['Buscar una acción', 'Ctrl/⌘ + K abre la búsqueda de comandos, herramientas y elementos.'],
        ['Volver al inicio', 'La marca abre la bienvenida de esta herramienta. Desde ahí puedes volver a FusionStructure.'],
      ],
    },
    space3d: {
      steps: [
        ['Prepara la geometría', 'Archivo permite crear un edificio, usar el generador o importar. Traer del 2D repite el pórtico del modo 2D en pórticos paralelos unidos por vigas transversales (se deshace con Deshacer). Nudo y Barra en el dock dibujan sobre el plano de trabajo.'],
        ['Define el modelo', 'Definir reúne ejes y pisos, secciones, casos de carga y parámetros dinámicos.'],
        ['Selecciona y asigna', 'Elige nudos o barras y abre Asignar. Los comandos explican si requieren nudos o barras seleccionados.'],
        ['Calcula', 'Analizar utiliza el caso o combinación activo. La guía del modelo indica el siguiente paso y los resultados se invalidan al editar.'],
        ['Consulta los resultados', 'Elige la magnitud en la banda del lienzo. Panel abre datos y diagnósticos; Mostrar controla deformada, etiquetas y capas; Vista abre el explorador.'],
        ['Diseña un eje', 'En Diseño · Estructura, el origen Modelo 3D diseña en concreto el pórtico de un eje (A, B… o 1, 2…) con las acciones del modelo completo. La categoría de cada caso (permanente, variable, accidental) decide cómo entra.'],
      ],
      controls: [
        ['2D, 3D y Diseño', 'Son modos de la misma mesa: el proyecto, el guardado y la barra no cambian; sólo cambian las herramientas del modo.'],
        ['Vistas y plano de trabajo', 'La vista 3D, las plantas y los alzados cambian desde el selector del lienzo. Comprueba el plano activo antes de colocar un nudo.'],
        ['Selección', 'Selecciona en el lienzo o el explorador. La ficha de selección permite editar o quitar la selección.'],
        ['Deshacer y rehacer', 'Los botones de la barra recuperan ediciones de esta mesa.'],
        ['Menús', 'Las flechas recorren Definir, Asignar, Mostrar y Vista; Escape cierra el menú abierto.'],
        ['Archivo', 'Importar y exportar trabajan con el modelo 3D. Un cambio de estructura se revisa antes de reemplazar el modelo.'],
      ],
    },
    fem: {
      steps: [
        ['Revisa el modelo', 'Modelo muestra el material, el espesor, los apoyos y las cargas del estudio abierto. El ejemplo inicial es un triángulo con dos apoyos.'],
        ['Consulta la malla', 'Malla muestra nudos y elementos TRI3/QUAD4. Importar Gmsh 4.1 carga una malla desde un archivo .msh.'],
        ['Analiza', 'Analizar resuelve el estudio actual. Una malla importada puede necesitar apoyos y cargas antes de poder resolverse; revisa Modelo y el diagnóstico.'],
        ['Lee los campos', 'Resultados reúne desplazamientos, tensiones y equilibrio. La vista coloreada de von Mises describe los valores por elemento.'],
        ['Exporta', 'JSON conserva el documento y el análisis disponible. VTK permite abrir la malla y sus campos en un visor compatible.'],
      ],
      controls: [
        ['Modelo, Malla y Resultados', 'Las tres pestañas consultan el mismo estudio. Abrirlas no modifica sus datos.'],
        ['Unidades', 'Geometría en m, cargas en kN, módulo y tensiones en kN/m². Los desplazamientos se muestran en mm.'],
        ['Importación', 'Si el archivo no se puede leer, se conserva el estudio anterior y se muestra el motivo.'],
        ['Alcance', 'Elasticidad lineal 2D con TRI3 y QUAD4. No incluye un editor gráfico de apoyos ni de cargas.'],
      ],
    },
    design: {
      steps: [
        ['Elige elemento y norma', 'Estructura (el modelo), Viga, Columna, Zapata y Secciones están en el dock. La norma se elige sobre el dibujo y se aplica a todo el diseño. En Estructura, el origen es el Modelo 2D, un eje del Modelo 3D o un pórtico rápido; al llegar desde el modo 2D o 3D se toma ese modelo.'],
        ['Completa Datos', 'Indica geometría, materiales, demandas y armado. Cada campo muestra su unidad. Las opciones menos frecuentes se despliegan dentro de su apartado.'],
        ['Revisa el cálculo', 'El cálculo se actualiza al editar: no necesitas un botón Analizar. Corrige los campos inválidos antes de consultar los resultados.'],
        ['Consulta Resultados', 'Cada comprobación indica demanda, capacidad y su referencia. Cumple lo evaluado requiere revisar también las comprobaciones fuera del alcance.'],
        ['Guarda la memoria', 'Agregar conserva el elemento en la memoria del proyecto; Guardar actualiza una revisión abierta. Memoria reúne los elementos; PDF exporta el actual y Copiar memoria lleva su texto al portapapeles.'],
      ],
      controls: [
        ['Dibujo, Datos y Resultados', 'En teléfono cada vista ocupa la mesa. En escritorio puedes abrir los datos y los resultados junto al dibujo.'],
        ['Restablecer', 'Recupera los datos del ejemplo para el elemento activo; Deshacer permite recuperar la edición anterior.'],
        ['Deshacer y rehacer', 'Ctrl/⌘ + Z y Ctrl/⌘ + Mayús + Z actúan sobre el elemento; dentro de un campo actúan sobre su texto.'],
        ['Zoom', 'Usa + y −, Ctrl/⌘ + rueda o pellizca con dos dedos. Tamaño normal devuelve la escala inicial.'],
      ],
    },
  },
  en: {
    model2d: {
      steps: [
        ['Draw the structure', 'Place points with Node, then connect two nodes with Member. Generate structure lets you review a parametric model before creating it.'],
        ['Set supports and properties', 'Select a node or member and open Panel to edit its data. Support applies to a node.'],
        ['Place loads', 'Point load applies to a node. Distributed load and Moment have their own tools. Calculation experience contains the mode, load cases and combinations.'],
        ['Analyze and inspect', 'Press Analyze, then Results to inspect reactions, diagrams and deformation. Review a failed analysis diagnosis before changing the model.'],
        ['Design', 'Switch to Diseño in the top bar: Estructura designs the model’s concrete beams and columns with its load cases. Modelo returns to the drawing.'],
        ['Keep your work', 'The three-dot menu contains exports, PDF reports, units and datasheets. Edit the project name in the top bar.'],
      ],
      controls: [
        ['Select', 'Tap an element to edit it; clear the selection on an empty area.'],
        ['Pan and zoom', 'Pan moves the view. +, − and Fit affect the camera.'],
        ['Cancel', 'Escape cancels the current action. Undo restores a model edit.'],
        ['Find an action', 'Ctrl/⌘ + K opens command, tool and element search.'],
        ['Home', 'The mark opens this tool’s welcome screen, where you can return to FusionStructure.'],
      ],
    },
    space3d: {
      steps: [
        ['Prepare geometry', 'File creates a building, opens the generator or imports a model. From 2D repeats the 2D frame in parallel frames joined by transverse beams (Undo reverts it). Node and Member in the dock draw on the working plane.'],
        ['Define the model', 'Define contains axes and stories, sections, load cases and dynamic parameters.'],
        ['Select and assign', 'Select nodes or members, then open Assign. Commands explain the selection they need.'],
        ['Analyze', 'Analyze uses the active case or combination. The model guide suggests the next step; editing invalidates results.'],
        ['Inspect results', 'Select a quantity on the canvas rail. Panel opens data and diagnostics, Display controls deformation and layers, and View opens the explorer.'],
        ['Design an axis', 'In Design · Estructura, the Modelo 3D source designs the concrete frame of one axis (A, B… or 1, 2…) with the actions of the whole model. Each case category (permanent, variable, accidental) decides how it enters.'],
      ],
      controls: [
        ['2D, 3D and Design', 'They are modes of the same workspace: project, saving and the bar stay; only the mode tools change.'],
        ['Views and working plane', 'Use the canvas selector for 3D, plans and elevations. Check the active plane before placing a node.'],
        ['Selection', 'Select in the canvas or explorer. The selection card opens the editor or clears the selection.'],
        ['Undo and redo', 'The top bar restores edits made in this tool.'],
        ['Menus', 'Arrow keys move between Define, Assign, Display and View. Escape closes the open menu.'],
        ['File', 'Import and export use the 3D model. Review a replacement before changing the structure.'],
      ],
    },
    fem: {
      steps: [
        ['Review the model', 'Modelo shows the material, thickness, restraints and loads. The initial example is a triangle with two restrained nodes.'],
        ['Inspect the mesh', 'Malla shows TRI3/QUAD4 nodes and elements. Importar Gmsh 4.1 loads a .msh file.'],
        ['Analyze', 'Analizar solves the current study. An imported mesh may need restraints and loads; inspect Modelo and its diagnosis.'],
        ['Read the fields', 'Resultados contains displacements, stresses and equilibrium. The von Mises view shows values per element.'],
        ['Export', 'JSON includes the document and available analysis. VTK opens the mesh and fields in a compatible viewer.'],
      ],
      controls: [
        ['Study tabs', 'Modelo, Malla and Resultados inspect the same study without editing it.'],
        ['Units', 'Geometry: m; loads: kN; modulus and stresses: kN/m²; displayed displacements: mm.'],
        ['Import', 'An unreadable file keeps the previous study and displays a diagnosis.'],
        ['Scope', 'Linear 2D elasticity with TRI3 and QUAD4. No graphical restraint or load editor.'],
      ],
    },
    design: {
      steps: [
        ['Choose an element and code', 'Estructura (the model), Viga, Columna, Zapata and Secciones are in the dock. Choose the design code above the drawing. Estructura designs the 2D model, one axis of the 3D model or a quick frame; arriving from the 2D or 3D mode picks that model.'],
        ['Fill in Datos', 'Enter geometry, materials, demands and reinforcement. Each field shows its unit; less frequent options expand in their section.'],
        ['Review the calculation', 'The calculation updates as you edit. Fix invalid fields before opening results.'],
        ['Inspect Resultados', 'Checks show demand, capacity and references. Cumple lo evaluado also requires reviewing out-of-scope checks.'],
        ['Keep the report', 'Agregar saves the element in project memory; Guardar updates an opened review. Memoria lists saved elements; PDF exports the current one and Copiar memoria copies its text.'],
      ],
      controls: [
        ['Views', 'Dibujo, Datos and Resultados use the whole phone workspace. Desktop allows panels beside the drawing.'],
        ['Reset', 'Restablecer loads the current element’s example. Deshacer restores the previous edit.'],
        ['Undo and redo', 'Ctrl/⌘ + Z and Ctrl/⌘ + Shift + Z affect the element. In a text field they affect its text.'],
        ['Zoom', 'Use + and −, Ctrl/⌘ + wheel or pinch with two fingers. Tamaño normal restores the original scale.'],
      ],
    },
  },
};
