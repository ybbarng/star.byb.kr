import type { MetadataRoute } from "next";

// 검색 엔진 안내. sitemap.xml은 빌드 뒤 out/의 페이지 목록으로 만든다 (src/scripts/pwa/buildServiceWorker.ts)
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/embed/"] },
    sitemap: "https://star.byb.kr/sitemap.xml",
  };
}
