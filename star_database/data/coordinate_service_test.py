import unittest
from math import pi 

from numpy import array

from data.coordinate_service import CoordinateService

class CoordinateServiceTestCase(unittest.TestCase):
  def test_find_angle_from_points_with_3d(self):
    a = array([1, 1, 0])
    b = array([0, 0, 0])
    c = array([0, 1, 0])
    angle = CoordinateService().find_angle_from_points(a, b, c)
    self.assertAlmostEqual(angle, pi / 4)

  def test_find_angle_from_points_with_2d(self):
    a = array([0, 0])
    b = array([1, 0])
    c = array([1, 10])
    angle = CoordinateService().find_angle_from_points(a, b, c)
    self.assertAlmostEqual(angle, pi / 2)