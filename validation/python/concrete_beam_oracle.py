"""Independent numeric oracle for the NTC CDMX 2023 rectangular-beam slice.

This module intentionally does not mirror the TypeScript result shape or import
application code.  It recomputes a compact projection used by shared fixtures.
Units are MPa, mm, N, kN and kN·m as named by each variable.
"""

from __future__ import annotations

import math
from typing import Any


SOURCE_URL = "https://data.consejeria.cdmx.gob.mx/portal_old/uploads/gacetas/b3c4f4ff37241d0a93cc6742a8b0bf2f.pdf"
SOURCE_SHA256 = "293f22316a59ec2ec64d1f64f0749f49ba8849ded15b289cd88cc171c55ae62a"
MINIMUM_NUMBER_4_DIAMETER_MM = 12.7
PHI_FLEXURE = 0.90
PHI_SHEAR = 0.75


def _bar_area(diameter_mm: float) -> float:
    return math.pi * diameter_mm**2 / 4


def _beta_one(fc_mpa: float) -> float:
    return 0.85 if fc_mpa <= 30 else max(0.65, 1.05 - fc_mpa / 140)


def _required_flexural_area(
    demand_knm: float,
    width_mm: float,
    depth_mm: float,
    fy_mpa: float,
    block_strength_mpa: float,
) -> float | None:
    if demand_knm == 0:
        return 0.0
    moment_nmm = demand_knm * 1_000_000
    quadratic = 0.5 * fy_mpa / (width_mm * depth_mm * block_strength_mpa)
    normalized = moment_nmm / (PHI_FLEXURE * fy_mpa * depth_mm)
    discriminant = 1 - 4 * quadratic * normalized
    if discriminant < 0:
        return None
    return (1 - math.sqrt(discriminant)) / (2 * quadratic)


def _flexural_strength(
    area_mm2: float,
    width_mm: float,
    depth_mm: float,
    fy_mpa: float,
    block_strength_mpa: float,
) -> float:
    steel_ratio = area_mm2 / (width_mm * depth_mm)
    q = steel_ratio * fy_mpa / block_strength_mpa
    return PHI_FLEXURE * area_mm2 * fy_mpa * depth_mm * (1 - 0.5 * q) / 1_000_000


def _select_longitudinal(data: dict[str, Any], demand_knm: float, stirrup_diameter_mm: float) -> dict[str, float] | None:
    section = data["section"]
    concrete = data["concrete"]
    steel = data["reinforcement"]
    width = section["widthMm"]
    fc = concrete["compressiveStrengthMpa"]
    fy = steel["longitudinalYieldStrengthMpa"]
    block_strength = 0.85 * fc
    candidates: list[dict[str, float]] = []

    for preference, diameter in enumerate(steel["preferredLongitudinalDiametersMm"]):
        if diameter < MINIMUM_NUMBER_4_DIAMETER_MM:
            continue
        depth = section["heightMm"] - steel["coverMm"] - stirrup_diameter_mm - diameter / 2
        required = _required_flexural_area(demand_knm, width, depth, fy, block_strength)
        if required is None or depth <= 0:
            continue
        minimum = max(0.25 * math.sqrt(fc) * width * depth / min(fy, 560), 1.4 * width * depth / min(fy, 560))
        balanced = block_strength / fy * (600 * _beta_one(fc) / (fy + 600)) * width * depth
        maximum = 0.9 * balanced
        target = max(required, minimum)
        minimum_clear = max(25, diameter, 1.5 * steel["maximumAggregateSizeMm"])
        inside_width = width - 2 * (steel["coverMm"] + stirrup_diameter_mm)

        for count in range(2, 31):
            area = count * _bar_area(diameter)
            clear = (inside_width - count * diameter) / (count - 1)
            if clear < minimum_clear or area > maximum:
                continue
            candidates.append({
                "diameter": diameter,
                "count": count,
                "area": area,
                "depth": depth,
                "required": required,
                "strength": _flexural_strength(area, width, depth, fy, block_strength),
                "deficit": max(0.0, target - area),
                "excess": max(0.0, area - target),
                "preference": preference,
            })

    if not candidates:
        return None
    return min(candidates, key=lambda item: (
        item["deficit"], item["excess"], item["count"], item["preference"], item["diameter"]
    ))


def _select_stirrup(data: dict[str, Any], required_ratio: float, maximum_spacing_mm: float) -> dict[str, float] | None:
    steel = data["reinforcement"]
    increment = steel["stirrupSpacingIncrementMm"]
    candidates: list[dict[str, float]] = []
    for preference, diameter in enumerate(steel["preferredStirrupDiametersMm"]):
        area = steel["stirrupLegs"] * _bar_area(diameter)
        spacing = increment
        while spacing <= maximum_spacing_mm + 1e-9:
            provided = area / spacing
            candidates.append({
                "diameter": diameter,
                "spacing": spacing,
                "provided": provided,
                "deficit": max(0.0, required_ratio - provided),
                "excess": max(0.0, provided - required_ratio),
                "preference": preference,
            })
            spacing += increment
    if not candidates:
        return None
    return min(candidates, key=lambda item: (
        item["deficit"], item["excess"], item["preference"], -item["spacing"]
    ))


def _gate(data: dict[str, Any]) -> str | None:
    if data.get("section", {}).get("origin") != "catalog" or not data.get("section", {}).get("catalogId"):
        return "catalog-section-required"
    if data.get("concrete", {}).get("origin") != "catalog" or not data.get("concrete", {}).get("catalogId"):
        return "catalog-material-required"
    if data.get("analysis", {}).get("reliability") != "reliable":
        return "reliable-analysis-required"
    evidence = data.get("normativeEvidence", {})
    if evidence.get("sourceUrl") != SOURCE_URL or evidence.get("sourceSha256") != SOURCE_SHA256:
        return "complete-normative-evidence-required"
    return None


def design_reinforced_concrete_beam(data: dict[str, Any]) -> dict[str, Any]:
    """Return the fixture projection computed from first principles."""
    blocker = _gate(data)
    if blocker:
        return {"status": "blocked", "scope": "incomplete", "blockers": [blocker]}

    section = data["section"]
    concrete = data["concrete"]
    steel = data["reinforcement"]
    analysis = data["analysis"]
    first_stirrup_diameter = steel["preferredStirrupDiametersMm"][0]
    positive = _select_longitudinal(data, analysis["ultimate"]["positiveMomentKnm"], first_stirrup_diameter)
    negative = _select_longitudinal(data, abs(analysis["ultimate"]["negativeMomentKnm"]), first_stirrup_diameter)
    if positive is None or negative is None:
        return {"status": "blocked", "scope": "incomplete", "blockers": ["no-longitudinal-arrangement"]}

    width = section["widthMm"]
    height = section["heightMm"]
    fc = concrete["compressiveStrengthMpa"]
    fyv = steel["stirrupYieldStrengthMpa"]
    depth = min(positive["depth"], negative["depth"])
    shear_demand_n = analysis["ultimate"]["absoluteShearKn"] * 1_000
    concrete_nominal_n = 0.17 * math.sqrt(fc) * width * depth
    concrete_design_kn = PHI_SHEAR * concrete_nominal_n / 1_000
    required_stirrup_n = max(0.0, shear_demand_n / PHI_SHEAR - concrete_nominal_n)
    strength_ratio = required_stirrup_n / (fyv * depth)
    minimum_ratio = max(0.062 * math.sqrt(fc) * width / fyv, 0.35 * width / fyv)
    required_ratio = max(strength_ratio, minimum_ratio)
    high_shear = required_stirrup_n > 0.33 * math.sqrt(fc) * width * depth
    maximum_spacing = min(depth / 4, 300) if high_shear else min(depth / 2, 600)
    stirrup = _select_stirrup(data, required_ratio, maximum_spacing)
    if stirrup is None:
        return {"status": "blocked", "scope": "incomplete", "blockers": ["no-stirrup-arrangement"]}
    stirrup_nominal_n = stirrup["provided"] * fyv * depth

    selected = positive if analysis["service"]["governingMomentKnm"] >= 0 else negative
    gross_inertia = width * height**3 / 12
    modular_ratio = steel["steelElasticModulusMpa"] / concrete["elasticModulusMpa"]
    transformed_area = modular_ratio * selected["area"]
    neutral_axis = (-transformed_area + math.sqrt(transformed_area**2 + 2 * width * transformed_area * selected["depth"])) / width
    cracked_inertia = width * neutral_axis**3 / 3 + transformed_area * (selected["depth"] - neutral_axis) ** 2
    cracking_moment_knm = concrete["modulusOfRuptureMpa"] * gross_inertia / (height / 2) / 1_000_000
    service_moment = abs(analysis["service"]["governingMomentKnm"])
    if service_moment == 0 or service_moment <= 2 * cracking_moment_knm / 3:
        effective_inertia = gross_inertia
    else:
        ratio_squared = (2 * cracking_moment_knm / (3 * service_moment)) ** 2
        effective_inertia = cracked_inertia / (1 - ratio_squared * (1 - cracked_inertia / gross_inertia))
    immediate_deflection = analysis["service"]["grossElasticDeflectionMm"] * gross_inertia / effective_inertia
    total_limit = (3 + data["spanMm"] / 480) if analysis["service"]["damagesNonstructuralElements"] else (5 + data["spanMm"] / 240)

    return {
        "status": "available",
        "positiveRequiredAreaMm2": positive["required"],
        "negativeRequiredAreaMm2": negative["required"],
        "positiveDesignStrengthKnm": positive["strength"],
        "negativeDesignStrengthKnm": negative["strength"],
        "bottomDiameterMm": positive["diameter"],
        "bottomCount": positive["count"],
        "topDiameterMm": negative["diameter"],
        "topCount": negative["count"],
        "rejectedLongitudinalDiametersMm": [
            diameter for diameter in steel["preferredLongitudinalDiametersMm"]
            if diameter < MINIMUM_NUMBER_4_DIAMETER_MM
        ],
        "stirrupDiameterMm": stirrup["diameter"],
        "stirrupSpacingMm": stirrup["spacing"],
        "requiredAreaPerSpacingMm": required_ratio,
        "providedAreaPerSpacingMm": stirrup["provided"],
        "concreteDesignStrengthKn": concrete_design_kn,
        "shearDesignStrengthKn": PHI_SHEAR * (concrete_nominal_n + stirrup_nominal_n) / 1_000,
        "grossInertiaMm4": gross_inertia,
        "crackedTransformedInertiaMm4": cracked_inertia,
        "effectiveInertiaMm4": effective_inertia,
        "immediateDeflectionMm": immediate_deflection,
        "totalDeflectionLimitMm": total_limit,
        "totalConclusion": "not-evaluated",
    }
