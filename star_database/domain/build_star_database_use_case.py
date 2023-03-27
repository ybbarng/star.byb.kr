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
        platoon = []
        for group in groups:
            platoon += self.combination_service.get_combinations(group, 4)
        print(f"{len(platoon)} squads in a platoon are created.")
        platoon_with_angles = []
        for squad in platoon:
            coordinates = [star[0] for star in squad]
            platoon_with_angles.append((self.coordinate_service.find_angles_of_polygon(*coordinates), squad))
        angles.sort(key = lambda angle: angle[0][0], reverse=True)
        platoon = platoon_with_angles
        print("All the angles of polygons are calculated.")

        target = [1.504462873315192, 1.4235989684685986, 0.21353081180600306]
        threshold = 0.035 # 2 degree to rad
        print(f"target: {target}")
        for angles, stars in platoon:
            is_valid = True
            for i in len(target):
                if angles[i] - target[i] > threshold or angles[i] - target[i] < -threshold:
                    is_valid = False
                    break
            if is_valid:
                print(angles, stars)
