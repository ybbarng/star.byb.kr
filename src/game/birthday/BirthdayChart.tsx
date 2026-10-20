"use client";

import type { Birth } from "@/game/birthday/BirthdayPicker";
import type { BirthdaySky } from "@/game/birthday/zodiac";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  chartProjection,
  drawBirthdayChart,
  wrap180,
} from "@/game/birthday/drawChart";

// 천문도 캔버스: 넓은 화면에서는 좌우를 꽉 채워 황도를 최대한 길게 보여 주고, 마우스로 끌면 황도를 따라 돌려 본다.
// 좁은 화면(모바일)에서는 높이를 지킨 채 좌우를 잘라 옆으로 밀어 보게 한다.
// 날짜가 바뀌면 해가 가운데 오도록 천문도를 부드럽게 민다.

const MOBILE_BREAK = 768;
const MOBILE_WIDTH = 1000;
const MOBILE_HEIGHT = 460;
const DESKTOP_HEIGHT = 600;
// 처음 나타날 때 이만큼 옆에서 미끄러져 들어온다
const INTRO_PAN_DEG = 100;
// 해에서 이만큼 넘게 돌리면 "해로 돌아가기"를 보여 준다
const AWAY_DEG = 5;

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
  const raf = useRef(0);
  const drag = useRef<{ x: number; center: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [away, setAway] = useState(false);
  const mobile = size?.w === MOBILE_WIDTH && size.h === MOBILE_HEIGHT;

  useEffect(() => {
    const el = wrapper.current;

    if (!el) {
      return;
    }

    const measure = () => {
      const cw = el.clientWidth;
      const isMobile = cw < MOBILE_BREAK;
      setSize((s) => {
        const next = isMobile
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

  // 지금 가운데 황경으로 그린다
  const draw = useCallback(() => {
    const ctx = canvas.current?.getContext("2d");

    if (ctx && size && center.current !== null) {
      drawBirthdayChart(ctx, size.w, size.h, birth, sky, center.current);
    }
  }, [size, birth, sky]);

  // 가운데 황경을 target으로 부드럽게 옮긴다
  const panTo = useCallback(
    (target: number, from: number, duration: number) => {
      const delta = wrap180(target - from);
      const start = performance.now();
      cancelAnimationFrame(raf.current);

      const frame = (now: number) => {
        const k = Math.min(1, (now - start) / duration);
        center.current = from + delta * (1 - (1 - k) ** 3);
        draw();

        if (k < 1) {
          raf.current = requestAnimationFrame(frame);
        }
      };

      raf.current = requestAnimationFrame(frame);
    },
    [draw],
  );

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
    panTo(target, center.current ?? target + INTRO_PAN_DEG, first ? 1400 : 600);
    setAway(false);

    return () => cancelAnimationFrame(raf.current);
  }, [size, sky, panTo]);

  // 데스크톱: 마우스로 끌면 황도를 따라 돌아간다 (오른쪽으로 끌면 동쪽 하늘이 보인다)
  const pxPerDeg = size ? chartProjection(size.w, size.h, 0).pxPerDeg : 1;

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mobile || e.pointerType !== "mouse" || center.current === null) {
      return;
    }

    cancelAnimationFrame(raf.current);
    drag.current = { x: e.clientX, center: center.current };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) {
      return;
    }

    center.current =
      drag.current.center + (e.clientX - drag.current.x) / pxPerDeg;
    draw();
  };

  const onPointerUp = () => {
    if (!drag.current || center.current === null) {
      return;
    }

    drag.current = null;
    setAway(Math.abs(wrap180(center.current - sky.sunLonJ2000)) > AWAY_DEG);
  };

  return (
    <div className="relative w-full">
      <div ref={wrapper} className="w-full overflow-x-auto">
        <canvas
          ref={canvas}
          style={size ? { width: size.w, height: size.h } : { height: 600 }}
          className={
            mobile ? "block" : "block cursor-grab active:cursor-grabbing"
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      {!mobile && size && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
          {away ? (
            <button
              className="btn btn-sm btn-warning pointer-events-auto shadow-lg"
              onClick={() => {
                if (center.current !== null) {
                  panTo(sky.sunLonJ2000, center.current, 700);
                }

                setAway(false);
              }}
            >
              ☀ 생일의 해로 돌아가기
            </button>
          ) : (
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs opacity-70">
              ← 끌어서 황도 한 바퀴를 둘러보세요 →
            </span>
          )}
        </div>
      )}
    </div>
  );
}
