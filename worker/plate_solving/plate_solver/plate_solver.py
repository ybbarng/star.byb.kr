from plate_solving.plate_solver.domain.fake_plate_solve_use_case import PlateSolveUseCase as FakePlateSolveUseCase
from plate_solving.plate_solver.domain.plate_solve_use_case import PlateSolveUseCase as RealPlateSolveUseCase

class PlateSolver:
  def __init__(self, fake=True):
    if fake:
      self.plate_solve_use_case = FakePlateSolveUseCase()
    else:
      self.plate_solve_use_case = RealPlateSolveUseCase()
  def solve(self, request):
    return self.plate_solve_use_case.execute(request)
