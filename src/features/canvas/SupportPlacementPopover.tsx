import { useEffect, useId, useRef, useState } from 'react';
import type { SupportType } from '../../types';
import { SupportGlyph } from '../inspector/SupportGlyph';
import type { SupportGlyphName } from '../inspector/supportCatalog';

export type SupportPlacementType = Extract<SupportType, 'none' | 'pin' | 'roller' | 'fixed' | 'custom'>;

interface SupportPlacementPopoverProps {
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
const BASIC_GLYPHS: Readonly<Record<SupportPlacementType, SupportGlyphName>> = {
  none: 'free',
  pin: 'pin',
  roller: 'roller',
  fixed: 'fixed',
  custom: 'custom',
};

const SupportTileGlyph = ({ glyph, angleDeg = 90 }: { glyph: SupportGlyphName; angleDeg?: number }) => (
  <span className="support-placement-glyph" aria-hidden="true"><SupportGlyph glyph={glyph} angleDeg={angleDeg} size={44} /></span>
);
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
  const typedAngle = Number(angleText.trim().replace(',', '.'));
  const previewAngle = angleText.trim() !== '' && Number.isFinite(typedAngle) ? typedAngle : initialAngleDeg;
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
      <p id={descriptionId} className="sr-only">{description}</p>
      {/* Un mosaico por apoyo, con su dibujo: se elige mirando, no leyendo. */}
      <div className="support-placement-grid">
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
              <SupportTileGlyph glyph={BASIC_GLYPHS[type]} angleDeg={type === 'roller' ? previewAngle : 90} />
              <span>{labels[type]}</span>
            </button>
          ))}
        </div>
        <div className="support-placement-options" role="group" aria-label={presetLabels?.guidedCategory ?? 'Guiados'}>
          <button
            type="button"
            className={selectedPreset === 'guide-horizontal' ? 'active' : ''}
            aria-pressed={selectedPreset === 'guide-horizontal'}
            data-support-placement-option="guide-horizontal"
            onClick={() => select('custom', 'guide-horizontal')}
          >
            <SupportTileGlyph glyph="guide-horizontal" />
            <span>{presetLabels?.['guide-horizontal'] ?? 'Guía horizontal'}</span>
          </button>
          <button
            type="button"
            className={selectedPreset === 'guide-vertical' ? 'active' : ''}
            aria-pressed={selectedPreset === 'guide-vertical'}
            data-support-placement-option="guide-vertical"
            onClick={() => select('custom', 'guide-vertical')}
          >
            <SupportTileGlyph glyph="guide-vertical" />
            <span>{presetLabels?.['guide-vertical'] ?? 'Guía vertical'}</span>
          </button>
        </div>
        <div className="support-placement-options" role="group" aria-label={presetLabels?.elasticCategory ?? 'Elásticos y avanzado'}>
          <button
            type="button"
            className={selectedPreset === 'spring' ? 'active' : ''}
            aria-pressed={selectedPreset === 'spring'}
            data-support-placement-option="spring"
            onClick={() => select('none', 'spring')}
          >
            <SupportTileGlyph glyph="spring-y" />
            <span>{presetLabels?.spring ?? 'Resorte'}</span>
          </button>
          <button
            type="button"
            className={selectedType === 'custom' && selectedPreset === 'custom' ? 'active' : ''}
            aria-pressed={selectedType === 'custom' && selectedPreset === 'custom'}
            data-support-placement-option="custom"
            onClick={() => select('custom', 'custom')}
          >
            <SupportTileGlyph glyph="custom" />
            <span>{labels.custom}</span>
          </button>
        </div>
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
