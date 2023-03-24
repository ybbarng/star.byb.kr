from domain.catalog_service import CatalogService
from domain.coordinate_service import CoordinateService

class BuildStarDatabaseUseCase():
    def __init__(self, catalog_service: CatalogService, coordiate_service: CoordinateService):
        self.catalog_service = catalog_service
        self.coordinate_service = coordiate_service

    def execute(self):
        print("Building star database is started.")
        N_SIDE = 11
        stars = self.catalog_service.load()
        print(f"{len(stars)} data is loaded.")
        groups = self.coordinate_service.group_by_healpixes(N_SIDE, stars)
        print(groups[0])
