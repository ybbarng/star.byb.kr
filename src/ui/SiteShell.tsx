import SiteNav from "@/ui/SiteNav";
import SkyBackground from "@/ui/SkyBackground";
import "@/game/fx/fx.css";

// 사이트 공용 틀: 반짝이는 별밭 배경과 위쪽 길잡이
export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center gap-4 overflow-x-hidden px-4 py-4 sm:px-8 sm:py-6">
      <SkyBackground />
      <SiteNav />
      <div className="relative z-[1] flex w-full flex-1 flex-col items-center gap-4">
        {children}
      </div>
    </div>
  );
}
