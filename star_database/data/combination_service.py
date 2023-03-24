from itertools import combinations

from numpy import array

from domain.combination_service import CombinationService


class CombinationService(CombinationService):
    def get_combinations(self, group: list[array]) -> list[tuple[array, array, array]]:
        return list(combinations(group, 3))
