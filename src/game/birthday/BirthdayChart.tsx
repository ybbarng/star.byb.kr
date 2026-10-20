"use client";

import type { Birth } from "@/game/birthday/BirthdayPicker";
import type { BirthdaySky } from "@/game/birthday/zodiac";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { drawBirthdayChart, wrap180 } from "@/game/birthday/drawChart";

// 천문도 캔버스: 넓은 화면에서는 좌우를 꽉 채워 황도를 최대한 길게 보여 주고,
// 좁은 화면(모바일)에서는 높이를 지킨 채 좌우를 잘라 옆으로 밀어 보게 한다.
// 날짜가 바뀌면 해가 가운데 오도록 천문도를 부드럽게 민다.

const MOBILE_BREAK = 768;
const MOBILE_WIDTH = 1000;
const MOBILE_HEIGHT = 460;
const DESKTOP_HEIGHT = 600;
// 처음 나타날 때 이만큼 옆에서 미끄러져 들어온다
const INTRO_PAN_DEG = 100;

export default function BirthdayChart({
  birth,
  sky,
}: {
  birth: Birth;
  sky: BirthdaySky;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const center = useRef<number | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = wrapper.current;

    if (!el) {
      return;
    }

    const measure = () => {
      const cw = el.clientWidth;
      const mobile = cw < MOBILE_BREAK;
      setSize((s) => {
        const next = mobile
          ? { w: MOBILE_WIDTH, h: MOBILE_HEIGHT }
          : { w: cw, h: DESKTOP_HEIGHT };

        return s && s.w === next.w && s.h === next.h ? s : next;
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  // 모바일: 해(가운데)가 보이게 가운데로 밀어 둔다
  useLayoutEffect(() => {
    const el = wrapper.current;

    if (el && size) {
      el.scrollLeft = (size.w - el.clientWidth) / 2;
    }
  }, [size, birth]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx || !size) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    ctx.canvas.width = Math.round(size.w * dpr);
    ctx.canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = sky.sunLonJ2000;
    const first = center.current === null;
    const from = center.current ?? target + INTRO_PAN_DEG;
    const delta = wrap180(target - from);
    const duration = first ? 1400 : 600;
    const start = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - k) ** 3;
      center.current = from + delta * eased;
      drawBirthdayChart(ctx, size.w, size.h, birth, sky, center.current);

      if (k < 1) {
        raf = requestAnimationFrame(frame);
      }
    };

    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }, [size, birth, sky]);

  return (
    <div ref={wrapper} className="w-full overflow-x-auto">
      <canvas
        ref={canvas}
        style={size ? { width: size.w, height: size.h } : { height: 600 }}
        className="block"
      />
    </div>
  );
}
