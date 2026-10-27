// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {createDefaultProject} from '../../data/defaultProject';
import {analyzeProject} from '../../engine/solver';
import {AnalysisIssues} from './AnalysisIssues';
vi.mock('../../i18n/useI18n',()=>({useI18n:()=>({language:'es'})}));
afterEach(cleanup);
it('permite inspeccionar la causa y corrección del resultado sin ir a otro panel',()=>{
 const r=analyzeProject(createDefaultProject());r.issues=[{id:'dup-M2',severity:'warning',title:'Miembro superpuesto',message:'Se duplica la rigidez.',suggestedFix:'Revisa la barra M2.'}];
 render(<AnalysisIssues analysis={r}/>);
 expect(screen.getByText('Miembro superpuesto')).toBeTruthy();expect(screen.getByText('Se duplica la rigidez.')).toBeTruthy();expect(screen.getByText('Revisa la barra M2.')).toBeTruthy();
 expect(screen.queryByRole('button',{name:/Doctor/})).toBeNull();
});
it('mantiene los diagnósticos originales y contextualiza la referencia',()=>{
 const r=analyzeProject(createDefaultProject());
 r.issues=[{id:'relative-stiffness',severity:'warning',title:'Referencia EI',message:'El valor no es físico.'},{id:'small-displacement-assumption',severity:'warning',title:'Deformación elevada',message:'Límite de la hipótesis lineal.'}];
 const before=structuredClone(r.issues);render(<AnalysisIssues analysis={r}/>);
 expect(screen.getByText('Referencia EI')).toBeTruthy();expect(screen.getByText('Deformación elevada')).toBeTruthy();expect(screen.getByText(/no valida.*desplazamientos físicos/i)).toBeTruthy();expect(r.issues).toEqual(before);
});
it('un resultado sin hallazgos no añade un panel vacío',()=>{
 const r=analyzeProject(createDefaultProject());r.issues=[];
 const {container}=render(<AnalysisIssues analysis={r}/>);expect(container.childElementCount).toBe(0);
});
it('los errores reales están desplegados sin otro clic',()=>{
 const r=analyzeProject(createDefaultProject());r.success=false;r.issues=[{id:'no-supports',severity:'error',title:'Sin apoyos',message:'No existe equilibrio estable.'}];
 const {container}=render(<AnalysisIssues analysis={r}/>);expect(container.querySelector('details')?.open).toBe(true);expect(screen.getByText('No existe equilibrio estable.')).toBeTruthy();
});
