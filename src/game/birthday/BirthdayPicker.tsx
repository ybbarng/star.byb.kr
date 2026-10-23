"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ko } from "react-day-picker/locale";
import { cn } from "@/utils/cn";

// 생일 고르기: 위에는 연·월·일 휠(세로로 굴려 가운데 줄을 고른다), 밑에는 달력.
// 둘은 같은 값을 보여 준다. 휠을 굴리면 달력이 그 달로 넘어가 그날을 고르고, 달력에서 날을 누르면 휠이 그 값으로 굴러간다.
// 생일은 몇십 년 전일 수 있어 연·월은 휠로 옮기고, 달력은 이전/다음 달 버튼만 둔다.

export interface Birth {
  year: number;
  month: number;
  day: number;
}

export const toDate = (b: Birth) => new Date(b.year, b.month - 1, b.day);
export const toBirth = (d: Date): Birth => ({
  year: d.getFullYear(),
  month: d.getMonth() + 1,
  day: d.getDate(),
});
export const birthLabel = (b: Birth) => `${b.year}년 ${b.month}월 ${b.day}일`;

const FIRST_YEAR = 1900;
const LAST_YEAR = new Date().getFullYear();
const FIRST_MONTH = new Date(FIRST_YEAR, 0);
const LAST_MONTH = new Date(LAST_YEAR, 11);

// 아직 고르지 않았을 때 휠·달력이 보여 주는 날
const DEFAULT_BIRTH: Birth = { year: 2000, month: 1, day: 1 };

// 그 달의 날 수 (윤년 2월 29일 포함)
const daysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const YEARS = range(FIRST_YEAR, LAST_YEAR);
const MONTHS = range(1, 12);

// 휠 한 줄의 높이(px)와 보이는 줄 수 (홀수, 가운데 줄이 고른 값)
const ITEM_H = 40;
const ROWS = 5;
const PAD = ((ROWS - 1) / 2) * ITEM_H;

// 스크롤이 이만큼(ms) 멈추면 가운데 줄을 값으로 삼는다
const SETTLE_MS = 140;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

// iOS 날짜 선택기처럼 세로로 굴리는 열 하나.
// 터치·트랙패드는 브라우저 스크롤(scroll-snap)에 맡기고, 마우스는 휠 한 칸에 한 줄·끌기로 굴린다.
function Wheel({
  label,
  items,
  index,
  onPick,
  className,
}: {
  label: string;
  items: string[];
  index: number;
  onPick: (index: number) => void;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(index);
  const mounted = useRef(false);
  const settleTimer = useRef(0);
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const wheelTarget = useRef<number | null>(null);

  // 이벤트 처리기가 늘 최신 값을 보도록
  const latest = useRef({ index, count: items.length, onPick });

  useLayoutEffect(() => {
    latest.current = { index, count: items.length, onPick };
  });

  const nearest = (el: HTMLElement) =>
    clamp(Math.round(el.scrollTop / ITEM_H), 0, latest.current.count - 1);

  const scheduleSettle = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const el = box.current;

      if (!el || drag.current) {
        return;
      }

      wheelTarget.current = null;
      const i = nearest(el);

      if (i !== latest.current.index) {
        latest.current.onPick(i);
      }
    }, SETTLE_MS);
  };

  // 값이 바깥(달력·다른 휠)에서 바뀌면 그 줄로 굴린다. 처음에는 바로 그 자리에 둔다
  useLayoutEffect(() => {
    const el = box.current;

    if (!el || drag.current) {
      return;
    }

    const top = index * ITEM_H;

    if (Math.abs(el.scrollTop - top) >= 1) {
      el.scrollTo({ top, behavior: mounted.current ? "smooth" : "instant" });
    }

    if (!mounted.current) {
      setLive(index);
    }

    mounted.current = true;
  }, [index, items.length]);

  // 마우스 휠은 한 칸에 한 줄씩 (트랙패드처럼 잘게 오는 값은 브라우저 스크롤에 맡긴다)
  useEffect(() => {
    const el = box.current;

    if (!el) {
      return;
    }

    const onWheel = (e: WheelEvent) => {
      const notched = e.deltaMode !== 0 || Math.abs(e.deltaY) >= 50;

      if (!notched || e.deltaY === 0) {
        return;
      }

      e.preventDefault();
      const next = clamp(
        (wheelTarget.current ?? nearest(el)) + Math.sign(e.deltaY),
        0,
        latest.current.count - 1,
      );

      wheelTarget.current = next;
      el.scrollTo({ top: next * ITEM_H, behavior: "smooth" });
      scheduleSettle();
    };

    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      window.clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    const el = box.current;

    if (!el) {
      return;
    }

    setLive(nearest(el));

    if (!drag.current) {
      scheduleSettle();
    }
  };

  // 마우스로 끌어 굴리기 (터치는 브라우저가 굴린다)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) {
      return;
    }

    drag.current = {
      y: e.clientY,
      top: e.currentTarget.scrollTop,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = e.currentTarget;

    if (!d) {
      return;
    }

    const dy = e.clientY - d.y;

    if (!d.moved && Math.abs(dy) > 3) {
      d.moved = true;
      el.setPointerCapture(e.pointerId);
      el.style.scrollSnapType = "none";
    }

    if (d.moved) {
      el.scrollTop = d.top - dy;
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = e.currentTarget;

    if (!d) {
      return;
    }

    drag.current = null;

    if (!d.moved) {
      return;
    }

    justDragged.current = true;
    el.style.scrollSnapType = "";
    el.scrollTo({ top: nearest(el) * ITEM_H, behavior: "smooth" });
    scheduleSettle();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      PageUp: -5,
      PageDown: 5,
      Home: -Infinity,
      End: Infinity,
    };
    const s = step[e.key];

    if (s === undefined) {
      return;
    }

    e.preventDefault();
    onPick(clamp(index + s, 0, items.length - 1));
  };

  return (
    <div
      className={cn("relative", className)}
      style={{ height: ROWS * ITEM_H }}
    >
      {/* 가운데 줄 (고른 값) */}
      <div
        className="border-primary/50 bg-primary/15 pointer-events-none absolute inset-x-1 rounded-lg border"
        style={{ top: PAD, height: ITEM_H }}
      />
      <div
        ref={box}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        className={cn(
          "relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain",
          "cursor-grab select-none active:cursor-grabbing",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "[mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]",
          "focus-visible:outline-primary rounded-lg focus-visible:outline-2",
        )}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div style={{ height: PAD }} />
        {items.map((text, i) => {
          const far = Math.abs(i - live);

          return (
            <div
              key={i}
              role="option"
              aria-selected={i === index}
              className={cn(
                "flex snap-center items-center justify-center tabular-nums transition-opacity",
                far === 0 && "text-lg font-bold",
                far === 1 && "opacity-60",
                far >= 2 && "opacity-30",
              )}
              style={{ height: ITEM_H }}
              onClick={() => {
                if (justDragged.current) {
                  justDragged.current = false;

                  return;
                }

                onPick(i);
              }}
            >
              {text}
            </div>
          );
        })}
        <div style={{ height: PAD }} />
      </div>
    </div>
  );
}

// 연·월·일 휠 + 그 밑의 달력. how는 어디서 골랐는지 (달력에서 고르면 팝업을 닫는 등)
export function BirthdayPicker({
  value,
  onChange,
}: {
  value: Birth | null;
  onChange: (b: Birth, how: "wheel" | "calendar") => void;
}) {
  const shown = value ?? DEFAULT_BIRTH;
  const days = range(1, daysInMonth(shown.year, shown.month));

  // 달력이 보여 주는 달. 고른 날의 달이 바뀌면 그 달로 넘기고, 이전/다음 달 버튼으로는 둘러보기만 한다
  const shownKey = shown.year * 12 + shown.month - 1;
  const [seenKey, setSeenKey] = useState(shownKey);
  const [month, setMonth] = useState(
    () => new Date(shown.year, shown.month - 1),
  );

  if (seenKey !== shownKey) {
    setSeenKey(shownKey);
    setMonth(new Date(shown.year, shown.month - 1));
  }

  // 연·월이 바뀌어 그날이 없으면(2월 30일 등) 그 달의 마지막 날로
  const pick = (year: number, month: number, day: number) =>
    onChange(
      { year, month, day: Math.min(day, daysInMonth(year, month)) },
      "wheel",
    );

  return (
    <div className="flex w-[19rem] max-w-full flex-col items-center gap-3">
      <div className="bg-base-300/60 grid w-full grid-cols-[1.4fr_1fr_1fr] gap-1 rounded-xl p-1">
        <Wheel
          label="연도"
          items={YEARS.map((y) => `${y}년`)}
          index={shown.year - FIRST_YEAR}
          onPick={(i) => pick(YEARS[i], shown.month, shown.day)}
        />
        <Wheel
          label="월"
          items={MONTHS.map((m) => `${m}월`)}
          index={shown.month - 1}
          onPick={(i) => pick(shown.year, MONTHS[i], shown.day)}
        />
        <Wheel
          label="일"
          items={days.map((d) => `${d}일`)}
          index={shown.day - 1}
          onPick={(i) => pick(shown.year, shown.month, days[i])}
        />
      </div>
      <DayPicker
        className="react-day-picker"
        mode="single"
        locale={ko}
        startMonth={FIRST_MONTH}
        endMonth={LAST_MONTH}
        month={month}
        onMonthChange={setMonth}
        selected={value ? toDate(value) : undefined}
        onSelect={(d) => d && onChange(toBirth(d), "calendar")}
      />
    </div>
  );
}

// 결과 화면 위쪽: 날짜를 누르면 휠·달력이 펼쳐지고, 옆 버튼으로 하루씩 옮긴다
export function BirthdayField({
  value,
  onChange,
}: {
  value: Birth;
  onChange: (b: Birth) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const shift = (days: number) => {
    const d = toDate(value);
    d.setDate(d.getDate() + days);
    onChange(toBirth(d));
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", close);

    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={box} className="relative flex items-center gap-1">
      <button
        className="btn btn-sm btn-ghost"
        aria-label="하루 전"
        onClick={() => shift(-1)}
      >
        ◀
      </button>
      <button
        className="btn btn-sm min-w-40"
        onClick={() => setOpen((o) => !o)}
      >
        {birthLabel(value)}
      </button>
      <button
        className="btn btn-sm btn-ghost"
        aria-label="하루 뒤"
        onClick={() => shift(1)}
      >
        ▶
      </button>
      {open && (
        <div className="bg-base-200 rounded-box absolute top-full right-0 z-20 mt-2 flex flex-col items-center gap-2 p-3 shadow-xl">
          <BirthdayPicker
            value={value}
            onChange={(b, how) => {
              onChange(b);

              if (how === "calendar") {
                setOpen(false);
              }
            }}
          />
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setOpen(false)}
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
