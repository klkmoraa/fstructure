import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { TriangleAlert } from 'lucide-react';
import { ErrorBoundary } from '../../design-system/components/errorBoundary';
import { useI18n } from '../../i18n/useI18n';

/**
 * Frontera local para superficies diferidas. Un fallo de chunk no debe sacar
 * del árbol el modelo ni las demás herramientas de la Mesa.
 */
export const LazySurface = ({ pending = null, children }: {
  pending?: ReactNode;
  children: ReactNode;
}) => {
  const { t } = useI18n();

  return (
    <ErrorBoundary
      fallback={
        <div className="sc-surface-error" role="alert">
          <span className="sc-surface-error__icon" aria-hidden="true"><TriangleAlert size={16} /></span>
          <span>{t('surface.loadFailed')}</span>
          <button type="button" onClick={() => window.location.reload()}>{t('surface.reload')}</button>
        </div>
      }
    >
      <Suspense fallback={pending}>{children}</Suspense>
    </ErrorBoundary>
  );
};
