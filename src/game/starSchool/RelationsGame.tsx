"use client";

import type { RelationQuestion } from "@/game/starSchool/quiz";
import { useState } from "react";
import { ResultCard, RoundBanner, FxLayer, useFx } from "@/game/fx/Fx";
import { sfx } from "@/game/fx/sound";
import { isSouthOpen } from "@/game/starSchool/passport";
import {
  addXp,
  comboMultiplier,
  loadSave,
  saveBestRecord,
  writeSave,
  XP,
} from "@/game/starSchool/progress";
import { relationRound } from "@/game/starSchool/quiz";
import RelationQuestionView from "@/game/starSchool/RelationQuestionView";
import { useSave } from "@/game/starSchool/useSave";
import { cn } from "@/utils/cn";

// 관계 맞히기: 별자리와 길잡이 모양이 하늘에서 서로 어디에 있는지 (꼭짓점, 사이, 순서, 계절, 징검다리).
// 한 판 8문제. 연달아 맞히면 별빛이 10%씩 더, 남반구 수업이 열리면 남반구 문제도 나온다.

const ROUND = 8;

export default function RelationsGame() {
  const save = useSave();
  const [round, setRound] = useState<RelationQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [right, setRight] = useState(0);
  const [combo, setCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [over, setOver] = useState<{ isNew: boolean; best: number } | null>(
    null,
  );
  const fx = useFx();

  const start = () => {
    sfx.whoosh();
    setRound(
      relationRound(Date.now() % 2147483647, ROUND, isSouthOpen(loadSave())),
    );
    setIndex(0);
    setAnswered(null);
    setRight(0);
    setCombo(0);
    setXp(0);
    setOver(null);
  };

  if (!round) {
    return (
      <div className="fx-rise mx-auto flex w-full max-w-xl flex-col gap-4">
        <p className="text-sm opacity-80">
          별자리는 따로따로가 아니라 서로 이어져 있어요. 실제 하늘에서 길잡이
          모양의 꼭짓점을 누르고, 두 별자리 사이의 별자리를 맞히고, 징검다리를
          건너 목표를 찾고, 해가 지나는 순서를 맞혀요.
        </p>
        <ul className="bg-base-200/60 rounded-box flex flex-col gap-1 p-4 text-sm">
          <li>
            🔺 꼭짓점 누르기 — 여름철 대삼각형, 겨울철 대육각형, 북두칠성…
          </li>
          <li>↔️ 사이 별자리 — 쌍둥이와 사자 사이에는?</li>
          <li>🗓️ 계절의 길잡이 — 이 하늘에 뜬 커다란 모양은?</li>
          <li>🪨 징검다리 — 페가수스 대사각형에서 안드로메다은하로</li>
          <li>☀️ 해의 길 — 황도 별자리 순서 (뱀주인자리 포함!)</li>
          <li className={cn(!isSouthOpen(save) && "opacity-50")}>
            ✝️ 남반구 — 진짜 남십자, 하늘의 남극
            {!isSouthOpen(save) && " (사계절 수업을 마치면 나와요)"}
          </li>
        </ul>
        <div className="text-sm opacity-70">
          최고 기록 {save.best.relations ?? 0} / {ROUND}
        </div>
        <button className="btn btn-primary btn-lg" onClick={start}>
          시작
        </button>
      </div>
    );
  }

  if (over) {
    const stars = right >= 7 ? 3 : right >= 5 ? 2 : right >= 3 ? 1 : 0;

    return (
      <div className="flex justify-center">
        <ResultCard
          title="관계 맞히기 끝"
          score={right}
          unit={` / ${ROUND}`}
          stars={stars}
          best={over.best}
          newBest={over.isNew}
          actions={
            <>
              <button className="btn btn-primary" onClick={start}>
                한 판 더
              </button>
              <button className="btn" onClick={() => setRound(null)}>
                처음으로
              </button>
            </>
          }
        >
          <div className="text-amber-200">✦ 별빛 +{xp}</div>
        </ResultCard>
      </div>
    );
  }

  const q = round[index];

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-3">
      <FxLayer fx={fx} />
      <RoundBanner key={index} text={`${index + 1} / ${ROUND}`} />
      <div className="flex items-center justify-between text-sm">
        <span>
          {index + 1} / {ROUND} · 맞힘 {right}
        </span>
        <span
          key={combo}
          className={cn(combo >= 2 && "fx-pop font-bold text-amber-300")}
        >
          {combo >= 2 ? `🔥 ${combo}연속` : ""}
        </span>
        <span className="text-amber-200">✦ +{xp}</span>
      </div>
      <RelationQuestionView
        key={`${index}-${q.key}`}
        q={q}
        onDone={(correct) => {
          setAnswered(correct);

          if (correct) {
            const c = combo + 1;
            const gained = Math.round(XP.relation * comboMultiplier(c));
            writeSave(addXp(loadSave(), gained));
            setCombo(c);
            setRight((r) => r + 1);
            setXp((x) => x + gained);
            fx.popup(0.5, 0.2, `+${gained}`);
            fx.burst(0.5, 0.25);
          } else {
            setCombo(0);
          }
        }}
      />
      {answered !== null && (
        <button
          className="btn btn-primary self-end"
          onClick={() => {
            if (index + 1 >= ROUND) {
              const r = saveBestRecord(loadSave(), "relations", right);
              writeSave(r.save);
              setOver({
                isNew: r.isNew && right > 0,
                best: r.save.best.relations ?? right,
              });
            } else {
              setIndex(index + 1);
              setAnswered(null);
            }
          }}
        >
          {index + 1 >= ROUND ? "결과 보기" : "다음 문제 →"}
        </button>
      )}
    </div>
  );
}
