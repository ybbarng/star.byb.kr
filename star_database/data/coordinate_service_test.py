import unittest
from math import pi 

from numpy import array, dot
from numpy.testing import assert_almost_equal

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

  def test_find_plane_normal_vector(self):
    points = [
      array([3, 0, 0]),
      array([0, 3, 0]),
      array([0, 0, 3]),
    ]
    normal_vector = CoordinateService().find_plane_normal_vector(*points)
    assert_almost_equal(normal_vector[0], normal_vector[1])
    assert_almost_equal(normal_vector[1], normal_vector[2])
    assert_almost_equal(normal_vector[2], normal_vector[0])

  def test_get_rotation_matrix(self):
    normal_vector = array([0, 1, 0])
    point = normal_vector
    expected = array([0, 0, 1])
    rotation_matrix = CoordinateService().get_rotation_matrix(normal_vector)
    result = dot(rotation_matrix, point)
    assert_almost_equal(result, expected, 5)