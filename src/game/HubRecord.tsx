"use client";

import { useEffect, useState } from "react";
import { readBest } from "@/game/fx/Fx";
import { loadSave, rankOf } from "@/game/starSchool/progress";

// 허브 카드에 보여 줄 내 기록 (이 브라우저에 남긴 최고 기록)
// 난이도별 최고 점수 중 가장 높은 것 (점수가 클수록 좋은 게임)
const bestScore = (prefix: string, levels: string[]) => () => {
  const scores = levels
    .map((d) => readBest(`${prefix}-${d}`))
    .filter((v): v is number => v !== null);

  return scores.length
    ? `최고 ${Math.max(...scores).toLocaleString()}점`
    : null;
};

const RECORDS: Record<string, () => string | null> = {
  "/games/eclipse": bestScore("eclipse", ["intro", "normal", "hard"]),
  "/games/which-way": bestScore("which-way", [
    "intro",
    "easy",
    "normal",
    "hard",
  ]),
  "/games/star-trails": bestScore("star-trails", [
    "intro",
    "easy",
    "normal",
    "hard",
  ]),
  "/games/moon-date": bestScore("moon-date", ["intro", "easy", "normal"]),
  "/games/wanderers": bestScore("wanderers", [
    "intro",
    "easy",
    "normal",
    "hard",
  ]),
  "/games/sky-guessr": () => {
    const scores = ["easy", "normal", "hard"]
      .map((d) => readBest(`geo-${d}`))
      .filter((v): v is number => v !== null);

    return scores.length
      ? `최고 ${Math.max(...scores).toLocaleString()}점`
      : null;
  },
  "/games/sky-match": () => {
    const moves = ["easy", "normal", "hard"]
      .map((d) => readBest(`sky-match-${d}`))
      .filter((v): v is number => v !== null);

    return moves.length ? `최소 다이얼 ${Math.min(...moves)}번` : null;
  },
  "/games/find-constellation": () => {
    const scores = ["easy", "normal", "hard"]
      .map((d) => readBest(`find-${d}`))
      .filter((v): v is number => v !== null);

    return scores.length
      ? `최고 ${Math.max(...scores).toLocaleString()}점`
      : null;
  },
  "/games/draw-constellation": () => {
    const best = readBest("draw-quiz");

    return best === null ? null : `최고 ${best.toLocaleString()}점`;
  },
  "/games/human-vs-computer": () => {
    const best = readBest("human-vs-computer");

    return best === null ? null : `최고 ${best.toLocaleString()}점`;
  },
  "/games/shadow-clock": () => {
    const scores = ["intro", "easy", "normal"]
      .map((d) => readBest(`shadow-clock-${d}`))
      .filter((v): v is number => v !== null);

    return scores.length
      ? `최고 ${Math.max(...scores).toLocaleString()}점`
      : null;
  },
  "/games/quad-fingerprint": () => {
    const scores = ["intro", "easy", "normal", "hard"]
      .map((d) => readBest(`quad-fingerprint-${d}`))
      .filter((v): v is number => v !== null);

    return scores.length
      ? `최고 ${Math.max(...scores).toLocaleString()}점`
      : null;
  },
  "/games/star-school": () => {
    const save = loadSave();

    return save.xp > 0
      ? `${rankOf(save.xp).rank.title} · 도감 ${save.learned.length}`
      : null;
  },
  "/games/light-time-capsule": () => {
    try {
      const c = JSON.parse(
        localStorage.getItem("star-games-capsule") ?? "null",
      );

      return c?.stars?.length ? `도감 ${c.stars.length}개` : null;
    } catch {
      return null;
    }
  },
};

export default function HubRecord({ href }: { href: string }) {
  const [record, setRecord] = useState<string | null>(null);

  useEffect(() => setRecord(RECORDS[href]?.() ?? null), [href]);

  return record ? (
    <span className="badge badge-warning badge-sm fx-pop">🏆 {record}</span>
  ) : null;
}
