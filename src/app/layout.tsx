import type { Metadata } from "next";
// Pretendard 동적 부분 집합: 한글 전체(2MB)를 한 파일로 받는 대신, 92조각 중 화면에 쓰인 글자가 든 조각만
// 받는다 (unicode-range). 글꼴 이름은 globals.css의 body에서 쓴다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "star.byb.kr",
  description: "Find stars from Photo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="h-screen antialiased">{children}</body>
    </html>
  );
}
