const SVDJS = require("svd-js");
const math = require("mathjs");
const plane = require("../hash/plane");

const run = (photo, database) => {
  const databaseQuad = database.quad.map((star) => [star.x, star.y, star.z]);
  const P = calculateProjectTransform(databaseQuad);
  const projectedDatabase = databaseQuad.map((star) => math.multiply(P, star).splice(0, 2));
  const photoQuad = photo.quad.map((star) => star.position)
  const T = calculateToPhotoTransform(photoQuad, projectedDatabase);
  /*
  console.log("사진");
  console.log(photoQuad);
  console.log("데이터베이스");
  console.log(database.quad.map((star) => math.multiply(T, P, [star.x, star.y, star.z])));
  console.log("데이터베이스 투영된 애들");
  console.log(projectedDatabase.map((star) => math.multiply(T, [star[0], star[1], 1])));
   */
}

const calculateProjectTransform = (quad) => {
  const center = plane.findCenter(quad);
  return plane.calculateProjectTransform(center);
}

function calculateToPhotoTransform(photo, database) {

  // 각 quad의 중심점 계산
  const centroidPhoto = math.mean(photo, 0);
  const centroidDatabase = math.mean(database, 0);

  // 중심점이 원점이 되도록 이동
  const centeredPhoto = photo.map(point => math.subtract(point, centroidPhoto));
  const centeredDatabase = database.map(point => math.subtract(point, centroidDatabase));

  // 사진과 데이터베이스의 스케일 차이 계산
  const scalePhoto = math.norm(centeredPhoto[0]);
  const scaleDatabase = math.norm(centeredDatabase[0]);
  const scale = scalePhoto / scaleDatabase;

  //
  const H = centeredDatabase.reduce((acc, pointDatabase, i) => {
    const pointPhoto = centeredPhoto[i];
    return math.add(acc, math.multiply(math.transpose([pointDatabase]), [pointPhoto])); // Outer product
  }, math.zeros([2, 2]));

  const { u, v } = SVDJS.SVD(H);
  const r = math.multiply(u, math.transpose(v));

  const DtoZero = [
    [ 1, 0, -centroidDatabase[0] ],
    [ 0, 1, -centroidDatabase[1] ],
    [ 0, 0, 1  ],
  ];

  const R = [
    [r[0][0], r[0][1], 0],
    [r[1][0], r[1][1], 0],
    [0, 0, 1],
  ]

  const S = [
    [scale, 0, 0],
    [0, scale, 0],
    [0, 0, 1],
  ]

  for (let i = 0; i < centeredDatabase.length; i++) {
    const D = [...centeredDatabase[i], 1];
    const P = centeredPhoto[i];
    console.log("회전!");
    console.log(P);
    console.log(math.multiply(S, R, D));
  }


  const zeroToP = [
    [ 1, 0, centroidPhoto[0] ],
    [ 0, 1, centroidPhoto[1] ],
    [ 0, 0, 1  ],
  ]

  // Construct transformation matrix
  return math.multiply(zeroToP, S, R, DtoZero);
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

run(photo, database);
