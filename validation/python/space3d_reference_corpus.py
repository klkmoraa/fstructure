"""Corpus de referencia del Modelo 3D con PyNite: sólo números.

REQUIERE PyNite (paquete ``PyNiteFEA``, licencia MIT) y NO CORRE EN CI. No es
dependencia del proyecto ni se copia su código: se instala en un entorno
virtual fuera del repositorio y este script sólo escribe los valores que PyNite
calcula para unos modelos pequeños.

    python3 -m venv /tmp/venv-pynite
    /tmp/venv-pynite/bin/pip install PyNiteFEA==3.2.0
    /tmp/venv-pynite/bin/python validation/python/space3d_reference_corpus.py \
        --output src/modules/space3d/space3d/engine/referenceCorpus.json

Cada caso se describe una sola vez, aquí, en el formato del Modelo 3D de
FStructure (ejes globales X y Z horizontales, Y vertical hacia arriba; m, kN,
kN·m, kN/m², rad). El script lo traduce a PyNite, lo resuelve con
``analyze_linear`` y guarda en el JSON el modelo y los resultados:
desplazamientos y reacciones de todos los nudos, triada local y fuerzas de
extremo de todas las barras. ``referenceCorpus.test.ts`` construye los mismos
modelos con el motor de FStructure y compara.

Equivalencias que el script comprueba antes de resolver:

  · Triada local. PyNite fija la suya (vertical hacia arriba: y = −X, z = +Z;
    resto: z horizontal, y con componente hacia arriba) y luego la gira
    ``rotation`` grados alrededor de x con Rodrigues. FStructure proyecta su
    referencia y la gira ``rollRadians`` igual. El script exige que la
    referencia de cada barra reproduzca la triada de PyNite sin giro; el
    JSON guarda además la triada final para que la prueba la compare.
  · Elemento. Ambos son Euler–Bernoulli prismáticos sin deformación por
    cortante ni alabeo, con rigidez torsional G·J.
  · Fuerzas de extremo. ``Member3D.f()`` de PyNite es k·d + fer en ejes
    locales: acciones de los nudos sobre la barra, el mismo convenio que
    ``start``/``end`` en FStructure ([N, Vy, Vz, T, My, Mz]).
  · Armadura. FStructure tiene barras ``truss`` (sólo axil). En PyNite se
    modelan con las flexiones liberadas en ambos extremos y la torsión en uno;
    los nudos a los que sólo llegan armaduras reciben además restricción de
    giro (con reacción nula), lo que FStructure hace solo.
  · Diafragma rígido. PyNite no tiene restricción de diafragma: se aproxima con
    barras de penalización en el plano (A e Iy enormes, Iz y J despreciables).
    El error de la penalización se estima resolviendo con dos niveles y se
    publica como ``referenceUncertainty`` del caso.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import math
from importlib.metadata import version
from pathlib import Path
from typing import Any

import numpy as np
from Pynite import FEModel3D

DOFS = ("ux", "uy", "uz", "rx", "ry", "rz")
RELEASE_KEYS = ("iUx", "iUy", "iUz", "iRx", "iRy", "iRz", "jUx", "jUy", "jUz", "jRx", "jRy", "jRz")
FIXED = list(DOFS)
PINNED = ["ux", "uy", "uz"]

# --- Materiales (kN/m²) -------------------------------------------------------
STEEL = {"E": 200e6, "G": 200e6 / (2 * (1 + 0.3))}  # acero estructural, ν = 0,3
# Concreto f'c = 25 MPa: E ≈ 4400·√f'c MPa = 22 000 MPa, ν = 0,2.
CONCRETE = {"E": 4400 * math.sqrt(25) * 1000, "G": 4400 * math.sqrt(25) * 1000 / (2 * (1 + 0.2))}

# --- Secciones (m², m⁴) ---------------------------------------------------------
IN2 = 0.0254 ** 2
IN4 = 0.0254 ** 4


def aisc(A: float, I_strong: float, I_weak: float, J: float) -> dict[str, float]:
    """Propiedades nominales de tabla AISC (in², in⁴) en m: Iz es el eje fuerte."""
    return {"A": A * IN2, "Iz": I_strong * IN4, "Iy": I_weak * IN4, "J": J * IN4}


def rect(width: float, depth: float) -> dict[str, float]:
    """Rectángulo macizo: ``depth`` a lo largo de y local (Iz), ``width`` a lo largo de z local (Iy)."""
    a, b = max(width, depth), min(width, depth)
    return {
        "A": width * depth,
        "Iz": width * depth ** 3 / 12,
        "Iy": depth * width ** 3 / 12,
        "J": a * b ** 3 * (1 / 3 - 0.21 * (b / a) * (1 - b ** 4 / (12 * a ** 4))),
    }


def rod(diameter: float) -> dict[str, float]:
    """Barra redonda maciza (tirante)."""
    I = math.pi * diameter ** 4 / 64
    return {"A": math.pi * diameter ** 2 / 4, "Iz": I, "Iy": I, "J": 2 * I}


HSS8x6x3_8 = aisc(9.74, 82.0, 52.5, 105.0)   # HSS 203×152×9,5
HSS6x4x1_4 = aisc(4.30, 20.9, 11.1, 23.6)    # HSS 152×102×6,4
W12x40 = aisc(11.7, 307.0, 44.1, 0.906)      # W310×60
COL40 = rect(0.40, 0.40)
COL30x50 = rect(0.30, 0.50)
COL30x60 = rect(0.30, 0.60)
BEAM30x50 = rect(0.30, 0.50)
BEAM30x60 = rect(0.30, 0.60)
BEAM25x45 = rect(0.25, 0.45)
ROD40 = rod(0.040)
ROD32 = rod(0.032)

UP = [0, 1, 0]
# Referencia que reproduce la triada de PyNite en barras verticales hacia arriba.
VERTICAL = [-1, 0, 0]


# --- Constructores del formato del corpus ---------------------------------------

def node(node_id: str, x: float, y: float, z: float, restraints: list[str] | None = None) -> dict[str, Any]:
    return {"id": node_id, "x": x, "y": y, "z": z, "restraints": list(restraints or [])}


def member(member_id: str, i: str, j: str, material: dict[str, float], section: dict[str, float], *,
           reference: list[float] = UP, roll_degrees: float = 0.0, kind: str = "frame",
           releases: list[str] | None = None) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": member_id, "i": i, "j": j, "type": kind,
        "E": material["E"], "G": material["G"],
        "A": section["A"], "Iy": section["Iy"], "Iz": section["Iz"], "J": section["J"],
        "localYReferenceGlobal": list(reference), "rollDegrees": roll_degrees,
    }
    if releases:
        data["releases"] = {key: True for key in releases}
    return data


def nodal(load_id: str, case: str, node_id: str, **components: float) -> dict[str, Any]:
    return {"id": load_id, "caseId": case, "nodeId": node_id,
            **{key: float(components.get(key, 0.0)) for key in ("fx", "fy", "fz", "mx", "my", "mz")}}


def distributed(load_id: str, case: str, member_id: str, system: str, start: float, end: float,
                **components: float) -> dict[str, Any]:
    return {"id": load_id, "memberId": member_id, "caseId": case, "type": "distributed",
            "coordinateSystem": system, "lengthBasis": "real", "start": start, "end": end, **components}


def point(load_id: str, case: str, member_id: str, system: str, position: float, **components: float) -> dict[str, Any]:
    return {"id": load_id, "memberId": member_id, "caseId": case, "type": "point",
            "coordinateSystem": system, "lengthBasis": "real", "start": 0, "end": 1, "position": position, **components}


def moment(load_id: str, case: str, member_id: str, system: str, position: float, **components: float) -> dict[str, Any]:
    return {"id": load_id, "memberId": member_id, "caseId": case, "type": "moment",
            "coordinateSystem": system, "lengthBasis": "real", "start": 0, "end": 1, "position": position, **components}


def single_case(case_id: str = "LC1") -> dict[str, Any]:
    return {"loadCases": [{"id": case_id, "name": case_id}], "loadCombinations": [], "target": case_id}


# --- Casos -------------------------------------------------------------------

def case_space_cantilever() -> dict[str, Any]:
    nodes = [node("A", 0, 0, 0, FIXED), node("B", 2.4, 0, 1.8)]
    return {
        "id": "voladizo-espacial",
        "description": "Voladizo horizontal oblicuo en planta (L = 3 m, HSS 203×152×9,5) con las seis acciones en la punta: axil, flexión biaxial y torsión.",
        "exercises": ["transformación en planta", "flexión en los dos planos", "torsión G·J", "axil"],
        "model": {
            "nodes": nodes,
            "members": [member("M1", "A", "B", STEEL, HSS8x6x3_8)],
            "nodalLoads": [nodal("P1", "LC1", "B", fx=10, fy=-15, fz=6, mx=4, my=-3, mz=5)],
            "memberLoads": [],
            **single_case(),
        },
    }


def case_one_story_frame() -> dict[str, Any]:
    plan = [(0, 0), (6, 0), (6, 5), (0, 5)]
    nodes = [node(f"B{k}", x, 0, z, FIXED) for k, (x, z) in enumerate(plan)]
    nodes += [node(f"T{k}", x, 3.5, z) for k, (x, z) in enumerate(plan)]
    members = [member(f"C{k}", f"B{k}", f"T{k}", CONCRETE, COL40, reference=VERTICAL) for k in range(4)]
    members += [member(f"V{k}", f"T{k}", f"T{(k + 1) % 4}", CONCRETE, BEAM30x50) for k in range(4)]
    loads = [nodal(f"G{k}", "LC1", f"T{k}", fy=-80) for k in range(4)]
    loads += [nodal("WX", "LC1", "T0", fx=40), nodal("WZ", "LC1", "T1", fz=25), nodal("MT", "LC1", "T2", my=12)]
    return {
        "id": "portico-un-nivel",
        "description": "Pórtico espacial de un nivel y una crujía (6 × 5 m, h = 3,5 m, concreto f'c = 25 MPa) con carga lateral en X y en Z excéntricas y un par alrededor de Y.",
        "exercises": ["ensamble 3D de columnas y vigas", "carga lateral en dos direcciones", "torsión de planta", "cargas nodales"],
        "model": {"nodes": nodes, "members": members, "nodalLoads": loads, "memberLoads": [], **single_case()},
    }


def case_two_story_frame() -> dict[str, Any]:
    xs, zs, ys = (0.0, 5.0, 10.0), (0.0, 6.0), (0.0, 4.0, 7.2)
    nodes = []
    for level, y in enumerate(ys):
        for row, z in enumerate(zs):
            for col, x in enumerate(xs):
                nodes.append(node(f"N{level}{row}{col}", x, y, z, FIXED if level == 0 else None))
    members = []
    for level in (1, 2):
        for row in range(2):
            for col in range(3):
                # Columnas 30×50: en el eje z = 0 el peralte resiste la deriva en X;
                # en z = 6 se giran 90° para resistir la deriva en Z.
                members.append(member(f"C{level}{row}{col}", f"N{level - 1}{row}{col}", f"N{level}{row}{col}",
                                      CONCRETE, COL30x50, reference=VERTICAL, roll_degrees=90.0 if row == 1 else 0.0))
        for row in range(2):
            for col in range(2):
                members.append(member(f"VX{level}{row}{col}", f"N{level}{row}{col}", f"N{level}{row}{col + 1}", CONCRETE, BEAM30x60))
        for col in range(3):
            members.append(member(f"VZ{level}{col}", f"N{level}0{col}", f"N{level}1{col}", CONCRETE, BEAM25x45))
    member_loads = []
    for item in members:
        if item["id"].startswith("VX"):
            member_loads.append(distributed(f"D-{item['id']}", "D", item["id"], "global", 0, 1, qyStart=-24, qyEnd=-24))
        elif item["id"].startswith("VZ"):
            member_loads.append(distributed(f"D-{item['id']}", "D", item["id"], "global", 0, 1, qyStart=-9, qyEnd=-9))
    nodal_loads = [
        nodal("W1X", "W", "N100", fx=35), nodal("W2X", "W", "N200", fx=55),
        nodal("W1Z", "W", "N112", fz=-20), nodal("W2Z", "W", "N212", fz=-30),
    ]
    return {
        "id": "marco-dos-niveles",
        "description": "Marco de dos niveles y 2 × 1 crujías (concreto): columnas rectangulares con orientación alterna (giro 90°), carga muerta distribuida en vigas y viento en X y Z; se compara la combinación 1,2 D + 1,0 W.",
        "exercises": ["varios niveles", "giro de columnas verticales", "carga distribuida global en vigas", "combinación de casos"],
        "model": {
            "nodes": nodes, "members": members, "nodalLoads": nodal_loads, "memberLoads": member_loads,
            "loadCases": [{"id": "D", "name": "Muerta"}, {"id": "W", "name": "Viento"}],
            "loadCombinations": [{"id": "CO1", "name": "1,2D + 1,0W", "terms": [{"caseId": "D", "factor": 1.2}, {"caseId": "W", "factor": 1.0}]}],
            "target": "CO1",
        },
    }


def case_inclined_rotated() -> dict[str, Any]:
    nodes = [node("A", 0, 0, 0, FIXED), node("B", 2.0, 3.0, 1.5, PINNED)]
    return {
        "id": "barra-inclinada-girada",
        "description": "Barra inclinada en el espacio (HSS 152×102×6,4, L ≈ 3,9 m) empotrada en A y articulada en B, girada 30° alrededor de su eje, con carga gravitacional global, carga local en z, una puntual local y momentos en el nudo articulado.",
        "exercises": ["orientación no trivial (inclinada y girada)", "carga distribuida global y local", "carga puntual local", "hiperestática"],
        "model": {
            "nodes": nodes,
            "members": [member("M1", "A", "B", STEEL, HSS6x4x1_4, roll_degrees=30.0)],
            "nodalLoads": [nodal("PB", "LC1", "B", mx=1.0, mz=-0.8)],
            "memberLoads": [
                distributed("Q1", "LC1", "M1", "global", 0, 1, qyStart=-1.5, qyEnd=-1.5),
                distributed("Q2", "LC1", "M1", "local", 0, 1, qzStart=2.0, qzEnd=2.0),
                point("P1", "LC1", "M1", "local", 0.4, py=-3.0),
            ],
            **single_case(),
        },
    }


def case_continuous_beam() -> dict[str, Any]:
    nodes = [node("S1", 0, 0, 0, FIXED), node("S2", 0, 0, 6.0, PINNED), node("S3", 0, 0, 10.5, PINNED)]
    return {
        "id": "viga-continua-cargas",
        "description": "Viga continua de dos tramos a lo largo de Z (W310×60), empotrada en S1 y articulada en S2 y S3, con carga trapezoidal parcial, carga lateral, axil distribuido, puntuales globales y locales y pares en el vano.",
        "exercises": ["carga trapezoidal parcial", "axil distribuido", "puntual global y local", "pares concentrados en barra (Mx, My, Mz)"],
        "model": {
            "nodes": nodes,
            "members": [member("T1", "S1", "S2", STEEL, W12x40), member("T2", "S2", "S3", STEEL, W12x40)],
            "nodalLoads": [],
            "memberLoads": [
                distributed("Q1", "LC1", "T1", "local", 0.1, 0.8, qyStart=-8.0, qyEnd=-14.0),
                distributed("Q2", "LC1", "T1", "local", 0, 1, qzStart=-2.0, qzEnd=-2.0),
                distributed("Q3", "LC1", "T2", "local", 0, 1, qxStart=1.0, qxEnd=1.0),
                point("P1", "LC1", "T2", "global", 0.35, py=-20.0),
                point("P2", "LC1", "T2", "local", 0.6, pz=5.0),
                moment("M1", "LC1", "T2", "local", 0.5, mx=2.5),
                moment("M2", "LC1", "T2", "local", 0.25, mz=6.0),
                moment("M3", "LC1", "T2", "local", 0.7, my=-3.0),
            ],
            **single_case(),
        },
    }


def case_grid_releases() -> dict[str, Any]:
    nodes = [
        node("A", 0, 0, 0, FIXED), node("M", 3.0, 0, 0), node("B", 6.0, 0, 0, FIXED),
        # Apoyo de horquilla: traslaciones y el giro alrededor del eje de la viga.
        node("E", 3.0, 0, 5.0, ["ux", "uy", "uz", "rz"]),
    ]
    return {
        "id": "parrilla-liberaciones",
        "description": "Parrilla de piso (concreto): trabe A–M–B empotrada con la flexión vertical liberada en B, y viga secundaria M–E articulada a la trabe (flexión en ambos planos y torsión liberadas en M) sobre un apoyo de horquilla.",
        "exercises": ["liberación de momento en un extremo", "liberación de torsión", "acoplamiento flexión–torsión en parrilla"],
        "model": {
            "nodes": nodes,
            "members": [
                member("G1", "A", "M", CONCRETE, BEAM30x60),
                member("G2", "M", "B", CONCRETE, BEAM30x60, releases=["jRz"]),
                member("S1", "M", "E", CONCRETE, BEAM25x45, releases=["iRx", "iRy", "iRz"]),
            ],
            "nodalLoads": [nodal("PM", "LC1", "M", fz=6.0, mx=4.0)],
            "memberLoads": [
                distributed("Q1", "LC1", "S1", "global", 0, 1, qyStart=-12.0, qyEnd=-12.0),
                distributed("Q2", "LC1", "G1", "global", 0, 1, qyStart=-18.0, qyEnd=-18.0),
                point("P1", "LC1", "G2", "global", 0.5, py=-25.0),
            ],
            **single_case(),
        },
    }


def case_rigid_diaphragm() -> dict[str, Any]:
    xs, zs, h = (0.0, 6.0, 12.0), (0.0, 7.0), 3.5
    nodes, members = [], []
    for row, z in enumerate(zs):
        for col, x in enumerate(xs):
            nodes.append(node(f"B{row}{col}", x, 0, z, FIXED))
    for row, z in enumerate(zs):
        for col, x in enumerate(xs):
            nodes.append(node(f"T{row}{col}", x, h, z))
    for row in range(2):
        for col in range(3):
            middle = col == 1
            members.append(member(f"C{row}{col}", f"B{row}{col}", f"T{row}{col}", CONCRETE,
                                  COL30x60 if middle else COL40, reference=VERTICAL,
                                  roll_degrees=90.0 if (middle and row == 1) else 0.0))
    for row in range(2):
        for col in range(2):
            members.append(member(f"VX{row}{col}", f"T{row}{col}", f"T{row}{col + 1}", CONCRETE, BEAM30x50))
    for col in range(3):
        members.append(member(f"VZ{col}", f"T0{col}", f"T1{col}", CONCRETE, BEAM30x50))
    tops = [f"T{row}{col}" for row in range(2) for col in range(3)]
    loads = [nodal(f"G{k}", "LC1", top, fy=-100) for k, top in enumerate(tops)]
    loads += [nodal("SX", "LC1", "T01", fx=60), nodal("SZ", "LC1", "T12", fz=35), nodal("MY", "LC1", "T10", my=20)]
    return {
        "id": "diafragma-rigido",
        "description": "Planta de un nivel con 2 × 1 crujías (concreto) y diafragma rígido en el techo: columnas de distinta rigidez y orientación, cargas laterales excéntricas en X y Z, un par alrededor de Y y gravedad en los nudos.",
        "exercises": ["diafragma rígido (ux, uz, ry)", "centro de rigidez fuera del centro geométrico", "vigas del plano sin axil"],
        "model": {
            "nodes": nodes, "members": members, "nodalLoads": loads, "memberLoads": [],
            "diaphragms": [{"id": "D1", "name": "Techo", "nodeIds": tops}],
            **single_case(),
        },
    }


def case_tied_cantilever() -> dict[str, Any]:
    nodes = [
        node("A", 0, 0, 0, FIXED), node("B", 5.0, 0, 0),
        node("C1", 0, 2.5, -1.2, PINNED), node("C2", 0, 2.5, 1.2, PINNED),
    ]
    return {
        "id": "voladizo-atirantado",
        "description": "Ménsula W310×60 empotrada y sostenida en la punta por dos tirantes (barras de armadura, Ø40 y Ø32 mm) anclados en apoyos articulados; carga gravitacional distribuida y acciones en la punta en las tres direcciones.",
        "exercises": ["barras de armadura (sólo axil)", "giros fijados automáticamente en nudos de armadura", "interacción marco–armadura"],
        "model": {
            "nodes": nodes,
            "members": [
                member("V1", "A", "B", STEEL, W12x40),
                member("K1", "C1", "B", STEEL, ROD40, kind="truss"),
                member("K2", "C2", "B", STEEL, ROD32, kind="truss"),
            ],
            "nodalLoads": [nodal("PB", "LC1", "B", fx=-3.0, fy=-40.0, fz=8.0)],
            "memberLoads": [distributed("Q1", "LC1", "V1", "global", 0, 1, qyStart=-4.0, qyEnd=-4.0)],
            **single_case(),
        },
    }


CASES = (
    case_space_cantilever,
    case_one_story_frame,
    case_two_story_frame,
    case_inclined_rotated,
    case_continuous_beam,
    case_grid_releases,
    case_rigid_diaphragm,
    case_tied_cantilever,
)


# --- Traducción a PyNite ----------------------------------------------------------

def reference_triad(start: np.ndarray, end: np.ndarray, reference: list[float]) -> np.ndarray:
    """Triada sin giro a partir de una referencia (la regla del Modelo 3D)."""
    x = (end - start) / np.linalg.norm(end - start)
    ref = np.asarray(reference, dtype=float)
    y = ref - x * np.dot(ref, x)
    y /= np.linalg.norm(y)
    z = np.cross(x, y)
    return np.vstack([x, y, z / np.linalg.norm(z)])


def build_pynite(model: dict[str, Any], penalty: float) -> tuple[FEModel3D, list[str]]:
    fem = FEModel3D()
    for item in model["nodes"]:
        fem.add_node(item["id"], item["x"], item["y"], item["z"])

    truss_only: dict[str, bool] = {item["id"]: True for item in model["nodes"]}
    for item in model["members"]:
        is_truss = item["type"] == "truss"
        for end in (item["i"], item["j"]):
            truss_only[end] = truss_only[end] and is_truss

    for item in model["nodes"]:
        restrained = set(item["restraints"])
        rotations = truss_only[item["id"]]
        fem.def_support(item["id"], "ux" in restrained, "uy" in restrained, "uz" in restrained,
                        "rx" in restrained or rotations, "ry" in restrained or rotations, "rz" in restrained or rotations)

    for item in model["members"]:
        material, section = f"mat-{item['id']}", f"sec-{item['id']}"
        fem.add_material(material, item["E"], item["G"], item["E"] / (2 * item["G"]) - 1, 0.0)
        fem.add_section(section, item["A"], item["Iy"], item["Iz"], item["J"])
        fem.add_member(item["id"], item["i"], item["j"], material, section, rotation=item["rollDegrees"])
        flags = [bool(item.get("releases", {}).get(key, False)) for key in RELEASE_KEYS]
        if item["type"] == "truss":
            # Sólo axil: flexión libre en ambos extremos y torsión libre en uno.
            flags = [False, False, False, True, True, True, False, False, False, False, True, True]
        if any(flags):
            fem.def_releases(item["id"], *flags)

    penalty_members: list[str] = []
    for diaphragm in model.get("diaphragms", []):
        ids = diaphragm["nodeIds"]
        stiff = max(item["E"] for item in model["members"])
        area = max(item["A"] for item in model["members"]) * penalty
        inertia = max(max(item["Iy"], item["Iz"]) for item in model["members"]) * penalty
        fem.add_material("mat-penalty", stiff, stiff / 2.4, 0.2, 0.0)
        # A e Iy (flexión en el plano XZ de una barra horizontal) enormes; Iz y J despreciables
        # para no rigidizar uy, rx ni rz, que el diafragma deja libres.
        fem.add_section("sec-penalty", area, inertia, inertia * 1e-12 / penalty, inertia * 1e-12 / penalty)
        # Cadena que recorre los nudos en el orden declarado (filas de la planta en
        # zigzag): basta un árbol de barras rígidas para que todos se muevan juntos.
        order = ids[:3] + ids[3:][::-1] if len(ids) == 6 else ids
        for k in range(len(order) - 1):
            name = f"penalty-{diaphragm['id']}-{k}"
            fem.add_member(name, order[k], order[k + 1], "mat-penalty", "sec-penalty")
            penalty_members.append(name)
        # Y se cierra el anillo para que la planta no dependa de una sola barra.
        name = f"penalty-{diaphragm['id']}-close"
        fem.add_member(name, order[0], order[-1], "mat-penalty", "sec-penalty")
        penalty_members.append(name)

    lengths = {}
    for item in model["members"]:
        a = model_node(model, item["i"])
        b = model_node(model, item["j"])
        lengths[item["id"]] = math.dist((a["x"], a["y"], a["z"]), (b["x"], b["y"], b["z"]))

    for load in model["nodalLoads"]:
        for key, direction in (("fx", "FX"), ("fy", "FY"), ("fz", "FZ"), ("mx", "MX"), ("my", "MY"), ("mz", "MZ")):
            if load[key] != 0:
                fem.add_node_load(load["nodeId"], direction, load[key], case=load["caseId"])

    for load in model["memberLoads"]:
        L = lengths[load["memberId"]]
        local = load["coordinateSystem"] == "local"
        axes = ("x", "y", "z")
        if load["type"] == "distributed":
            for axis in axes:
                w1 = load.get(f"q{axis}Start", 0.0)
                w2 = load.get(f"q{axis}End", 0.0)
                if w1 == 0 and w2 == 0:
                    continue
                direction = f"F{axis}" if local else f"F{axis.upper()}"
                fem.add_member_dist_load(load["memberId"], direction, w1, w2, load["start"] * L, load["end"] * L, case=load["caseId"])
        else:
            prefix = "F" if load["type"] == "point" else "M"
            key = "p" if load["type"] == "point" else "m"
            for axis in axes:
                value = load.get(f"{key}{axis}", 0.0)
                if value == 0:
                    continue
                direction = f"{prefix}{axis}" if local else f"{prefix}{axis.upper()}"
                fem.add_member_pt_load(load["memberId"], direction, value, load["position"] * L, case=load["caseId"])

    target = model["target"]
    factors: dict[str, float] = {}
    if any(item["id"] == target for item in model["loadCases"]):
        factors[target] = 1.0
    for combination in model["loadCombinations"]:
        if combination["id"] == target:
            for term in combination["terms"]:
                factors[term["caseId"]] = factors.get(term["caseId"], 0.0) + term["factor"]
    fem.add_load_combo("TARGET", factors)
    return fem, penalty_members


def model_node(model: dict[str, Any], node_id: str) -> dict[str, Any]:
    return next(item for item in model["nodes"] if item["id"] == node_id)


def check_orientation(fem: FEModel3D, model: dict[str, Any]) -> None:
    """La referencia de cada barra debe reproducir la triada de PyNite sin giro."""
    for item in model["members"]:
        physical = fem.members[item["id"]]
        saved = physical.rotation
        physical.rotation = 0.0
        pynite = physical.T()[:3, :3]
        physical.rotation = saved
        a, b = model_node(model, item["i"]), model_node(model, item["j"])
        ours = reference_triad(np.array([a["x"], a["y"], a["z"]], float), np.array([b["x"], b["y"], b["z"]], float),
                               item["localYReferenceGlobal"])
        if not np.allclose(pynite, ours, atol=1e-12):
            raise SystemExit(f"La referencia de {item['id']} no reproduce la triada de PyNite:\n{pynite}\n{ours}")


def solve(model: dict[str, Any], penalty: float) -> dict[str, Any]:
    fem, _penalty_members = build_pynite(model, penalty)
    check_orientation(fem, model)
    fem.analyze_linear(check_stability=True)
    combo = "TARGET"

    nodes_out: dict[str, Any] = {}
    for item in model["nodes"]:
        n = fem.nodes[item["id"]]
        displacement = [n.DX[combo], n.DY[combo], n.DZ[combo], n.RX[combo], n.RY[combo], n.RZ[combo]]
        reaction = [n.RxnFX[combo], n.RxnFY[combo], n.RxnFZ[combo], n.RxnMX[combo], n.RxnMY[combo], n.RxnMZ[combo]]
        restrained = set(item["restraints"])
        # Los giros que sólo se fijaron en PyNite (nudos de armadura) deben quedar sin reacción.
        for index, dof in enumerate(DOFS):
            if dof not in restrained:
                scale = max(1.0, max(abs(value) for value in reaction[:3]))
                if abs(reaction[index]) > 1e-9 * scale:
                    raise SystemExit(f"Reacción espuria en {item['id']}.{dof}: {reaction[index]}")
                reaction[index] = 0.0
        nodes_out[item["id"]] = {"displacement": displacement, "reaction": reaction}

    members_out: dict[str, Any] = {}
    for item in model["members"]:
        physical = fem.members[item["id"]]
        if len(physical.sub_members) != 1:
            raise SystemExit(f"{item['id']} se dividió en {len(physical.sub_members)} tramos; el corpus no lo admite")
        sub = next(iter(physical.sub_members.values()))
        forces = sub.f(combo).flatten().tolist()
        triad = sub.T()[:3, :3]
        members_out[item["id"]] = {
            "basis": {"x": triad[0].tolist(), "y": triad[1].tolist(), "z": triad[2].tolist()},
            "start": forces[:6],
            "end": forces[6:],
        }
    return {"nodes": nodes_out, "members": members_out}


def flatten(result: dict[str, Any]) -> np.ndarray:
    values: list[float] = []
    for entry in result["nodes"].values():
        values += entry["displacement"] + entry["reaction"]
    for entry in result["members"].values():
        values += entry["start"] + entry["end"]
    return np.array(values)


def rounded(value: Any) -> Any:
    if isinstance(value, float):
        number = float(f"{value:.12g}")
        return 0.0 if number == 0 else number
    if isinstance(value, list):
        return [rounded(item) for item in value]
    if isinstance(value, dict):
        return {key: rounded(item) for key, item in value.items()}
    return value


def build_case(factory) -> dict[str, Any]:
    case = factory()
    model = case["model"]
    if model.get("diaphragms"):
        # Penalización a dos niveles: la diferencia mide el error del modelo
        # aproximado de PyNite. Se publica el más rígido.
        coarse = solve(model, 1e4)
        fine = solve(model, 1e5)
        a, b = flatten(coarse), flatten(fine)
        scale = np.max(np.abs(b))
        uncertainty = float(np.max(np.abs(a - b)) / 9 / scale)
        expected = fine
        case["referenceModel"] = (
            "Diafragma aproximado en PyNite con barras de penalización (A e Iy × 1e5 del mayor de las barras reales; "
            "Iz y J despreciables). referenceUncertainty estima su error relativo a partir de la solución con × 1e4."
        )
    else:
        expected = solve(model, 0)
        uncertainty = 0.0
        case["referenceModel"] = "Mismo modelo en PyNite: elemento Euler–Bernoulli, sin deformación por cortante."
    case["referenceUncertainty"] = float(f"{uncertainty:.3g}")
    case["expected"] = expected
    return case


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--output", type=Path, default=Path("src/modules/space3d/space3d/engine/referenceCorpus.json"))
    parser.add_argument("--date", default=_dt.date.today().isoformat())
    args = parser.parse_args()

    corpus = {
        "source": f"PyNite {version('PyNiteFEA')} (paquete PyNiteFEA, licencia MIT); sólo números, sin código de PyNite",
        "generatedAt": args.date,
        "command": "python validation/python/space3d_reference_corpus.py --output src/modules/space3d/space3d/engine/referenceCorpus.json",
        "units": {"length": "m", "force": "kN", "moment": "kN·m", "modulus": "kN/m²", "area": "m²", "inertia": "m⁴", "rotation": "rad"},
        "conventions": {
            "globalAxes": "X y Z horizontales, Y vertical hacia arriba",
            "dofOrder": "[ux, uy, uz, rx, ry, rz] por nudo; desplazamientos y reacciones en ejes globales",
            "localAxes": "x de i a j; y = referencia proyectada perpendicular a x y girada rollDegrees alrededor de x; z = x × y",
            "inertias": "Iz gobierna la flexión en el plano x–y local (v, rz); Iy la del plano x–z (w, ry)",
            "endForces": "[N, Vy, Vz, T, My, Mz] en ejes locales: acciones de los nudos sobre la barra (k·d + fuerzas de empotramiento)",
            "reactions": "Fuerzas de los apoyos sobre la estructura; cero en los GDL libres",
            "memberLoads": "start, end y position son fracciones de la longitud real; las intensidades son por metro de longitud real",
            "element": "Euler–Bernoulli prismático, sin deformación por cortante ni alabeo; torsión de St. Venant G·J",
        },
        "cases": [rounded(build_case(factory)) for factory in CASES],
    }
    args.output.write_text(json.dumps(corpus, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(corpus['cases'])} casos escritos en {args.output}")


if __name__ == "__main__":
    main()
