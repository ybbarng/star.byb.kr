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

  def test_find_angle_from_points_compare_two_data(self):
    catalog_alkaid = array([-0.58145959, -0.29479991, 0.75828607])
    catalog_dubhe = array([-0.45911157, 0.11504759, 0.88089762])
    catalog_merak = array([-0.5359151, 0.13899214, 0.83275218])

    image_alkaid = array([174.5, 157.625])
    image_dubhe = array([474.5, 222.625])
    image_merak = array([451.5, 283.625])
    catalog_angle = CoordinateService().find_angle_from_points(catalog_alkaid, catalog_dubhe, catalog_merak)
    image_angle = CoordinateService().find_angle_from_points(image_alkaid, image_dubhe, image_merak)
    print("A-D-M")
    print(catalog_angle)
    print(image_angle)

    print("D-M-A")
    catalog_angle = CoordinateService().find_angle_from_points(catalog_dubhe, catalog_merak, catalog_alkaid)
    image_angle = CoordinateService().find_angle_from_points(image_dubhe, image_merak, image_alkaid)
    print(catalog_angle)
    print(image_angle)

    print("M-A-D")
    catalog_angle = CoordinateService().find_angle_from_points(catalog_merak, catalog_alkaid, catalog_dubhe)
    image_angle = CoordinateService().find_angle_from_points(image_merak, image_alkaid, image_dubhe)
    print(catalog_angle)
    print(image_angle)
    self.assertAlmostEqual(catalog_angle, image_angle)