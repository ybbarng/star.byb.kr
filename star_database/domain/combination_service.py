from abc import ABC, abstractmethod
from numpy import array


class CombinationService(ABC):
    @abstractmethod
    def get_combinations(self, group: list[array]) -> list[tuple[array, array, array]]:
        pass
