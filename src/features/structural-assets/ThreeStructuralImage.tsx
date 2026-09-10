import { useEffect, useState } from 'react';
import { StructuralIllustration } from './StructuralIllustration';
import { renderThreeStructuralAssetDataUrl, type ThreeStructuralAssetId } from './threeStructuralRender';
import { resolveStructuralAssetUrl } from './structuralAssetUrl';
import './threeStructuralImage.css';

interface ThreeStructuralImageProps {
  assetId: ThreeStructuralAssetId;
  theme: 'light' | 'dark';
  alt?: string;
  className?: string;
  eager?: boolean;
  render?: 'prerendered' | 'vector' | 'three';
}

type ThreeRenderQueueItem = {
  run: () => Promise<string>;
  resolve: (src: string) => void;
  reject: (reason: unknown) => void;
};

const threeRenderQueue: ThreeRenderQueueItem[] = [];
let threeRenderQueueActive = false;

const drainThreeRenderQueue = async () => {
  if (threeRenderQueueActive) return;
  threeRenderQueueActive = true;
  while (threeRenderQueue.length) {
    const item = threeRenderQueue.shift();
    if (!item) continue;
    try {
      item.resolve(await item.run());
    } catch (error) {
      item.reject(error);
    }
  }
  threeRenderQueueActive = false;
};

const enqueueThreeRender = (run: () => Promise<string>): Promise<string> => {
  const promise = new Promise<string>((resolve, reject) => {
    threeRenderQueue.push({ run, resolve, reject });
  });
  void drainThreeRenderQueue();
  return promise;
};

const scheduleIdle = (callback: () => void): (() => void) => {
  const idleWindow = window as Window & {
    requestIdleCallback?: (idleCallback: () => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 500 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(callback, 0);
  return () => window.clearTimeout(handle);
};

export function ThreeStructuralImage({ assetId, theme, alt = '', className = '', eager = false, render = 'prerendered' }: ThreeStructuralImageProps) {
  const [failed, setFailed] = useState(false);
  const [threeSrc, setThreeSrc] = useState<string | null>(null);

  useEffect(() => {
    if (render !== 'three') return undefined;
    let active = true;
    setThreeSrc(null);
    setFailed(false);
    const cancelIdle = scheduleIdle(() => {
      void enqueueThreeRender(async () => {
        return renderThreeStructuralAssetDataUrl(assetId, theme === 'dark' ? 'night' : 'day', 900, 600);
      }).then((src) => {
        if (active) setThreeSrc(src);
      }).catch(() => {
        if (active) setFailed(true);
      });
    });
    return () => {
      active = false;
      cancelIdle();
    };
  }, [assetId, render, theme]);

  if (render === 'vector' || failed) return <StructuralIllustration assetId={assetId} detail="hero" decorative={alt.length === 0} title={alt || undefined} motion="none" className={className} />;

  if (render === 'three') return <span
    aria-busy={!threeSrc}
    className={`three-structural-preview ${className}`.trim()}
    data-preview-state={threeSrc ? 'ready' : 'loading'}
    data-structural-asset-id={assetId}
    data-structural-render="three-runtime"
    data-render-theme={theme === 'dark' ? 'night' : 'day'}
  >
    <StructuralIllustration assetId={assetId} detail="hero" decorative motion="none" className="three-structural-preview__fallback" />
    {threeSrc ? <img
      alt={alt}
      className="three-structural-image three-structural-image--runtime"
      data-structural-asset-id={assetId}
      data-structural-render="three-runtime-image"
      data-render-theme={theme === 'dark' ? 'night' : 'day'}
      decoding="async"
      draggable={false}
      height="600"
      loading={eager ? 'eager' : 'lazy'}
      src={threeSrc}
      width="900"
    /> : null}
  </span>;

  return <img
    alt={alt}
    className={`three-structural-image ${className}`.trim()}
    data-structural-asset-id={assetId}
    data-structural-render="three-prerender"
    data-render-theme={theme === 'dark' ? 'night' : 'day'}
    decoding="async"
    draggable={false}
    height="600"
    loading={eager ? 'eager' : 'lazy'}
    onError={() => setFailed(true)}
    src={resolveStructuralAssetUrl(assetId, theme === 'dark' ? 'night' : 'day')}
    width="900"
  />;
}
