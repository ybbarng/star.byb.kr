"use client";

import { useEffect, useRef, useState } from "react";

// 발표 iframe 안에서 데모가 iframe 높이를 넘으면 통째로 줄여 한 화면에 담는다.
// transform은 레이아웃 크기(offsetHeight)를 바꾸지 않으니, 줄인 뒤 다시 재도 값이 흔들리지 않는다.
// 바깥 상자를 줄인 높이로 잡아 평소엔 스크롤이 생기지 않고, 그래도 넘치는 게 있으면 스크롤로 볼 수 있다.
export default function FitToFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useEffect(() => {
    const box = outer.current;
    const el = inner.current;

    if (!box || !el) return;

    const measure = () => {
      const room = window.innerHeight - box.offsetTop * 2;
      const natural = el.offsetHeight;
      const scale = Math.min(1, room / natural);
      setFit({ scale, height: natural * scale });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    measure();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={outer}
      className="w-full max-w-6xl"
      style={{ height: fit.height || undefined }}
    >
      <div
        ref={inner}
        style={{
          transform: `scale(${fit.scale})`,
          transformOrigin: "top center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
