import { useContext } from 'react';
import { StructuralCanvas } from '../../canvas/StructuralCanvas';
import { Model2DSurfaceContext } from './surfaceContexts';

export default function Model2DSurface() {
  const props = useContext(Model2DSurfaceContext);
  if (!props) throw new Error('Model2DSurface requires shell-owned canvas state');
  return <StructuralCanvas {...props} />;
}
