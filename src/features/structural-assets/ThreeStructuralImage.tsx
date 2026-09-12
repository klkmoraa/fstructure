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

const threeDataUrlCache = new Map<string, string>();

const enqueueThreeRender = (run: () => Promise<string>, priority = false): Promise<string> => {
  const promise = new Promise<string>((resolve, reject) => {
    if (priority) {
      threeRenderQueue.unshift({ run, resolve, reject });
    } else {
      threeRenderQueue.push({ run, resolve, reject });
    }
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
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 120 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(callback, 0);
  return () => window.clearTimeout(handle);
};

export function ThreeStructuralImage({ assetId, theme, alt = '', className = '', eager = false, render = 'prerendered' }: ThreeStructuralImageProps) {
  const cacheKey = `${assetId}:${theme}`;
  const [failed, setFailed] = useState(false);
  const [threeSrc, setThreeSrc] = useState<string | null>(() => threeDataUrlCache.get(cacheKey) ?? null);

  useEffect(() => {
    if (render !== 'three') return undefined;
    const cached = threeDataUrlCache.get(cacheKey);
    if (cached) {
      setThreeSrc(cached);
      return undefined;
    }
    let active = true;
    setFailed(false);

    const executeRender = () => {
      void enqueueThreeRender(async () => {
        const existing = threeDataUrlCache.get(cacheKey);
        if (existing) return existing;
        const rendered = await renderThreeStructuralAssetDataUrl(assetId, theme === 'dark' ? 'night' : 'day', 900, 600);
        threeDataUrlCache.set(cacheKey, rendered);
        return rendered;
      }, eager).then((src) => {
        if (active) setThreeSrc(src);
      }).catch(() => {
        if (active) setFailed(true);
      });
    };

    if (eager) {
      executeRender();
      return () => {
        active = false;
      };
    }

    const cancelIdle = scheduleIdle(executeRender);
    return () => {
      active = false;
      cancelIdle();
    };
  }, [assetId, cacheKey, eager, render, theme]);

  if (render === 'vector') {
    return <StructuralIllustration assetId={assetId} detail="hero" decorative={alt.length === 0} title={alt || undefined} motion="none" className={className} />;
  }

  if (render === 'three') {
    return <span
      aria-busy={!threeSrc && !failed}
      className={`three-structural-preview ${className}`.trim()}
      data-preview-state={threeSrc ? 'ready' : failed ? 'failed' : 'loading'}
      data-structural-asset-id={assetId}
      data-structural-render="three-runtime"
      data-render-theme={theme === 'dark' ? 'night' : 'day'}
    >
      <span className="three-structural-preview__placeholder" aria-hidden="true" />
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
  }

  if (failed) {
    return <span
      className={`three-structural-preview ${className}`.trim()}
      data-preview-state="failed"
      data-structural-asset-id={assetId}
    >
      <span className="three-structural-preview__placeholder" aria-hidden="true" />
    </span>;
  }

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
