import json
import math
import unittest
from pathlib import Path

from validation.python import elements_oracle as oracle


FIXTURES = Path(__file__).parents[1] / "fixtures" / "elements"


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def fixtures(prefix):
    return sorted(path.name for path in FIXTURES.glob(f"{prefix}*.json"))


class ElementsOracleTest(unittest.TestCase):
    def assert_close(self, actual, expected, path):
        if isinstance(expected, dict):
            for key, value in expected.items():
                self.assert_close(actual[key], value, f"{path}.{key}")
        elif isinstance(expected, (int, float)) and not isinstance(expected, bool):
            self.assertTrue(math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-9), f"{path}: {actual!r} != {expected!r}")
        else:
            self.assertEqual(actual, expected, path)

    def test_fixture_inventory(self):
        # NTC, NSR-10 y E.060 cubiertos en columnas, zapatas y bloques.
        codes = {load(name)["input"]["code"] for name in fixtures("column-") + fixtures("footing-")}
        self.assertEqual(codes, {oracle.NTC, oracle.NSR, oracle.E060})

    def test_column_fixtures(self):
        for name in fixtures("column-"):
            fixture = load(name)
            self.assert_close(oracle.column_bresler(fixture["input"]), fixture["expected"], name)

    def test_footing_fixtures(self):
        for name in fixtures("footing-"):
            fixture = load(name)
            self.assert_close(oracle.footing(fixture["input"]), fixture["expected"], name)

    def test_blocks_fixtures(self):
        for name in fixtures("") :
            if not name.endswith("blocks.json"):
                continue
            fixture = load(name)
            for case in fixture["flexure"]:
                actual = oracle.flexural_strength(case["areaMm2"], case["widthMm"], case["depthMm"], case["fyMpa"], case["fcMpa"], case.get("code", oracle.NTC))
                self.assert_close(actual, case["strengthKnm"], f"{name}.flexure")
            for case in fixture["required"]:
                actual = oracle.required_steel(case["momentKnm"], case["widthMm"], case["depthMm"], case["fyMpa"], case["fcMpa"], case.get("code", oracle.NTC))
                self.assert_close(actual, case["areaMm2"], f"{name}.required")
            for case in fixture["development"]:
                actual = oracle.development_length(case["diameterMm"], case["fyMpa"], case["fcMpa"], case["topBar"], case["clearSpacingMm"], case["clearCoverMm"], case["minimumStirrups"], case.get("code", oracle.NTC))
                self.assert_close(actual, case["lengthMm"], f"{name}.development")
            for case in fixture.get("hooks", []):
                self.assert_close(oracle.hooked_length(case["diameterMm"], case["fyMpa"], case["fcMpa"]), case["lengthMm"], f"{name}.hooks")

    def test_hand_values(self):
        # Transición de la tabla 3.8.2.2: con 0.9ρb el FR cae a ~0.70.
        balanced = 0.85 * 24.5 / 412 * (600 * 0.85 / (412 + 600)) * 300 * 540
        a = 0.9 * balanced * 412 / (0.85 * 24.5 * 300)
        c = a / 0.85
        phi = oracle.resistance_factor(0.003 * (540 - c) / c, 412)
        self.assertTrue(0.65 < phi < 0.75)
        # NSR-10 C.9.3.2.2: φ = 0.90 en εt = 0.005; la NTC necesita εty + 0.003.
        self.assertEqual(oracle.resistance_factor(0.005, 420, oracle.NSR), 0.90)
        self.assertLess(oracle.resistance_factor(0.005, 420, oracle.NTC), 0.90)
        # E.060 9.3.2.1: flexión sin carga axial siempre 0.90.
        self.assertEqual(oracle.resistance_factor(0.001, 420, oracle.E060), 0.90)
        # λs de la ec. 5.5.3.2.1.b para d = 500 mm.
        self.assertAlmostEqual(min(1.0, math.sqrt(2 / (1 + 0.004 * 500))), math.sqrt(2 / 3), places=12)


if __name__ == "__main__":
    unittest.main()
