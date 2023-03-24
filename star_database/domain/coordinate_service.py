from abc import ABC, abstractmethod
from numpy import array


class CoordinateService(ABC):
    @abstractmethod
    def group_by_healpixes(self, nside: int, data: array) -> list[array]:
        pass