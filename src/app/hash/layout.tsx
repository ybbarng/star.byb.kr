import type { Metadata } from "next";

// 발표 화면용 페이지라 검색에 걸리지 않게 한다 (첫 화면에서 링크하지 않는다)
export const metadata: Metadata = {
  title: "발표용 시각화",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
