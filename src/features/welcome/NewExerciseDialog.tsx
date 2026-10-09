import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  getClassroomExerciseTemplate,
  type ClassroomExerciseParameterKey,
  type ClassroomExerciseParameters,
} from '../../education/exerciseTemplates';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import type { ProjectModel } from '../../types';
import { useModalFocus } from '../../design-system/components/modalFocus';
import './newExerciseDialog.css';

interface NewExerciseDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (project: ProjectModel) => void;
}

const fieldLabelKeys: Record<ClassroomExerciseParameterKey, TranslationKey> = {
  length: 'newExercise.fieldLength',
  height: 'newExercise.fieldHeight',
  loadMagnitude: 'newExercise.fieldLoad',
  distributedLoadMagnitude: 'newExercise.fieldDistributedLoad',
  loadPosition: 'newExercise.fieldLoadPosition',
};

const initialParameters = () => ({ ...getClassroomExerciseTemplate('blank').defaults });

export const NewExerciseDialog = ({
  open,
  onClose,
  onCreate,
}: NewExerciseDialogProps) => {
  const { t } = useI18n();
  const [parameters, setParameters] = useState<Partial<ClassroomExerciseParameters>>(initialParameters);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ClassroomExerciseParameterKey, string>>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const shouldFocusInvalidRef = useRef(false);
  const template = getClassroomExerciseTemplate('blank');

  useEffect(() => {
    if (!shouldFocusInvalidRef.current) return;
    shouldFocusInvalidRef.current = false;
    dialogRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [fieldErrors]);

  useEffect(() => {
    if (!open) return;
    setParameters(initialParameters());
    setFieldErrors({});
  }, [open]);

  useModalFocus({
    open,
    containerRef: dialogRef,
    onEscape: onClose,
    initialFocus: (dialog) => dialog.querySelector<HTMLElement>('button, input'),
  });

  if (!open) return null;

  return (
    <div
      className="new-exercise-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="new-exercise-dialog" data-aula-layout="blank-builder" role="dialog" aria-modal="true" aria-labelledby="new-exercise-title" aria-describedby="new-exercise-subtitle">
        <header className="new-exercise-header">
          <div>
            <p className="new-exercise-eyebrow">{t('classroom.eyebrow')}</p>
            <h2 id="new-exercise-title">{t('newExercise.title')}</h2>
            <p id="new-exercise-subtitle">{t('newExercise.subtitle')}</p>
          </div>
          <button type="button" className="new-exercise-close" aria-label={t('newExercise.close')} onClick={onClose}><X size={20} /></button>
        </header>
        <form
          className="new-exercise-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const nextErrors: Partial<Record<ClassroomExerciseParameterKey, string>> = {};
            for (const field of template.fields) {
              const value = parameters[field.key];
              if (typeof value !== 'number' || !Number.isFinite(value)) {
                nextErrors[field.key] = t('newExercise.fieldEmpty');
              } else if (value < field.min || value > field.max) {
                nextErrors[field.key] = t('newExercise.fieldRange', { min: field.min, max: field.max });
              }
            }
            if (Object.keys(nextErrors).length) {
              shouldFocusInvalidRef.current = true;
              setFieldErrors(nextErrors);
              return;
            }
            onCreate(template.build(parameters));
          }}
        >
          <section className="new-exercise-settings" aria-label={t('newExercise.title')}>
            {template.fields.length ? template.fields.map((field) => {
              const label = t(fieldLabelKeys[field.key]);
              const error = fieldErrors[field.key];
              const errorId = `new-exercise-${field.key}-error`;
              return <label key={field.key} className="new-exercise-field">
                <span>{label}</span>
                <span className="new-exercise-input-wrap">
                  <input
                    className="new-exercise-input"
                    aria-label={label}
                    type="number"
                    inputMode="decimal"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    required
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    aria-errormessage={error ? errorId : undefined}
                    value={parameters[field.key] ?? ''}
                    onChange={(event) => {
                      const value = event.currentTarget.valueAsNumber;
                      setParameters((current) => {
                        const next = { ...current };
                        if (Number.isFinite(value)) next[field.key] = value;
                        else delete next[field.key];
                        return next;
                      });
                      setFieldErrors((current) => {
                        if (!current[field.key]) return current;
                        const next = { ...current };
                        delete next[field.key];
                        return next;
                      });
                    }}
                  />
                  <small>{field.unit}</small>
                </span>
                {error ? <small id={errorId} className="new-exercise-field-error" role="alert">{error}</small> : null}
              </label>;
            }) : <p className="new-exercise-note">{t('newExercise.emptyNote')}</p>}
            <p className="new-exercise-note">{t('newExercise.mechanicalNote')}</p>
            <button className="new-exercise-submit" type="submit">{t('newExercise.create')}</button>
          </section>
        </form>
      </div>
    </div>
  );
};
