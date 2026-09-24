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

  it('rejects the unsupported axial truss archetype instead of analyzing it as a frame', () => {
    expect(() => generateSpace3DTruss({
      spanX: 12,
      heightY: 2.5,
      widthZ: 3,
      panels: 4,
      loadAtTopNodes: 15,
    })).toThrow(/no está soportada|truss/i);
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

    expect(shed.loadCases.map((loadCase) => loadCase.id)).toEqual(['ROOF', 'WIND_X']);
    expect(shed.loadCombinations).toHaveLength(0);
    expect(shed.nodalLoads.some((load) => load.caseId === 'ROOF')).toBe(true);
    expect(shed.nodalLoads.some((load) => load.caseId === 'WIND_X')).toBe(true);

    const roofResult = analyzeSpace3DStatic(shed, 'ROOF');
    expect(roofResult.success).toBe(true);
    expect(roofResult.issues).toHaveLength(0);

    const windResult = analyzeSpace3DStatic(shed, 'WIND_X');
    expect(windResult.success).toBe(true);
    expect(windResult.issues).toHaveLength(0);
  });

  it('rejects pathological generated shapes before allocating model arrays', () => {
    expect(() => generateSpace3DFrame({
      baysX: 100_000_000,
      bayWidthX: 4,
      storiesY: 2,
      storyHeightY: 3,
      baysZ: 2,
      bayDepthZ: 4,
    })).toThrow(/presupuesto|rango seguro/i);
  });

  it('rejects non-finite generator parameters', () => {
    expect(() => generateSpace3DFrame({
      baysX: Number.POSITIVE_INFINITY,
      bayWidthX: 4,
      storiesY: 1,
      storyHeightY: 3,
      baysZ: 1,
      bayDepthZ: 4,
    })).toThrow(/finito/i);
  });

  it('fails closed when generated coordinates violate the model contract', () => {
    expect(() => generateSpace3DFrame({
      baysX: 1,
      bayWidthX: 2_000_000_000,
      storiesY: 1,
      storyHeightY: 3,
      baysZ: 1,
      bayDepthZ: 4,
    })).toThrow(/proyecto generado inválido/i);
  });

  // Los datos no aceptan NaN ni infinitos. Una carga no finita tratada como
  // "carga desactivada" devolvía un proyecto válido al que le faltaba en
  // silencio la carga pedida.
  it('rejects non-finite optional loads instead of dropping them', () => {
    expect(() => generateSpace3DFrame({
      baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4,
      gravityLoadPerNode: Number.NaN,
    })).toThrow(RangeError);

    expect(() => generateSpace3DFrame({
      baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4,
      gravityLoadPerNode: Number.NEGATIVE_INFINITY,
    })).toThrow(RangeError);

    // Cero sigue siendo una desactivación legítima, no un error.
    expect(() => generateSpace3DFrame({
      baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4,
      gravityLoadPerNode: 0,
    })).not.toThrow();
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

    it('separates bridge span from deck width', () => {
      const parsed = parseNaturalLanguageStructuralPrompt('Puente espacial de 30m de luz y 4m de ancho');
      expect(parsed.params.span).toBe(30);
      expect(parsed.params.width).toBe(4);
    });

    it('parses shed AxB dimensions and decimal commas', () => {
      const shed = parseNaturalLanguageStructuralPrompt('Nave industrial 12x24m');
      expect(shed.params.span).toBe(12);
      expect(shed.params.lengthZ).toBe(24);

      const dome = parseNaturalLanguageStructuralPrompt('Cúpula de 8,5 metros de radio y 4m de altura');
      expect(dome.params.radius).toBe(8.5);
    });

    it('treats residential towers as frames and captures bay size', () => {
      const parsed = parseNaturalLanguageStructuralPrompt('Torre residencial de 6 pisos con 2 vanos de 5m');
      expect(parsed.archetype).toBe('frame');
      expect(parsed.params.storiesY).toBe(6);
      expect(parsed.params.baysX).toBe(2);
      expect(parsed.params.baySize).toBe(5);
    });

    it('marks prompts without archetype evidence as unrecognized', () => {
      const parsed = parseNaturalLanguageStructuralPrompt('algo de 5 metros');
      expect(parsed.recognized).toBe(false);
      expect(parsed.confidence).toBeLessThan(0.5);
    });

    // Regresión: la abreviatura `h` sin frontera de palabra capturaba el número
    // que sigue a "with", inventando una altura y bloqueando la luz del puente.
    it('does not read a height out of the English word "with"', () => {
      const frame = parseNaturalLanguageStructuralPrompt('3 floors building with 2 bays of 5m and 25 kN load');
      expect(frame.archetype).toBe('frame');
      expect(frame.params.height).toBeUndefined();
      expect(frame.params.storiesY).toBe(3);
      expect(frame.params.baysX).toBe(2);
      expect(frame.params.baySize).toBe(5);
      expect(frame.params.load).toBe(25);

      const tower = parseNaturalLanguageStructuralPrompt('18 m antenna tower with 30 kN wind');
      expect(tower.archetype).toBe('tower');
      expect(tower.params.height).toBe(18);
      expect(tower.params.load).toBe(30);

      const bridge = parseNaturalLanguageStructuralPrompt('20 m space bridge with 5 panels');
      expect(bridge.archetype).toBe('bridge');
      expect(bridge.params.height).toBeUndefined();
      expect(bridge.params.span).toBe(20);
    });

    it('reads English postfix height and radius', () => {
      const dome = parseNaturalLanguageStructuralPrompt('Reticular dome with 8 m radius and 4 m height');
      expect(dome.archetype).toBe('dome');
      expect(dome.params.radius).toBe(8);
      expect(dome.params.height).toBe(4);
    });

    it('prefers industrial vocabulary over the generic building word', () => {
      for (const prompt of ['edificio industrial de 6 vanos', 'industrial building with 6 bays']) {
        const parsed = parseNaturalLanguageStructuralPrompt(prompt);
        expect(parsed.archetype, prompt).toBe('industrial-shed');
        expect(parsed.params.baysX, prompt).toBe(6);
      }

      // Sin vocabulario industrial, "edificio" sigue siendo un pórtico.
      expect(parseNaturalLanguageStructuralPrompt('edificio de 6 vanos').archetype).toBe('frame');
      // Y un puente sigue ganando a la nave aunque diga "industrial".
      expect(parseNaturalLanguageStructuralPrompt('puente industrial de 20 m').archetype).toBe('bridge');
    });

    // Arreglar la altura fantasma no bastaba: con una altura REAL la guarda
    // `!params.height` seguía apagando el respaldo y la luz se perdía igual.
    it('keeps the span when the prompt also states a real height', () => {
      expect(parseNaturalLanguageStructuralPrompt('Puente de 30 m, altura 5 m').params).toMatchObject({ span: 30, height: 5 });
      expect(parseNaturalLanguageStructuralPrompt('Bridge 30 m, 4 m high').params).toMatchObject({ span: 30, height: 4 });
      expect(parseNaturalLanguageStructuralPrompt('Nave industrial de 20 m, altura 7 m').params).toMatchObject({ span: 20, height: 7 });
      // El orden inverso también: la altura primero no debe robarse la luz.
      expect(parseNaturalLanguageStructuralPrompt('Nave de 7 m de altura y 20 m').params).toMatchObject({ span: 20, height: 7 });
    });

    // "3-story building with 5m bays" es el ejemplo que la propia app muestra en
    // su placeholder en inglés, y no se extraía nada de él.
    it('reads hyphenated and British storey forms and a leading bay size', () => {
      expect(parseNaturalLanguageStructuralPrompt('3-story building with 5m bays').params).toMatchObject({ storiesY: 3, baySize: 5 });
      expect(parseNaturalLanguageStructuralPrompt('3 storey frame').params.storiesY).toBe(3);
      expect(parseNaturalLanguageStructuralPrompt('4 storeys').params.storiesY).toBe(4);
      expect(parseNaturalLanguageStructuralPrompt('3-bay frame').params.baysX).toBe(3);
    });

    it('reports the requested bay count without an invented cap', () => {
      const parsed = parseNaturalLanguageStructuralPrompt('nave industrial de 16m con 8 vanos');
      expect(parsed.params.baysX).toBe(8);
      expect(parsed.params.baysZ).toBe(8);
    });

    it('keeps Spanish prompts unchanged after the word-boundary fix', () => {
      const tower = parseNaturalLanguageStructuralPrompt('Torre de 18 metros con viento de 30 kN');
      expect(tower.params.height).toBe(18);
      expect(tower.params.load).toBe(30);

      const bridge = parseNaturalLanguageStructuralPrompt('Puente espacial de 20 metros con 5 paneles');
      expect(bridge.params.span).toBe(20);
      expect(bridge.params.height).toBeUndefined();
    });
  });
});
