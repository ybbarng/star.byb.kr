const calculateHash = (quadrilateral) => {
  const [v1, v2, v3, v4] = quadrilateral.stars.map((star) => {
    return [star.x, star.y, star.z];
  });
  return 0;
}

exports.calculate = calculateHash;
