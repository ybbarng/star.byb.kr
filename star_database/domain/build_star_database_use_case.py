from numpy import array, dot
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
        target_matrix = array([image_stars[index][1] + [1] for angle, index in target])
        print(f"{len(results)} results are found.")
        max_stars_found = 0
        for i, squad in enumerate(results):
            # Verify squad {i} is valid
            vectors = [star['vector'] for angle, star in squad]
            normal_vector = self.coordinate_service.find_plane_normal_vector(*vectors)
            rotation_matrix = self.coordinate_service.get_rotation_matrix(normal_vector)
            new_squad = []
            for angle, star in squad:
                new_squad.append(list(dot(rotation_matrix, star['vector'])[:2]) + [1])
            new_squad = array(new_squad)
            # new_squad dot X = target_matrix
            # X = new_squad-1 dot target_matrix
            X = dot(pinv(new_squad), target_matrix)

            # Rotate neighbor stars on this plane
            neighbors = []
            for star in stars:
                neighbors.append(list(dot(rotation_matrix, star['vector'])[:2]) + [1])
            neighbors = array(neighbors)

            # Transform rotated neighbor to the image coordinates
            target_neighbors = dot(neighbors, X)

            # find the neighbor exists in the image data
            founds = []
            for n in target_neighbors:
                for i in image_stars:
                    if (n[0] - i[1][0]) ** 2 + (n[1] - i[1][1]) ** 2 < 70:
                        founds.append((n, i))
            found_image_stars = set()
            for found in founds:
                found_image_stars.add(found[1][0])
            if len(found_image_stars) > 3:
                if max_stars_found < len(found_image_stars):
                    max_stars_found = len(found_image_stars)
                if len(found_image_stars) > 5:
                    print(squad)
        print(max_stars_found)
    
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
