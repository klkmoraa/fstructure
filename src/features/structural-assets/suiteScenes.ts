import * as THREE from 'three';
import { createMaterialKit, roundedMember, segmentMember, type MaterialKit, type StructuralRenderTheme } from './threePortalAssets';

/**
 * Escenas de presentación de los modos de FStructure en la Home.
 *
 * Usan el mismo kit acromático, la misma luz y la misma cámara que el pórtico
 * del catálogo: arcilla separada por valor, nunca por color. Se renderizan una
 * vez a PNG con `scripts/render-suite-scenes.mjs` y la app sirve la imagen, así
 * que no cuestan WebGL en la Home.
 */
export type SuiteSceneId = 'suite:model2d' | 'suite:design';
export const SUITE_SCENE_IDS: readonly SuiteSceneId[] = ['suite:model2d', 'suite:design'];

const cone = (kit: MaterialKit, position: readonly [number, number, number], length = 0.5) => {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, length, 10), kit.accent);
  shaft.position.y = length / 2 + 0.12;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 16), kit.accent);
  head.rotation.x = Math.PI;
  head.position.y = 0.08;
  for (const mesh of [shaft, head]) { mesh.castShadow = true; group.add(mesh); }
  group.position.set(...position);
  return group;
};

const pinSupport = (kit: MaterialKit, x: number, z = 0) => {
  const prism = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.2, 0.26, 3), kit.accent);
  prism.rotation.y = Math.PI / 2;
  prism.position.set(x, -0.02, z);
  prism.castShadow = true;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(prism.geometry, 32), kit.edge);
  prism.add(edges);
  return prism;
};

/** FS-A01 · pórtico plano de dos vanos y dos niveles, con sus cargas. */
const buildModel2D = (kit: MaterialKit) => {
  const group = new THREE.Group();
  const xs = [-2, 0, 2];
  const levels = [1.3, 2.5];
  group.add(roundedMember([5.1, 0.12, 0.9], [0, -0.21, 0], kit.base, kit.edge, 0.05));
  for (const x of xs) {
    group.add(segmentMember([x, 0.1, 0], [x, levels[1]!, 0], [0.2, 0.2], kit.concrete, kit.edge));
    group.add(pinSupport(kit, x));
  }
  for (const y of levels) group.add(segmentMember([xs[0]!, y, 0], [xs[2]!, y, 0], [0.22, 0.2], kit.concrete, kit.edge));
  for (const x of [-1.5, -0.75, 0.75, 1.5]) group.add(cone(kit, [x, levels[1]! + 0.1, 0]));
  group.add(segmentMember([-2, levels[1]! + 0.77, 0], [2, levels[1]! + 0.77, 0], [0.03, 0.03], kit.accent, kit.edge));
  return group;
};

/** FS-A04 · viga de concreto con la jaula de armado expuesta en un extremo. */
const buildDesign = (kit: MaterialKit) => {
  const group = new THREE.Group();
  const width = 0.62;
  const height = 0.95;
  const concreteLength = 3;
  group.add(roundedMember([concreteLength, height, width], [-0.9, height / 2, 0], kit.concrete, kit.edge, 0.03));
  const bars = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1]] as const;
  const cage = { x0: 0.6, x1: 2.3, cover: 0.09 };
  for (const [side, level] of bars) {
    const y = level < 0 ? cage.cover + 0.02 : height - cage.cover - 0.02;
    const z = side * (width / 2 - cage.cover - 0.02);
    group.add(segmentMember([cage.x0 - 0.3, y, z], [cage.x1, y, z], [0.055, 0.055], kit.rebar, kit.edge));
  }
  for (let x = cage.x0 + 0.1; x <= cage.x1; x += 0.28) {
    const y0 = cage.cover; const y1 = height - cage.cover;
    const z0 = -(width / 2 - cage.cover); const z1 = width / 2 - cage.cover;
    group.add(segmentMember([x, y0, z0], [x, y0, z1], [0.028, 0.028], kit.rebar, kit.edge));
    group.add(segmentMember([x, y1, z0], [x, y1, z1], [0.028, 0.028], kit.rebar, kit.edge));
    group.add(segmentMember([x, y0, z0], [x, y1, z0], [0.028, 0.028], kit.rebar, kit.edge));
    group.add(segmentMember([x, y0, z1], [x, y1, z1], [0.028, 0.028], kit.rebar, kit.edge));
  }
  group.add(roundedMember([0.7, 0.42, 0.9], [-2.1, -0.19, 0], kit.base, kit.edge, 0.04));
  return group;
};

export const buildSuiteScene = (id: SuiteSceneId, theme: StructuralRenderTheme) => {
  const kit = createMaterialKit(theme);
  const group = id === 'suite:model2d' ? buildModel2D(kit) : buildDesign(kit);
  group.name = id;
  return group;
};
