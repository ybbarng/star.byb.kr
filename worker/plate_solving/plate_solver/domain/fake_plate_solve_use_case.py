import time

class PlateSolveUseCase:
  def execute(self, request):
    print("Request: ")
    print(f"  width: {request['width']}")
    print(f"  height: {request['height']}")
    print(f"  stars: {request['height']}")
    for star in request['stars']:
      print(f"    ({star[0]}, {star[1]})")
    time.sleep(10)
    return [[
      [3, 51, 6.0],
      [-3, 0, 3.7]
    ],
    [
      [5, 51, 6.0],
      [-3, 0, 3.7]
    ],
    [
      [5, 51, 6.0],
      [12, 0, 3.7]
    ],
    [
      [3, 51, 6.0],
      [12, 0, 3.7]
    ]]