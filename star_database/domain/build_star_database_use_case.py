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
            coordinates = [star["vector"] for star in squad]
            squad_with_angles = list(zip(self.coordinate_service.find_angles_of_polygon(coordinates), squad))
            squad_with_angles.sort(key=lambda item: item[0], reverse=True)
            platoon_with_angles.append(squad_with_angles)
        platoon_with_angles.sort(key=lambda squad: squad[0][0], reverse=True)
        platoon = platoon_with_angles
        print("All the angles of polygons are calculated.")

        image_testset = self.build_testset()
        image_stars = image_testset['stars']
        image_stars = list(enumerate(image_stars))
        selected_stars = [
            image_stars[0],
            image_stars[1],
            image_stars[6],
        ]
        selected_star_ids, selected_star_coordinates = zip(*selected_stars)
        target = list(zip(self.coordinate_service.find_angles_of_polygon(selected_star_coordinates), selected_star_ids))
        # sort by angle
        target.sort(key=lambda item: item[0], reverse=True)
        threshold = 0.016 # 5 degree to rad
        print(f"target: {target}")
        results = []
        for squad in platoon:
            is_valid = True
            for i in range(len(target)):
                if squad[i][0] - target[i][0] > threshold or squad[i][0] - target[i][0] < -threshold:
                    is_valid = False
                    break
            if is_valid:
                results.append(squad)
        print(f"{len(results)} results are found:")
        for squad in results:
            for i in range(len(target)):
                print(f"For star {i}")
                print("  Image")
                print(f"    angle: {target[i][0]}")
                print(f"    id: {target[i][1]}")
                print(f"    coordinate: {image_stars[i][1]}")
                print("  Database")
                print(f"    angle: {squad[i][0]}")
                print(f"    star: HR{squad[i][1]['HR']}" + f" ({squad[i][1]['N']})" if "N" in squad[i][1] else "")
                print(f"    coordinate: {squad[i][1]['vector']}")
                return
            return
    
    def build_testset(self):
        image_dubhe = [474.5, 222.625]
        image_merak = [451.5, 283.625]
        image_phecda = [357.5, 269.625]
        image_megrez = [351.5, 216.625]
        image_alioth = [295.5, 183.625]
        image_mizar = [153.5, 155.625]
        image_alkaid = [174.5, 157.625]
        image_width = 675
        image_height = 444

        stars = [
            image_dubhe,
            image_merak,
            image_phecda,
            image_megrez,
            image_alioth,
            image_mizar,
            image_alkaid
        ]

        return {
            'stars': stars,
            'width': image_width,
            'height': image_height
        }
