from abc import ABC, abstractmethod
from numpy import array
from numpy.typing import ArrayLike


class CoordinateService(ABC):
    @abstractmethod
    def group_by_healpixes(self, nside: int, data: array) -> list[array]:
        pass

    @abstractmethod
    def find_angle_from_points(self, a: ArrayLike, b: ArrayLike, c: ArrayLike) -> float:
        pass

    @abstractmethod
    def find_angles_of_polygon(self, points: list[ArrayLike]) -> list[float]:
        pass
