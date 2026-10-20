"use client";

import { useEffect, useState } from "react";
import { readBest } from "@/game/fx/Fx";

// 허브 카드에 보여 줄 내 기록 (이 브라우저에 남긴 최고 기록)
const RECORDS: Record<string, () => string | null> = {
  "/games/star-geoguessr": () => {
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
