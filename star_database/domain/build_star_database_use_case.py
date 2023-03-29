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
        N_SIDE = 1
        stars = self.catalog_service.load()
        print(f"{len(stars)} data is loaded.")
        groups = self.coordinate_service.group_by_healpixes(N_SIDE, stars)
        print(f"{len(groups)} groups are created with N_SIDE: {N_SIDE}.")
        platoon = []
        for group in groups:
            platoon += self.combination_service.get_combinations(group, 3)
        print(f"{len(platoon)} squads in a platoon are created.")
        platoon_with_angles = []
        for squad in platoon:
            coordinates = [star[0] for star in squad]
            platoon_with_angles.append((self.coordinate_service.find_angles_of_polygon(coordinates), squad))
        platoon_with_angles.sort(key = lambda angle: angle[0][0], reverse=True)
        platoon = platoon_with_angles
        print("All the angles of polygons are calculated.")

        target = self.build_target()['triangles'][0]
        threshold = 0.016 # 5 degree to rad
        print(f"target: {target}")
        results = []
        for angles, stars in platoon:
            is_valid = True
            for i in range(len(target)):
                if angles[i] - target[i] > threshold or angles[i] - target[i] < -threshold:
                    is_valid = False
                    break
            if is_valid:
                results.append((angles, stars))
        print(f"{len(results)} results are found:")
        for angles, stars in results:
            print(angles, stars)
    
    def build_target(self):
        image_dubhe = [474.5, 222.625]
        image_merak = [451.5, 283.625]
        image_phecda = [357.5, 269.625]
        image_megrez = [351.5, 216.625]
        image_alioth = [295.5, 183.625]
        image_mizar = [153.5, 155.625]
        image_alkaid = [174.5, 157.625]
        image_width = 675
        image_height = 444

        triangle = self.coordinate_service.find_angles_of_polygon([image_alkaid, image_dubhe, image_merak])
        quadrilateral = self.coordinate_service.find_angles_of_polygon([image_alkaid, image_dubhe, image_merak, image_phecda])
        return {
            'triangles': [triangle]
        }
