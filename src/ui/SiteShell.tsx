import SiteFooter from "@/ui/SiteFooter";
import SiteNav from "@/ui/SiteNav";
import SkyBackground from "@/ui/SkyBackground";
import "@/game/fx/fx.css";

// 사이트 공용 틀: 반짝이는 별밭 배경, 위쪽 길잡이, 아래쪽 꼬리말.
// 내용이 짧아도 꼬리말이 화면 아래에 붙도록 내용 칸이 남는 높이를 채운다(flex-1).
export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center gap-4 overflow-x-hidden px-4 py-4 sm:px-8 sm:py-6">
      <SkyBackground />
      <SiteNav />
      <div className="relative z-[1] flex w-full flex-1 flex-col items-center gap-4">
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
