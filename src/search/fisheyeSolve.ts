import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { CandidateIndex } from "@/search/findCandidatesCore";
import type { FisheyeCamera } from "@/search/utils/fisheye";
import { findCandidates } from "@/search/findCandidatesCore";
import {
  fitFisheyeCamera,
  projectFisheye,
  refitFisheyeCamera,
} from "@/search/utils/fisheye";

// 어안 사진을 라벨 없이(blind) 푼다.
// 핵심: 작은 로컬 quad는 어안이어도 모양이 보존돼 카탈로그와 해시 매칭된다. 그렇게
// 얻은 (픽셀↔카탈로그) 후보들에서 별마다 가장 많이 득표한 정체를 고르고(투표),
// 표를 많이 받은 별로 카메라를 시드 피팅한 뒤 inlier를 좁혀가며 정밀화한다.

export interface FisheyeSolveResult {
  camera: FisheyeCamera;
  inliers: number; // 최종 카메라와 일치한 별 수
  voted: number; // 투표로 정체를 확정한 별 수
}

export const blindSolveFisheye = (
  photoStars: Point2D[],
  index: CandidateIndex,
  byHR: Map<string, Point3D>,
  width: number,
  height: number,
): FisheyeSolveResult | null => {
  const cands = findCandidates({ width, height, stars: photoStars }, index, {
    localNeighbors: 10,
  });

  if (cands.length === 0) {
    return null;
  }

  // 별별 투표: (사진 별 i, 카탈로그 HR) → 표수
  const votes = new Map<number, Map<string, number>>();

  for (const c of cands) {
    c.input.forEach((i, k) => {
      const hr = c.output[k].hr;
      let m = votes.get(i);

      if (!m) {
        m = new Map();
        votes.set(i, m);
      }

      m.set(hr, (m.get(hr) ?? 0) + 1);
    });
  }

  // 각 별의 최다표 정체(최소 3표). 표가 많을수록 신뢰도↑.
  const ident: { x: number; y: number; v: Point3D; votes: number }[] = [];

  for (const [i, m] of votes) {
    let bestHr = "";
    let bestVotes = 0;

    for (const [hr, n] of m) {
      if (n > bestVotes) {
        bestVotes = n;
        bestHr = hr;
      }
    }

    const v = byHR.get(bestHr);

    if (v && bestVotes >= 3) {
      ident.push({
        x: photoStars[i][0],
        y: photoStars[i][1],
        v,
        votes: bestVotes,
      });
    }
  }

  if (ident.length < 8) {
    return null;
  }

  ident.sort((a, b) => b.votes - a.votes);

  // 시드: 표를 가장 많이 받은 별들(거의 정답)로 카메라 피팅
  const seed = ident.slice(0, Math.min(24, ident.length));
  let cam = fitFisheyeCamera(
    seed.map((d) => ({ x: d.x, y: d.y, v: d.v })),
    width,
    height,
  ).camera;

  // inlier 확장: 재투영 오차가 작은 별만 모아 따뜻하게 재피팅, 허용오차를 좁혀간다
  let inliers = seed.length;

  for (let it = 0; it < 6; it++) {
    const tol = Math.max(5, 30 - it * 6);
    const inl = ident.filter((d) => {
      const p = projectFisheye(cam, d.v);

      return p && Math.hypot(p[0] - d.x, p[1] - d.y) < tol;
    });

    if (inl.length < 6) {
      break;
    }

    cam = refitFisheyeCamera(
      inl.map((d) => ({ x: d.x, y: d.y, v: d.v })),
      cam,
      width,
      height,
    ).camera;
    inliers = inl.length;
  }

  return { camera: cam, inliers, voted: ident.length };
};
