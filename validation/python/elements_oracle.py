"""Independent numeric oracle for the design workbench (column, footing and code blocks).

It does not import application code nor mirror its algorithms: the column
capacity along a load ray is solved by bisection on the neutral-axis depth
(the TypeScript engine intersects a sampled polyline), footing strip moments and
shears are integrated numerically (the engine uses closed forms) and the steel
search walks a fine grid. Units: mm, MPa, N, kN and kN·m as named.

Codes: ``ntc-2023`` (NTC-CDMX 2023), ``nsr-10`` (NSR-10 Título C) and ``e060``
(E.060 Concreto Armado). Every constant below is transcribed in
``docs/design/normative-sources.json``.
"""

from __future__ import annotations

import math
from typing import Any

ES = 200_000.0
ECU = 0.003
NTC, NSR, E060 = "ntc-2023", "nsr-10", "e060"


def beta_one(fc: float) -> float:
    return 0.85 if fc <= 28 else max(0.65, 1.05 - fc / 140)


def resistance_factor(net_strain: float, fy: float, code: str = NTC) -> float:
    """φ de flexión sin carga axial: NTC tabla 3.8.2.2, NSR C.9.3.2, E.060 9.3.2.1."""
    if code == E060:
        return 0.90
    ey = fy / ES
    upper = ey + 0.003 if code == NTC else 0.005
    if net_strain <= ey:
        return 0.65
    if net_strain >= upper:
        return 0.90
    return 0.65 + 0.25 * (net_strain - ey) / (upper - ey)


def flexural_strength(area: float, b: float, d: float, fy: float, fc: float, code: str = NTC) -> float:
    a = area * fy / (0.85 * fc * b)
    c = a / beta_one(fc)
    phi = resistance_factor(ECU * (d - c) / c, fy, code) if c > 0 else 0.90
    return phi * area * fy * (d - a / 2) / 1e6


def required_steel(moment: float, b: float, d: float, fy: float, fc: float, code: str = NTC) -> float | None:
    balanced = 0.85 * fc / fy * (600 * beta_one(fc) / (fy + 600)) * b * d
    previous = 0.0
    for step in range(1, 4001):
        area = balanced * step / 4000
        if flexural_strength(area, b, d, fy, fc, code) >= moment:
            low, high = previous, area
            for _ in range(80):
                middle = (low + high) / 2
                if flexural_strength(middle, b, d, fy, fc, code) >= moment:
                    high = middle
                else:
                    low = middle
            return high
        previous = area
    return None


def development_length(db: float, fy: float, fc: float, top: bool, clear_spacing: float, clear_cover: float, stirrups: bool, code: str = NTC) -> float:
    """NTC 14.4.2 (tablas 14.4.2.4 y 14.4.2.6), NSR C.12.2.2 y C.12.2.4, E.060 tabla 12.1 y ec. 12-1."""
    favorable = clear_cover >= db and (clear_spacing >= 2 * db or (clear_spacing >= db and stirrups))
    small = db <= 19.1
    root = math.sqrt(min(fc, 70))
    psi_top = 1.3 if top else 1.0
    if code == NTC:
        divisor = (2.1 if small else 1.7) if favorable else (1.4 if small else 1.1)
        psi_g = 1.0 if fy <= 420 * 1.02 else (1.15 if fy <= 550 else 1.3)
        length = fy * psi_top * psi_g / (divisor * root) * db
    elif code == NSR:
        divisor = (2.1 if small else 1.7) if favorable else (1.4 if small else 1.1)
        length = fy * psi_top / (divisor * root) * db
    else:
        if favorable:
            length = fy * psi_top / ((2.6 if small else 2.1) * root) * db
        else:
            cb = min(clear_cover + db / 2, (clear_spacing + db) / 2)
            psi_s = 0.8 if small else 1.0
            length = fy / (1.1 * root) * psi_top * psi_s / min(2.5, cb / db) * db
    return max(300.0, length)


def hooked_length(db: float, fy: float, fc: float) -> float:
    """Gancho estándar con factores unitarios: 0.24 fy/√f′c db, no menos de 8db ni 150 mm."""
    return max(0.24 * fy / math.sqrt(min(fc, 70)) * db, 8 * db, 150.0)


# ---------------------------------------------------------------- columna

def _bar_positions(data: dict[str, Any]) -> list[tuple[float, float]]:
    offset = data["coverMm"] + data["tieDiameterMm"] + data["barDiameterMm"] / 2
    xe = data["widthMm"] / 2 - offset
    ye = data["depthMm"] / 2 - offset
    nx, ny = data["barsAlongWidth"], data["barsAlongDepth"]
    bars = []
    for i in range(nx):
        x = -xe + 2 * xe * i / (nx - 1)
        bars += [(x, ye), (x, -ye)]
    for j in range(1, ny - 1):
        y = -ye + 2 * ye * j / (ny - 1)
        bars += [(-xe, y), (xe, y)]
    return bars


def _nominal(depth: float, width: float, positions: list[float], bar_area: float, fc: float, fy: float, c: float) -> tuple[float, float, float]:
    """(Pn [N], Mn [N·mm], εt) para profundidad del eje neutro c."""
    fpp = 0.85 * fc
    top = depth / 2
    a = min(beta_one(fc) * c, depth)
    force = fpp * a * width
    moment = force * (top - a / 2)
    for y in positions:
        strain = ECU * (c - (top - y)) / c
        stress = max(-fy, min(fy, strain * ES))
        if top - y < a:
            stress -= fpp
        force += stress * bar_area
        moment += stress * bar_area * y
    dt = top - min(positions)
    return force, moment, ECU * (dt - c) / c


def _column_phi(code: str, net_strain: float, fy: float, pn: float, low: float) -> float:
    if code == E060:
        if pn <= 0:
            return 0.90
        # φ = 0.90 − 0.20·φPn/low con φPn = φ·Pn, acotado a [0.70, 0.90].
        return max(0.70, min(0.90, 0.90 / (1 + 0.20 * pn / low)))
    return resistance_factor(net_strain, fy, NSR if code == NSR else NTC)


def column_ray_capacity(data: dict[str, Any], axis: str, moment: float, axial: float) -> tuple[float, float]:
    """Punto (φPn, φMn) sobre el rayo de excentricidad M/P, por bisección en c."""
    code = data["code"]
    depth = data["depthMm"] if axis == "x" else data["widthMm"]
    width = data["widthMm"] if axis == "x" else data["depthMm"]
    bars = _bar_positions(data)
    positions = [y if axis == "x" else x for x, y in bars]
    bar_area = math.pi * data["barDiameterMm"] ** 2 / 4
    fc, fy = data["fcMpa"], data["fyMpa"]
    dt = depth / 2 - min(positions)
    balanced, _, _ = _nominal(depth, width, positions, bar_area, fc, fy, ECU * dt / (ECU + fy / ES))
    low = max(1.0, min(0.1 * fc * depth * width, 0.70 * balanced))
    target = moment / axial * 1e3  # excentricidad en mm
    # Pn crece con c: primero se acota la raíz Pn = 0 y luego, donde Pn > 0, la
    # excentricidad Mn/Pn decrece de +∞ a 0 y la bisección es segura.
    lo, hi = depth * 1e-4, depth * 60
    for _ in range(200):
        middle = math.sqrt(lo * hi)
        if _nominal(depth, width, positions, bar_area, fc, fy, middle)[0] > 0:
            hi = middle
        else:
            lo = middle
    lo, hi = hi, depth * 60
    for _ in range(200):
        middle = math.sqrt(lo * hi)
        pn, mn, _ = _nominal(depth, width, positions, bar_area, fc, fy, middle)
        if mn / pn > target:
            lo = middle
        else:
            hi = middle
    pn, mn, strain = _nominal(depth, width, positions, bar_area, fc, fy, hi)
    phi = _column_phi(code, strain, fy, pn, low)
    return phi * pn / 1e3, phi * mn / 1e6


def column_squash(data: dict[str, Any]) -> float:
    steel = len(_bar_positions(data)) * math.pi * data["barDiameterMm"] ** 2 / 4
    gross = data["widthMm"] * data["depthMm"]
    return (0.85 * data["fcMpa"] * (gross - steel) + data["fyMpa"] * steel) / 1e3


def _compression_factor(code: str) -> float:
    return 0.70 if code == E060 else 0.65


def _axial_cap_coefficient(code: str) -> float:
    return {NTC: 1.0, NSR: 0.75, E060: 0.80}[code]


def column_design_moment(data: dict[str, Any], axis: str) -> float:
    """Mínimos y amplificación: NTC 3.3.5.2 y 5.3.2.1, NSR C.10.10, E.060 10.11-10.13."""
    code = data["code"]
    depth = data["depthMm"] if axis == "x" else data["widthMm"]
    width = data["widthMm"] if axis == "x" else data["depthMm"]
    non_sway = abs(data["momentXKnm"] if axis == "x" else data["momentYKnm"])
    sway = 0.0 if data["braced"] else abs(data["swayMomentXKnm"] if axis == "x" else data["swayMomentYKnm"])
    pu = data["axialKn"]
    fc = data["fcMpa"]
    height = data["unbracedLengthM"] * 1e3
    k = data["effectiveLengthFactor"]
    ratio = data["endMomentRatio"] * (1 if data["curvature"] == "single" else -1)
    r = depth / math.sqrt(12) if code == NTC else 0.3 * depth
    ec = (4400 * math.sqrt(fc) if fc < 40 else 2700 * math.sqrt(fc) + 11000) if code == NTC else 4700 * math.sqrt(fc)
    ei = 0.4 * ec * width * depth**3 / 12 / (1 + data["sustainedRatio"])

    def minimum() -> float:
        e = max(0.05 * depth, 20.0) if code == NTC else 15 + 0.03 * depth
        return pu * e / 1e3

    def amplified(m2: float, k_factor: float) -> float:
        m_min = minimum()
        base = max(m2, m_min)
        cm = 1.0 if m_min > m2 else 0.6 + 0.4 * ratio
        if code != NSR:
            cm = max(cm, 0.4)
        pc = math.pi**2 * ei / (k_factor * height) ** 2 / 1e3
        return max(1.0, cm / (1 - pu / (0.75 * pc))) * base

    if data["braced"]:
        value = height / r if code == NTC else k * height / r
        limit = 34 - 12 * ratio if code == NTC else min(34 - 12 * ratio, 40)
        slender = pu > 0 and (value >= limit if code == NTC else value > limit)
        if not slender:
            return max(non_sway, minimum()) if code == NTC else non_sway
        return amplified(non_sway, k)
    value = k * height / r
    neglect = pu <= 0 or (code == NSR and value <= 22) or (code == E060 and value < 22)
    delta_s = 1.0 if neglect else 1 / (1 - data["stabilityIndex"])
    m2 = non_sway + delta_s * sway
    individual_limit = 35 / math.sqrt(pu * 1e3 / (fc * width * depth)) if pu > 0 else math.inf
    if (code == NTC and height / r >= individual_limit) or (code == E060 and height / r > individual_limit):
        return amplified(m2, min(k, 1.0))
    return max(m2, minimum()) if code == NTC else m2


def column_bresler(data: dict[str, Any]) -> dict[str, float]:
    code = data["code"]
    pu = data["axialKn"]
    mx = column_design_moment(data, "x")
    my = column_design_moment(data, "y")
    prx, _ = column_ray_capacity(data, "x", mx, pu)
    pry, _ = column_ray_capacity(data, "y", my, pu)
    phi_p0 = _compression_factor(code) * column_squash(data)
    cap = _axial_cap_coefficient(code) * phi_p0
    pr = min(cap, 1 / (1 / min(prx, cap) + 1 / min(pry, cap) - 1 / phi_p0))
    return {"designMomentXKnm": mx, "designMomentYKnm": my, "maximumDesignAxialKn": cap, "breslerLoadKn": pr, "ratio": pu / pr}


# ---------------------------------------------------------------- zapata

def _integrate(function, a: float, b: float, steps: int = 4000) -> float:
    if b <= a:
        return 0.0
    h = (b - a) / steps
    total = function(a) + function(b)
    for i in range(1, steps):
        total += (4 if i % 2 else 2) * function(a + i * h)
    return total * h / 3


def footing(data: dict[str, Any]) -> dict[str, Any]:
    code = data["code"]
    bx, by, h = data["sideXMm"], data["sideYMm"], data["thicknessMm"]
    c1, c2 = data["columnWidthMm"], data["columnDepthMm"]
    fc, fy, cover, db = data["fcMpa"], data["fyMpa"], data["coverMm"], data["barDiameterMm"]
    pu = max(c["dead"] * data["deadKn"] + c["live"] * data["liveKn"] for c in data["combinations"]) * 1e3
    mux = abs(data["ultimateMomentXKnm"]) * 1e6
    muy = abs(data["ultimateMomentYKnm"]) * 1e6
    q0 = pu / (bx * by)
    kx = muy / (by * bx**3 / 12)
    ky = mux / (bx * by**3 / 12)
    long_axis = "x" if bx >= by else "y"
    shear_phi = 0.85 if code == E060 else 0.75
    punching_phi = 0.85 if code == E060 else (0.65 if code == NTC and data["seismicCombination"] else 0.75)

    # Penetración a d/2 del paño con γv·M·c/Jc de columna interior.
    d = h - cover - db
    b1, b2 = min(bx, c1 + d), min(by, c2 + d)
    bo = 2 * (b1 + b2)
    vu = pu - q0 * b1 * b2

    def transfer(along: float, across: float, moment: float) -> float:
        jc = d * along**3 / 6 + along * d**3 / 6 + d * across * along**2 / 2
        gamma_v = 1 - 1 / (1 + 2 / 3 * math.sqrt(along / across))
        return gamma_v * moment * (along / 2) / jc

    beta = max(c1, c2) / min(c1, c2)
    size = min(1.0, math.sqrt(2 / (1 + 0.004 * d))) if code == NTC else 1.0
    vc = min(0.33, 0.17 * (1 + 2 / beta), 0.083 * (2 + 40 * d / bo)) * size * math.sqrt(fc)
    direct = vu / (bo * d)
    punching_min_per_mm = 5 * direct * bo / (punching_phi * 40 * fy) if code == NTC and direct > 0.17 * punching_phi * size * math.sqrt(fc) else 0.0

    result: dict[str, Any] = {}
    for axis in ("x", "y"):
        side, column, width, k = (bx, c1, by, kx) if axis == "x" else (by, c2, bx, ky)
        dd = h - cover - (db / 2 if axis == long_axis else 1.5 * db)
        a, e = column / 2, side / 2
        pressure = lambda x: (q0 + k * x) * width
        moment = _integrate(lambda x: pressure(x) * (x - a), a, e) / 1e6
        shear = _integrate(pressure, a + dd, e) / 1e3
        required = required_steel(moment, width, dd, fy, fc, code)
        target = max(required, 0.0018 * width * h, punching_min_per_mm * width)
        bar = math.pi * db**2 / 4
        usable = width - 2 * cover - db
        count = max(2, math.ceil(target / bar))
        max_spacing = {NTC: min(2 * h, 450), NSR: min(3 * h, 450), E060: min(3 * h, 400)}[code]
        if usable / (count - 1) > max_spacing:
            count = math.ceil(usable / max_spacing) + 1
        provided = count * bar
        rho = provided / (width * dd)
        if code == NTC:
            one_way = shear_phi * 0.66 * min(1.0, math.sqrt(2 / (1 + 0.004 * dd))) * rho ** (1 / 3) * math.sqrt(fc) * width * dd / 1e3
        else:
            one_way = shear_phi * 0.17 * math.sqrt(fc) * width * dd / 1e3
        result[axis] = {
            "effectiveDepthMm": dd,
            "momentKnm": moment,
            "barCount": count,
            "providedMm2": provided,
            "strengthKnm": flexural_strength(provided, width, dd, fy, fc, code),
            "oneWayDemandKn": shear,
            "oneWayStrengthKn": one_way,
            "developmentLengthMm": development_length(db, fy, fc, False, usable / (count - 1) - db, cover, False, code),
            "hookLengthMm": hooked_length(db, fy, fc),
        }
    result["punching"] = {
        "demandKn": vu / 1e3,
        "demandStressMpa": direct + transfer(b1, b2, muy) + transfer(b2, b1, mux),
        "strengthStressMpa": punching_phi * vc,
    }
    return result
