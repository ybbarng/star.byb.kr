from abc import ABC, abstractclassmethod


class CatalogService(ABC):
    @abstractclassmethod
    def load(self) -> list:
        pass
