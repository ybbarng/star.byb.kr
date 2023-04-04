from copy import copy
from itertools import combinations

from numpy import allclose, array, dot
from numpy.linalg import pinv

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
        icombinations = list(combinations(range(0, len(image_stars)), r=3))

        dstars = {}
        for star in stars:
            dstars[star["HR"]] = star
        self.find(image_stars, dstars, platoon, {}, icombinations)
    
    def find(self, istars, dstars, platoon, assumes, icombinations):
        combination = icombinations[0]
        selected_stars = [istars[i] for i in combination]
        selected_star_ids, selected_star_coordinates = zip(*selected_stars)
        target = list(zip(self.coordinate_service.find_angles_of_polygon(selected_star_coordinates), selected_star_ids))
        # sort by angle
        target.sort(key=lambda item: item[0], reverse=True)
        threshold = 0.016 # 5 degree to rad
        results = []

        assumed_stars = []
        for i in combination:
            if i in assumes:
                assumed_stars.append(assumes[i])
        # remove the squads not the assumed star 0 and 1 are exist
        if len(assumed_stars) > 0:
            new_platoon = []
            for squad in platoon:
                stars = [star["HR"] for angle, star in squad]
                is_valid = True
                for assumed_star in assumed_stars:
                    if assumed_star not in stars:
                        is_valid = False
                        break
                if is_valid:
                    new_platoon.append(squad)
        else:
            new_platoon = platoon

        for squad in new_platoon:
            is_valid = True
            for i in range(len(target)):
                if squad[i][0] - target[i][0] > threshold or squad[i][0] - target[i][0] < -threshold:
                    is_valid = False
                    break
            if is_valid:
                results.append(squad)

        if len(results) == 0:
            return

        print(f"{len(results)} triangles are found.")
        for i, squad in enumerate(results):
            new_assumes = copy(assumes)
            is_valid = True
            for j in range(len(target)):
                for assume_i, assume_name in new_assumes.items():
                    if assume_name == squad[j][1]["HR"]:
                        if assume_i != target[j][1]:
                            is_valid = False
                            break
            if not is_valid:
                continue
            new_assumes[target[0][1]] = squad[0][1]["HR"]
            new_assumes[target[1][1]] = squad[1][1]["HR"]
            new_assumes[target[2][1]] = squad[2][1]["HR"]
            print(new_assumes)
            new_icombinations = copy(icombinations)
            while len(new_icombinations) > 1:
                new_icombinations = new_icombinations[1:]
                self.find(istars, dstars, platoon, new_assumes, new_icombinations)
            else:
                if len(new_assumes) == len(istars):
                    if self.verify_assumes(istars, dstars, new_assumes):
                        print("VERIFIED ASSUMES:")
                        print(new_assumes)
    
    def verify_assumes(self, istars, dstars, assumes):
        for combination in combinations(range(0, len(istars)), r=3):
            from_istars = [istars[i][1] for i in combination]
            from_dstars = [dstars[assumes[i]]['vector'] for i in combination]
            istars_angles = self.coordinate_service.find_angles_of_polygon(from_istars)
            dstars_angles = self.coordinate_service.find_angles_of_polygon(from_dstars)
            if not allclose(istars_angles, dstars_angles):
                return False
        return True
    
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
