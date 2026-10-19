import type { ImageSize, InputStar, Solver, SolverContext } from "./types";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import { isConfident, topCandidates } from "./candidates";
import { searchTriangle, triangleShape } from "@/search/catalogGeometry";
import { solveCandidate } from "@/search/solveCore";
import { selectTopByBrightness } from "@/search/utils/selectStars";

// 최선A — Geometric Voting (다수결).
// 단일 패턴(quad·삼각형 하나)으로 답을 정하지 않고, 사진의 모든 삼각형이
// 카탈로그 후보에 "별-별 대응"을 투표한다. 가짜 별이 섞여도 진짜 별들끼리는
// 같은 대응에 반복 투표하므로, 최다 득표 대응만 모으면 outlier가 걸러진다.
// 삼각형은 스케일·회전 불변이라 blind(FOV 미지)에서 그대로 동작한다.
//
// (순수 별쌍 각거리 voting도 시도했으나, 별쌍은 방향이 모호해 교차 투표
//  노이즈가 커 blind에서 대응 품질이 낮았다. 삼각형 단위 투표로 해결.)

// TODO(다음 세션): 단순 다수결은 카탈로그 삼각형(~5.5만)의 형태 충돌로 정답
// 대응 비율이 낮아 현재 0점이다. bestForI(별별 최다 득표) 대신, 투표쌍을
// RANSAC 입력으로 써서 일관된 대응만 추리는 방식으로 개선해야 한다.
const MATCH_STARS = 12;
const KD_K = 4;
const MIN_VOTES = 2;

const pixDist = (a: Point2D, b: Point2D): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

export const votingSolver: Solver = {
  key: "voting",
  name: "최선A (Geometric Voting)",
  description:
    "모든 삼각형이 별-별 대응에 투표 → 최다 득표 대응(outlier 제거)으로 RANSAC 검증",

  solve(stars: InputStar[], size: ImageSize, ctx: SolverContext) {
    const t0 = performance.now();
    const tri = ctx.triangleIndex;

    if (!tri) {
      throw new Error("votingSolver: ctx.triangleIndex가 필요하다");
    }

    const photoTop = selectTopByBrightness(stars, MATCH_STARS);
    const allStars: Point2D[] = stars.map((s) => [s.x, s.y]);

    // 사진 별 i가 카탈로그 별 hr에 받은 득표
    const votes = new Map<string, number>();

    const vote = (i: number, hr: string) => {
      const key = `${i}|${hr}`;
      votes.set(key, (votes.get(key) ?? 0) + 1);
    };

    for (let i = 0; i < photoTop.length - 2; i++) {
      for (let j = i + 1; j < photoTop.length - 1; j++) {
        for (let k = j + 1; k < photoTop.length; k++) {
          const d01 = pixDist(photoTop[i], photoTop[j]);
          const d02 = pixDist(photoTop[i], photoTop[k]);
          const d12 = pixDist(photoTop[j], photoTop[k]);
          const { order, shape } = triangleShape(d01, d02, d12, [i, j, k]);
          const cands = searchTriangle(tri, shape, KD_K);

          // 삼각형 정점은 마주변 오름차순으로 정렬돼 있어 순서가 대응된다
          for (const ent of cands) {
            vote(order[0], ent.hrs[0]);
            vote(order[1], ent.hrs[1]);
            vote(order[2], ent.hrs[2]);
          }
        }
      }
    }

    // 각 사진 별의 최다 득표 카탈로그 별을 대응으로 채택
    const bestForI = new Map<number, { hr: string; v: number }>();

    for (const [key, count] of votes) {
      const sep = key.indexOf("|");
      const i = Number(key.slice(0, sep));
      const hr = key.slice(sep + 1);
      const cur = bestForI.get(i);

      if (!cur || count > cur.v) {
        bestForI.set(i, { hr, v: count });
      }
    }

    const photoPts: Point2D[] = [];
    const dbPts: Point3D[] = [];

    for (const [i, { hr, v }] of bestForI) {
      const vec = ctx.byHrVec.get(hr);

      if (v >= MIN_VOTES && vec) {
        photoPts.push(photoTop[i]);
        dbPts.push(vec);
      }
    }

    const timeMs0 = performance.now() - t0;

    if (photoPts.length < 4) {
      return {
        found: false,
        centerVector: null,
        fovDeg: null,
        confidence: 0,
        inlierCount: 0,
        candidatesEvaluated: 0,
        timeMs: timeMs0,
        transform: null,
        candidates: [],
      };
    }

    const res = solveCandidate(photoPts, dbPts, allStars, ctx.catalog, {
      imageWidth: size.width,
      imageHeight: size.height,
      ransacIterations: 120,
    });
    const timeMs = performance.now() - t0;

    if (!res) {
      return {
        found: false,
        centerVector: null,
        fovDeg: null,
        confidence: 0,
        inlierCount: 0,
        candidatesEvaluated: 1,
        timeMs,
        transform: null,
        candidates: [],
      };
    }

    return {
      found: isConfident(res),
      centerVector: res.centerVector,
      fovDeg: res.fovDeg,
      confidence: res.logOdds,
      inlierCount: res.inlierCount,
      candidatesEvaluated: 1,
      timeMs,
      transform: res.TP,
      candidates: topCandidates([res], 5),
    };
  },
};
