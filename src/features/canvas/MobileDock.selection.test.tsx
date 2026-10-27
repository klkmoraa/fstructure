// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { MobileDock } from './MobileDock';
const Probe = () => {
  const {project,setSelection}=useProject();
  return <><output aria-label="modelo">{JSON.stringify({nodes:project.nodes,members:project.members,loads:project.nodalLoads})}</output>
    <button onClick={()=>setSelection({kind:'node',id:'N2'})}>Seleccionar nudo</button>
    <button onClick={()=>setSelection({kind:'member',id:'M1'})}>Seleccionar barra</button></>;
};
beforeEach(()=>{ localStorage.clear(); localStorage.setItem(PROJECT_STORAGE_KEY,JSON.stringify(createDefaultProject())); });
afterEach(cleanup);
it('tras borrar un nudo, Deshacer restaura también barras y cargas; Rehacer repite la eliminación', async()=>{
  const user=userEvent.setup();render(<ProjectProvider><MobileDock inspectorOpen={false} onOpenInspector={()=>{}}/><Probe/></ProjectProvider>);
  const original=screen.getByLabelText('modelo').textContent;
  await user.click(screen.getByRole('button',{name:'Seleccionar nudo'}));
  await user.click(screen.getByRole('button',{name:/Eliminar selección/}));
  await user.click(await screen.findByRole('button',{name:'Deshacer'}));
  await waitFor(()=>expect(screen.getByLabelText('modelo').textContent).toBe(original));
  await user.click(screen.getByRole('button',{name:'Rehacer'}));
  await waitFor(()=>expect(screen.getByLabelText('modelo').textContent).not.toBe(original));
});
it('Editar barra abre el inspector sin alterar el modelo', async()=>{
  const user=userEvent.setup();const open=vi.fn();render(<ProjectProvider><MobileDock inspectorOpen={false} onOpenInspector={open}/><Probe/></ProjectProvider>);
  const original=screen.getByLabelText('modelo').textContent;
  await user.click(screen.getByRole('button',{name:'Seleccionar barra'}));
  await user.click(screen.getByRole('button',{name:'Editar barra M1'}));
  expect(open).toHaveBeenCalledTimes(1);expect(screen.getByLabelText('modelo').textContent).toBe(original);
});
