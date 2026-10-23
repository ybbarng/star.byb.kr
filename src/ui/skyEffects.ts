// 사이트 배경의 움직이는 효과: 별 하나가 아주 짧게 반짝이고(밝은 별은 가는 십자 빛살이 잠깐 선다),
// 가끔 유성이 지나간다. 별 그림은 그대로 두고 위층 캔버스에만 그린다.
// 효과가 있는 동안에만 requestAnimationFrame을 돌리고, 없으면 다음 효과까지 타이머로 기다린다.

export interface EffectStar {
  x: number;
  y: number;
  r: number;
  mag: number;
  color: string; // "r,g,b"
}

interface Twinkle {
  kind: "twinkle";
  star: EffectStar;
  start: number;
  duration: number;
}

interface Meteor {
  kind: "meteor";
  x: number;
  y: number;
  dx: number; // 진행 방향 단위 벡터
  dy: number;
  distance: number; // 머리가 가는 거리(px)
  tail: number; // 꼬리 길이(px)
  start: number;
  duration: number;
}

type Effect = Twinkle | Meteor;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// 효과가 얼마나 지났는지 0~1. requestAnimationFrame의 시각은 효과를 넣은 시각보다 조금 이를 수 있어 잘라 둔다
const progress = (effect: Effect, now: number) =>
  Math.min(1, Math.max(0, (now - effect.start) / effect.duration));

// 반짝임 세기 0→1→0. 빠르게 밝아지고 조금 더 천천히 돌아온다.
// 색 문자열에 1e-7 같은 지수 표기가 들어가지 않게 소수 셋째 자리로 자른다
const flash = (t: number) =>
  Math.round(Math.pow(Math.sin(Math.PI * Math.pow(t, 0.6)), 2) * 1000) / 1000;

// 가운데서 바깥으로 흐려지는 가는 빛살 하나
const spike = (
  context: CanvasRenderingContext2D,
  star: EffectStar,
  dx: number,
  dy: number,
  length: number,
  alpha: number,
) => {
  // 길이·좌표가 0이거나 NaN·Infinity면 그라디언트를 만들 수 없으니 건너뛴다
  if (
    !(length > 0) ||
    !Number.isFinite(length) ||
    !Number.isFinite(star.x) ||
    !Number.isFinite(star.y)
  ) {
    return;
  }

  const gradient = context.createLinearGradient(
    star.x,
    star.y,
    star.x + dx * length,
    star.y + dy * length,
  );
  gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gradient.addColorStop(0.3, `rgba(${star.color},${alpha * 0.5})`);
  gradient.addColorStop(1, `rgba(${star.color},0)`);
  context.strokeStyle = gradient;
  context.beginPath();
  context.moveTo(star.x, star.y);
  context.lineTo(star.x + dx * length, star.y + dy * length);
  context.stroke();
};

const drawTwinkle = (
  context: CanvasRenderingContext2D,
  effect: Twinkle,
  now: number,
) => {
  const a = flash(progress(effect, now));
  const { star } = effect;

  // 밝은 별(약 2.5등급보다 밝은)은 십자 빛살이 잠깐 선다
  if (star.mag < 2.5) {
    const length = a * (8 + 5 * (2.5 - star.mag)) * Math.max(1, star.r);
    context.lineWidth = 0.7;
    spike(context, star, 1, 0, length, a);
    spike(context, star, -1, 0, length, a);
    spike(context, star, 0, 1, length * 1.15, a);
    spike(context, star, 0, -1, length * 1.15, a);
  }

  // 별 자체가 순간 또렷하게 밝아진다 (빛무리 없이 점만)
  context.fillStyle = `rgba(255,255,255,${0.9 * a})`;
  context.beginPath();
  context.arc(star.x, star.y, star.r * (1 + 0.5 * a) + 0.3, 0, 2 * Math.PI);
  context.fill();
};

const drawMeteor = (
  context: CanvasRenderingContext2D,
  effect: Meteor,
  now: number,
) => {
  const t = progress(effect, now);
  // 머리는 처음에 빠르고 끝으로 갈수록 조금 느려진다
  const travelled = effect.distance * (1 - Math.pow(1 - t, 1.6));
  const tail = Math.min(travelled, effect.tail);
  const headX = effect.x + effect.dx * travelled;
  const headY = effect.y + effect.dy * travelled;
  const tailX = headX - effect.dx * tail;
  const tailY = headY - effect.dy * tail;
  // 뒤 40% 동안 꼬리부터 사라진다
  const alpha = t < 0.6 ? 1 : Math.round(((1 - t) / 0.4) * 1000) / 1000;

  // 막 시작해 꼬리가 없거나 좌표가 NaN·Infinity면 이번 프레임은 건너뛴다
  if (!(tail > 0) || !Number.isFinite(headX) || !Number.isFinite(headY)) {
    return;
  }

  const gradient = context.createLinearGradient(tailX, tailY, headX, headY);
  gradient.addColorStop(0, "rgba(200,220,255,0)");
  gradient.addColorStop(1, `rgba(240,245,255,${0.85 * alpha})`);
  context.strokeStyle = gradient;
  context.lineWidth = 1.1;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(tailX, tailY);
  context.lineTo(headX, headY);
  context.stroke();

  context.fillStyle = `rgba(255,255,255,${alpha})`;
  context.beginPath();
  context.arc(headX, headY, 0.9, 0, 2 * Math.PI);
  context.fill();
};

export interface SkyEffects {
  stop: () => void;
}

// canvas는 이미 기기 픽셀 배율에 맞춰 크기·변환이 잡혀 있어야 한다 (SkyBackground의 draw가 맞춘다)
export const startSkyEffects = (
  canvas: HTMLCanvasElement,
  getStars: () => EffectStar[],
): SkyEffects => {
  const context = canvas.getContext("2d")!;
  let effects: Effect[] = [];
  let raf = 0;
  let twinkleTimer = 0;
  let meteorTimer = 0;
  let running = false;

  const clear = () => {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
  };

  const frame = (now: number) => {
    raf = 0;
    clear();
    effects = effects.filter((e) => now - e.start < e.duration);

    for (const effect of effects) {
      if (effect.kind === "twinkle") {
        drawTwinkle(context, effect, now);
      } else {
        drawMeteor(context, effect, now);
      }
    }

    if (effects.length) {
      raf = requestAnimationFrame(frame);
    }
  };

  const add = (effect: Effect) => {
    effects.push(effect);

    if (!raf) {
      raf = requestAnimationFrame(frame);
    }
  };

  // 화면 전체로 0.15~0.45초에 별 하나 (어느 순간에나 한두 개가 반짝이는 정도).
  // 대부분은 모든 별에서 고르게, 4번에 1번은 밝은 별(3등급보다 밝은)에서 골라 십자 빛살도 가끔 보이게 한다
  const scheduleTwinkle = () => {
    twinkleTimer = window.setTimeout(
      () => {
        const stars = getStars();
        const bright = stars.filter((s) => s.mag < 3);
        const pool = bright.length && Math.random() < 0.25 ? bright : stars;

        if (pool.length) {
          add({
            kind: "twinkle",
            star: pool[Math.floor(Math.random() * pool.length)],
            start: performance.now(),
            duration: rand(200, 600),
          });
        }

        scheduleTwinkle();
      },
      rand(150, 450),
    );
  };

  // 유성은 15~50초에 하나. 위쪽에서 시작해 대체로 아래로 비스듬히 떨어진다
  const scheduleMeteor = (min = 15000, max = 50000) => {
    meteorTimer = window.setTimeout(
      () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        // 화면 y는 아래로 커진다. 수평에서 27°~153° 사이로 떨어진다
        const angle = rand(0.15, 0.85) * Math.PI;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        add({
          kind: "meteor",
          x: rand(0.1, 0.9) * width,
          y: rand(0, 0.5) * height,
          dx,
          dy,
          distance: rand(220, 420),
          tail: rand(90, 170),
          start: performance.now(),
          duration: rand(600, 1000),
        });
        scheduleMeteor();
      },
      rand(min, max),
    );
  };

  const start = () => {
    if (running) {
      return;
    }

    running = true;
    scheduleTwinkle();
    scheduleMeteor(6000, 25000);
  };

  // 탭이 안 보이면 타이머·애니메이션을 모두 멈춘다
  const pause = () => {
    running = false;
    window.clearTimeout(twinkleTimer);
    window.clearTimeout(meteorTimer);
    cancelAnimationFrame(raf);
    raf = 0;
    effects = [];
    clear();
  };

  const onVisibility = () => (document.hidden ? pause() : start());

  document.addEventListener("visibilitychange", onVisibility);

  if (!document.hidden) {
    start();
  }

  return {
    stop: () => {
      pause();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
};
