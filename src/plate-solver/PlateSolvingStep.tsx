import type { SampleAnswer } from "@/plate-solver/sampleAnswers";
import type { ShotTime } from "@/plate-solver/shotTime";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { CompassMark } from "@/search/compass";
import type { HorizonSolveResult } from "@/search/horizonSolve";
import type { SolvePhase } from "@/search/solvePhoto";
import type { SolveCandidateResult } from "@/search/solvers";
import type { Mat3 } from "@/search/utils/similarity";
import type { LatLon } from "@/search/whereShot";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BasicsTerm } from "@/learn/basics/BasicsLinks";
import { autoHorizon } from "@/plate-solver/autoHorizon";
import { detectPhotoStars } from "@/plate-solver/detectPhotoStars";
import MiniSkyMap from "@/plate-solver/MiniSkyMap";
import { photoInfo } from "@/plate-solver/photoInfo";
import { getSampleAnswer, matchesAnswer } from "@/plate-solver/sampleAnswers";
import { SampleCreditLine } from "@/plate-solver/SampleCredits";
import {
  ESTIMATED_SHOT_NOTE,
  exactShotUtc,
  getSampleShot,
  shotDate,
  shotFromExif,
  shotFromFileName,
} from "@/plate-solver/shotTime";
import ShotTimeControl from "@/plate-solver/ShotTimeControl";
import ShotTimeEstimator from "@/plate-solver/ShotTimeEstimator";
import { useContextStore } from "@/plate-solver/store/context";
import { trailPose, trailProgress } from "@/plate-solver/trailMotion";
import WhereShotCard, { whereSummary } from "@/plate-solver/WhereShotCard";
import { compassMarks, frameFromZenith } from "@/search/compass";
import useSkyOverlay from "@/search/hooks/useSkyOverlay";
import useSolve from "@/search/hooks/useSolve";
import { HORIZON_ACCEPT_LOG_ODDS } from "@/search/horizonSolve";
import { zenithFromHorizon } from "@/search/shotTimeEstimate";
import { DEEP_SKY_OBJECTS, solarSystemObjects } from "@/search/skyObjects";
import { horizonSolveInWorker } from "@/search/solverClient";
import { ACCEPT } from "@/search/solvers/candidates";
import { constellationAt } from "@/search/utils/constellationBounds";
import { horizontalFrameJ2000, julianDay } from "@/search/utils/ephemeris";
import { projectFisheye } from "@/search/utils/fisheye";
import { DEFAULT_DISPLAY_STARS } from "@/search/utils/selectStars";
import { photoToSky, projectVecToPhoto } from "@/search/utils/wcs";
import { whereShot } from "@/search/whereShot";
import { readExif } from "@/services/exif";
import { getSampleCredit } from "@/services/samples";
import { secondsBucket, track } from "@/ui/track";
import { cn } from "@/utils/cn";

// 별자리 찾기: 사진을 고르면 별 찾기 → 풀이까지 자동으로 하고 결과를 보여 준다.
// 못 찾거나 틀렸으면 별 고치기(별·지평선·달)로 사람이 돕는다.
export default function PlateSolvingStep() {
  const image = useContextStore((state) => state.image);
  const fileName = useContextStore((state) => state.fileName);
  const photoStars = useContextStore((state) => state.photoStars);
  const hiddenStars = useContextStore((state) => state.hiddenStars);
  const marks = useContextStore((state) => state.marks);
  const setPhotoStars = useContextStore((state) => state.setPhotoStars);
  const setDetections = useContextStore((state) => state.setDetections);
  const setMarks = useContextStore((state) => state.setMarks);
  const goTo = useContextStore((state) => state.goTo);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const { solve, outcome, solving, ready, phase, error } = useSolve();
  // 방문 통계: 풀이 한 번의 결과 (ui/track). 사진이 바뀔 때가 아니라 결과가 나올 때만 보낸다
  const imageSrc = useRef(image?.src);
  imageSrc.current = image?.src;

  useEffect(() => {
    if (!outcome && !error) return;

    const source = imageSrc.current?.startsWith("blob:") ? "upload" : "sample";
    track(
      "photo-solve",
      outcome
        ? {
            source,
            result: outcome.found
              ? "found"
              : outcome.candidates.length
                ? "candidates"
                : "none",
            seconds: secondsBucket(outcome.timeMs),
          }
        : { source, result: "error" },
    );
  }, [outcome, error]);
  const {
    stars: skyStars,
    constellations: skyConstellations,
    objects: skyObjects,
    boundaries: skyBoundaries,
    milkyWay: skyMilkyWay,
    milkyWayLabel: skyMilkyWayLabel,
    regions: skyRegions,
    update: updateSky,
    updateFisheye,
    clear: clearSky,
  } = useSkyOverlay();
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [shot, setShot] = useState<ShotTime | null>(null);
  // 사진 EXIF의 GPS. 촬영 시각이 없어도 장소만은 쓴다 (어디서 찍었을까?)
  const [exifGps, setExifGps] = useState<LatLon | null>(null);
  const [showDetected, setShowDetected] = useState(false);
  // 별자리 구역(IAU 경계). 켜면 경계선과 구역 이름을, 끄면 별자리선 이름을 쓴다
  const [showRegions, setShowRegions] = useState(true);
  const [showMilkyWay, setShowMilkyWay] = useState(true);
  const [showCompass, setShowCompass] = useState(true);
  // 풀이 결과(별·별자리·천체) 표시. 끄면 원본 사진만 보여 번갈아 비교할 수 있다
  const [showSolution, setShowSolution] = useState(true);
  // "사진에 담긴 별자리 구역"에서 누른 별자리. 사진과 작은 천문도에서 강조한다
  const [highlight, setHighlight] = useState<string | null>(null);
  // 시각·장소·지평선 풀이 결과 (확신했을 때만 result가 있다)
  const [horizonRun, setHorizonRun] = useState<{
    running: boolean;
    result: HorizonSolveResult | null;
    message: string | null;
  }>(NO_HORIZON_RUN);
  const horizonTP = horizonRun.result?.TP;

  // 1. 사진에서 별을 찾는다 (처음 한 번). 지평선도 자동으로 찾아 제안한다.
  useEffect(() => {
    // 별 고치기에서 돌아온 경우처럼 이미 찾았으면 다시 찾지 않는다
    if (!image || useContextStore.getState().detections.length > 0) {
      return;
    }

    let alive = true;
    setDetecting(true);
    setDetectError(null);
    detectPhotoStars(image)
      .then((all) => {
        if (!alive) {
          return;
        }

        setDetections(all);
        setPhotoStars(
          all.slice(0, DEFAULT_DISPLAY_STARS),
          all.slice(DEFAULT_DISPLAY_STARS),
        );

        const found = autoHorizon(
          image,
          all.slice(0, 60).map((s): [number, number] => [s.x, s.y]),
        );
        const current = useContextStore.getState().marks;

        if (found && current.horizon.length === 0) {
          setMarks({ ...current, horizon: found, horizonAuto: true });
        }
      })
      .catch((e: Error) => alive && setDetectError(e.message))
      .finally(() => alive && setDetecting(false));

    return () => {
      alive = false;
    };
  }, [image, setDetections, setPhotoStars, setMarks]);

  // 촬영 시각·장소와 지평선 두 점으로 푼다 (별이 적어 자동으로 못 푸는 사진)
  const runHorizonSolve = useCallback(() => {
    const observer = shot?.observer;

    if (!image || !observer || marks.horizon.length < 2) {
      return;
    }

    const offsetHours = parseInt(shot.offset, 10);
    setHorizonRun({ running: true, result: null, message: null });
    horizonSolveInWorker(
      [...photoStars, ...hiddenStars].map((s) => ({
        x: s.x,
        y: s.y,
        brightness: s.brightness,
        ringContrast: s.ringContrast,
        trail: s.trail,
        chord: s.chord,
      })),
      image.width,
      image.height,
      [marks.horizon[0], marks.horizon[1]],
      shotDate(shot),
      observer,
    )
      .then((r) => {
        if (!r) {
          setHorizonRun({
            running: false,
            result: null,
            message: "지평선 위에 별이 너무 적어 풀 수 없어요.",
          });

          return;
        }

        const accepted = r.logOdds >= HORIZON_ACCEPT_LOG_ODDS;
        const local = new Date(r.date.getTime() + offsetHours * 3600000)
          .toISOString()
          .slice(0, 16)
          .replace("T", " ");
        setHorizonRun({
          running: false,
          result: accepted ? r : null,
          message: accepted
            ? `맞는 별 ${r.inlierCount}/${r.photoCount}개 · 하늘이 맞는 촬영 시각 ${local}`
            : `확신하지 못했어요 (맞는 별 ${r.inlierCount}/${r.photoCount}개). 시각·장소·지평선을 확인해 보세요.`,
        });
      })
      .catch((e: Error) =>
        setHorizonRun({ running: false, result: null, message: e.message }),
      );
  }, [image, shot, marks.horizon, photoStars, hiddenStars]);

  // 자동 풀이가 확신하지 못했고 촬영 시각·장소와 지평선이 있으면, 시각·장소 풀이를 한 번 자동으로 돌린다
  const autoHorizonTried = useRef(false);

  useEffect(() => {
    autoHorizonTried.current = false;
    setHorizonRun(NO_HORIZON_RUN);
  }, [image, photoStars, marks]);

  useEffect(() => {
    if (
      autoHorizonTried.current ||
      solving ||
      !outcome ||
      outcome.found ||
      outcome.fisheyeCamera ||
      !shot?.observer ||
      marks.horizon.length < 2
    ) {
      return;
    }

    autoHorizonTried.current = true;
    runHorizonSolve();
  }, [solving, outcome, shot, marks.horizon, runHorizonSolve]);

  // 촬영 시각: 기록을 아는 샘플이면 그 기록, 아니면 사진의 EXIF, 그것도 없으면 파일 이름. 다 없으면 사람이 넣는다.
  // EXIF의 GPS는 기록이 있어도 따로 읽어 둔다 (장소는 사진의 위치 정보가 가장 믿을 만하다).
  useEffect(() => {
    if (!image) {
      return;
    }

    const known = getSampleShot(image.src);
    setShot(known);
    setExifGps(null);

    let cancelled = false;
    fetch(image.src)
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        if (cancelled) {
          return;
        }

        const exif = readExif(buffer);
        setExifGps(
          exif?.latDeg != null && exif.lonDeg != null
            ? { latDeg: exif.latDeg, lonDeg: exif.lonDeg }
            : null,
        );

        // EXIF에 시각이 없으면 파일 이름에서 (EXIF를 덮어쓰지 않는다)
        if (!known) {
          setShot(shotFromExif(exif) ?? shotFromFileName(fileName));
        }
      })
      .catch(() => {
        if (!cancelled && !known) {
          setShot(shotFromFileName(fileName));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [image, fileName]);

  // 딥스카이는 늘, 해·달·행성은 촬영 시각을 알 때만 그린다
  const objects = useMemo(() => {
    const date = shot ? shotDate(shot) : null;

    return date && !Number.isNaN(date.getTime())
      ? [...DEEP_SKY_OBJECTS, ...solarSystemObjects(date, shot?.observer)]
      : DEEP_SKY_OBJECTS;
  }, [shot]);

  // 그릴 어안 카메라: worker의 blind 어안 풀이가 성공했을 때만
  const fisheyeCamera = outcome?.fisheyeCamera ?? null;

  // 2. 찾은 별로 plate solving (직선/어안 자동 판별은 worker에서)
  const runSolve = useCallback(() => {
    if (!image || photoStars.length < 1) {
      return;
    }

    // 화면의 별 + 화면에 안 띄운 나머지 검출(사람이 고치지 않았을 때). 풀이가 영역마다 고른다.
    solve(
      [...photoStars, ...hiddenStars].map((s) => ({
        x: s.x,
        y: s.y,
        brightness: s.brightness,
        ringContrast: s.ringContrast,
        trail: s.trail,
        chord: s.chord,
      })),
      image.width,
      image.height,
    );
  }, [image, photoStars, hiddenStars, solve]);

  useEffect(() => {
    if (ready) {
      runSolve();
    }
  }, [ready, runSolve]);

  // 결과가 오면 최상위 후보 선택
  useEffect(() => {
    setSelected(0);
    setHighlight(null);
  }, [outcome]);

  // 어안이면 어안 카메라로, 아니면 선택 후보의 변환으로 별/별자리를 그린다
  useEffect(() => {
    if (!image) {
      return;
    }

    if (fisheyeCamera) {
      updateFisheye(fisheyeCamera, image.width, image.height, objects);

      return;
    }

    if (horizonTP) {
      updateSky(horizonTP, image.width, image.height, objects);

      return;
    }

    const c = outcome?.candidates[selected];

    if (!c || solving) {
      clearSky();

      return;
    }

    const trailAngle = selected === 0 ? outcome?.trailAngleDeg : undefined;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!trailAngle || reduceMotion) {
      updateSky(c.transform, image.width, image.height, objects);

      return;
    }

    // 별 궤적: 노출 시작 → 끝으로 궤적을 따라 움직인다 (trailMotion.ts). 멈춘 동안은 다시 그리지 않는다
    const t0 = performance.now();
    let frame = 0;
    let drawn = -1;

    const tick = () => {
      const progress = trailProgress(performance.now() - t0);

      if (progress !== drawn) {
        drawn = progress;
        updateSky(
          trailPose(c.transform, trailAngle, progress),
          image.width,
          image.height,
          objects,
        );
      }

      frame = requestAnimationFrame(tick);
    };

    tick();

    return () => cancelAnimationFrame(frame);
  }, [
    image,
    objects,
    fisheyeCamera,
    horizonTP,
    outcome,
    selected,
    solving,
    updateSky,
    updateFisheye,
    clearSky,
  ]);

  // 방향키로 후보 탐색
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const n = outcome?.candidates.length ?? 0;

      if (n === 0 || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) {
        return;
      }

      e.preventDefault();
      setSelected((prev) => {
        if (e.key === "ArrowDown") {
          return prev < n - 1 ? prev + 1 : prev;
        }

        return prev > 0 ? prev - 1 : 0;
      });
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [outcome]);

  const transformForWhere =
    !fisheyeCamera && !solving
      ? (horizonTP ?? outcome?.candidates[selected]?.transform)
      : undefined;

  // 어디서 찍었을까? 사진 GPS → 기록·입력한 장소 → 지평선 → 사진에 담긴 별 순으로
  const where = useMemo(() => {
    if (!image) {
      return null;
    }

    // "언제 찍었을까?"에서 고른 시각은 장소가 하늘에서 추정한 값이라 입력한 장소로 보지 않는다
    const place =
      shot?.observer &&
      (shot.source === "record" ||
        (shot.source === "manual" && shot.note !== ESTIMATED_SHOT_NOTE))
        ? { ...shot.observer, source: shot.source }
        : null;
    const T = transformForWhere;
    const toSky = (p: [number, number]) => photoToSky(T!, p);

    // 별 범위는 찾은 별 중 카탈로그 별과 겹친 것(맞는 별)만 쓴다. 사진 모서리를 되돌리면
    // 땅·건물 쪽 방향까지 들어가 범위가 틀리게 좁아지고, 검출만 쓰면 불빛이 섞인다.
    const unit = Math.hypot(image.width, image.height) / 1400;
    const stars: Point3D[] = T
      ? photoStars
          .filter((p) =>
            skyStars.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 8 * unit),
          )
          .map((p) => toSky([p.x, p.y]))
      : [];

    return whereShot({
      exif: exifGps,
      place,
      horizon:
        T && marks.horizon.length === 2
          ? {
              a: toSky(marks.horizon[0]),
              b: toSky(marks.horizon[1]),
              sky: toSky([image.width / 2, 0]),
            }
          : null,
      stars,
      utc: exactShotUtc(shot),
    });
  }, [
    image,
    shot,
    exifGps,
    transformForWhere,
    marks.horizon,
    photoStars,
    skyStars,
  ]);

  // 방위(동서남북): 지평선 두 점이 있으면 그 천정으로, 없으면 촬영 시각·장소의 천정으로.
  // 둘 다 없으면 null (추측해서 그리지 않는다)
  const compass = useMemo((): CompassMark[] | null => {
    if (!image || solving) {
      return null;
    }

    const T = transformForWhere;
    const project = fisheyeCamera
      ? (v: Point3D) => projectFisheye(fisheyeCamera, v)
      : T
        ? (v: Point3D) => projectVecToPhoto(T, v)
        : null;

    if (!project) {
      return null;
    }

    // 지평선은 직선투영일 때만 되돌릴 수 있다
    const zenith =
      T && marks.horizon.length === 2
        ? zenithFromHorizon(
            photoToSky(T, marks.horizon[0]),
            photoToSky(T, marks.horizon[1]),
            photoToSky(T, [image.width / 2, 0]),
          )
        : null;
    // 시각·장소 풀이가 확신했으면 그 시각이 더 정확하다
    const date = horizonRun.result?.date ?? (shot ? shotDate(shot) : null);
    const frame = zenith
      ? frameFromZenith(zenith)
      : shot?.observer && date && !Number.isNaN(date.getTime())
        ? horizontalFrameJ2000(julianDay(date), shot.observer)
        : null;

    if (!frame) {
      return null;
    }

    const unit = Math.hypot(image.width, image.height) / 1400;

    return compassMarks(project, frame, {
      width: image.width,
      height: image.height,
      margin: 30 * unit,
      minGap: 70 * unit,
    });
  }, [
    image,
    solving,
    transformForWhere,
    fisheyeCamera,
    marks.horizon,
    horizonRun.result,
    shot,
  ]);

  // 강조한 별자리 구역이 사진에서 차지하는 칸 (직선투영으로 되돌릴 수 있을 때만)
  const highlightArea = useMemo(
    () =>
      image && highlight && transformForWhere
        ? regionCells(transformForWhere, image.width, image.height, highlight)
        : null,
    [image, highlight, transformForWhere],
  );

  // 사진 위에 그리기
  useEffect(() => {
    if (!canvasElement.current || !image) {
      return;
    }

    const context = canvasElement.current.getContext("2d");

    if (!context) {
      return;
    }

    context.drawImage(image, 0, 0, image.width, image.height);
    drawOverlay(context, image, {
      photoStars: showDetected || detecting ? photoStars : [],
      ...(showSolution
        ? {
            skyStars,
            skyConstellations,
            skyObjects,
            boundaries: showRegions ? skyBoundaries : [],
            milkyWay: showMilkyWay ? skyMilkyWay : [],
            milkyWayLabel: showMilkyWay ? skyMilkyWayLabel : null,
            regions: showRegions ? skyRegions : [],
            horizon: horizonTP ? marks.horizon : [],
            compass: showCompass && compass ? compass : [],
            highlight: highlight
              ? { label: highlight, area: highlightArea }
              : null,
          }
        : NO_SOLUTION_LAYERS),
    });
  }, [
    showSolution,
    highlight,
    highlightArea,
    showCompass,
    compass,
    image,
    photoStars,
    showDetected,
    showRegions,
    showMilkyWay,
    skyMilkyWay,
    skyMilkyWayLabel,
    detecting,
    skyStars,
    skyConstellations,
    skyObjects,
    skyBoundaries,
    skyRegions,
    horizonTP,
    marks,
  ]);

  // 사진 안에 보이는 별자리 이름
  const visibleConstellations = useMemo(() => {
    if (!image) {
      return [];
    }

    // 한 별자리가 여러 선 묶음으로 나뉘어 있을 수 있어 이름은 한 번만
    const names = skyConstellations
      .filter(({ lines }) =>
        lines.some(
          (l) =>
            l !== null &&
            l[0] >= 0 &&
            l[0] < image.width &&
            l[1] >= 0 &&
            l[1] < image.height,
        ),
      )
      .map((c) => c.label);

    return [...new Set(names)];
  }, [skyConstellations, image]);

  if (!image) {
    return null;
  }

  const candidates = outcome?.candidates ?? [];
  const answer = getSampleAnswer(image.src);
  const credit = getSampleCredit(image.src);
  const selectedTransform = transformForWhere;
  // 별을 찾은 뒤 풀이가 시작되기 전 잠깐도 진행 중으로 본다
  const busy =
    detecting ||
    solving ||
    !ready ||
    (photoStars.length > 0 && !outcome && !error);
  const confident = Boolean(
    !busy && (fisheyeCamera || horizonTP || outcome?.found),
  );
  const failed = !busy && !confident && outcome !== null;
  // 별만으로(시각·장소 없이) 확신한 사진
  const blindSolved = confident && !horizonTP && Boolean(outcome?.found);

  // 별자리 칩: 누르면 강조, 다시 누르면 끈다. 풀이 표시를 꺼 두었으면 다시 켠다
  const toggleHighlight = (label: string) => {
    setShowSolution(true);
    setHighlight((h) => (h === label ? null : label));
  };

  const chipClass = (label: string) =>
    cn(
      "badge badge-outline cursor-pointer border-yellow-300/50 text-yellow-200",
      highlight === label && "border-yellow-300 bg-yellow-300/25",
    );

  return (
    <div className="flex w-full max-w-[1400px] flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-col gap-2 lg:flex-1">
        <div className="rounded-box relative overflow-hidden bg-black">
          <canvas
            className="mx-auto block max-w-full lg:max-h-[calc(100dvh-9rem)]"
            ref={canvasElement}
            width={image.width}
            height={image.height}
            style={{ aspectRatio: image.width / image.height }}
          />
          {!busy && skyStars.length + skyConstellations.length > 0 && (
            <button
              className="btn btn-sm absolute top-2 right-2 border-white/20 bg-black/60 text-white backdrop-blur hover:bg-black/80"
              aria-pressed={!showSolution}
              onClick={() => setShowSolution((v) => !v)}
            >
              {showSolution ? "원본 사진 보기" : "풀이 결과 보기"}
            </button>
          )}
          {busy && !error && !detectError && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10">
              <SolveProgress
                detecting={detecting}
                ready={ready}
                phase={phase}
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs opacity-70">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="toggle toggle-xs"
              checked={showRegions}
              onChange={(e) => setShowRegions(e.target.checked)}
            />
            별자리 구역 경계
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="toggle toggle-xs"
              checked={showMilkyWay}
              onChange={(e) => setShowMilkyWay(e.target.checked)}
            />
            은하수
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="toggle toggle-xs"
              checked={showDetected}
              onChange={(e) => setShowDetected(e.target.checked)}
            />
            컴퓨터가 찾은 별 표시 ({photoStars.length}개)
          </label>
          {compass ? (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="toggle toggle-xs"
                checked={showCompass}
                onChange={(e) => setShowCompass(e.target.checked)}
              />
              방위 (동서남북)
            </label>
          ) : (
            confident && (
              <span>
                지평선을 찍거나 촬영 시각·장소를 알려 주면{" "}
                <BasicsTerm slug="sky-coords">방위</BasicsTerm>를 표시해요
              </span>
            )
          )}
          {compass && <BasicsTerm slug="sky-coords">방위·고도란?</BasicsTerm>}
        </div>
      </div>

      <aside className="flex w-full flex-col gap-3 lg:w-96 lg:shrink-0">
        <div className="bg-base-200/90 rounded-box flex flex-col gap-3 p-4 backdrop-blur">
          {error || detectError ? (
            <>
              <div className="text-error text-lg font-bold">
                문제가 생겼어요
              </div>
              <div className="text-sm opacity-70">{error ?? detectError}</div>
              <button className="btn btn-sm self-start" onClick={runSolve}>
                다시 시도
              </button>
            </>
          ) : busy ? (
            <>
              <div className="text-lg font-bold">찾는 중…</div>
              <p className="text-sm opacity-70">
                사진 속 밝은 별들이 이루는 모양을 별 지도의 모양과 맞춰 보고
                있어요. 보통 몇 초면 끝나요.
              </p>
            </>
          ) : confident ? (
            <>
              <div className="fx-pop text-success text-2xl font-black">
                ✨ 찾았어요!
              </div>
              {skyRegions.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <div className="text-xs opacity-60">
                    사진에 담긴 별자리 구역
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {skyRegions
                      .filter((r) => r.share >= 0.01)
                      .slice(0, 8)
                      .map((r) => (
                        <button
                          key={r.label}
                          className={chipClass(r.label)}
                          aria-pressed={highlight === r.label}
                          onClick={() => toggleHighlight(r.label)}
                        >
                          {r.label}{" "}
                          <span className="opacity-60">
                            {Math.round(r.share * 100)}%
                          </span>
                        </button>
                      ))}
                  </div>
                  <div className="text-xs opacity-50">
                    누르면 사진과 별자리표에서 그 별자리를 강조해요
                  </div>
                </div>
              ) : (
                visibleConstellations.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {visibleConstellations.slice(0, 8).map((name) => (
                      <button
                        key={name}
                        className={chipClass(name)}
                        aria-pressed={highlight === name}
                        onClick={() => toggleHighlight(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )
              )}
              <div className="text-sm opacity-70">
                {fisheyeCamera
                  ? "초광각(어안) 렌즈 왜곡까지 풀었어요."
                  : horizonTP
                    ? `촬영 시각·장소와 지평선으로 풀었어요. ${horizonRun.message ?? ""}`
                    : `맞는 별 ${candidates[selected]?.inlierCount}개 · 화각 약 ${candidates[selected]?.fovDeg.toFixed(0)}° · ${((outcome?.timeMs ?? 0) / 1000).toFixed(1)}초`}
              </div>
              {!horizonTP && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                  {photoInfo({
                    fovDeg: candidates[selected]?.fovDeg ?? null,
                    fisheye: Boolean(fisheyeCamera),
                    trailAngleDeg:
                      selected === 0 ? outcome?.trailAngleDeg : undefined,
                  }).map((item) => (
                    <Fragment key={item.label}>
                      <dt className="opacity-60">{item.label}</dt>
                      <dd>{item.value}</dd>
                    </Fragment>
                  ))}
                </dl>
              )}
              {selectedTransform && (
                <MiniSkyMap
                  transform={selectedTransform}
                  width={image.width}
                  height={image.height}
                  photoStars={photoStars}
                  highlight={highlight}
                />
              )}
            </>
          ) : failed && candidates.length > 0 ? (
            <>
              <div className="text-warning text-lg font-bold">
                확신하지 못했어요
              </div>
              <p className="text-sm opacity-70">
                가장 그럴듯한 답을 그렸어요. 별자리 선이 사진의 별과 맞는지 봐
                주세요. 아니라면 별을 고쳐서 다시 찾아 보세요.
                {outcome?.timedOut && " (시간 안에 다 찾아보지 못했어요)"}
              </p>
            </>
          ) : (
            <>
              <div className="text-lg font-bold">별자리를 찾지 못했어요</div>
              <p className="text-sm opacity-70">
                나무·건물 불빛이 별로 잡혔거나, 별이 너무 적은 사진일 수 있어요.
                별을 고치거나, 촬영 시각·장소로 풀어 보세요.
              </p>
            </>
          )}
          {answer && !busy && (
            <KnownAnswerNote answer={answer} found={confident} />
          )}
          {credit && <SampleCreditLine credit={credit} />}
          <div className="flex flex-wrap gap-2">
            <button
              className={cn("btn btn-sm", failed && "btn-primary")}
              disabled={busy}
              onClick={() => goTo("edit")}
            >
              ✎ 별 고치기
            </button>
            <button
              className={cn(
                "btn btn-sm",
                confident ? "btn-primary" : "btn-ghost",
              )}
              onClick={() => goTo("select")}
            >
              다른 사진으로
            </button>
          </div>
        </div>

        {!busy && candidates.length > 1 && !fisheyeCamera && !horizonTP && (
          <Section
            title={`다른 후보 ${candidates.length}개`}
            summary="신뢰도가 높은 순서예요"
            defaultOpen={!outcome?.found}
          >
            <CandidateList
              candidates={candidates}
              selected={selected}
              answer={answer}
              width={image.width}
              height={image.height}
              onSelect={setSelected}
            />
          </Section>
        )}

        <Section
          title="촬영 시각·장소"
          summary={
            shot
              ? `${shot.local.replace("T", " ")} · ${shot.note ?? "직접 입력"}`
              : "모름 · 넣으면 해·달·행성도 그려요"
          }
        >
          <ShotTimeControl shot={shot} onChange={setShot} />
        </Section>

        {!busy && !fisheyeCamera && (
          <Section
            title="별이 적은 사진이라면"
            summary={
              blindSolved
                ? "별만으로 이미 풀렸어요"
                : "촬영 시각·장소와 지평선으로 풀기"
            }
            defaultOpen={failed}
          >
            {blindSolved ? (
              // 이미 확신한 사진에 돌리면 오히려 "확신하지 못했어요"가 나와 헷갈린다
              <p className="opacity-70">
                별만으로 이미 풀렸어요. 이 방법은 별이 적어 자동으로 못 푼
                사진에 써요.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="opacity-70">
                  언제 어디서 찍었는지 알면, 지평선만으로 하늘의 방향이 거의
                  정해져서 별이 열 개 남짓이어도 풀 수 있어요.
                </p>
                <ul className="flex flex-col gap-1">
                  <li>
                    {shot?.observer ? "✓" : "○"} 촬영 시각·장소{" "}
                    {!shot?.observer && (
                      <span className="opacity-60">(위에서 위도·경도까지)</span>
                    )}
                  </li>
                  <li className="flex items-center gap-2">
                    {marks.horizon.length === 2 ? "✓" : "○"} 지평선{" "}
                    <span className="opacity-60">
                      {marks.horizon.length === 2
                        ? marks.horizonAuto
                          ? "(자동으로 찾음)"
                          : "(직접 찍음)"
                        : "(아직 없음)"}
                    </span>
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={() => goTo("edit", "horizon")}
                    >
                      {marks.horizon.length === 2 ? "고치기" : "찍기"}
                    </button>
                  </li>
                </ul>
                <button
                  className="btn btn-sm btn-primary self-start"
                  disabled={
                    !shot?.observer ||
                    marks.horizon.length < 2 ||
                    horizonRun.running
                  }
                  onClick={runHorizonSolve}
                >
                  {horizonRun.running ? "푸는 중…" : "시각·장소로 풀기"}
                </button>
                {horizonRun.message && !horizonTP && (
                  <p className="text-xs">{horizonRun.message}</p>
                )}
              </div>
            )}
          </Section>
        )}

        {confident && where && (
          <Section
            title="어디서 찍었을까?"
            summary={whereSummary(where)}
            defaultOpen
          >
            <WhereShotCard
              where={where}
              recordNote={shot?.note}
              onPickHorizon={() => goTo("edit", "horizon")}
            />
          </Section>
        )}

        {selectedTransform && !busy && (
          <Section
            title="언제 찍었을까?"
            summary="지평선으로 촬영 시각 거꾸로 찾기"
          >
            <ShotTimeEstimator
              transform={selectedTransform}
              width={image.width}
              shot={shot}
              marks={marks}
              onApply={setShot}
              onPickHorizon={() => goTo("edit", "horizon")}
            />
          </Section>
        )}
      </aside>
    </div>
  );
}

const NO_HORIZON_RUN = { running: false, result: null, message: null };

// 풀이 결과를 끈 사진: 찾은 별 표시만 남기고 나머지는 그리지 않는다
const NO_SOLUTION_LAYERS = {
  skyStars: [],
  skyConstellations: [],
  skyObjects: [],
  boundaries: [],
  milkyWay: [],
  milkyWayLabel: null,
  regions: [],
  horizon: [],
  compass: [],
  highlight: null,
};

// 강조할 구역이 사진에서 차지하는 칸들. 사진을 긴 변 64칸으로 나눠 칸 가운데가 그 구역인지 본다
const HIGHLIGHT_GRID = 64;

interface HighlightArea {
  step: number;
  cells: Point2D[]; // 칸 왼쪽 위
}

const regionCells = (
  T: Mat3,
  width: number,
  height: number,
  label: string,
): HighlightArea => {
  const step = Math.max(width, height) / HIGHLIGHT_GRID;
  const cells: Point2D[] = [];

  for (let x = 0; x < width; x += step) {
    for (let y = 0; y < height; y += step) {
      if (
        constellationAt(photoToSky(T, [x + step / 2, y + step / 2])) === label
      ) {
        cells.push([x, y]);
      }
    }
  }

  return { step, cells };
};

// 접었다 펼 수 있는 곁 패널 칸
function Section({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="bg-base-200/70 rounded-box group text-sm backdrop-blur"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3">
        <span className="font-bold">{title}</span>
        <span className="min-w-0 flex-1 truncate text-xs opacity-60">
          {summary}
        </span>
        <span className="opacity-60 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

// 천체 종류별 표시 색 (별은 보라, 별자리선은 노랑)
const OBJECT_COLORS = {
  deepSky: "oklch(0.789 0.154 211.53)",
  moon: "oklch(0.97 0 0)",
  sun: "oklch(0.852 0.199 91.936)",
  planet: "oklch(0.75 0.183 55.934)",
};

type Overlay = ReturnType<typeof useSkyOverlay>;

// 찾은 별·별자리·천체를 사진 위에 그린다
const drawOverlay = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  layers: {
    photoStars: { x: number; y: number }[];
    skyStars: Overlay["stars"];
    skyConstellations: Overlay["constellations"];
    skyObjects: Overlay["objects"];
    boundaries: Overlay["boundaries"];
    milkyWay: Overlay["milkyWay"];
    milkyWayLabel: Overlay["milkyWayLabel"];
    regions: Overlay["regions"];
    horizon: [number, number][];
    compass: CompassMark[];
    highlight: { label: string; area: HighlightArea | null } | null;
  },
) => {
  // 사진 크기와 무관하게 비슷한 크기로 보이도록 표시 크기를 대각선 길이에 맞춘다
  const unit = Math.hypot(image.width, image.height) / 1400;
  const fontPx = Math.round(18 * unit);
  // 밝은 빛 위에서도 글자가 보이도록 어두운 테두리를 먼저 그린다
  const SHADOW = "oklch(0 0 0 / 0.75)";

  const label = (text: string, x: number, y: number, color: string) => {
    context.font = `bold ${fontPx}px Pretendard Variable, sans-serif`;
    context.strokeStyle = SHADOW;
    context.lineWidth = 4 * unit;
    context.strokeText(text, x, y);
    context.fillStyle = color;
    context.fillText(text, x, y);
  };

  layers.photoStars.forEach(({ x, y }) => {
    context.beginPath();
    context.arc(x, y, 5 * unit, 0, 2 * Math.PI);
    context.strokeStyle = "oklch(0.704 0.191 22.216)";
    context.lineWidth = 2 * unit;
    context.stroke();
  });

  // 강조한 구역: 칸들을 한 경로로 모아 한 번에 칠한다 (겹친 칸이 더 진해지지 않게)
  const highlighted = layers.highlight?.label ?? null;
  const area = layers.highlight?.area;

  if (area) {
    const path = new Path2D();

    for (const [x, y] of area.cells) {
      path.rect(x, y, area.step + 1, area.step + 1);
    }

    context.fillStyle = "oklch(0.905 0.182 98.111 / 0.16)";
    context.fill(path);
  }

  // 은하수: 띠 가장자리(은위 ±10°)는 옅은 실선, 가운데선(은위 0°)은 더 옅게. 별자리선을 가리지 않도록 먼저 그린다
  for (const { latitude, points } of layers.milkyWay) {
    context.strokeStyle =
      latitude === 0
        ? "oklch(0.92 0.03 250 / 0.22)"
        : "oklch(0.92 0.03 250 / 0.4)";
    context.lineWidth = (latitude === 0 ? 1 : 1.5) * unit;
    context.setLineDash(latitude === 0 ? [2 * unit, 6 * unit] : []);
    context.beginPath();
    let drawing = false;

    for (const p of points) {
      if (!p) {
        drawing = false;
        continue;
      }

      if (drawing) context.lineTo(p[0], p[1]);
      else context.moveTo(p[0], p[1]);

      drawing = true;
    }

    context.stroke();
  }

  context.setLineDash([]);

  if (layers.milkyWayLabel) {
    label(
      "은하수",
      layers.milkyWayLabel[0] + 8 * unit,
      layers.milkyWayLabel[1] - 8 * unit,
      "oklch(0.92 0.03 250 / 0.85)",
    );
  }

  // 별자리 구역 경계 (점선)와 구역 이름
  const REGION_COLOR = "oklch(0.8 0.09 230 / 0.55)";
  context.setLineDash([6 * unit, 5 * unit]);
  context.strokeStyle = REGION_COLOR;
  context.lineWidth = 1.2 * unit;

  for (const ring of layers.boundaries) {
    context.beginPath();
    let drawing = false;

    for (const p of ring) {
      if (!p) {
        drawing = false;
        continue;
      }

      if (drawing) context.lineTo(p[0], p[1]);
      else context.moveTo(p[0], p[1]);

      drawing = true;
    }

    context.stroke();
  }

  context.setLineDash([]);

  // 구역 이름을 쓰면 별자리선 이름은 쓰지 않는다 (같은 이름이 두 번 나오지 않게)
  const regionLabels = layers.regions.length > 0;

  for (const r of layers.regions) {
    if (r.share < 0.04) continue;

    label(
      r.label,
      r.x,
      r.y,
      r.label === highlighted
        ? "oklch(0.905 0.182 98.111)"
        : "oklch(0.85 0.08 230)",
    );
  }

  // 강조한 별자리가 있으면 그 선만 굵고 진하게, 나머지는 흐리게
  layers.skyConstellations.forEach(({ label: name, lines }) => {
    const on = name === highlighted;
    context.strokeStyle = highlighted
      ? on
        ? "oklch(0.905 0.182 98.111)"
        : "oklch(0.905 0.182 98.111 / 0.35)"
      : "oklch(0.905 0.182 98.111 / 0.85)";
    context.lineWidth = (on ? 3.5 : 1.5) * unit;

    for (let i = 0; i < lines.length - 1; i++) {
      const a = lines[i];
      const b = lines[i + 1];

      // 한쪽 정점이라도 뒤쪽 반구/먼 영역(null)이면 그 선분은 그리지 않는다
      if (!a || !b) {
        continue;
      }

      context.beginPath();
      context.moveTo(a[0], a[1]);
      context.lineTo(b[0], b[1]);
      context.stroke();
    }
  });

  // 별자리 이름: 선 묶음이 여럿인 별자리(처녀자리 등)도 이름은 한 번, 사진 안 꼭짓점들의 가운데에
  if (!regionLabels) {
    const byName = new Map<string, [number, number][]>();

    for (const { label: name, lines } of layers.skyConstellations) {
      const visible = lines.filter(
        (l): l is [number, number] =>
          l !== null &&
          l[0] >= 0 &&
          l[0] < image.width &&
          l[1] >= 0 &&
          l[1] < image.height,
      );
      byName.set(name, [...(byName.get(name) ?? []), ...visible]);
    }

    for (const [name, pts] of byName) {
      if (pts.length === 0) continue;

      const cx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
      const cy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
      label(name, cx, cy, "oklch(0.905 0.182 98.111)");
    }
  }

  layers.skyStars.forEach(({ name, x, y }) => {
    context.beginPath();
    context.arc(x, y, (name ? 10 : 6) * unit, 0, 2 * Math.PI);
    context.strokeStyle = "oklch(.75 .17 292.717)";
    context.lineWidth = (name ? 2.5 : 1.2) * unit;
    context.stroke();

    if (name) {
      label(name, x + 14 * unit, y + 6 * unit, "oklch(.82 .12 292.717)");
    }
  });

  layers.skyObjects.forEach(({ name, kind, x, y, radiusPx }) => {
    const color = OBJECT_COLORS[kind];
    const r = Math.max(radiusPx, 12 * unit);

    context.setLineDash(kind === "deepSky" ? [6 * unit, 4 * unit] : []);

    for (const [style, width] of [
      [SHADOW, 5 * unit],
      [color, 2 * unit],
    ] as const) {
      context.strokeStyle = style;
      context.lineWidth = width;
      context.beginPath();
      context.arc(x, y, r, 0, 2 * Math.PI);
      context.stroke();
    }

    context.setLineDash([]);
    label(name, x + r * 0.75 + 4 * unit, y - r * 0.75, color);
  });

  if (layers.horizon.length === 2) {
    context.strokeStyle = "oklch(0.792 0.209 151.711)";
    context.lineWidth = 3 * unit;
    context.beginPath();
    context.moveTo(...layers.horizon[0]);
    context.lineTo(...layers.horizon[1]);
    context.stroke();
  }

  // 방위: 지평선 위면 짧은 눈금 위에, 아니면 그 자리(사진 가장자리 쪽)에 이름만
  const COMPASS_COLOR = "oklch(0.9 0.13 160)";
  context.textAlign = "center";

  for (const m of layers.compass) {
    const size = Math.round(fontPx * (m.cardinal ? 1.4 : 1));
    context.font = `bold ${size}px Pretendard Variable, sans-serif`;

    if (m.onHorizon) {
      context.strokeStyle = COMPASS_COLOR;
      context.lineWidth = 2.5 * unit;
      context.beginPath();
      context.moveTo(m.x, m.y);
      context.lineTo(m.x, m.y - 10 * unit);
      context.stroke();
    }

    const y = m.onHorizon ? m.y - 16 * unit : m.y + size * 0.35;
    context.strokeStyle = SHADOW;
    context.lineWidth = 4 * unit;
    context.strokeText(m.label, m.x, y);
    context.fillStyle = COMPASS_COLOR;
    context.fillText(m.label, m.x, y);
  }

  context.textAlign = "start";
};

// 풀이 진행 단계를 사람이 읽는 문장으로
const describePhase = (
  detecting: boolean,
  ready: boolean,
  phase: SolvePhase | null,
): string => {
  if (detecting) {
    return "사진에서 별을 찾고 있어요";
  }

  if (!ready) {
    return "별 지도를 펼치고 있어요";
  }

  if (!phase) {
    return "별자리를 맞춰 보기 시작해요";
  }

  if (phase.kind === "fisheye") {
    return "초광각 렌즈 사진으로 보고 다시 찾고 있어요";
  }

  const where = phase.region === "사진 전체" ? "" : ` (${phase.region})`;

  return `밝은 별 ${phase.inputSize}개의 모양을 맞춰 보는 중${where}`;
};

// 풀이가 진행 중임을 사진 아래쪽에 보여 준다. 몇 초 걸릴 수 있어 경과 시간을 함께 보여 준다.
function SolveProgress({
  detecting,
  ready,
  phase,
}: {
  detecting: boolean;
  ready: boolean;
  phase: SolvePhase | null;
}) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(
      () => setElapsedSec((Date.now() - startedAt) / 1000),
      200,
    );

    return () => clearInterval(timer);
  }, []);

  // 별 찾기 10%, 직선투영 단계는 입력 크기 순서로, 어안 시도는 마지막 단계로 본다
  const progress = detecting
    ? 0.05
    : !phase
      ? 0.1
      : phase.kind === "fisheye"
        ? 0.95
        : 0.1 + (0.85 * (phase.index + 0.5)) / (phase.total + 1);

  return (
    <div className="flex flex-col gap-2 text-white">
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm" />
        <span className="font-bold">
          {describePhase(detecting, ready, phase)}
        </span>
        <span className="ml-auto text-xs opacity-70">
          {elapsedSec.toFixed(1)}초
        </span>
      </div>
      <progress
        className="progress progress-primary w-full"
        value={progress}
        max={1}
      />
    </div>
  );
}

function CandidateList({
  candidates,
  selected,
  answer,
  width,
  height,
  onSelect,
}: {
  candidates: SolveCandidateResult[];
  selected: number;
  answer: SampleAnswer | null;
  width: number;
  height: number;
  onSelect: (index: number) => void;
}) {
  // 후보마다 사진 가운데가 놓인 별자리 구역 ("○○자리 주변")
  const regions = useMemo(
    () =>
      candidates.map((c) =>
        constellationAt(photoToSky(c.transform, [width / 2, height / 2])),
      ),
    [candidates, width, height],
  );

  return (
    <ul
      className="flex max-h-64 flex-col gap-1 overflow-y-auto"
      title={`신뢰도 N은 우연히 이만큼 맞을 확률이 10^-N이라는 뜻이에요. ${ACCEPT.minLogOdds} 이상이면 확신해요.`}
    >
      {candidates.map((c, i) => {
        // 검증된 정답(approximate 아님)일 때만 후보에 ✓를 단다
        const isAnswer =
          answer && !answer.approximate
            ? matchesAnswer(c.centerVector, answer)
            : false;

        return (
          <li key={`candidate-${i}`}>
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1 text-left",
                selected === i
                  ? "bg-primary/25 font-bold"
                  : "hover:bg-base-300/60",
              )}
              onClick={() => onSelect(i)}
            >
              <span className="w-5 opacity-60">{i + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                {regions[i] && (
                  <span className="truncate">{regions[i]} 주변</span>
                )}
                <span className="text-xs font-normal opacity-70">
                  맞는 별 {c.inlierCount}개 · 화각 {c.fovDeg.toFixed(0)}°
                </span>
              </span>
              <span className="text-xs opacity-60">
                신뢰도 {c.confidence.toFixed(0)}
              </span>
              {isAnswer && (
                <span className="badge badge-success badge-xs">정답</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// 이 샘플의 알려진 정답(검증된 ground truth)을 안내한다
function KnownAnswerNote({
  answer,
  found,
}: {
  answer: SampleAnswer;
  found: boolean;
}) {
  return (
    <div
      className={cn(
        "text-xs",
        answer.approximate
          ? "text-warning/80"
          : found
            ? "text-success/80"
            : "text-info/80",
      )}
    >
      {answer.approximate ? "샘플의 예상 영역(대략): " : "샘플의 알려진 정답: "}
      {answer.name} · 시야 약 {answer.fovDeg.toFixed(0)}°
    </div>
  );
}
