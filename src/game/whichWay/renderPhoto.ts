import type { WhichWayRound } from "@/game/whichWay/problem";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import {
  PHOTO_H,
  PHOTO_W,
  roundFrame,
  WHICH_WAY_SETTINGS,
} from "@/game/whichWay/problem";
import { fromAltAzJ2000 } from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 사진 한 장을 캔버스에 그린다 (브라우저에서만). 같은 판의 사진은 같은 순간·같은 땅·같은 구름이다.

const FAINT_LINE_ALPHA = 0.35;
const EIGHT = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];

const sceneOptions = (round: WhichWayRound, index: number) => {
  const set = WHICH_WAY_SETTINGS[round.difficulty];
  const photo = round.photos[index];

  return {
    width: PHOTO_W,
    height: PHOTO_H,
    TP: photo.TP,
    date: round.date,
    observer: round.observer,
    azimuthDeg: photo.view.azimuthDeg,
    magLimit: set.magLimit,
    lightPollution: set.lightPollution,
    groundSeed: round.groundSeed,
    stars: STARS,
    clouds: round.clouds,
  };
};

export const renderPhoto = (
  round: WhichWayRound,
  index: number,
): HTMLCanvasElement => {
  const set = WHICH_WAY_SETTINGS[round.difficulty];
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_W;
  canvas.height = PHOTO_H;
  const ctx = canvas.getContext("2d")!;
  const options = sceneOptions(round, index);

  drawSky(ctx, options);

  // 입문: 별자리선을 흐리게. 선을 그린 그림을 옅게 겹친다 (선 말고는 같은 그림이라 선만 흐리게 남는다)
  if (set.faintLines) {
    const lined = document.createElement("canvas");
    lined.width = PHOTO_W;
    lined.height = PHOTO_H;
    drawSky(lined.getContext("2d")!, {
      ...options,
      constellations: CONSTELLATIONS,
    });
    ctx.globalAlpha = FAINT_LINE_ALPHA;
    ctx.drawImage(lined, 0, 0);
    ctx.globalAlpha = 1;
  }

  // 입문: 지평선 아래에 여덟 방위
  if (set.compass) {
    const frame = roundFrame(round);
    const photo = round.photos[index];
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.85)";

    EIGHT.forEach((label, k) => {
      const p = projectVecToPhoto(photo.TP, fromAltAzJ2000(frame, -2, k * 45));

      if (p && p[0] > 10 && p[0] < PHOTO_W - 10 && p[1] < PHOTO_H - 8) {
        ctx.fillText(label, p[0], Math.min(PHOTO_H - 12, p[1] + 26));
      }
    });

    ctx.textAlign = "start";
  }

  return canvas;
};
