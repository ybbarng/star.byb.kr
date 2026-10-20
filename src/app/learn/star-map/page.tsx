import LearnArticle, { Figure, LearnSection, Stat } from "@/learn/LearnArticle";
import { learnMetadata } from "@/learn/steps";

export const metadata = learnMetadata("star-map");

export default function Page() {
  return (
    <LearnArticle
      slug="star-map"
      lead="사진을 보기 전에, 맞춰 볼 별 지도부터 준비해요. 별의 방향을 계산하기 쉬운 꼴로 바꾸고, 별 셋·넷이 이루는 모양을 빨리 찾을 수 있게 색인을 만들어요."
    >
      <LearnSection title="어떤 별을 담을까">
        <p>
          출발점은 <b>예일 밝은 별 목록(BSC5)</b>이에요. 맨눈으로 보이는 별
          9,096개의 위치·밝기·색이 들어 있어요. 이 중{" "}
          <b>5등급까지의 별 1,625개</b>만 써요. 휴대폰이나 카메라로 찍은 밤하늘
          사진에 또렷이 남는 별이 대개 이 정도이고, 별을 늘릴수록 비슷한 모양이
          많아져 헷갈리기 쉬워요.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Stat value="9,096" label="BSC5 전체" />
          <Stat value="1,625" label="5등급까지 (사용)" />
          <Stat value="287" label="3.5등급까지 (밝은 별 색인)" />
        </div>
      </LearnSection>

      <LearnSection title="별의 위치를 화살표로">
        <p>
          별 목록은 위치를 적경·적위(하늘의 경도·위도)로 적어 둬요. 이것을 지구
          중심에서 별을 가리키는 <b>길이 1인 화살표(단위 벡터)</b>로 바꿔요.
          그러면 두 별 사이의 각도가 곱셈·덧셈 몇 번(내적)으로 나오고, 하늘
          어디서든 같은 식으로 계산할 수 있어요.
        </p>
        <Figure caption="적경 α, 적위 δ인 별은 (cos δ·cos α, cos δ·sin α, sin δ) 방향이에요. 두 별의 각도는 두 화살표의 내적으로 바로 나와요.">
          <svg viewBox="0 0 320 160" className="mx-auto w-full max-w-md">
            <circle
              cx="90"
              cy="80"
              r="62"
              fill="none"
              stroke="rgba(160,180,255,0.35)"
            />
            <ellipse
              cx="90"
              cy="80"
              rx="62"
              ry="18"
              fill="none"
              stroke="rgba(160,180,255,0.2)"
            />
            <line
              x1="90"
              y1="80"
              x2="135"
              y2="38"
              stroke="#fde68a"
              strokeWidth="2"
            />
            <line
              x1="90"
              y1="80"
              x2="148"
              y2="70"
              stroke="#a5b4fc"
              strokeWidth="2"
            />
            <circle cx="135" cy="38" r="4" fill="#fde68a" />
            <circle cx="148" cy="70" r="4" fill="#a5b4fc" />
            <path
              d="M 112 60 A 28 28 0 0 1 118 74"
              fill="none"
              stroke="white"
              strokeOpacity="0.6"
            />
            <text x="122" y="64" fontSize="10" fill="white" opacity="0.8">
              θ
            </text>
            <text x="180" y="60" fontSize="11" fill="white" opacity="0.85">
              cos θ = a · b
            </text>
            <text x="180" y="80" fontSize="10" fill="white" opacity="0.6">
              (두 화살표의 내적)
            </text>
            <text x="180" y="104" fontSize="10" fill="white" opacity="0.6">
              하늘 어디서든 같은 식
            </text>
          </svg>
        </Figure>
      </LearnSection>

      <LearnSection title="모양 색인 만들기">
        <p>
          사진에서 찾은 별 셋이 이루는 삼각형을 별 지도에서 찾으려면, 별 지도의
          삼각형을 모두 미리 모아 &ldquo;모양&rdquo;으로 줄 세워 둬야 해요.
          그래야 책의 색인처럼 비슷한 모양을 바로 찾아볼 수 있어요. 세 가지를
          만들어요.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <b>삼각형 색인 (약 113만 개)</b>: 별 하나와, 그 별에서 18° 안에 있는
            두 별로 만든 삼각형. 사진 한 장에 담기는 크기의 삼각형이에요.
          </li>
          <li>
            <b>밝은 별 삼각형 색인 (약 4.9만 개)</b>: 3.5등급까지의 밝은 별
            287개끼리, 30° 안에서 만든 삼각형. 사진에서 가장 밝은 별은 대개
            하늘에서도 밝은 별이라, 밝은 별끼리만 찾으면 헷갈리는 비슷한 모양이
            20분의 1로 줄어요.
          </li>
          <li>
            <b>사각형 색인 (82,703개)</b>: 하늘을 192칸(HEALPix)으로 나누고,
            칸마다 서로 10° 안에 있는 별 넷의 조합을 모아요. 네 별의 모양은 숫자
            네 개로 적어, 4차원 공간에서 가까운 것을 찾는 나무 구조(KD-tree)에
            넣어요.
          </li>
        </ul>
      </LearnSection>

      <LearnSection title="받지 않고 만든다">
        <p>
          처음에는 사각형 색인을 서버에서 미리 만들어 10.8MB짜리 파일로 내려
          받았어요. 지금은 별 목록(압축 41KB)만 받고, 색인은 사진을 고르는 동안
          브라우저가 직접 만들어요. 만드는 데 1초 남짓이면 충분하거든요. 덕분에
          처음 받는 양이 8MB에서 약 0.7MB로 줄었어요.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Stat value="8MB → 0.7MB" label="처음 받는 양 (압축)" />
          <Stat
            value="약 1초"
            label="브라우저가 색인을 만드는 시간 (사진 고르는 동안)"
          />
        </div>
      </LearnSection>

      <LearnSection title="별자리선">
        <p>
          별자리 그림은 국제천문연맹 88개 별자리를 BSC 별 번호로 이어 둔 공개
          자료(ConstellationLines)를 써요. 풀이에는 쓰지 않고, 답을 찾은 뒤 사진
          위에 그릴 때만 써요.
        </p>
      </LearnSection>
    </LearnArticle>
  );
}
