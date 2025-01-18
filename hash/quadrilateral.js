const createQuadrilaterals = (stars) => {
  const result = [];
  for (let s1 = 0; s1 < stars.length - 3; s1++) {
    for (let s2 = s1; s2 < stars.length - 2; s2++) {
      for (let s3 = s2; s3 < stars.length - 1; s3++) {
        for (let s4 = s3; s4 < stars.length; s4++) {
          result.push({
            id: `${s1}-${s2}-${s3}-${s4}`,
            stars: [stars[s1], stars[s2], stars[s3], stars[s4]],
          });
        }
      }
    }
  }
  return result;
}

exports.create = createQuadrilaterals;
