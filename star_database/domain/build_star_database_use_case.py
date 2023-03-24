from domain.catalog_service import CatalogService
from domain.coordinate_service import CoordinateService
from domain.combination_service import CombinationService

class BuildStarDatabaseUseCase():
    def __init__(self, catalog_service: CatalogService, coordiate_service: CoordinateService, combination_service: CombinationService):
        self.catalog_service = catalog_service
        self.coordinate_service = coordiate_service
        self.combination_service = combination_service

    def execute(self):
        print("Building star database is started.")
        N_SIDE = 11
        stars = self.catalog_service.load()
        print(f"{len(stars)} data is loaded.")
        groups = self.coordinate_service.group_by_healpixes(N_SIDE, stars)
        print(f"{len(groups)} groups are created with N_SIDE: {N_SIDE}.")
        triangles = []
        for group in groups:
            triangles += self.combination_service.get_combinations(group)
        print(f"{len(triangles)} triangles are created.")
        angles = []
        for triangle in triangles:
            angles.append(self.coordinate_service.find_angles_of_triangles(*triangle))
        angles.sort(key = lambda angle: angle[0], reverse=True)
        print("All the angles of triangles are calculated.")
        print(angles[0])
        print(angles[1])
        print(angles[2])
        print(angles[3])
