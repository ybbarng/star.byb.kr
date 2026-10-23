import BasicsArticle from "@/learn/basics/BasicsArticle";
import MagnitudeCompare from "@/learn/basics/MagnitudeCompare";
import { MAGNITUDE_LADDER, NEAR_BRIGHT_STARS } from "@/learn/basics/references";
import {
  airmass,
  brightnessRatio,
  EXTINCTION_MAG_PER_AIRMASS,
  extinctionMag,
} from "@/learn/basics/skyMath";
import { basicsMetadata } from "@/learn/basics/topics";
import { Figure, LearnSection, Stat } from "@/learn/LearnArticle";
import { BarChart, Callout, DataTable } from "@/learn/parts";

export const metadata = basicsMetadata("brightness-distance");

const ALTITUDES = [90, 45, 30, 20, 10, 5];

export default function Page() {
  return (
    <BasicsArticle
      slug="brightness-distance"
      lead="별의 밝기는 '등급'이라는 거꾸로 된 눈금으로 말해요. 숫자가 작을수록 밝고, 5등급 차이가 정확히 100배예요. 그런데 보이는 밝기는 별의 진짜 밝기와 거리, 그리고 우리 머리 위 공기가 함께 정해요."
    >
      <div className="grid grid-cols-2 gap-3">
        <Stat value="5등급 = 100배" label="등급 눈금의 정의" />
        <Stat
          value={`1등급 ≈ ${brightnessRatio(1).toFixed(3)}배`}
          label="100의 5제곱근"
        />
      </div>

      <LearnSection title="등급: 2천 년 된 눈금">
        <p>
          고대 그리스의 히파르코스는 맨눈에 가장 밝은 별을 1등성, 겨우 보이는
          별을 6등성으로 나눴어요. 19세기에 이 눈금을 &ldquo;5등급 차이 = 밝기
          100배&rdquo;로 정확히 정하면서, 1등성보다 밝은 별은 0등급, 더 밝으면
          음수가 됐어요. 가장 밝은 별 시리우스는 −1.46등급이에요.
        </p>
        <Figure caption="두 별을 골라 비교해 보세요. 등급은 별 지도(BSC5)의 V등급이에요.">
          <MagnitudeCompare stars={MAGNITUDE_LADDER} />
        </Figure>
        <p>
          눈은 빛의 양을 곱셈으로 느껴서, 2배·4배·8배가 같은 간격으로 밝아지는
          것처럼 보여요. 등급이 덧셈 눈금인 이유예요. 플레이트 솔버의 별 지도는
          5등급까지의 별 1,624개를 담아요. 도시 사진에 찍히는 별은 대개 그보다
          훨씬 밝은 별뿐이라, 사진에서도 밝은 별부터 짝을 찾아요.
        </p>
      </LearnSection>

      <LearnSection title="지평선 가까운 별은 어두워져요 (대기 소광)">
        <p>
          별빛은 공기를 지나며 일부가 흩어지고 흡수돼요. 머리 위의 별은 공기층을
          가장 짧게 지나고, 지평선 쪽 별은 몇 배나 길게 지나요. 맑은 날 맨눈
          기준으로 공기층 하나에 약 {EXTINCTION_MAG_PER_AIRMASS}등급
          어두워진다고 두고 계산하면 이래요 (공기의 맑기에 따라 0.15~0.4쯤
          달라져요).
        </p>
        <Figure caption="고도별로 어두워지는 양 (등급). 공기층 두께는 머리 위를 1로 잰 값이에요.">
          <BarChart
            items={ALTITUDES.map((alt) => ({
              label: `고도 ${alt}°`,
              value: extinctionMag(alt),
              note: `공기층 ${airmass(alt).toFixed(1)}배`,
              highlight: alt === 10,
            }))}
            format={(v) => `${v.toFixed(2)}등급`}
          />
        </Figure>
        <p>
          고도 10°의 별은 머리 위에 있을 때보다 1등급 남짓(약 3배) 더 어두워
          보여요. 지평선 가까이 뜬 별과 달이 붉게 보이는 것도 파란빛이 더 많이
          흩어지기 때문이에요.
        </p>
      </LearnSection>

      <LearnSection title="거리는 연주 시차로">
        <p>
          지구는 1년에 한 번 해 둘레를 돌아요. 반년 사이에 지구 궤도의
          반대편으로 옮겨 가면, 가까운 별은 먼 별들을 배경으로 아주 조금 자리를
          옮겨요. 손가락을 눈앞에 두고 왼눈·오른눈을 번갈아 감으면 손가락이
          움직이는 것과 같아요. 이 각도의 절반이 <b>연주 시차</b>예요.
        </p>
        <Figure caption="지구 궤도 반지름(1천문단위)이 별에서 보이는 각도가 연주 시차예요. 실제 각도는 그림보다 수십만 배 작아요.">
          <svg
            viewBox="0 0 320 130"
            className="rounded-box w-full bg-[#0b0f22]"
            role="img"
            aria-label="연주 시차 그림"
          >
            <ellipse
              cx="60"
              cy="65"
              rx="22"
              ry="48"
              fill="none"
              stroke="white"
              strokeOpacity="0.3"
            />
            <circle cx="60" cy="65" r="6" fill="#fbbf24" />
            <circle cx="60" cy="17" r="4" fill="#60a5fa" />
            <circle cx="60" cy="113" r="4" fill="#60a5fa" />
            <text x="70" y="14" fontSize="9" fill="white" opacity="0.7">
              1월
            </text>
            <text x="70" y="124" fontSize="9" fill="white" opacity="0.7">
              7월
            </text>
            <circle cx="250" cy="65" r="3.5" fill="white" />
            <text x="250" y="56" fontSize="9" fill="white" textAnchor="middle">
              가까운 별
            </text>
            <line
              x1="60"
              y1="17"
              x2="250"
              y2="65"
              stroke="#fde68a"
              strokeOpacity="0.8"
            />
            <line
              x1="60"
              y1="113"
              x2="250"
              y2="65"
              stroke="#fde68a"
              strokeOpacity="0.8"
            />
            <line
              x1="60"
              y1="65"
              x2="250"
              y2="65"
              stroke="white"
              strokeOpacity="0.3"
              strokeDasharray="3 3"
            />
            <path
              d="M 222 58 A 30 30 0 0 1 222 65"
              fill="none"
              stroke="white"
            />
            <text x="205" y="80" fontSize="9" fill="#fde68a" textAnchor="end">
              시차 p
            </text>
            <text
              x="314"
              y="20"
              fontSize="9"
              fill="white"
              opacity="0.6"
              textAnchor="end"
            >
              ★ 먼 별들(배경)
            </text>
          </svg>
        </Figure>
        <p>
          시차가 1″(각초, 1°의 3600분의 1)인 거리를 1파섹이라 하고, 1파섹은 약
          3.26광년이에요. 그래서 <b>거리(광년) = 3.26 ÷ 시차(″)</b>예요. 가장
          가까운 별인 센타우루스자리 알파의 시차도 약 0.75″라, 1838년에야
          처음으로 별의 시차를 쟀어요.
        </p>
        <DataTable
          head={["별", "등급", "시차", "거리"]}
          rows={NEAR_BRIGHT_STARS.map((s) => [
            s.name,
            s.mag.toFixed(2),
            `${s.parallaxArcsec.toFixed(3)}″`,
            `약 ${s.lightYears.toFixed(s.lightYears < 20 ? 1 : 0)}광년`,
          ])}
        />
        <Callout kind="found" title="자료 출처">
          <p>
            시차는 예일 밝은 별 목록(BSC5, 1991)에 실린 값이에요. 빛의
            타임캡슐과 오늘 밤 내 하늘도 같은 값을 써요. 최신
            위성(히파르코스·가이아) 측정과 몇 % 다를 수 있고, 시차가 작은 먼
            별은 오차가 커서 위 표에는 약 80광년(0.04″)보다 가까운 밝은 별만
            넣었어요.
          </p>
        </Callout>
      </LearnSection>

      <LearnSection title="밝아 보인다고 가까운 건 아니에요">
        <p>
          시리우스가 가장 밝아 보이는 건 진짜로 밝은 데다 8.7광년으로 아주
          가깝기 때문이에요. 반대로 오리온자리 리겔은 수백 광년 넘게 떨어져
          있는데도 0.1등급으로 보일 만큼, 진짜 밝기가 해의 수만 배예요. 보이는
          밝기(겉보기 등급)는 진짜 밝기와 거리의 제곱이 함께 정해요. 거리가
          2배면 밝기는 4분의 1이에요.
        </p>
      </LearnSection>
    </BasicsArticle>
  );
}
