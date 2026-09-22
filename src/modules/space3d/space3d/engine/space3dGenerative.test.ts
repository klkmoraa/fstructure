import { describe, expect, it } from 'vitest';
import {
  generateSpace3DBridge,
  generateSpace3DDome,
  generateSpace3DFrame,
  generateSpace3DIndustrialShed,
  generateSpace3DTower,
  generateSpace3DTruss,
  parseNaturalLanguageStructuralPrompt,
} from './space3dGenerative';
import { analyzeSpace3DStatic } from './solver';

describe('space3dGenerative', () => {
  it('generates a valid solvable 3D frame (building)', () => {
    const frame = generateSpace3DFrame({
      baysX: 2,
      bayWidthX: 4,
      storiesY: 2,
      storyHeightY: 3,
      baysZ: 1,
      bayDepthZ: 5,
      baseSupport: 'fixed',
      gravityLoadPerNode: 30,
    });

    // (2+1) * (1+1) = 6 columns per level * 3 levels (0, 1, 2) = 18 nodes
    expect(frame.nodes.length).toBe(18);
    expect(frame.members.length).toBeGreaterThan(15);
    expect(frame.nodalLoads.length).toBe(6);

    const result = analyzeSpace3DStatic(frame, 'LC1');
    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.memberResults.length).toBe(frame.members.length);
    expect(result.nodeResults.length).toBe(frame.nodes.length);
  });

  it('generates a valid solvable 3D space truss', () => {
    const truss = generateSpace3DTruss({
      spanX: 12,
      heightY: 2.5,
      widthZ: 3,
      panels: 4,
      loadAtTopNodes: 15,
    });

    expect(truss.nodes.length).toBeGreaterThan(10);
    expect(truss.members.length).toBeGreaterThan(20);

    const result = analyzeSpace3DStatic(truss, 'LC1');
    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('generates a valid solvable 3D lattice tower', () => {
    const tower = generateSpace3DTower({
      totalHeight: 12,
      baseWidth: 4,
      topWidth: 1.5,
      tiers: 3,
      topWindLoad: 20,
    });

    expect(tower.nodes.length).toBe(16); // 4 tiers * 4 corners
    expect(tower.members.length).toBeGreaterThan(20);

    const result = analyzeSpace3DStatic(tower, 'LC1');
    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('generates a valid solvable 3D ribbed dome', () => {
    const dome = generateSpace3DDome({
      radius: 6,
      height: 3,
      sectors: 6,
      rings: 3,
      verticalLoad: 10,
    });

    expect(dome.nodes.length).toBe(1 + 6 * 3); // 1 apex + 18 ring nodes = 19
    expect(dome.members.length).toBeGreaterThan(25);

    const result = analyzeSpace3DStatic(dome, 'LC1');
    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('generates a valid solvable 3D space bridge', () => {
    const bridge = generateSpace3DBridge({
      spanX: 18,
      widthZ: 3.5,
      heightY: 2.8,
      panels: 4,
      deckLoad: 20,
    });

    // (4 panels + 1) * 4 nodes per station (BOT_A, TOP_A, BOT_B, TOP_B) = 20 nodes
    expect(bridge.nodes.length).toBe(20);
    expect(bridge.members.length).toBeGreaterThan(30);
    expect(bridge.nodalLoads.length).toBeGreaterThan(0);

    const result = analyzeSpace3DStatic(bridge, 'LC1');
    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('generates a valid solvable 3D industrial shed', () => {
    const shed = generateSpace3DIndustrialShed({
      spanX: 12,
      eaveHeightY: 4,
      ridgeHeightY: 6,
      baysZ: 2,
      baySpacingZ: 5,
      baseSupport: 'fixed',
      roofLoad: 15,
      windLoadX: 10,
    });

    // 3 portal stations (bz=0, 1, 2) * 5 nodes = 15 nodes
    expect(shed.nodes.length).toBe(15);
    expect(shed.members.length).toBeGreaterThan(20);
    expect(shed.nodalLoads.length).toBeGreaterThan(0);

    const result = analyzeSpace3DStatic(shed, 'LC1');
    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  describe('parseNaturalLanguageStructuralPrompt', () => {
    it('parses building frame prompts', () => {
      const parsed = parseNaturalLanguageStructuralPrompt('Edificio de 3 pisos con 2 vanos y carga de 25 kN');
      expect(parsed.archetype).toBe('frame');
      expect(parsed.params.storiesY).toBe(3);
      expect(parsed.params.baysX).toBe(2);
      expect(parsed.params.load).toBe(25);
    });

    it('parses tower prompts', () => {
      const parsed = parseNaturalLanguageStructuralPrompt('Torre de telecomunicaciones de 24 metros con viento de 30 kn');
      expect(parsed.archetype).toBe('tower');
      expect(parsed.params.height).toBe(24);
      expect(parsed.params.load).toBe(30);
    });

    it('parses bridge prompts', () => {
      const parsed = parseNaturalLanguageStructuralPrompt('Puente espacial de 30m de luz y 4m de ancho');
      expect(parsed.archetype).toBe('bridge');
      expect(parsed.params.span).toBe(30);
    });

    it('parses industrial shed prompts', () => {
      const parsed = parseNaturalLanguageStructuralPrompt('Nave industrial de 16 metros de luz');
      expect(parsed.archetype).toBe('industrial-shed');
      expect(parsed.params.span).toBe(16);
    });
  });
});
