// @vitest-environment jsdom
import { StrictMode, useState, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useDraftHistory } from './common';
import { WorkbenchStorageContext, type WorkbenchStorage } from './workbenchStorage';

it('retains grouped edits across mode changes, supports undo/redo and isolates projects and forms', () => {
  const scope = {};
  const storage: WorkbenchStorage = { historyScope: scope, read: () => undefined, write: () => undefined };
  const wrapper = ({ children }: { children: ReactNode }) => <StrictMode><WorkbenchStorageContext value={storage}>{children}</WorkbenchStorageContext></StrictMode>;
  const useForm = (initial: string, key = 'beam') => {
    const [value, set] = useState({ length: initial });
    return { value, set, history: useDraftHistory(value, set, key) };
  };
  const first = renderHook(() => useForm('5'), { wrapper });
  act(() => first.result.current.set({ length: '6' }));
  act(() => first.result.current.set({ length: '7' }));
  first.unmount();
  const second = renderHook(() => useForm('7'), { wrapper });
  expect(second.result.current.history.canUndo).toBe(true);
  act(() => second.result.current.history.undo());
  expect(second.result.current.value.length).toBe('5');
  second.unmount();
  const third = renderHook(() => useForm('5'), { wrapper });
  expect(third.result.current.history.canRedo).toBe(true);
  act(() => third.result.current.history.redo());
  expect(third.result.current.value.length).toBe('7');
  third.unmount();
  const otherForm = renderHook(() => useForm('7', 'column'), { wrapper });
  expect(otherForm.result.current.history.canUndo).toBe(false);
  otherForm.unmount();
  // A loaded draft that differs from the retained snapshot must not reuse its history.
  const replaced = renderHook(() => useForm('20'), { wrapper });
  expect(replaced.result.current.history.canUndo).toBe(false);
  replaced.unmount();
  const otherProject = renderHook(() => useForm('7'), { wrapper: ({ children }) => <WorkbenchStorageContext value={{ ...storage, historyScope: {} }}>{children}</WorkbenchStorageContext> });
  expect(otherProject.result.current.history.canUndo).toBe(false);
  otherProject.unmount();
});
