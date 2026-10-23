import type { ShotTime } from "@/plate-solver/shotTime";
import type { Point2D } from "@/scripts/hash/types";
import type { HorizonView } from "@/search/horizonSolve";
import { shotDate } from "@/plate-solver/shotTime";
import { horizonCameraTP } from "@/search/horizonSolve";
import { julianDay } from "@/search/utils/ephemeris";
import { fromAltAzJ2000, horizontalFrameJ2000 } from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 반전 판의 사진: 직접 만든(합성) 장면. 사람이 크게 찍힌 사이판 사진 대신 쓴다.
// 여름밤 제주 서귀포 바닷가에서 남쪽 바다 위에 낮게 걸린 전갈자리를 휴대폰으로 찍은 듯이 그렸다.
// 그림은 src/scripts/game/renderSeaScene.ts가 이 값으로 그려 public/samples/games/에 둔다 (시드 고정).
// 정답(촬영 시각·장소·카메라 방향)을 알고 그렸으므로, 시험은 컴퓨터의 풀이를 이 정답과 비교한다.

export const SEA_SCENE = {
  file: "games/jeju-sea-scorpius.jpg",
  width: 1440,
  height: 1920,
  // 실제로 "찍은" 시각 (그림을 그린 하늘)
  shot: { local: "2025-07-25T21:20", offset: "+09:00" },
  // 사람이 단서로 알려 주는 시각·장소: 사진을 올린 시각이라 찍은 시각보다 조금 늦다
  clue: {
    local: "2025-07-25T21:40",
    offset: "+09:00",
    observer: { latDeg: 33.24, lonDeg: 126.56 },
    source: "record",
    note: "사진을 올린 시각 (서귀포 바닷가)",
  } satisfies ShotTime,
  place: "제주 서귀포 바닷가",
  view: {
    azimuthDeg: 188,
    altitudeDeg: 17,
    rollDeg: 1.2,
    fovDeg: 48,
  } satisfies HorizonView,
  seed: 20250725,
};

export const seaSceneShotAt = () =>
  shotDate({ ...SEA_SCENE.clue, local: SEA_SCENE.shot.local });

// 정답 변환 (그림을 그린 카메라)
export const seaSceneTP = () =>
  horizonCameraTP(
    seaSceneShotAt(),
    SEA_SCENE.clue.observer,
    SEA_SCENE.view,
    SEA_SCENE.width,
    SEA_SCENE.height,
  );

// 사진 속 바다 수평선 (고도 0°): 사진 왼쪽 10%·오른쪽 90% 높이의 두 점 (사람이 찍는 두 점과 같은 꼴)
export const seaSceneHorizon = (): [Point2D, Point2D] => {
  const TP = seaSceneTP();
  const jd = julianDay(seaSceneShotAt());
  const frame = horizontalFrameJ2000(jd, SEA_SCENE.clue.observer);
  const [a, b] = [-10, 10].map(
    (d) =>
      projectVecToPhoto(
        TP,
        fromAltAzJ2000(frame, 0, SEA_SCENE.view.azimuthDeg + d),
      ) as Point2D,
  );
  const yAt = (x: number) =>
    a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  const { width } = SEA_SCENE;

  return [
    [width * 0.1, yAt(width * 0.1)],
    [width * 0.9, yAt(width * 0.9)],
  ];
};
