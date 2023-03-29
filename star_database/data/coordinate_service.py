from math import cos, dist, radians, sin, acos

from healpy import nside2npix, pix2vec, nside2resol
from numpy import array, cross, dot, identity, subtract
from numpy.linalg import norm
from numpy.typing import ArrayLike

from domain.coordinate_service import CoordinateService


class CoordinateService(CoordinateService):
    # Assumes the radius of celestial sphere is 1
    r = 1

    def group_by_healpixes(self, nside: int, data) -> list[array]:
        healpix_size = nside2resol(nside)
        groups = []
        for i in range(nside2npix(nside)):
            group = []
            healpix = pix2vec(nside, i)
            for star in data:
                if dist(star['vector'], healpix) < healpix_size:
                    group.append(star)
            groups.append(group)
        return groups

    def find_angles_of_polygon(self, points: list[ArrayLike]) -> list[float]:
        n_points = len(points)
        angles = []
        for i in range(n_points):
            angles.append(self.find_angle_from_points(points[(i - 1 + n_points) % n_points], points[i % n_points], points[(i + 1) % n_points]))
        return angles

    def find_angle_from_points(self, a: ArrayLike, b: ArrayLike, c: ArrayLike) -> float:
        ba = subtract(a, b)
        bc = subtract(c, b)
        try:
            return acos(dot(ba, bc) / (norm(ba) * norm(bc)))
        except ValueError:
            print(f"a: {a}, b: {b}, c: {c}, ba: {ba}, bc: {bc}, acos({dot(ba, bc)} / {norm(ba) * norm(bc)}) = {dot(ba, bc) / (norm(ba) * norm(bc))}")

    def find_plane_normal_vector(self, point1: ArrayLike, point2: ArrayLike, point3: ArrayLike) -> ArrayLike:
        # https://kitchingroup.cheme.cmu.edu/blog/2015/01/18/Equation-of-a-plane-through-three-points/
        point1 = array(point1)
        point2 = array(point2)
        point3 = array(point3)
        point1 = point1 / norm(point1)
        point2 = point2 / norm(point2)
        point3 = point3 / norm(point3)
        vector1 = point3 - point1
        vector2 = point2 - point1
        return cross(vector1, vector2)

    def get_rotation_matrix(
        self, normal_vector: ArrayLike
    ) -> list[ArrayLike]:
        # https://math.stackexchange.com/questions/180418/calculate-rotation-matrix-to-align-vector-a-to-vector-b-in-3d
        from_vector = array(normal_vector)
        from_vector = from_vector / norm(from_vector)
        to_vector = array([0, 0, 1])
        to_vector = to_vector / norm(to_vector)
        v = cross(from_vector, to_vector)
        c = dot(from_vector, to_vector)
        skew_v = array([
            [0, -v[2], v[1]],
            [v[2], 0, -v[0]],
            [-v[1], v[0], 0]
        ])
        s = 1 / (1 + c)
        rotation_matrix = identity(3) + skew_v + dot(skew_v, skew_v) * s
        return rotation_matrix

    def get_middle_vector(self, p1: ArrayLike, p2: ArrayLike) -> ArrayLike:
        vector = (p1 + p2) / 2
        return vector / norm(vector)

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