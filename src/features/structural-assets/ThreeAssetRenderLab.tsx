import { useEffect, useState } from 'react';
import { THREE_STRUCTURAL_ASSET_IDS, renderThreeStructuralAssetDataUrl, type ThreeStructuralAssetId } from './threeStructuralRender';
import type { StructuralRenderTheme } from './threePortalAssets';

declare global {
  interface Window {
    __FUSIONSTRUCTURE_RENDER_ASSET__?: (assetId: ThreeStructuralAssetId, theme: StructuralRenderTheme) => Promise<string>;
    __FUSIONSTRUCTURE_THREE_ASSET_IDS__?: readonly ThreeStructuralAssetId[];
  }
}

export function ThreeAssetRenderLab() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    window.__FUSIONSTRUCTURE_RENDER_ASSET__ = renderThreeStructuralAssetDataUrl;
    window.__FUSIONSTRUCTURE_THREE_ASSET_IDS__ = THREE_STRUCTURAL_ASSET_IDS;
    setReady(true);
    return () => {
      delete window.__FUSIONSTRUCTURE_RENDER_ASSET__;
      delete window.__FUSIONSTRUCTURE_THREE_ASSET_IDS__;
    };
  }, []);
  return <main style={{ fontFamily: 'sans-serif', padding: 24 }} data-testid="three-asset-render-lab">
    <h1>Three.js structural render lab</h1>
    <p>{ready ? `Ready · ${THREE_STRUCTURAL_ASSET_IDS.length} structural scenes` : 'Preparing WebGL renderer…'}</p>
  </main>;
}
