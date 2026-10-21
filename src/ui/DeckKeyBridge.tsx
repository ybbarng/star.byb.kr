"use client";

import { useEffect } from "react";

// 발표 슬라이드(public/presentation, Reveal.js)에 iframe으로 들어간 페이지를 누르면 키보드 입력이 iframe으로 가서
// 슬라이드가 넘어가지 않는다. 넘기는 키(→ ← PageDown PageUp, 발표용 리모컨이 보내는 키)는 바깥 슬라이드로 돌려주고,
// 포커스도 바깥으로 돌려놓는다. 입력칸·슬라이더에서 누른 키는 그 칸이 쓰게 둔다.

interface Deck {
  next: () => void;
  prev: () => void;
}

const KEYS: Record<string, keyof Deck> = {
  ArrowRight: "next",
  PageDown: "next",
  ArrowLeft: "prev",
  PageUp: "prev",
};

export default function DeckKeyBridge() {
  useEffect(() => {
    if (window.parent === window) return;

    const onKey = (e: KeyboardEvent) => {
      const move = KEYS[e.key];
      const target = e.target as HTMLElement | null;

      if (
        !move ||
        target?.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }

      let deck: Deck | undefined;

      try {
        deck = (window.parent as Window & { Reveal?: Deck }).Reveal;
      } catch {
        return; // 다른 사이트에 들어간 경우
      }

      if (!deck) return;

      e.preventDefault();
      deck[move]();
      window.parent.focus();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
