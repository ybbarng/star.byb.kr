"use client";

import { useEffect, useState } from "react";
import { altAzOf, julianDay, sunVector } from "@/search/utils/ephemeris";
import { SEOUL } from "@/ui/SkyBackground";

// 배경 하늘(ui/SkyBackground: 지금 실제 서울 하늘) 안내 한 줄. 배경처럼 1분마다 시각을 새로 쓴다.
// 해가 떠 있으면 "낮이어서 보이지 않아도…", 지면 "지금 밖에서는…"을 붙인다.
// 정적 내보내기라 서버가 그린 HTML에는 시각을 넣지 않고, 브라우저에서 처음 그린 뒤 채운다.
const format = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const sunIsUp = (date: Date) => {
  const jd = julianDay(date);

  return altAzOf(sunVector(jd), jd, SEOUL).altDeg > 0;
};

export default function SkyNowNote() {
  const [now, setNow] = useState<{ text: string; day: boolean } | null>(null);

  useEffect(() => {
    const tick = () => {
      const date = new Date();
      setNow({ text: format.format(date), day: sunIsUp(date) });
    };

    tick();
    const timer = setInterval(tick, 60_000);

    return () => clearInterval(timer);
  }, []);

  return (
    <span>
      배경은 서울의 현재{now && `(${now.text})`} 하늘이에요.
      {now &&
        (now.day
          ? " 낮이어서 보이지 않아도 실제 별의 모습을 그려요."
          : " 지금 밖에서는 어떤 별자리가 보일까요?")}
    </span>
  );
}
