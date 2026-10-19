// 검증 판정용 확률 계산.

// X ~ Poisson(lambda)일 때 P(X >= k)를 -log10으로 돌려준다.
// "우연히 k개 이상 맞을 확률"이 10^(-값)이라는 뜻이라, 값이 클수록 우연이 아니다.
// 꼬리확률이 1e-300보다 작아도 정확하도록 로그 공간에서 k부터 항을 더한다.
export const poissonTailNegLog10 = (k: number, lambda: number): number => {
  if (k <= 0) {
    return 0;
  }

  if (lambda <= 0) {
    return Infinity;
  }

  const logLambda = Math.log(lambda);
  // ln P(X = k) = -λ + k·ln λ - ln k!
  let logFactorial = 0;

  for (let i = 2; i <= k; i++) {
    logFactorial += Math.log(i);
  }

  const logFirst = -lambda + k * logLambda - logFactorial;

  // P(X = i+1) / P(X = i) = λ / (i+1). 첫 항 기준 상대값을 더해 넘침을 피한다.
  // λ보다 충분히 큰 i까지 더하면 나머지 항은 무시할 만큼 작다.
  const last = Math.max(k, Math.ceil(lambda)) + 200;
  let relSum = 0;
  let rel = 1;

  for (let i = k; i <= last; i++) {
    relSum += rel;
    rel *= lambda / (i + 1);
  }

  const logTail = logFirst + Math.log(relSum);

  return Math.max(0, -logTail / Math.LN10);
};
