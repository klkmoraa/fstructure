import { describe, expect, it } from 'vitest';
import { createSurfaceBrokerState, openSurfaceIntent, resolveSurfaceActivity } from './surfacePresentation';

describe('resolveSurfaceActivity', () => {
  it('deja una sola capa contextual activa en X2', () => {
    const withDetail = openSurfaceIntent(createSurfaceBrokerState(), 'detail');
    const state = openSurfaceIntent(withDetail, 'results');
    const activity = resolveSurfaceActivity('X2', state);
    expect(activity.results.status).toBe('active');
    expect(activity.detail.status).toBe('suspended');
  });
});
