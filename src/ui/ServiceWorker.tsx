"use client";

import { useEffect } from "react";

// 서비스 워커 등록 (PWA, docs/pwa.md). sw.js는 빌드 뒤에 만들어지므로 프로덕션에서만 등록한다
export default function ServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 등록에 실패해도 사이트는 그대로 쓴다 (오프라인만 안 된다)
    });
  }, []);

  return null;
}
