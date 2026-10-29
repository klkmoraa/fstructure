// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createBlankProject } from '../../data/defaultProject';
import { prepareStructureGeneration, type PreparedStructureGeneration } from '../../commands/structureGeneration';
import { StructureGeneratorPanel } from './StructureGeneratorPanel';
import { DEFAULT_GENERATOR_FORM, buildGeneratorParams } from './structureGeneratorForm';
import { createStructureGeneratorTranslator } from './structureGeneratorCopy';
const t = createStructureGeneratorTranslator('es');
afterEach(cleanup);
const mountPanel = () => {
  const generate = vi.fn(), cancel = vi.fn(), project = createBlankProject();
  const Harness = () => {
    const [form, setForm] = useState(DEFAULT_GENERATOR_FORM);
    const built = buildGeneratorParams(form, 'kN-m');
    let prepared: PreparedStructureGeneration | null = null, error = '';
    if (built.ok) try { prepared = prepareStructureGeneration(project, built.params); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    return <StructureGeneratorPanel form={form} onFormChange={setForm} errors={built.ok ? {} : built.errors} units="kN-m" language="es"
      summary={prepared?.summary ?? null} warnings={prepared?.warnings ?? []} error={error}
      onGenerate={() => { generate(prepared); return true; }} onCancel={cancel} />;
  };
  render(<Harness />); return { generate, cancel };
};
describe('native curved generator controls', () => {
  it.each(['circular-arch', 'circular-ring', 'pitched-portal'] as const)('selects, previews, reviews and confirms %s', async family => {
    const { generate } = mountPanel();
    fireEvent.click(screen.getByRole('radio', { name: t(`family.${family}`) }));
    const preview = screen.getByRole('img', { name: t('curve.preview') });
    if (family !== 'pitched-portal') {
      expect(preview.querySelectorAll('circle')).toHaveLength(2);
      expect(preview.querySelectorAll('[data-native-curve-preview]')).toHaveLength(family === 'circular-arch' ? 1 : 2);
      expect(screen.queryByLabelText(t('curve.segments'))).toBeNull();
    }
    fireEvent.click(screen.getByRole('button', { name: t('action.review') }));
    expect(generate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: t('action.generate') }));
    await waitFor(() => expect(generate).toHaveBeenCalledOnce());
    expect(generate.mock.calls[0][0]?.kind).toBe(family);
  });
  it('blocks an impossible rise without committing and allows cancellation', () => {
    const { generate, cancel } = mountPanel();
    fireEvent.click(screen.getByRole('radio', { name: t('family.circular-arch') }));
    fireEvent.change(screen.getByLabelText(t('curve.rise')), { target: { value: '999' } });
    expect((screen.getByRole('button', { name: t('action.review') }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: t('action.cancel') }));
    expect(cancel).toHaveBeenCalledOnce(); expect(generate).not.toHaveBeenCalled();
  });
  it('explains that ring supports are assigned afterwards', () => {
    mountPanel(); fireEvent.click(screen.getByRole('radio', { name: t('family.circular-ring') }));
    expect(screen.getByText(t('curve.ringSupports'))).toBeTruthy();
  });
});
