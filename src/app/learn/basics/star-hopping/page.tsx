import BasicsArticle from "@/learn/basics/BasicsArticle";
import { REFERENCE_PAIRS } from "@/learn/basics/references";
import { moonAngularDiameterDeg } from "@/learn/basics/skyMath";
import StarHopDemo from "@/learn/basics/StarHopDemo";
import { basicsMetadata } from "@/learn/basics/topics";
import { Figure, LearnSection } from "@/learn/LearnArticle";
import { Callout, DataTable } from "@/learn/parts";

export const metadata = basicsMetadata("star-hopping");

// 2026년 한 해 동안 달 지름의 범위 (하루 간격)
const moonSizes = Array.from({ length: 365 }, (_, d) =>
  moonAngularDiameterDeg(new Date(Date.UTC(2026, 0, 1 + d))),
);
const MOON_MIN = Math.min(...moonSizes);
const MOON_MAX = Math.max(...moonSizes);

const HANDS = [
  { icon: "🤙", what: "새끼손가락 굵기", deg: "약 1°" },
  { icon: "🤟", what: "손가락 세 개 (검지·중지·약지)", deg: "약 5°" },
  { icon: "✊", what: "주먹 폭 (엄지 빼고)", deg: "약 10°" },
  { icon: "🤘", what: "검지와 새끼손가락을 벌린 폭", deg: "약 15°" },
  { icon: "🖐", what: "엄지와 새끼손가락을 활짝 벌린 한 뼘", deg: "약 20~25°" },
];

export default function Page() {
  return (
    <BasicsArticle
      slug="star-hopping"
      lead="하늘의 거리는 km가 아니라 각도로 재요. 팔을 쭉 뻗은 손이 훌륭한 각도기예요. 그 손으로 아는 별에서 몇 걸음 건너뛰면 처음 보는 별도 찾을 수 있어요."
    >
      <LearnSection title="팔 뻗은 손으로 각도 재기">
        <Figure caption="팔 길이 약 60cm, 주먹 폭 약 10cm라면 눈에서 본 주먹의 폭은 약 10°예요. 손이 큰 사람은 대개 팔도 길어서, 사람마다 값이 크게 다르지 않아요.">
          <svg
            viewBox="0 0 320 120"
            className="rounded-box w-full bg-[#0b0f22]"
            role="img"
            aria-label="눈에서 팔 뻗은 주먹까지의 각도"
          >
            <circle cx="30" cy="60" r="7" fill="white" opacity="0.85" />
            <text
              x="30"
              y="85"
              fontSize="10"
              fill="white"
              opacity="0.7"
              textAnchor="middle"
            >
              눈
            </text>
            <line
              x1="30"
              y1="60"
              x2="270"
              y2="31"
              stroke="#fde68a"
              strokeWidth="1.5"
            />
            <line
              x1="30"
              y1="60"
              x2="270"
              y2="89"
              stroke="#fde68a"
              strokeWidth="1.5"
            />
            <path
              d="M 80 54 A 50 50 0 0 1 80 66"
              fill="none"
              stroke="white"
              strokeOpacity="0.8"
            />
            <text x="90" y="64" fontSize="11" fill="white">
              약 10°
            </text>
            <rect
              x="262"
              y="31"
              width="22"
              height="58"
              rx="8"
              fill="#f2c9a0"
              opacity="0.9"
            />
            <text
              x="273"
              y="104"
              fontSize="10"
              fill="white"
              opacity="0.7"
              textAnchor="middle"
            >
              주먹 약 10cm
            </text>
            <line
              x1="30"
              y1="22"
              x2="262"
              y2="22"
              stroke="white"
              strokeOpacity="0.4"
              strokeDasharray="3 3"
            />
            <text
              x="146"
              y="16"
              fontSize="10"
              fill="white"
              opacity="0.7"
              textAnchor="middle"
            >
              팔 길이 약 60cm
            </text>
          </svg>
        </Figure>
        <ul className="grid gap-2 sm:grid-cols-2">
          {HANDS.map((h) => (
            <li
              key={h.what}
              className="bg-base-200/70 rounded-box flex items-center gap-3 p-3"
            >
              <span className="text-2xl">{h.icon}</span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm">{h.what}</span>
                <span className="font-black text-amber-200">{h.deg}</span>
              </span>
            </li>
          ))}
        </ul>
        <p>
          대략의 값이라 사람마다 조금씩 달라요. 아래 기준 쌍에 내 손을 대 보고
          &ldquo;내 주먹은 9°쯤&rdquo;처럼 맞춰 두면 훨씬 정확해져요. 숫자는 이
          사이트의 별 지도로 계산했어요.
        </p>
        <DataTable
          head={["기준", "각거리"]}
          rows={[
            ...REFERENCE_PAIRS.map((p) => [p.label, `${p.deg.toFixed(1)}°`]),
            [
              "보름달 지름 (2026년 한 해 동안)",
              `${MOON_MIN.toFixed(2)}~${MOON_MAX.toFixed(2)}°`,
            ],
          ]}
        />
        <Callout kind="found" title="달은 새끼손가락 뒤에 숨어요">
          <p>
            지평선 가까이 뜬 보름달은 유난히 커 보이지만, 팔 뻗은 새끼손가락(약
            1°)으로 가려 보면 언제나 그 절반쯤이에요. 커 보이는 건 눈과 뇌의
            착시예요.
          </p>
        </Callout>
      </LearnSection>

      <LearnSection title="별 건너뛰기 (스타 호핑)">
        <p>
          처음 보는 별을 찾을 때는 아는 별에서 출발해요. &ldquo;이 두 별을 이은
          방향으로, 그 거리의 다섯 배&rdquo;처럼 방향과 거리(손 각도)로 한
          걸음씩 건너가는 방법을 <b>스타 호핑</b>이라고 해요. 망원경으로 희미한
          은하를 찾을 때도 이렇게 해요.
        </p>
        <Figure caption="길을 골라 보세요. 노란 화살표가 건너가는 길이고, 아래에 걸음마다의 각도를 적었어요.">
          <StarHopDemo />
        </Figure>
        <p>
          처음에는 북두칠성·오리온·카시오페이아처럼 모양이 뚜렷한 별자리 몇 개만
          익혀 두면 돼요. 나머지는 거기서 건너뛰며 하나씩 늘려 가요.
        </p>
      </LearnSection>
    </BasicsArticle>
  );
}
