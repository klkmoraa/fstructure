import * as THREE from 'three';
import { createMaterialKit, roundedMember, segmentMember, type MaterialKit, type StructuralRenderTheme } from './threePortalAssets';

/**
 * Escenas de presentación de las cuatro herramientas.
 *
 * Usan el mismo kit acromático, la misma luz y la misma cámara que el pórtico
 * del catálogo: arcilla separada por valor, nunca por color. Se renderizan una
 * vez a PNG con `scripts/render-suite-scenes.mjs` y la app sirve la imagen, así
 * que no cuestan WebGL en el Inicio.
 */
export type SuiteSceneId = 'suite:model2d' | 'suite:design' | 'suite:fem';
export const SUITE_SCENE_IDS: readonly SuiteSceneId[] = ['suite:model2d', 'suite:design', 'suite:fem'];

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

/** FS-A03 · placa con perforación, mallada con triángulos, empotrada a la izquierda y cargada. */
const buildFem = (kit: MaterialKit) => {
  const group = new THREE.Group();
  const w = 3.6; const d = 2.2; const t = 0.14;
  const hole = { x: 0.55, z: 0, r: 0.42 };
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2, -d / 2); shape.lineTo(w / 2, d / 2); shape.lineTo(-w / 2, d / 2); shape.closePath();
  const opening = new THREE.Path();
  opening.absarc(hole.x, hole.z, hole.r, 0, Math.PI * 2, true);
  shape.holes.push(opening);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 48 });
  geometry.rotateX(-Math.PI / 2);
  const plate = new THREE.Mesh(geometry, kit.base);
  plate.castShadow = true;
  plate.receiveShadow = true;
  plate.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), kit.edge));
  plate.position.y = 0.2;
  group.add(plate);

  // Malla triangular dibujada sobre la cara superior; se omite dentro del hueco.
  const nx = 12; const nz = 8; const y = 0.2 + t + 0.004;
  const inside = (x: number, z: number) => Math.hypot(x - hole.x, z - hole.z) < hole.r + 0.08;
  const points: number[] = [];
  const at = (i: number, j: number) => [-w / 2 + (w * i) / nx, -d / 2 + (d * j) / nz] as const;
  const push = (a: readonly [number, number], b: readonly [number, number]) => {
    if (inside((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) || inside(...a) || inside(...b)) return;
    points.push(a[0], y, a[1], b[0], y, b[1]);
  };
  for (let i = 0; i <= nx; i += 1) for (let j = 0; j <= nz; j += 1) {
    if (i < nx) push(at(i, j), at(i + 1, j));
    if (j < nz) push(at(i, j), at(i, j + 1));
    if (i < nx && j < nz) push(at(i, j), at(i + 1, j + 1));
  }
  const mesh = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), kit.edge);
  group.add(mesh);
  // Anillo de elementos refinados alrededor del hueco: concentración de tensiones.
  const ring: number[] = [];
  for (const radius of [hole.r + 0.12, hole.r + 0.26]) for (let k = 0; k < 28; k += 1) {
    const a0 = (k / 28) * Math.PI * 2; const a1 = ((k + 1) / 28) * Math.PI * 2;
    ring.push(hole.x + radius * Math.cos(a0), y, hole.z + radius * Math.sin(a0), hole.x + radius * Math.cos(a1), y, hole.z + radius * Math.sin(a1));
    ring.push(hole.x + hole.r * Math.cos(a0), y, hole.z + hole.r * Math.sin(a0), hole.x + (hole.r + 0.26) * Math.cos(a0), y, hole.z + (hole.r + 0.26) * Math.sin(a0));
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(ring, 3)), kit.edge));

  group.add(roundedMember([0.34, 1.1, d + 0.3], [-w / 2 - 0.17, 0.3, 0], kit.concrete, kit.edge, 0.04));
  for (const z of [-0.7, 0, 0.7]) {
    const arrow = cone(kit, [w / 2 + 0.34, 0.27, z], 0.42);
    arrow.rotation.z = Math.PI / 2;
    group.add(arrow);
  }
  return group;
};

export const buildSuiteScene = (id: SuiteSceneId, theme: StructuralRenderTheme) => {
  const kit = createMaterialKit(theme);
  const group = id === 'suite:model2d' ? buildModel2D(kit) : id === 'suite:design' ? buildDesign(kit) : buildFem(kit);
  group.name = id;
  return group;
};
