// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThreeStructuralImage } from './ThreeStructuralImage';

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
});
