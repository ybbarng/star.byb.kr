import type { Metadata } from "next";
import "@/game/fx/fx.css";

// 발표 슬라이드(public/presentation)에 iframe으로 넣는 데모 페이지. 검색에 걸리지 않게 한다.
export const metadata: Metadata = {
  title: "발표용 데모",
  robots: { index: false, follow: false },
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="embed flex min-h-screen w-full items-start justify-center bg-[#0a0a0a] p-4">
      {/* 사진 데모가 화면 높이를 넘지 않게 해서, 아래 조작판까지 한 화면에 들어오게 한다 */}
      <style>{`.embed canvas.h-auto { max-height: 62vh; width: auto !important; max-width: 100%; margin: 0 auto; }`}</style>
      <div className="w-full max-w-5xl">{children}</div>
    </div>
  );
}
