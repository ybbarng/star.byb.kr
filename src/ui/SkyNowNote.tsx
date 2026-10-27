"use client";

import { useEffect, useState } from "react";

// 배경 하늘(ui/SkyBackground: 지금 실제 서울 하늘) 안내 한 줄. 배경처럼 1분마다 시각을 새로 쓴다.
// 정적 내보내기라 서버가 그린 HTML에는 시각을 넣지 않고, 브라우저에서 처음 그린 뒤 채운다.
const format = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function SkyNowNote() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(format.format(new Date()));
    tick();
    const timer = setInterval(tick, 60_000);

    return () => clearInterval(timer);
  }, []);

  return (
    <span>
      배경은 서울의 현재{now && `(${now})`} 하늘이에요. 낮이어서 보이지 않을
      때도 실제 별의 모습을 그려요.
    </span>
  );
}
