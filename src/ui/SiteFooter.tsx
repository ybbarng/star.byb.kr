import Link from "next/link";
import SkyNowNote from "@/ui/SkyNowNote";

// 모든 페이지 아래쪽의 꼬리말: 배경 하늘 안내, 만든 이, 발표 자료, 출처.
// 예전에는 첫 화면에만 있어 다른 페이지에서는 출처·발표 자료로 갈 길이 없었다. 사이트 공용 틀(SiteShell)이 그린다.
const external = { target: "_blank", rel: "noopener noreferrer" } as const;

export default function SiteFooter() {
  return (
    <footer className="relative z-[1] flex w-full max-w-[1280px] flex-col items-center gap-2 border-t border-white/10 pt-6 text-center text-xs opacity-50">
      <SkyNowNote />
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <span>
          만든 이{" "}
          <a
            className="link link-hover"
            href="https://github.com/ybbarng"
            {...external}
          >
            ybbarng
          </a>{" "}
          with{" "}
          <a
            className="link link-hover"
            href="https://www.claude.com/product/claude-code"
            {...external}
          >
            Claude Code
          </a>
        </span>
        <a className="link link-hover" href="/presentation/v3.html">
          발표 자료 V3
        </a>
        <Link href="/credits" className="link link-hover">
          출처와 참고 자료
        </Link>
      </div>
    </footer>
  );
}
