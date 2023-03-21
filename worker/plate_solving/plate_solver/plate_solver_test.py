from plate_solving.plate_solver.plate_solver import PlateSolver

def test_plate_solver():
  request = {
    "width": 675,
    "height":444,
    "stars":[
      [174.5, 157.625],
      [253.5, 155.625],
      [295.5, 183.625],
      [351.5, 216.625],
      [357.5, 269.625],
      [451.5, 283.625],
      [474.5, 222.625]
    ]
  }
  result = PlateSolver(fake=False).solve(request)
  for i, point in enumerate(result):
    print(f"point {i}: {point}")