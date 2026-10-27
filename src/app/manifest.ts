import type { MetadataRoute } from "next";

// 홈 화면에 추가했을 때의 앱 정보 (PWA, docs/pwa.md). 사이트 전체가 한 앱이다.
// 아이콘은 src/app/icon.svg를 그린 것이다 (public/icons, 마스커블은 가장자리가 잘려도 되게 가운데로 모았다)
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "star.byb.kr · 사진 속 별자리 찾기",
    short_name: "별 찾기",
    description:
      "밤하늘 사진 속 별자리를 찾고, 별 놀이터에서 별자리와 하늘의 움직임을 익혀요. 한 번 열면 오프라인에서도 돼요.",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0e1c",
    theme_color: "#0a0e1c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "사진으로 별 찾기", url: "/plate-solver" },
      { name: "별 놀이터", url: "/games" },
      { name: "오늘 밤 하늘", url: "/games/tonight" },
    ],
  };
}
