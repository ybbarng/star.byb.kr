const math = require("mathjs");
const plane = require("../hash/plane");

const run = (photo, database, test) => {
  const databaseQuad = database.quad.map((star) => [star.x, star.y, star.z]);
  const P = calculateProjectTransform(databaseQuad);
  const projectedDatabase = databaseQuad.map((star) => math.multiply(P, star).splice(0, 2));
  const photoQuad = photo.quad.map((star) => star.position)
  const T = calculateToPhotoTransform(photoQuad, projectedDatabase);
  test.expected.forEach((expected, i) => {
    console.log(`Test ${i}`);
    console.log(expected);
    console.log(math.multiply(T, P, test.given[i]));
  })
}

const calculateProjectTransform = (quad) => {
  const center = plane.findCenter(quad);
  return plane.calculateProjectTransform(center);
}

const calculateToPhotoTransform = (photo, database) => {

  // 각 quad의 중심점 계산
  const centroidPhoto = math.mean(photo, 0);
  const centroidDatabase = math.mean(database, 0);

  // 중심점이 원점이 되도록 이동
  const centeredPhoto = photo.map(point => math.subtract(point, centroidPhoto));
  const centeredDatabase = database.map(point => math.subtract(point, centroidDatabase));

  // 사진과 데이터베이스의 스케일 차이 계산
  const scalePhoto = math.norm(centeredPhoto[0]);
  const scaleDatabase = math.norm(centeredDatabase[0]);

  const normalPhoto0 = math.divide(centeredPhoto[0], scalePhoto);
  const normalDatabase0 = math.divide(centeredDatabase[0], scaleDatabase);

  const angle = -calculateRotationAngle(normalPhoto0, normalDatabase0);

  const DtoZero = [
    [ 1, 0, -centroidDatabase[0] ],
    [ 0, 1, -centroidDatabase[1] ],
    [ 0, 0, 1  ],
  ];

  const SDtoN = [
    [1 / scaleDatabase, 0, 0],
    [0, 1 / scaleDatabase, 0],
    [0, 0, 1],
  ]

  const R = getRotationMatrix(angle);

  const NtoSP = [
    [scalePhoto, 0, 0],
    [0, scalePhoto, 0],
    [0, 0, 1],
  ]


  const zeroToP = [
    [ 1, 0, centroidPhoto[0] ],
    [ 0, 1, centroidPhoto[1] ],
    [ 0, 0, 1  ],
  ]

  // Construct transformation matrix
  return math.multiply(zeroToP, NtoSP, R, SDtoN, DtoZero);
}

const calculateRotationAngle = (A, B) => {
  const dotProduct = math.dot(A, B);

  const crossProduct = A[0] * B[1] - A[1] * B[0];

  // 회전 각도
  return Math.atan2(crossProduct, dotProduct);
}


// 회전 행렬 계산 함수
const getRotationMatrix = (theta) => {
  return math.matrix([
    [Math.cos(theta), -Math.sin(theta), 0],
    [Math.sin(theta), Math.cos(theta), 0],
    [0, 0, 1]
  ]);
}

// TEST: Phecda,Alkaid,Alioth,Mizar => 4554,5191,4905,5054
const photo = {
  "width": 1152,
  "height": 819,
  "quad": [
    {
      "label": "Phecda",
      "position": [
        551.7619047619047,
        487.30303030303025
      ],
      "brightness": 3.500704303147574
    },
    {
      "label": "Alkaid",
      "position": [411.6140350877193, 114.11779448621553],
      "brightness": 4.600826820390231
    },
    {
      "label": "Alioth",
      "position": [560.2671755725191, 292.5979643765903],
      "brightness": 4.566103102760415
    },
    {
      "label": "Mizar",
      "position": [533.1977011494253, 199.97701149425285],
      "brightness": 4.803901200932928
    }
  ]
};

// from vectors-database.json
const database = {
  "quad": [
    {
      "B": "γ",
      "N": "Phecda",
      "C": "UMa",
      "Dec": "+53° 41′ 41″",
      "F": "64",
      "HR": "4554",
      "K": "10000",
      "RA": "11h 53m 49.8s",
      "V": 2,
      "x": -0.5918728610028255,
      "y": 0.015938076508263857,
      "z": 0.8058737457725911
    },
    {
      "B": "η",
      "N": "Alkaid",
      "C": "UMa",
      "Dec": "+49° 18′ 48″",
      "F": "85",
      "HR": "5191",
      "K": "24000",
      "RA": "13h 47m 32.4s",
      "V": 1,
      "x": -0.581459592054957,
      "y": -0.29479990694318703,
      "z": 0.7582860658574515
    },
    {
      "B": "ε",
      "N": "Alioth",
      "C": "UMa",
      "Dec": "+55° 57′ 35″",
      "F": "77",
      "HR": "4905",
      "K": "10000",
      "RA": "12h 54m 01.7s",
      "V": 1,
      "x": -0.5442927591835712,
      "y": -0.13074430028288353,
      "z": 0.8286442664037894
    },
    {
      "B": "ζ",
      "N": "Mizar",
      "C": "UMa",
      "Dec": "+54° 55′ 31″",
      "F": "79",
      "HR": "5054",
      "K": "9750",
      "RA": "13h 23m 55.5s",
      "V": 2,
      "x": -0.5365439818464228,
      "y": -0.20575850700942397,
      "z": 0.8184033188701267
    },
  ]
}

const test = {
  expected: [
    [774.2253086419753, 552.6018518518518],
    [672.3654618473895, 615.3293172690762],
    [551.7619047619047, 487.30303030303025],
    [603, 402.77272727272725],
    [560.2671755725191, 292.5979643765903],
    [533.1977011494253, 199.97701149425285],
    [411.6140350877193, 114.11779448621553]
  ],
  given: [
    [-0.4591115674024834, 0.11504758911126119, 0.8808976222677193],
    [-0.5359150995023587, 0.1389921440572375, 0.832752178031225],
    [-0.5918728610028255, 0.015938076508263857, 0.8058737457725911],
    [-0.5429309331397354, -0.03660080679866315, 0.8389793696996983],
    [-0.5442927591835712, -0.13074430028288353, 0.8286442664037894],
    [-0.5365439818464228, -0.20575850700942397, 0.8184033188701267],
    [-0.581459592054957, -0.29479990694318703, 0.7582860658574515],
  ]
}

run(photo, database, test);
