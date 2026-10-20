"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ko } from "react-day-picker/locale";

// 생일 고르기: 달력(react-day-picker, DaisyUI 달력 모양) 위쪽에서 연·월을 바로 고를 수 있게 한다.
// 생일은 몇십 년 전일 수 있어 달마다 넘기는 대신 연도 목록에서 고른다.

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

const FIRST_MONTH = new Date(1900, 0);

export function BirthdayCalendar({
  value,
  onChange,
}: {
  value: Birth | null;
  onChange: (b: Birth) => void;
}) {
  const selected = value ? toDate(value) : undefined;

  return (
    <DayPicker
      className="react-day-picker"
      mode="single"
      locale={ko}
      captionLayout="dropdown"
      startMonth={FIRST_MONTH}
      endMonth={new Date()}
      defaultMonth={selected ?? new Date(2000, 0)}
      selected={selected}
      onSelect={(d) => d && onChange(toBirth(d))}
    />
  );
}

// 결과 화면 위쪽: 날짜를 누르면 달력이 펼쳐지고, 옆 버튼으로 하루씩 옮긴다
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
        <div className="bg-base-200 rounded-box absolute top-full right-0 z-20 mt-2 p-2 shadow-xl">
          <BirthdayCalendar
            value={value}
            onChange={(b) => {
              onChange(b);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
