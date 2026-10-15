import type { ImgHTMLAttributes } from 'react';

/**
 * Escena en arcilla de la suite (`public/assets/suite/`): WebP con su PNG de
 * respaldo. El `picture` no ocupa caja propia (`display: contents`), así que
 * las reglas que ya miden el `img` siguen valiendo.
 */
export function SceneImage({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
  return <picture style={{ display: 'contents' }}>
    <source srcSet={src.replace(/\.png$/, '.webp')} type="image/webp" />
    <img src={src} alt={alt} {...props} />
  </picture>;
}
