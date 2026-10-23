import React, { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import CardPractice from "@/game/starSchool/CardPractice";
import { dexEntries } from "@/game/starSchool/dex";
import DexBook, { figureOf } from "@/game/starSchool/DexBook";
import DrawExercise, { gradeDrawing } from "@/game/starSchool/DrawExercise";
import { constellationFigure } from "@/game/starSchool/figure";
import { markVectors, stepDate } from "@/game/starSchool/lessonGeometry";
import LessonRoom from "@/game/starSchool/LessonRoom";
import { LESSONS } from "@/game/starSchool/lessons";
import { relationBank } from "@/game/starSchool/quiz";
import RelationQuestionView from "@/game/starSchool/RelationQuestionView";
import RelationsGame from "@/game/starSchool/RelationsGame";
import SchoolHome from "@/game/starSchool/SchoolHome";
import { aimView, drawSchoolSky } from "@/game/starSchool/schoolSkyDraw";
import ShapeFigure from "@/game/starSchool/ShapeFigure";
import { dateAt, observerOf } from "@/game/starSchool/skyMath";

// 별자리 익히기 화면: 첫 그림(서버 그리기)이 깨지지 않는지, 하늘 그리기가 모든 수업 단계·관계 문제에서
// 오류 없이 도는지(가짜 캔버스), 점 잇기 채점이 맞는지.

beforeAll(() => {
  // 이 저장소의 JSX는 React 전역을 쓴다 (Next가 따로 처리)
  (globalThis as unknown as { React: typeof React }).React = React;
});

describe("첫 그림", () => {
  it.each([
    ["처음", SchoolHome],
    ["도감", DexBook],
    ["카드 연습", CardPractice],
    ["길잡이 수업", LessonRoom],
    ["관계 맞히기", RelationsGame],
  ] as const)("%s 화면", (_, Screen) => {
    expect(renderToString(createElement(Screen)).length).toBeGreaterThan(200);
  });

  it("관계 문제 전부", () => {
    for (const q of relationBank()) {
      expect(
        renderToString(
          createElement(RelationQuestionView, { q, onDone: () => {} }),
        ),
        q.key,
      ).toContain(q.prompt.slice(0, 6));
    }
  });

  it("도감 카드 그림 전부 (모양·그림자)", () => {
    for (const e of dexEntries()) {
      for (const look of ["lines", "silhouette"] as const) {
        expect(
          renderToString(
            createElement(ShapeFigure, { figure: figureOf(e), look }),
          ),
        ).toContain("<svg");
      }
    }
  });

  it("점 잇기 화면", () => {
    const html = renderToString(
      createElement(DrawExercise, {
        figure: constellationFigure("카시오페이아자리"),
        onDone: () => {},
      }),
    );

    expect(html).toContain("<svg");
  });
});

// 무엇을 불렀는지 세는 가짜 2D 캔버스
const fakeContext = () => {
  const calls: Record<string, number> = {};
  const props: Record<string, unknown> = {};
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy(props, {
    get: (_, key: string) => {
      if (key in props) return props[key];

      return () => {
        calls[key] = (calls[key] ?? 0) + 1;

        if (key === "measureText") return { width: 40 };

        if (key.startsWith("create")) return gradient;

        return undefined;
      };
    },
    set: (_, key: string, value) => {
      props[key] = value;

      return true;
    },
  });

  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
};

describe("하늘 그리기", () => {
  it.each(
    LESSONS.flatMap((l) => l.steps.map((s, i) => [l.id, i + 1, l, s] as const)),
  )("%s %i단계", (_, __, lesson, step) => {
    const { ctx, calls } = fakeContext();
    const date = stepDate(lesson, step);
    const view = aimView(step.marks.flatMap(markVectors), date, lesson.place);
    const TP = drawSchoolSky(ctx, {
      width: 400,
      height: 420,
      view,
      date,
      observer: observerOf(lesson.place),
      magLimit: lesson.magLimit,
      lightPollution: lesson.lightPollution,
      marks: step.marks,
      rings: [],
      quiet: false,
    });

    expect(TP).toHaveLength(3);
    expect(calls.arc ?? 0).toBeGreaterThan(0);
  });

  it("관계 문제의 하늘마다", () => {
    for (const q of relationBank()) {
      if (q.kind === "order") continue;

      const { ctx } = fakeContext();
      const date = dateAt(q.scene.place, q.scene.time);

      drawSchoolSky(ctx, {
        width: 360,
        height: 380,
        view: aimView([], date, q.scene.place),
        date,
        observer: observerOf(q.scene.place),
        magLimit: 4.6,
        lightPollution: 0.25,
        marks: [...q.marks, ...(q.kind === "vertices" ? [] : q.reveal)],
        rings: [],
        quiet: true,
      });
    }
  });
});

describe("점 잇기 채점", () => {
  const truth: [string, string][] = [
    ["a", "b"],
    ["b", "c"],
    ["c", "d"],
    ["d", "e"],
  ];

  it("방향은 상관없고, 70% 넘게 맞고 틀린 선이 적으면 통과", () => {
    expect(
      gradeDrawing(
        [
          ["b", "a"],
          ["c", "b"],
          ["d", "c"],
        ],
        truth,
      ).pass,
    ).toBe(true);
    expect(
      gradeDrawing(
        [
          ["a", "b"],
          ["b", "c"],
        ],
        truth,
      ).pass,
    ).toBe(false);
    expect(
      gradeDrawing(
        [
          ["a", "b"],
          ["b", "c"],
          ["c", "d"],
          ["a", "e"],
          ["a", "c"],
        ],
        truth,
      ).pass,
    ).toBe(false);
  });

  it("카시오페이아 W는 선분 넷", () => {
    expect(constellationFigure("카시오페이아자리").edges).toHaveLength(4);
  });
});
