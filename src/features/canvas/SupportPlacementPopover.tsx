import { useEffect, useId, useRef, useState } from 'react';
import type { SupportType } from '../../types';

export type SupportPlacementType = Extract<SupportType, 'none' | 'pin' | 'roller' | 'fixed' | 'custom'>;

export interface SupportPlacementPopoverProps {
  nodeId: string;
  anchor: { x: number; y: number };
  viewport: { width: number; height: number };
  title: string;
  description: string;
  labels: Readonly<Record<SupportPlacementType, string>>;
  presetLabels?: Readonly<Record<string, string>>;
  rollerAngleLabel: string;
  degreesLabel: string;
  cancelLabel: string;
  initialType?: SupportPlacementType;
  initialAngleDeg?: number;
  initialPresetId?: string;
  onSelect: (type: SupportPlacementType, angleDeg: number, presetId?: string) => void;
  onCancel: () => void;
}

const BASIC_OPTIONS: readonly SupportPlacementType[] = ['none', 'pin', 'roller', 'fixed'];
const POPOVER_WIDTH = 250;
const POPOVER_HEIGHT = 244;

/**
 * Selección explícita del apoyo en el punto donde se pulsó el nodo. La
 * elección vive aquí hasta que se confirma; un toque accidental no muta el
 * modelo ni obliga a recorrer un ciclo de tipos que puede incluir `custom`.
 */
export const SupportPlacementPopover = ({
  nodeId,
  anchor,
  viewport,
  title,
  description,
  labels,
  presetLabels,
  rollerAngleLabel,
  degreesLabel,
  cancelLabel,
  initialType = 'pin',
  initialAngleDeg = 90,
  initialPresetId,
  onSelect,
  onCancel,
}: SupportPlacementPopoverProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const [selectedType, setSelectedType] = useState<SupportPlacementType>(initialType);
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(initialPresetId ?? initialType);
  const [angleText, setAngleText] = useState(String(initialAngleDeg));
  const left = Math.max(8, Math.min(anchor.x + 14, Math.max(8, viewport.width - POPOVER_WIDTH - 8)));
  const top = Math.max(8, Math.min(anchor.y + 14, Math.max(8, viewport.height - POPOVER_HEIGHT - 8)));

  useEffect(() => {
    firstOptionRef.current?.focus({ preventScroll: true });
  }, []);

  const select = (type: SupportPlacementType, presetId?: string) => {
    setSelectedType(type);
    setSelectedPreset(presetId ?? type);
    // An empty string is coerced to zero by Number(), which silently changes
    // the roller orientation when the user clears an incomplete edit. Accept
    // the decimal comma used by the Spanish UI, but fall back for blank or
    // otherwise invalid drafts.
    const normalizedAngle = angleText.trim().replace(',', '.');
    const parsedAngle = normalizedAngle === '' ? Number.NaN : Number(normalizedAngle);
    const finalAngle = Number.isFinite(parsedAngle) ? parsedAngle : initialAngleDeg;
    if (presetId) {
      onSelect(type, finalAngle, presetId);
    } else {
      onSelect(type, finalAngle);
    }
  };

  return (
    <div
      className="support-placement-popover"
      data-support-placement
      data-node-id={nodeId}
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      style={{ left, top }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <header>
        <strong id={titleId}>{title}</strong>
        <button type="button" className="support-placement-close" aria-label={cancelLabel} onClick={onCancel}>×</button>
      </header>
      <p id={descriptionId}>{description}</p>
      <div className="support-placement-options" role="group" aria-label={title}>
        {BASIC_OPTIONS.map((type, index) => (
          <button
            key={type}
            ref={index === 0 ? firstOptionRef : undefined}
            type="button"
            className={type === selectedType && selectedPreset === type ? 'active' : ''}
            aria-pressed={type === selectedType && selectedPreset === type}
            data-support-placement-option={type}
            onClick={() => select(type)}
          >
            {labels[type]}
          </button>
        ))}
      </div>

      <div className="support-placement-section-title">
        {presetLabels?.guidedCategory ?? 'Guiados'}
      </div>
      <div className="support-placement-options" role="group" aria-label={presetLabels?.guidedCategory ?? 'Guiados'}>
        <button
          type="button"
          className={selectedPreset === 'guide-horizontal' ? 'active' : ''}
          aria-pressed={selectedPreset === 'guide-horizontal'}
          data-support-placement-option="guide-horizontal"
          onClick={() => select('custom', 'guide-horizontal')}
        >
          {presetLabels?.['guide-horizontal'] ?? 'Guía horizontal'}
        </button>
        <button
          type="button"
          className={selectedPreset === 'guide-vertical' ? 'active' : ''}
          aria-pressed={selectedPreset === 'guide-vertical'}
          data-support-placement-option="guide-vertical"
          onClick={() => select('custom', 'guide-vertical')}
        >
          {presetLabels?.['guide-vertical'] ?? 'Guía vertical'}
        </button>
      </div>

      <div className="support-placement-section-title">
        {presetLabels?.elasticCategory ?? 'Elásticos y avanzado'}
      </div>
      <div className="support-placement-options" role="group" aria-label={presetLabels?.elasticCategory ?? 'Elásticos y avanzado'}>
        <button
          type="button"
          className={selectedPreset === 'spring' ? 'active' : ''}
          aria-pressed={selectedPreset === 'spring'}
          data-support-placement-option="spring"
          onClick={() => select('none', 'spring')}
        >
          {presetLabels?.spring ?? 'Resorte'}
        </button>
        <button
          type="button"
          className={selectedType === 'custom' && selectedPreset === 'custom' ? 'active' : ''}
          aria-pressed={selectedType === 'custom' && selectedPreset === 'custom'}
          data-support-placement-option="custom"
          onClick={() => select('custom', 'custom')}
        >
          {labels.custom}
        </button>
      </div>

      <label className="support-placement-angle">
        <span>{rollerAngleLabel}</span>
        <span className="support-placement-angle-control">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={angleText}
            aria-label={rollerAngleLabel}
            onChange={(event) => setAngleText(event.target.value)}
          />
          <small>{degreesLabel}</small>
        </span>
      </label>
    </div>
  );
};
