from plate_solving.plate_solver.domain.plate_solve_use_case import PlateSolveUseCase

class PlateSolver:
  def solve(self, request):
    return PlateSolveUseCase().execute(request)