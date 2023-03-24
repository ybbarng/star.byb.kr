from math import cos, dist, radians, sin, acos

from healpy import nside2npix, pix2vec, nside2resol
from numpy import array, dot, subtract
from numpy.linalg import norm
from numpy.typing import ArrayLike

from domain.coordinate_service import CoordinateService


class CoordinateService(CoordinateService):
    # Assumes the radius of celestial sphere is 1
    r = 1

    def group_by_healpixes(self, nside: int, data: array) -> list[array]:
        healpix_size = nside2resol(nside)
        groups = []
        for i in range(nside2npix(nside)):
            group = []
            healpix = pix2vec(nside, i)
            for point in data:
                if dist(point, healpix) < healpix_size:
                    group.append(point)
            groups.append(array(group))
        return groups

    def find_angle_from_points(self, a: ArrayLike, b: ArrayLike, c: ArrayLike) -> float:
        ba = subtract(a, b)
        bc = subtract(c, b)
        return acos(dot(ba, bc) / (norm(ba) * norm(bc)))

    def merge_sexagesimal(self, base: float, minute: float, second: float) -> float:
        sign = base / abs(base) if base != 0 else 1
        return (base * sign + minute / 60 + second / 3600) * sign

    def convert_time_to_degrees(self, time: float) -> float:
        return time / 24 * 360

    def to_spherical_coordinate_from_radec(
        self, radec: tuple[float, float]
    ) -> tuple[float, float, float]:
        (ra, dec) = radec
        r = self.r
        theta = radians(self.convert_time_to_degrees(ra))
        phi = radians(90 - dec)
        return (r, theta, phi)

    def to_celestial_sphere_vector_from_spherical_coordinate(
        self, spherical: tuple[float, float, float]
    ) -> array:
        r, theta, phi = spherical
        x = r * cos(theta) * sin(phi)
        y = r * sin(theta) * sin(phi)
        z = r * cos(phi)
        return array([x, y, z])

    def to_celestial_sphere_vector_from_radec(
        self, radec: tuple[float, float]
    ) -> array:
        return self.to_celestial_sphere_vector_from_spherical_coordinate(
            self.to_spherical_coordinate_from_radec(radec)
        )