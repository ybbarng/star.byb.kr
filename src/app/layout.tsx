import type { Metadata } from "next";
// Pretendard 동적 부분 집합: 한글 전체(2MB)를 한 파일로 받는 대신, 92조각 중 화면에 쓰인 글자가 든 조각만
// 받는다 (unicode-range). 글꼴 이름은 globals.css의 body에서 쓴다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import DeckKeyBridge from "@/ui/DeckKeyBridge";

export const metadata: Metadata = {
  metadataBase: new URL("https://star.byb.kr"),
  title: {
    default: "star.byb.kr · 사진 속 별자리 찾기",
    template: "%s · star.byb.kr",
  },
  description:
    "밤하늘 사진을 올리면 어떤 별자리인지 찾아 줘요. 별자리 게임도 있어요. 사진은 내 기기 밖으로 나가지 않아요.",
  openGraph: {
    siteName: "star.byb.kr",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-theme="dark">
      <body className="h-screen antialiased">
        {children}
        <DeckKeyBridge />
      </body>
    </html>
  );
}
