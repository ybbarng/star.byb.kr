import Script from "next/script";

// 방문 통계: 내 서버(stats.byb.kr)의 Umami. 쿠키를 쓰지 않고 페이지 주소·참조 사이트·기기 종류 같은 익명 숫자만 센다.
// 화면 이동(history.pushState)은 Umami 스크립트가 스스로 센다. 사진·입력값은 보내지 않는다.
// ID가 비어 있으면 스크립트를 싣지 않는다. data-domains로 star.byb.kr에서만 세서 개발 서버 방문은 빠진다.
export const UMAMI_WEBSITE_ID = "";

export default function Analytics() {
  if (!UMAMI_WEBSITE_ID) return null;

  return (
    <Script
      src="https://stats.byb.kr/script.js"
      data-website-id={UMAMI_WEBSITE_ID}
      data-domains="star.byb.kr"
      strategy="afterInteractive"
    />
  );
}
