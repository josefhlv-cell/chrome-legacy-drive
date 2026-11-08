import unittest

import numpy as np

from compose_v2 import choose_contacts


class ContactTests(unittest.TestCase):
    def test_frontal_uses_outer_tyres_not_lower_bumper(self):
        profile = np.full(1000, -1)
        profile[100:250] = 1200
        profile[250:750] = 1400
        profile[750:900] = 1180
        choice = choose_contacts(profile)
        self.assertEqual(choice["kind"], "frontal")
        self.assertEqual(choice["near"], 1200)
        self.assertLess(choice["near"], choice["center"])

    def test_three_quarter_uses_lowest_near_tyre(self):
        profile = np.full(1000, -1)
        profile[100:300] = 900
        profile[300:800] = np.linspace(920, 1100, 500).astype(int)
        profile[800:950] = 1080
        choice = choose_contacts(profile)
        self.assertEqual(choice["kind"], "three_quarter")
        self.assertGreaterEqual(choice["near"], 1090)


if __name__ == "__main__":
    unittest.main()
