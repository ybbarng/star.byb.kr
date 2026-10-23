import type { StampId } from "@/game/starSchool/lessons";
import type { SchoolSave } from "@/game/starSchool/progress";
import { dexEntries } from "@/game/starSchool/dex";
import { LESSONS, SEASON_LESSONS } from "@/game/starSchool/lessons";
import { rankOf } from "@/game/starSchool/progress";

// 별자리 여권: 수업을 마치면 도장을 받는다 (계절 넷 + 북극성 둘레 + 은하수 + 황도 + 남반구).
// 북반구 사계절 도장을 모두 받으면 남반구 하늘이 열린다.

export interface Stamp {
  id: StampId;
  title: string;
  icon: string;
  color: string;
}

export const STAMPS: Stamp[] = [
  { id: "polaris", title: "북극성 둘레", icon: "⭐", color: "#9ad1ff" },
  { id: "spring", title: "봄 하늘", icon: "🌸", color: "#ffb3d1" },
  { id: "summer", title: "여름 하늘", icon: "🌌", color: "#9fe3c4" },
  { id: "autumn", title: "가을 하늘", icon: "🍂", color: "#ffc58a" },
  { id: "winter", title: "겨울 하늘", icon: "❄️", color: "#c9d6ff" },
  { id: "milkyway", title: "은하수", icon: "🌠", color: "#d8c4ff" },
  { id: "ecliptic", title: "해의 길", icon: "☀️", color: "#ffe28a" },
  { id: "south", title: "남반구", icon: "✝️", color: "#8ff0ff" },
];

const done = (save: SchoolSave, id: string) => !!save.lessons[id]?.done;

// 그 도장의 수업을 모두 마쳤나
export const hasStamp = (save: SchoolSave, stamp: StampId) =>
  LESSONS.filter((l) => l.stamp === stamp).every((l) => done(save, l.id));

export const stampProgress = (save: SchoolSave, stamp: StampId) => {
  const ls = LESSONS.filter((l) => l.stamp === stamp);

  return { done: ls.filter((l) => done(save, l.id)).length, total: ls.length };
};

export const isSouthOpen = (save: SchoolSave) =>
  SEASON_LESSONS.every((id) => done(save, id));

export interface DexProgress {
  constellations: [number, number];
  asterisms: [number, number];
  deepSky: [number, number];
}

export const dexProgress = (save: SchoolSave): DexProgress => {
  const learned = new Set(save.learned);

  const count = (kind: string): [number, number] => {
    const all = dexEntries().filter((e) => e.kind === kind);

    return [all.filter((e) => learned.has(e.id)).length, all.length];
  };

  return {
    constellations: count("constellation"),
    asterisms: count("asterism"),
    deepSky: count("deepSky"),
  };
};

// ── 여권을 그림으로 ─────────────────────────────────────────────

const CARD_W = 1080;
const CARD_H = 1350;
const FONT = "Pretendard, system-ui, sans-serif";

export const drawPassport = (save: SchoolSave, today: Date) => {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, "#0b1030");
  bg.addColorStop(1, "#1d1446");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // 별 뿌리기 (그림마다 같은 모양)
  let seed = 7;

  const rand = () => {
    seed = (seed * 16807) % 2147483647;

    return seed / 2147483647;
  };

  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.arc(
      rand() * CARD_W,
      rand() * CARD_H,
      rand() * 1.8 + 0.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const { rank } = rankOf(save.xp);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = `900 76px ${FONT}`;
  ctx.fillText("별자리 여권", CARD_W / 2, 130);
  ctx.font = `600 38px ${FONT}`;
  ctx.fillStyle = "#ffe9a8";
  ctx.fillText(
    `${rank.icon} ${rank.title} · 별빛 ${save.xp.toLocaleString()}`,
    CARD_W / 2,
    200,
  );

  // 도장 (4 × 2)
  STAMPS.forEach((s, i) => {
    const cx = 170 + (i % 4) * 247;
    const cy = 340 + Math.floor(i / 4) * 260;
    const got = hasStamp(save, s.id);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(got ? ((i % 3) - 1) * 0.12 : 0);
    ctx.lineWidth = 8;
    ctx.strokeStyle = got ? s.color : "rgba(255,255,255,0.18)";
    ctx.setLineDash(got ? [] : [10, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = got ? 1 : 0.25;
    ctx.font = `72px ${FONT}`;
    ctx.fillText(s.icon, 0, 20);
    ctx.globalAlpha = 1;
    ctx.font = `700 28px ${FONT}`;
    ctx.fillStyle = got ? s.color : "rgba(255,255,255,0.35)";
    ctx.fillText(s.title, 0, 140);
    ctx.restore();
  });

  // 도감
  const p = dexProgress(save);
  const rows: [string, [number, number]][] = [
    ["별자리", p.constellations],
    ["길잡이 모양", p.asterisms],
    ["맨눈 딥스카이", p.deepSky],
  ];
  ctx.textAlign = "left";

  rows.forEach(([name, [n, total]], i) => {
    const y = 930 + i * 110;
    ctx.fillStyle = "#fff";
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(name, 110, y);
    ctx.textAlign = "right";
    ctx.fillText(`${n} / ${total}`, CARD_W - 110, y);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(110, y + 20, CARD_W - 220, 22);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(110, y + 20, ((CARD_W - 220) * n) / total, 22);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText(
    `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()} · star.byb.kr/games/star-school`,
    CARD_W / 2,
    CARD_H - 50,
  );

  return canvas;
};

// 휴대폰이면 공유 시트로, 아니면 내려받기 (오늘 밤 내 하늘·나만의 별자리와 같은 방식)
export const savePassport = async (save: SchoolSave) => {
  try {
    await document.fonts?.ready;
  } catch {
    // 글꼴을 못 기다려도 그린다
  }

  const canvas = drawPassport(save, new Date());
  const blob = await new Promise<Blob | null>((ok) =>
    canvas.toBlob(ok, "image/png"),
  );

  if (!blob) return false;

  const file = new File([blob], "별자리-여권.png", { type: "image/png" });

  if (
    navigator.canShare?.({ files: [file] }) &&
    /Mobi/i.test(navigator.userAgent)
  ) {
    try {
      await navigator.share({ files: [file], title: "별자리 여권" });

      return true;
    } catch {
      // 취소하면 내려받기로
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return true;
};
