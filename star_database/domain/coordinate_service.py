from abc import ABC, abstractclassmethod
from numpy import array


class CoordinateService(ABC):
    @abstractclassmethod
    def group_by_healpixes(self, nside: int, data: array) -> list[array]:
        pass