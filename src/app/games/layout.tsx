import Link from "next/link";

// 게임 공용 틀: 위에 게임 허브로 돌아가는 링크
export default function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-base-100 flex min-h-screen w-full flex-col items-center gap-4 p-8">
      <nav className="flex w-full max-w-[1280px] items-center gap-4 text-sm">
        <Link className="link link-hover" href="/games">
          ← 별 놀이터
        </Link>
        <Link className="link link-hover opacity-60" href="/">
          star.byb.kr
        </Link>
      </nav>
      {children}
    </div>
  );
}
