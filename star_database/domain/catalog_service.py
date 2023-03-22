from abc import ABC, abstractclassmethod
from numpy import array


class CatalogService(ABC):
    @abstractclassmethod
    def load(self) -> array:
        pass
