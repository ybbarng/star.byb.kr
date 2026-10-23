"use client";

import { usePathname } from "next/navigation";
import { gameForPath } from "@/game/hub";
import BasicsLinks from "@/learn/basics/BasicsLinks";

// 지금 게임의 "배우는 것"을 더 알아볼 하늘 읽기 기초 링크 한 줄.
// 시작 화면·결과 카드(GameIntro·ResultCard)가 주소로 게임을 찾아 한 번에 단다
export default function GameBasicsLinks({ className }: { className?: string }) {
  const game = gameForPath(usePathname());

  return game?.basics ? (
    <BasicsLinks slugs={game.basics} className={className} />
  ) : null;
}
