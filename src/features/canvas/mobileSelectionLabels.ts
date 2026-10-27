import type { Selection } from '../../types';

/** Visible verbs accompany the technical symbols; IDs retain their full accessible name. */
export function mobileSelectionLabels(selection: Selection, language: 'es' | 'en') {
  const en = language === 'en';
  const kind = selection?.kind === 'node' ? (en ? 'node' : 'nudo')
    : selection?.kind === 'member' ? (en ? 'member' : 'barra')
    : selection?.kind === 'multi' ? (en ? 'selection' : 'selección') : (en ? 'load' : 'carga');
  const id = selection && 'id' in selection ? selection.id : '';
  return {
    kind, edit: en ? 'Edit' : 'Editar', editLabel: `${en ? 'Edit' : 'Editar'} ${kind}${id ? ` ${id}` : ''}`,
    move: en ? 'Move' : 'Mover', design: en ? 'Design' : 'Diseñar', remove: en ? 'Delete' : 'Borrar',
    deselect: en ? 'Clear' : 'Quitar', history: en ? 'History' : 'Historial',
  };
}
