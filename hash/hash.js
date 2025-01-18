const calculateHash = (quadrilateral) => {
  const vectors = quadrilateral.stars.map((star) => {
    return [star.x, star.y, star.z];
  });
  return 0;
}

exports.calculate = calculateHash;
