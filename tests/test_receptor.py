import importlib.util
import pathlib
import sys
import os
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'herramientas'))
_old = os.getcwd()
os.chdir(ROOT / 'herramientas')
import sim
os.chdir(_old)

class ReceiverTests(unittest.TestCase):
    def test_simulated_packet_has_expected_size_and_parses(self):
        packet = sim.pk(1, 1000, 45.0, 5500.0, 0.0, [.5]*4, [0.0]*4,
                        [.2]*4, [.2]*4, [90.0]*4, 255, 0, 3, 0)
        self.assertEqual(len(packet), 324)
        data = sim.m.parse(packet)
        self.assertTrue(sim.m.sane(data))
        self.assertEqual(data['gear'], 3)
        self.assertEqual(data['spd'], 45.0)
        compact = sim.m.compact(data)
        self.assertEqual(len(compact['sr']), 4)
        self.assertEqual(len(compact['tmp']), 4)

if __name__ == '__main__':
    unittest.main()
