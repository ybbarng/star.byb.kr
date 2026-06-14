import type { Candidate } from "@/search/type";

// 매칭 후보가 "정답"인지 판정한다: 후보의 DB quad 별 4개가 모두
// 화면에 실제로 있는 진짜 별(trueStars의 HR 집합)이면 정답으로 본다.

export const isCorrectCandidate = (
  cand: Candidate,
  trueHrs: Set<string>,
): boolean => cand.output.every((o) => trueHrs.has(o.hr));

// 후보 목록(정렬된 상태)에서 첫 정답 후보의 순위(0-based). 없으면 -1.
export const findCorrectRank = (
  cands: Candidate[],
  trueHrs: Set<string>,
): number => {
  for (let i = 0; i < cands.length; i++) {
    if (isCorrectCandidate(cands[i], trueHrs)) {
      return i;
    }
  }

  return -1;
};
