"use client";

import type { ComputerRun, TeamRun } from "@/game/humanVsComputer/computerRun";
import type { StageView } from "@/game/humanVsComputer/drawStage";
import type { Point2D } from "@/scripts/hash/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { sfx } from "@/game/fx/sound";
import { runWithClues } from "@/game/humanVsComputer/computerRun";
import { formatSeconds, overlapOf } from "@/game/humanVsComputer/rounds";
import { REVEAL_COLOR } from "@/game/humanVsComputer/SolveSteps";
import { constellationParts, projectLines } from "@/game/sky/catalog";
import { learnHref } from "@/learn/steps";
import { getSampleShot } from "@/plate-solver/shotTime";
import { ACCEPT } from "@/search/solvers/candidates";

// 반전 판: 별이 열 개 남짓인 사이판 사진. 컴퓨터는 별만으로는 "모르겠다"고 한다.
// 사람이 단서 두 가지 — 언제·어디서 찍었는지(샘플에 남은 기록), 수평선(컴퓨터의 제안을 확인하거나 직접 두 점) — 를 주면
// 시각·장소 풀이(horizonSolve)로 함께 푼다.

const PHOTO_STARS = 30;

// "2019-06-17T22:36" → "2019년 6월 17일 밤 10시 36분"
const koreanDateTime = (local: string) => {
  const [y, m, d] = local.slice(0, 10).split("-").map(Number);
  const [h, min] = local.slice(11, 16).split(":").map(Number);
  const part = h < 6 ? "새벽" : h < 12 ? "오전" : h < 18 ? "오후" : "밤";
  const h12 = h % 12 === 0 ? 12 : h % 12;

  return `${y}년 ${m}월 ${d}일 ${part} ${h12}시 ${min}분`;
};

export default function TeamUp({
  image,
  run,
  answer,
  onView,
  onReveal,
  onPicker,
  onSolved,
}: {
  image: HTMLImageElement;
  run: ComputerRun;
  answer: string;
  onView: (v: StageView) => void;
  onReveal: (r: { lines: Point2D[][]; color: string } | null) => void;
  onPicker: (fn: ((p: Point2D) => void) | null) => void;
  onSolved: () => void;
}) {
  const shot = getSampleShot(image.src);
  const [timeClue, setTimeClue] = useState(false);
  const [horizonStep, setHorizonStep] = useState<
    "none" | "suggest" | "pick" | "done"
  >("none");
  const [line, setLine] = useState<Point2D[]>([]);
  const [solving, setSolving] = useState(false);
  const [team, setTeam] = useState<TeamRun | null>(null);
  const stars = run.stars.slice(0, PHOTO_STARS);
  const best = run.result.candidates[0];
  const solvedByComputer = run.result.found && !!run.result.transform;

  // 사진 위 그림: 처음엔 찾은 별, 수평선 단서를 주는 동안엔 선, 함께 풀면 별 지도 겹치기
  useEffect(() => {
    if (team?.accepted && team.result) {
      const TP = team.result.TP;
      const o = overlapOf(TP, stars, image.width, image.height);
      onView({
        kind: "verify",
        TP,
        map: o.map,
        pairs: o.pairs,
        horizon: line,
      });
      onReveal({
        // 남십자 옆의 센타우루스(밝은 두 별)도 같이
        lines: [answer, "센타우루스자리"].flatMap((label) =>
          projectLines(TP, constellationParts(label)),
        ),
        color: REVEAL_COLOR,
      });

      return;
    }

    onReveal(null);
    onView(
      horizonStep === "none"
        ? { kind: "detect", stars }
        : { kind: "horizon", stars, line, confirmed: horizonStep === "done" },
    );
    // stars는 run에서 나온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, horizonStep, line, run, image, answer, onView, onReveal]);

  // 사람이 수평선 두 점을 찍는 중
  useEffect(() => {
    if (horizonStep !== "pick") {
      onPicker(null);

      return;
    }

    onPicker((p) => {
      sfx.tap();
      setLine((l) => {
        const next = l.length >= 2 ? [p] : [...l, p];

        if (next.length === 2) {
          setHorizonStep("done");
        }

        return next;
      });
    });

    return () => onPicker(null);
    // onPicker는 부모가 매번 새로 만드는 감싼 함수라 넣지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizonStep]);

  const solveTogether = () => {
    if (line.length < 2) {
      return;
    }

    setSolving(true);
    sfx.whoosh();
    runWithClues(image, run.stars, [line[0], line[1]])
      .then((r) => {
        setTeam(r);

        if (r.accepted) {
          onSolved();
        } else {
          sfx.miss();
        }
      })
      .catch(() => setTeam({ result: null, accepted: false, ms: 0 }))
      .finally(() => setSolving(false));
  };

  if (solvedByComputer) {
    return (
      <div className="text-sm opacity-80">
        이번엔 컴퓨터가 별만으로도 풀었어요. 보통은 별이 너무 적어 확신하지
        못하는 사진이에요.
      </div>
    );
  }

  const localTime = (d: Date) => {
    const offsetHours = shot ? parseInt(shot.offset, 10) : 0;

    return new Date(d.getTime() + offsetHours * 3600000)
      .toISOString()
      .slice(11, 16);
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded-box border border-red-300/40 bg-red-400/10 p-3">
        <div className="font-bold">🤖 컴퓨터: “모르겠어요.”</div>
        <p className="mt-1 opacity-80">
          구름과 불빛 사이로 진짜 별은 열 개 남짓이에요. 모양이 닮은 자리는
          찾았지만
          {best ? (
            <>
              {" "}
              우연일 확률이 10
              <sup>-{Math.max(0, best.confidence).toFixed(0)}</sup> 정도라
            </>
          ) : (
            ""
          )}{" "}
          기준(10<sup>-{ACCEPT.minLogOdds}</sup>, 10억 분의 1)에 못 미쳐요. 별이
          적으면 우연히 닮은 자리가 너무 많거든요.
        </p>
      </div>

      {!team?.accepted && (
        <>
          <div className="font-bold">🙋 사람이 단서를 주면 어떨까요?</div>

          <div className="rounded-box bg-base-300/60 flex flex-col gap-2 p-3">
            <div className="font-bold">단서 1 · 언제, 어디서</div>
            {timeClue && shot ? (
              <div className="fx-rise">
                {koreanDateTime(shot.local)} 무렵, 사이판(북위{" "}
                {shot.observer?.latDeg.toFixed(0)}°)
                <div className="text-xs opacity-60">
                  {shot.note} — 실제 촬영은 조금 앞이라 앞뒤 몇 시간을 같이
                  찾아요.
                </div>
              </div>
            ) : (
              <button
                className="btn btn-sm"
                onClick={() => {
                  sfx.tap();
                  setTimeClue(true);
                }}
              >
                📅 찍은 날짜·시각·장소 알려 주기
              </button>
            )}
          </div>

          <div className="rounded-box bg-base-300/60 flex flex-col gap-2 p-3">
            <div className="font-bold">단서 2 · 수평선</div>
            {horizonStep === "none" && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  sfx.tap();
                  setLine(run.horizon ?? []);
                  setHorizonStep(run.horizon ? "suggest" : "pick");
                }}
              >
                🌊 바다 수평선 알려 주기
              </button>
            )}
            {horizonStep === "suggest" && (
              <div className="fx-rise flex flex-col gap-2">
                <div>
                  컴퓨터가 찾은 수평선(파란 점선)이 바다와 하늘의 경계에 맞나요?
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-success grow"
                    onClick={() => {
                      sfx.tap();
                      setHorizonStep("done");
                    }}
                  >
                    맞아요
                  </button>
                  <button
                    className="btn btn-sm grow"
                    onClick={() => {
                      setLine([]);
                      setHorizonStep("pick");
                    }}
                  >
                    제가 찍을게요
                  </button>
                </div>
              </div>
            )}
            {horizonStep === "pick" && (
              <div className="fx-rise text-amber-200">
                사진에서 바다와 하늘의 경계를 왼쪽·오른쪽 두 번 눌러 주세요 (
                {line.length}/2).
              </div>
            )}
            {horizonStep === "done" && (
              <div className="fx-rise flex items-center justify-between gap-2">
                <span>✓ 수평선 (초록 선)</span>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    setLine([]);
                    setTeam(null);
                    setHorizonStep("pick");
                  }}
                >
                  다시 찍기
                </button>
              </div>
            )}
          </div>

          <button
            className="btn btn-secondary"
            disabled={!timeClue || horizonStep !== "done" || solving}
            onClick={solveTogether}
          >
            {solving ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                함께 푸는 중…
              </>
            ) : (
              "🤝 단서로 같이 풀기"
            )}
          </button>
          {team && !team.accepted && (
            <div className="text-red-300">
              이번 단서로는 확신하지 못했어요
              {team.result
                ? ` (맞는 별 ${team.result.inlierCount}/${team.result.photoCount}개)`
                : ""}
              . 수평선을 바다와 하늘의 경계에 맞춰 다시 찍어 볼까요?
            </div>
          )}
        </>
      )}

      {team?.accepted && team.result && (
        <div className="fx-rise rounded-box border border-green-300/40 bg-green-400/10 p-3">
          <div className="font-bold text-green-300">🤝 함께 풀었어요!</div>
          <p className="mt-1">
            단서 덕분에 컴퓨터가 살펴볼 자리가 방위·시야각 둘로 줄었어요. 사진
            별 {team.result.photoCount}개 가운데 {team.result.inlierCount}개가
            별 지도와 맞았고 ({formatSeconds(team.ms)}), 하늘이 가장 잘 맞는
            촬영 시각은 {localTime(team.result.date)} 무렵이에요.
          </p>
          <p className="mt-1 opacity-80">
            사람은 단서를, 컴퓨터는 계산을 — 둘이 함께일 때 가장 강해요.
          </p>
          <Link
            href={learnHref("hard-photos")}
            target="_blank"
            className="link link-primary text-xs"
          >
            찾는 원리: 어려운 사진들 자세히 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
