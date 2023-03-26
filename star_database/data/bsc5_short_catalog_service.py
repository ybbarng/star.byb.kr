from itertools import combinations
from typing import Callable

from numpy import array

import json
import re

from domain.catalog_service import CatalogService

from data.coordinate_service import CoordinateService


class Bsc5ShortCatalogService(CatalogService):
    __FILE_NAME = "catalog/bsc5-short.json"

    def __init__(self, coordinate_service: CoordinateService):
        self.__coordinate_service = coordinate_service

    def load(self) -> list:
        """Load Catalog from basc5-short database and return each stars coordinates on celestial sphere"""
        stars = self.__open_file(bright=None)
        stars = self.__remove_same_coordinates(stars)
        stars = list(filter(lambda star: float(star["V"]) < 3.0, stars))
        stars = [(self.__parse_ra_dec(star), star) for star in stars]
        return list([(self.__to_celestial_sphere_vector(star[0]), star) for star in stars])

    def __open_file(self, bright=None):
        with open(self.__FILE_NAME) as f:
            data = json.load(f)
            if bright:
                data = [star for star in data if float(star["V"]) <= bright]
            return data

    def __remove_same_coordinates(self, stars) -> array:
        """Remove the stars with duplicate coordinates.
        """
        unique_coordinates = {}
        for star in stars:
            name = star["HR"]
            key = star["Dec"] + star["RA"]
            if key not in unique_coordinates:
                unique_coordinates[key] = star
        return list(unique_coordinates.values())

    def __parse_ra_dec(self, star):
        """Parse the star from catalog format to get the right ascension and the declination

        Args:
            star (_type_): {'Dec': '+61° 18′ 51″', 'HR': '9110', 'K': '14000', 'RA': '00h 05m 06.2s', 'V': '5.80'}
        Return:
            {'dec': 61.314166666666665, 'ra': 0.08505555555555555}
        """

        declination_regex = r"^([-+]?[0-9]+)°\s*([0-9]+)′\s*([0-9.]+)″$"
        declination_pattern = re.compile(declination_regex)

        def parse_declination(declination):
            """Parse declination

            Args:
                declination (_type_): '+61° 18′ 51″'
            Return:
                (61, 18, 51)
            """
            return parse(declination, declination_pattern)

        right_ascension_regex = r"^([0-9]+)h\s*([0-9]+)m\s*([0-9.]+)s$"
        right_ascension_pattern = re.compile(right_ascension_regex)

        def parse_right_ascension(right_ascension):
            """Parse right ascension

            Args:
                right_ascension (_type_): '00h 05m 06.2s'
            Return:
                (0, 18, 51)
            """
            return parse(right_ascension, right_ascension_pattern)

        def parse(data, pattern):
            match = pattern.match(data)
            return (float(value) for value in match.groups())

        def to_degree(degree, minute, second):
            return self.__coordinate_service.merge_sexagesimal(degree, minute, second)

        def to_hour(hour, minute, second):
            return self.__coordinate_service.merge_sexagesimal(hour, minute, second)

        return {
            "dec": to_degree(*parse_declination(star["Dec"])),
            "ra": to_hour(*parse_right_ascension(star["RA"])),
        }

    def __to_celestial_sphere_vector(self, radecs) -> array:
        """Convert the star from catalog format to the format we use

        Args:
            {'dec': 61.314166666666665, 'ra': 0.08505555555555555}
        Return:
            array(x, y, z) on the celestial sphere
        """
        radec = (radecs["ra"], radecs["dec"])
        return self.__coordinate_service.to_celestial_sphere_vector_from_radec(radec)
