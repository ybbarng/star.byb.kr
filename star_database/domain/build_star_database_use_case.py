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
        N_SIDE = 5
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
            coordinates = [star[0] for star in triangle]
            angles.append((self.coordinate_service.find_angles_of_triangles(*coordinates), triangle))
        angles.sort(key = lambda angle: angle[0][0], reverse=True)
        triangles = angles
        print("All the angles of triangles are calculated.")

        target = [1.504462873315192, 1.4235989684685986, 0.21353081180600306]
        threshold = 0.035 # 2 degree to rad
        print(f"target: {target}")
        for angles, stars in triangles:
            if angles[0] - target[0] < threshold and angles[0] - target[0] > -threshold:
                if angles[1] - target[1] < threshold and angles[1] - target[1] > -threshold:
                    if angles[2] - target[2] < threshold and angles[2] - target[2] > -threshold:
                        print(angles, stars)
