import json
import math
import unittest
from copy import deepcopy
from pathlib import Path

from validation.python.concrete_beam_oracle import design_reinforced_concrete_beam
# El gate `npm run design:oracle` ejecuta este módulo; importar la suite de los
# elementos del taller aquí la incluye sin cambiar el comando fijado por el gate.
from validation.python.test_elements_oracle import ElementsOracleTest  # noqa: F401


FIXTURES = Path(__file__).parents[1] / "fixtures" / "concrete-beam"


class ConcreteBeamOracleTest(unittest.TestCase):
    def baseline_input(self):
        fixture = json.loads((FIXTURES / "baseline.json").read_text(encoding="utf-8"))
        return deepcopy(fixture["input"])

    def assert_projected_equal(self, actual, expected, path="result"):
        if isinstance(expected, dict):
            for key, value in expected.items():
                self.assertIn(key, actual, f"{path}.{key}")
                self.assert_projected_equal(actual[key], value, f"{path}.{key}")
        elif isinstance(expected, list):
            self.assertEqual(len(actual), len(expected), path)
            for index, value in enumerate(expected):
                self.assert_projected_equal(actual[index], value, f"{path}[{index}]")
        elif isinstance(expected, float):
            self.assertTrue(
                math.isclose(actual, expected, rel_tol=0, abs_tol=1e-3),
                f"{path}: {actual!r} != {expected!r}",
            )
        else:
            self.assertEqual(actual, expected, path)

    def test_all_json_fixtures(self):
        fixture_paths = sorted(FIXTURES.glob("*.json"))
        self.assertGreaterEqual(len(fixture_paths), 2)
        for fixture_path in fixture_paths:
            with self.subTest(fixture=fixture_path.name):
                fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
                actual = design_reinforced_concrete_beam(fixture["input"])
                self.assert_projected_equal(actual, fixture["expected"])

    def test_complete_configuration_uses_selected_stirrup_diameter(self):
        data = self.baseline_input()
        data["analysis"]["ultimate"]["positiveMomentKnm"] = 127.2
        data["analysis"]["ultimate"]["absoluteShearKn"] = 183.7
        actual = design_reinforced_concrete_beam(data)
        self.assertEqual(actual["stirrupDiameterMm"], 10)
        self.assertEqual(
            actual["bottomEffectiveDepthMm"],
            data["section"]["heightMm"] - data["reinforcement"]["coverMm"] - 10 - actual["bottomDiameterMm"] / 2,
        )

    def test_rejects_axial_force_and_invalid_reinforcement_geometry(self):
        axial = self.baseline_input()
        axial["analysis"]["ultimate"]["compressionKn"] = 1
        self.assertEqual(design_reinforced_concrete_beam(axial)["blockers"], ["unsupported-v1-input"])

        invalid = self.baseline_input()
        invalid["reinforcement"]["preferredStirrupDiametersMm"] = [-8]
        self.assertEqual(design_reinforced_concrete_beam(invalid)["blockers"], ["invalid-input"])


if __name__ == "__main__":
    unittest.main()
