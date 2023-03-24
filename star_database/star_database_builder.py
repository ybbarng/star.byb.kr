from data.bsc5_short_catalog_service import Bsc5ShortCatalogService
from data.coordinate_service import CoordinateService
from data.combination_service import CombinationService

from domain.build_star_database_use_case import BuildStarDatabaseUseCase


class StarDatabaseBuilder:
  def __init__(self):
    coordinate_service = CoordinateService()
    self.build_star_database_use_case = BuildStarDatabaseUseCase(
      Bsc5ShortCatalogService(coordinate_service),
      coordinate_service,
      CombinationService()
    )
  
  def build(self):
    self.build_star_database_use_case.execute()


if __name__ == "__main__":
  builder = StarDatabaseBuilder()
  builder.build()