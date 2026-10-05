import { describe, expect, it } from 'vitest';
import {
  createSurfaceBrokerState,
  openSurfaceIntent,
  reservesInspectorColumn,
  resolveSurfaceActivity,
} from './surfacePresentation';

describe('resolveSurfaceActivity', () => {
  it('deja una sola capa contextual activa en X2', () => {
    const withDetail = openSurfaceIntent(createSurfaceBrokerState(), 'detail');
    const state = openSurfaceIntent(withDetail, 'results');
    const activity = resolveSurfaceActivity('X2', state);
    expect(activity.results.status).toBe('active');
    expect(activity.detail.status).toBe('suspended');
  });
});

describe('reservesInspectorColumn', () => {
  /**
   * El defecto que esto guarda, medido en la versión publicada: con Cargas
   * abierto y Resultados encima, el shell seguía reservando la columna del
   * Inspector —330px de hueco vacío a la derecha del lienzo en X2 a 1440px—
   * porque la decisión leía `open`, que es la intención, en vez de `status`,
   * que es la ocupación. La superficie suspendida se monta con `hidden`: no se
   * ve, y por tanto no puede cobrar ancho.
   */
  it('no reserva ancho por una superficie que el bróker ha suspendido', () => {
    const conCargas = openSurfaceIntent(createSurfaceBrokerState(), 'analysisSetup');
    const conResultados = openSurfaceIntent(conCargas, 'results');
    const activity = resolveSurfaceActivity('X2', conResultados);

    expect(activity.analysisSetup.open, 'la intención del usuario sigue viva').toBe(true);
    expect(activity.analysisSetup.status).toBe('suspended');
    expect(reservesInspectorColumn(activity.detail, activity.analysisSetup, activity.view)).toBe(false);
  });

  it('reserva ancho mientras alguna de las tres superficies está activa', () => {
    const activity = resolveSurfaceActivity('X2', openSurfaceIntent(createSurfaceBrokerState(), 'detail'));
    expect(activity.detail.status).toBe('active');
    expect(reservesInspectorColumn(activity.detail, activity.analysisSetup, activity.view)).toBe(true);
  });

  it('no reserva nada con las tres cerradas', () => {
    const activity = resolveSurfaceActivity('X2', createSurfaceBrokerState());
    expect(reservesInspectorColumn(activity.detail, activity.analysisSetup, activity.view)).toBe(false);
  });
});
