const es = {
  'family.circular-arch': 'Arco circular', 'family.circular-ring': 'Anillo circular', 'family.pitched-portal': 'Pórtico inclinado',
  'curve.span': 'Distancia entre extremos', 'curve.rise': 'Flecha de la curva', 'curve.radius': 'Radio del anillo', 'curve.segments': 'Divisiones',
  'curve.riseHint': 'Flecha máxima: la mitad del claro. Esa medida crea un semicírculo.',
  'curve.originHint': 'El origen es el extremo inicial. Para curvar una barra entre nudos existentes, selecciónala y abre Geometría de la barra en el inspector.',
  'curve.ringHint': 'El origen es el centro. El anillo usa dos semicírculos conectados por dos nudos, no una cadena de segmentos.',
  'curve.ringSupports': 'Sin apoyos automáticos. Después de generar, selecciona los nudos y asigna sus apoyos en el editor.',
  'curve.approximation': 'Una curva real en el modelo: un elemento entre dos extremos. El análisis lineal experimental puede usar discretización interna, sin crear nudos editables.',
  'curve.independent': 'La geometría curva se conserva al guardar. No se añaden cargas ni nudos intermedios a las curvas.',
  'curve.preview': 'Vista previa de la geometría', 'curve.previewCount': '{count} barra(s) curva(s) · {nodes} nudos extremos',
  'portal.previewCount': '{count} barras · {nodes} nudos', 'portal.span': 'Claro del pórtico',
  'portal.leftHeight': 'Altura izquierda', 'portal.rightHeight': 'Altura derecha', 'portal.roofKind': 'Tipo de cubierta',
  'portal.mono': 'Una agua', 'portal.gable': 'Dos aguas', 'portal.ridgeX': 'Posición de cumbrera', 'portal.ridgeY': 'Altura de cumbrera',
  'portal.ridgeHint': 'Posición desde la columna izquierda; altura desde la base. La cumbrera debe quedar entre columnas y por encima de ambas.',
  'role.arc-segment': 'Barras curvas', 'role.ring-segment': 'Arcos del anillo', 'role.roof': 'Barras de cubierta',
} as const;
export type CurvedGeneratorCopyKey = keyof typeof es;
const en: Record<CurvedGeneratorCopyKey, string> = {
  'family.circular-arch': 'Circular arch', 'family.circular-ring': 'Circular ring', 'family.pitched-portal': 'Pitched portal',
  'curve.span': 'Distance between ends', 'curve.rise': 'Curve rise', 'curve.radius': 'Ring radius', 'curve.segments': 'Divisions',
  'curve.riseHint': 'Maximum rise: half the span. That value creates a semicircle.',
  'curve.originHint': 'The origin is the first endpoint. To curve a member between existing nodes, select it and open Member geometry in the inspector.',
  'curve.ringHint': 'The origin is the centre. The ring consists of two semicircles sharing two nodes, not a chain of segments.',
  'curve.ringSupports': 'No automatic supports. After generating, select nodes and assign their supports in the editor.',
  'curve.approximation': 'Native curved geometry: one member between two ends. Experimental linear analysis may discretise internally without adding editable nodes.',
  'curve.independent': 'Curved geometry survives saving. No loads or intermediate curve nodes are added.',
  'curve.preview': 'Geometry preview', 'curve.previewCount': '{count} curved member(s) · {nodes} endpoint nodes',
  'portal.previewCount': '{count} members · {nodes} nodes', 'portal.span': 'Portal span', 'portal.leftHeight': 'Left height',
  'portal.rightHeight': 'Right height', 'portal.roofKind': 'Roof type', 'portal.mono': 'Single slope', 'portal.gable': 'Two slopes',
  'portal.ridgeX': 'Ridge position', 'portal.ridgeY': 'Ridge height',
  'portal.ridgeHint': 'Position from the left column; height from the base. The ridge must lie between and above both columns.',
  'role.arc-segment': 'Curved members', 'role.ring-segment': 'Ring arcs', 'role.roof': 'Roof members',
};
export const curvedGeneratorCopy = { es, en } as const;
