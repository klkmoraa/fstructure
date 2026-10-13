// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,expect,it} from 'vitest';
import {createDefaultProject} from '../../data/defaultProject';
import {PROJECT_STORAGE_KEY} from '../../data/projectStorage';
import {ProjectProvider,useProject} from '../../store/ProjectContext';
import {MemberProfileEditor} from './MemberProfileEditor';
import {MultiStiffnessEditor} from './MultiStiffnessEditor';
beforeEach(()=>{localStorage.clear();const p=createDefaultProject();p.members[0].propertyProfile='exercise';p.settings.calculationMode='classroom';localStorage.setItem(PROJECT_STORAGE_KEY,JSON.stringify(p));});afterEach(cleanup);
function Harness(){const {project,undo}=useProject();return <><MemberProfileEditor member={project.members[0]}/><button onClick={undo}>Deshacer prueba</button><output data-testid="member">{JSON.stringify(project.members[0])}</output></>;}
const current=()=>JSON.parse(screen.getByTestId('member').textContent!);
const edit=async(user:ReturnType<typeof userEvent.setup>,label:string,value:string)=>{const el=screen.getByLabelText(label,{exact:true});await user.clear(el);await user.type(el,value);await user.tab();};
it('permite editar EI/E/I propios en Aula y construir una sección con concreto desde Personalizado',async()=>{
  const user=userEvent.setup();render(<ProjectProvider><Harness/></ProjectProvider>);
  await edit(user,'EI','6000');expect(current().E*current().I).toBeCloseTo(6000);
  await edit(user,'E','30000');expect(current().E).toBe(30e6);
  await edit(user,'I','0.001');expect(current().I).toBe(.001);
  await user.selectOptions(screen.getByLabelText('Perfil'),'custom');
  await user.selectOptions(screen.getByLabelText('Forma de la sección'),'rectangle');
  await edit(user,'Ancho b','0.4');await edit(user,'Peralte h','0.6');
  expect(current().A).toBeCloseTo(.24);expect(current().I).toBeCloseTo(.0072);
  await user.selectOptions(screen.getByLabelText('Tipo de material'),'CONCRETE');
  await edit(user,'Resistencia f′c','32');expect(current().customMaterial.compressiveStrength).toBe(32000);
  await user.click(screen.getByRole('button',{name:'Estimar E y G desde f′c'}));expect(current().E).toBeCloseTo(4700*Math.sqrt(32)*1000);
  await user.click(screen.getByRole('button',{name:'Deshacer prueba'}));expect(current().customMaterial.compressiveStrength).toBe(32000);expect(current().E).toBeCloseTo(21538105.7663);
});
it('edita acero y parámetros adicionales, y rechaza un ν inválido sin cambiarlo',async()=>{
  const user=userEvent.setup();render(<ProjectProvider><Harness/></ProjectProvider>);
  await user.selectOptions(screen.getByLabelText('Perfil'),'custom');await user.selectOptions(screen.getByLabelText('Tipo de material'),'STEEL');
  await edit(user,'Fluencia Fy','355');await edit(user,'Resistencia última Fu','510');
  expect(current().customMaterial.yieldStrength).toBe(355000);expect(current().customMaterial.ultimateStrength).toBe(510000);
  await user.click(screen.getByText('Otros parámetros del material'));
  await edit(user,'Poisson ν','0.5');expect(screen.getByRole('alert')).toBeTruthy();expect(current().customMaterial.poissonRatio).toBe(.3);
  await edit(user,'Poisson ν','0.28');await edit(user,'Peso específico γ','77');
  expect(current().density).toBeCloseTo(77/.00980665);
  await edit(user,'Dilatación térmica α','0.000013');expect(current().customMaterial.thermalExpansion).toBe(.000013);
});
function MultiHarness(){const{project}=useProject();return <><MultiStiffnessEditor members={project.members}/><output data-testid="factors">{JSON.stringify(project.members.map(m=>m.stiffnessFactor))}</output></>;}
it('aplica una constante a varias barras y permite volver a valores propios',async()=>{
  const p=createDefaultProject();p.settings.stiffnessDefaults={mode:'EI',value:10000,factor:1};localStorage.setItem(PROJECT_STORAGE_KEY,JSON.stringify(p));
  const user=userEvent.setup();render(<ProjectProvider><MultiHarness/></ProjectProvider>);
  await edit(user,'Factor de las barras seleccionadas','2');await user.click(screen.getByRole('button',{name:'Aplicar 2EI a 3 barras compatibles'}));expect(screen.getByTestId('factors').textContent).toBe('[2,2,2]');
  await user.click(screen.getByRole('button',{name:'Usar valores propios en la selección'}));expect(screen.getByTestId('factors').textContent).toBe('[null,null,null]');
});
