import LearnArticle, { Figure, LearnSection } from "@/learn/LearnArticle";
import ShapeDemo from "@/learn/ShapeDemo";
import { learnMetadata } from "@/learn/steps";

export const metadata = learnMetadata("match-shapes");

export default function Page() {
  return (
    <LearnArticle
      slug="match-shapes"
      lead="사진 속 별 몇 개가 하늘의 어느 별인지 짝을 찾는 단계예요. 사진은 어느 쪽으로 기울었는지, 얼마나 확대됐는지 모르니까, 돌리고 키워도 변하지 않는 '모양'만 보고 찾아요."
    >
      <LearnSection title="돌리고 키워도 변하지 않는 값">
        <p>
          별 셋이 이루는 삼각형의 세 변을 길이 순으로 놓고, 짧은 변과 중간 변을
          가장 긴 변으로 나눠요. 이 두 숫자는 사진을 돌려도, 확대해도, 옮겨도
          그대로예요. 그래서 사진의 삼각형과 별 지도의 삼각형을 이 두 숫자로
          비교할 수 있어요.
        </p>
        <Figure caption="삼각형을 돌리고 키워 보세요. 변 길이는 바뀌지만 모양 값은 그대로예요.">
          <ShapeDemo />
        </Figure>
      </LearnSection>

      <LearnSection title="별 지도에서 비슷한 모양 찾기">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            앞 단계에서 줄 세운 별 중 위에서 <b>10개</b>(마지막 시도에서는
            15개)를 골라, 세 개씩 묶은 삼각형을 모두 만들어요. 10개면 120개예요.
          </li>
          <li>
            사진은 평평하고 하늘은 둥글어서, 넓게 찍은 사진일수록 모양이 조금씩
            일그러져요. 그래서 화각(사진이 담은 하늘의 폭)을 10°부터 75°까지
            아홉 가지로 가정해 보고, 가정마다 사진 삼각형을 하늘 위의 모양으로
            바꿔요.
          </li>
          <li>
            바꾼 모양으로 별 지도의 삼각형 색인과 밝은 별 삼각형 색인에서{" "}
            <b>가장 비슷한 8개씩</b>을 찾아요. 가정한 화각에서 크기가 두 배 넘게
            다른 삼각형은 버려요.
          </li>
          <li>
            이렇게 나온 짝(사진 별 셋 ↔ 하늘 별 셋)이 &ldquo;후보&rdquo;예요.
            아직은 우연히 모양이 닮은 것일 수도 있어서, 다음 단계에서 확인해요.
          </li>
        </ol>
      </LearnSection>

      <LearnSection title="사각형으로도: 기하 해싱">
        <p>
          삼각형과 함께 별 넷의 모양도 써요. 네 별 중 가장 먼 두 별을 (0, 0)과
          (1, 1)에 오도록 옮기고 돌리고 늘리면, 나머지 두 별의 좌표 네 개가
          남아요. 이 네 숫자가 사각형의 &ldquo;지문&rdquo;이에요. 별 지도의
          사각형 82,703개를 이 지문으로 정리해 두고, 사진 사각형의 지문과 가까운
          것을 찾아요.
        </p>
        <Figure caption="가장 먼 두 별 A·B를 (0,0)·(1,1)에 놓으면, 나머지 C·D의 좌표 (xC, yC, xD, yD)가 지문이 돼요.">
          <svg viewBox="0 0 320 180" className="mx-auto w-full max-w-sm">
            <rect
              x="60"
              y="20"
              width="140"
              height="140"
              fill="none"
              stroke="rgba(160,180,255,0.25)"
              strokeDasharray="4 4"
            />
            <line
              x1="60"
              y1="160"
              x2="200"
              y2="20"
              stroke="rgba(160,180,255,0.4)"
            />
            <circle cx="60" cy="160" r="5" fill="#fde68a" />
            <circle cx="200" cy="20" r="5" fill="#fde68a" />
            <circle cx="150" cy="120" r="5" fill="#a5b4fc" />
            <circle cx="95" cy="65" r="5" fill="#a5b4fc" />
            <text x="40" y="175" fontSize="11" fill="white">
              A (0,0)
            </text>
            <text x="205" y="22" fontSize="11" fill="white">
              B (1,1)
            </text>
            <text x="158" y="124" fontSize="11" fill="white">
              C
            </text>
            <text x="103" y="62" fontSize="11" fill="white">
              D
            </text>
            <text x="225" y="100" fontSize="11" fill="#a5b4fc">
              (xC, yC,
            </text>
            <text x="232" y="116" fontSize="11" fill="#a5b4fc">
              xD, yD)
            </text>
          </svg>
        </Figure>
      </LearnSection>

      <LearnSection title="안 되면 범위를 바꿔서 다시">
        <p>
          한 번에 안 풀리면 조건을 바꿔 가며 다시 해요. 쓰는 별 수를 15개에서
          60개까지 늘리고, 그래도 안 되면 땅이 섞이기 쉬운 사진 아래쪽을 빼고
          위쪽 75% · 55% · 45%만 봐요. 확신하는 답이 나오면 바로 멈추고, 8초가
          지나면 그때까지의 후보로 마무리해요.
        </p>
      </LearnSection>
    </LearnArticle>
  );
}
