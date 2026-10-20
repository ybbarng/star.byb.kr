"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MuteButton } from "@/game/fx/Fx";
import { cn } from "@/utils/cn";

// 모든 페이지 위쪽의 길잡이: 첫 화면, 사진으로 찾기, 별 놀이터. 게임에서는 소리 켜고 끄기도 둔다.
const LINKS = [
  { href: "/plate-solver", label: "사진으로 찾기", short: "사진" },
  { href: "/games", label: "별 놀이터", short: "놀이터" },
];

export default function SiteNav() {
  const pathname = usePathname() ?? "/";
  const inGames = pathname.startsWith("/games");

  return (
    <nav className="relative z-10 flex w-full max-w-[1280px] items-center gap-1 text-sm sm:gap-3">
      <Link className="mr-1 font-bold whitespace-nowrap" href="/">
        ✦ star.byb.kr
      </Link>
      {LINKS.map((l) => {
        const active = pathname.startsWith(l.href);

        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-full px-3 py-1 whitespace-nowrap transition-colors",
              active ? "bg-white/15 font-bold" : "opacity-70 hover:opacity-100",
            )}
          >
            <span className="hidden sm:inline">{l.label}</span>
            <span className="sm:hidden">{l.short}</span>
          </Link>
        );
      })}
      <div className="grow" />
      {inGames && <MuteButton />}
    </nav>
  );
}
