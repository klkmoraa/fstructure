// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThreeStructuralImage } from './ThreeStructuralImage';

afterEach(() => vi.useRealTimers());

describe('ThreeStructuralImage', () => {
  it('renders the bundled vector directly when prerendered assets are unavailable', () => {
    const { container } = render(
      <ThreeStructuralImage
        assetId="portal:single-bay"
        theme="dark"
        alt="Portal estructural"
        render="vector"
      />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg[data-structural-asset-id="portal:single-bay"]')).toBeTruthy();
  });

  it('keeps an immediate vector placeholder while the 3D render is queued', () => {
    vi.useFakeTimers();
    const { container } = render(
      <ThreeStructuralImage
        assetId="beam:simply-supported"
        theme="light"
        render="three"
      />,
    );

    expect(container.querySelector('[data-structural-render="three-runtime"]')).toBeTruthy();
    expect(container.querySelector('[data-preview-state="loading"]')).toBeTruthy();
    expect(container.querySelector('svg[data-structural-asset-id="beam:simply-supported"]')).toBeTruthy();
    expect(container.querySelector('img[data-structural-render="three-runtime-image"]')).toBeNull();
  });
});
