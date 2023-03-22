from math import comb

from domain.catalog_service import CatalogService
from domain.coordinate_service import CoordinateService

class BuildStarDatabaseUseCase():
    def __init__(self, catalog_service: CatalogService, coordiate_service: CoordinateService):
        self.catalog_service = catalog_service
        self.coordinate_service = coordiate_service

    def execute(self):
        print("Building star database is started.")
        N_SIDE = 10
        stars = self.catalog_service.load()
        print(f"{len(stars)} data is loaded.")
        for i in range(1, 17):
            groups = self.coordinate_service.group_by_healpixes(i, stars)
            min = 999999999
            max = -1
            triangles = 0
            for group in groups:
                group_size = len(group)
                if group_size < min:
                    min = group_size
                if group_size > max:
                    max = group_size
                triangles += comb(group_size, 3)
            print(f"N_SIDE: {i}, Groups: {len(groups)}, Min: {min}, Max: {max}, Triangles: {triangles}")