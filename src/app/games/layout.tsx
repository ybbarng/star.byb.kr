import Link from "next/link";
import { MuteButton } from "@/game/fx/Fx";
import "@/game/fx/fx.css";

// 게임 공용 틀: 반짝이는 별밭 배경, 위에 게임 허브로 돌아가는 링크와 소리 켜고 끄기
export default function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center gap-4 overflow-x-hidden p-8">
      <div className="fx-starfield" />
      <nav className="relative z-10 flex w-full max-w-[1280px] items-center gap-4 text-sm">
        <Link className="link link-hover" href="/games">
          ← 별 놀이터
        </Link>
        <Link className="link link-hover opacity-60" href="/">
          star.byb.kr
        </Link>
        <div className="grow" />
        <MuteButton />
      </nav>
      <div className="relative z-[1] flex w-full flex-col items-center gap-4">
        {children}
      </div>
    </div>
  );
}
