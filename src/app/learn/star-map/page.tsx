import LearnArticle, { Figure, LearnSection, Stat } from "@/learn/LearnArticle";
import { BarChart, Callout, DataTable } from "@/learn/parts";
import SkySphere from "@/learn/SkySphere";
import { learnMetadata } from "@/learn/steps";

export const metadata = learnMetadata("star-map");

export default function Page() {
  return (
    <LearnArticle
      slug="star-map"
      lead="사진을 보기 전에, 맞춰 볼 별 지도부터 준비해요. 별의 방향을 계산하기 쉬운 꼴로 바꾸고, 별 셋·넷이 이루는 모양을 사전처럼 바로 찾아볼 수 있게 색인을 만들어요."
    >
      <Figure caption="이 사이트가 쓰는 별 지도 그대로예요. 끌어서 돌리고, 등급 한계를 바꿔 보세요. HEALPix를 켜면 하늘을 192칸으로 나눈 모습이 보여요.">
        <SkySphere />
      </Figure>

      <LearnSection title="어떤 별을 담을까">
        <p>
          출발점은 <b>예일 밝은 별 목록(BSC5)</b>이에요. 맨눈으로 보이는 별
          9,096개의 위치·밝기·색(표면 온도)이 들어 있어요. 이 중{" "}
          <b>5등급까지의 별 1,625개</b>만 써요.
        </p>
        <p>
          등급은 숫자가 작을수록 밝아요. 1등급 차이가 밝기 약 2.5배예요. 도시
          근처에서 휴대폰으로 찍은 사진에는 3~4등급, 카메라 장노출에는
          5~6등급까지 찍혀요. 별을 많이 담을수록 어두운 별까지 맞출 수 있지만,
          아래에서 보듯 모양 색인이 폭발적으로 커지고 비슷한 모양도 많아져요.
        </p>
        <BarChart
          items={[
            { label: "4등급까지", value: 518 },
            { label: "4.5등급까지", value: 904 },
            { label: "5등급까지 (사용)", value: 1625, highlight: true },
            { label: "5.5등급까지", value: 2887 },
            { label: "6등급까지", value: 5080 },
            { label: "BSC5 전체", value: 9096 },
          ]}
        />
      </LearnSection>

      <LearnSection title="별의 위치를 화살표로">
        <p>
          별 목록은 위치를 적경·적위(하늘의 경도·위도)로 적어 둬요. 그대로 쓰면
          두 별 사이 각도를 구할 때 삼각함수가 여러 번 필요하고, 적경 0시와
          24시가 만나는 곳, 천구의 극 근처에서 계산이 까다로워요.
        </p>
        <p>
          그래서 지구 중심에서 별을 가리키는 <b>길이 1인 화살표(단위 벡터)</b>로
          바꿔요. 그러면 두 별 사이 각도의 코사인이 두 화살표의 내적, 곧 곱셈 세
          번과 덧셈 두 번이에요. 하늘 어디서든 같은 식이라 극 근처도 걱정이
          없어요. 위 천구에서 별을 눌러 보면 벡터 값이 나와요.
        </p>
        <Figure caption="적경 α, 적위 δ인 별은 (cos δ·cos α, cos δ·sin α, sin δ) 방향이에요.">
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
              = aₓbₓ + a_yb_y + a_zb_z
            </text>
            <text x="180" y="104" fontSize="10" fill="white" opacity="0.6">
              하늘 어디서든 같은 식
            </text>
          </svg>
        </Figure>
      </LearnSection>

      <LearnSection title="왜 색인이 필요할까">
        <p>
          사진 속 밝은 별 10개로 만들 수 있는 삼각형은 120개예요. 별 지도에서
          사진 한 장 크기(18° 안)로 만들 수 있는 삼각형은 약 113만 개고요.
          하나하나 비교하면 1억 3천만 번이에요. 게다가 화각을 아홉 가지로 가정해
          보니 그 아홉 배예요.
        </p>
        <p>
          그래서 별 지도의 삼각형을 미리 &ldquo;모양 값&rdquo;으로 줄 세워
          두어요. 국어사전이 가나다순이라 낱말을 바로 찾듯, 사진 삼각형의 모양
          값 근처만 들여다보면 돼요. 모양 값이 무엇인지는{" "}
          <a className="link" href="/learn/match-shapes">
            모양 맞추기
          </a>
          에서 직접 만져 볼 수 있어요.
        </p>
      </LearnSection>

      <LearnSection title="사각형 색인과 HEALPix" id="healpix">
        <p>
          처음 만든 방법은 별 <b>넷</b>의 모양(기하 해싱)이었어요. 문제는 조합의
          수예요. 별 k개에서 넷을 고르는 방법은 k⁴/24 정도로, 별이 두 배면
          조합은 16배가 돼요. 하늘 전체의 별로 넷을 고르면 끝이 없으니, 서로
          가까운 별끼리만 묶어야 해요.
        </p>
        <p>
          그래서 하늘을 <b>HEALPix</b>로 나눠요. 구를 넓이가 모두 같은 칸으로
          나누는 방법인데, 천문학과 우주배경복사 지도에서 널리 써요. 경도·위도
          격자는 극으로 갈수록 칸이 좁아지지만 HEALPix 칸은 어디서나 같은
          넓이라, 칸마다 별 수가 고르게 나와요. 이 사이트는 192칸(nside 4)으로
          나누고, 칸 중심에서 10° 안의 별들로 네 별 조합을 만들어요. 그중{" "}
          <b>모든 별쌍이 10° 안</b>인 조합만 남겨요. 위 천구에서 HEALPix를 켜고
          칸을 눌러 보세요.
        </p>
        <Figure caption="등급 한계를 올리면 별 넷 조합(사각형) 수가 폭발해요. '10° 안' 조건이 이것을 7분의 1로 줄여요.">
          <BarChart
            log
            items={[
              { label: "4등급까지", value: 8344 },
              { label: "4.5등급까지", value: 55399 },
              { label: "5등급까지 (칸 안 모든 조합)", value: 553137 },
              {
                label: "5등급까지 + 모든 별쌍 10° 안 (사용)",
                value: 82703,
                highlight: true,
              },
              { label: "5.5등급까지", value: 4966646 },
              { label: "6등급까지", value: 41280631 },
            ]}
          />
        </Figure>
        <p>
          사각형 하나의 모양은 숫자 네 개라서, 4차원 공간에서 가까운 점을 찾는
          나무 구조(KD-tree)에 넣어 둬요. 예전엔 범용 라이브러리로 8만 개를 넣는
          데 0.31초 걸렸는데, 4차원 전용으로 숫자 배열에 바로 담게 짜서
          0.035초가 됐어요.
        </p>
      </LearnSection>

      <LearnSection title="삼각형 색인 두 가지">
        <p>
          나중에 별 <b>셋</b>의 모양도 쓰게 됐어요. 별이 적고 밝은
          사진(북두칠성처럼)은 사각형을 만들 별이 모자라거든요. 삼각형 색인은 두
          가지예요.
        </p>
        <DataTable
          head={["색인", "재료", "범위", "개수"]}
          rows={[
            [
              "삼각형",
              "5등급까지 1,625개",
              "한 별에서 18° 안의 두 별",
              "약 113만",
            ],
            ["밝은 별 삼각형", "3.5등급까지 287개", "30° 안", "약 4.9만"],
            [
              "사각형",
              "5등급까지 1,625개",
              "HEALPix 칸, 모든 쌍 10° 안",
              "82,703",
            ],
          ]}
        />
        <Callout kind="found" title="발견: 비슷한 모양이 너무 많다">
          <p>
            석촌호수 은하수 사진에서 진짜 별 삼각형의 모양은 별 지도와 0.005밖에
            차이 나지 않았어요. 그런데 113만 개 색인에는 그만큼 비슷한 모양이
            168개나 있어서, 가장 비슷한 8개 안에 들지 못했어요.
          </p>
          <p>
            사진에서 가장 밝은 별은 대개 하늘에서도 밝은 별이에요. 그래서
            3.5등급까지의 밝은 별끼리만 만든 색인을 함께 찾게 했더니 경쟁
            삼각형이 23분의 1로 줄어 진짜 삼각형이 3·4·5위로 올라왔어요.
          </p>
        </Callout>
      </LearnSection>

      <LearnSection title="빨리 만들기">
        <p>
          113만 개 삼각형 색인을 처음 만들었을 때는 9초가 걸렸어요. 사진을 고를
          때마다 9초를 기다릴 수는 없었죠. 부분별로 재 보니 범인은
          KD-tree(7.3초)였어요.
        </p>
        <DataTable
          head={["부분", "처음", "지금"]}
          rows={[
            [
              "삼각형 중복 제거",
              "0.66초 (문자열 키)",
              "없음 (가장 작은 번호의 별에서만 만든다)",
            ],
            [
              "검색 구조",
              "7.3초 (KD-tree)",
              "격자 칸 (정렬 없이 한 번 채우기)",
            ],
            ["합계", "9.0초", "0.54초"],
          ]}
          highlight={[2]}
        />
        <Callout kind="lesson">
          <p>
            느린 곳은 추측하지 말고 부분별로 잰다. 삼각형 모양 값은 0~1 사이
            숫자 두 개라, 범용 자료구조보다 그 범위를 칸으로 나눈 단순한 구조가
            17배 빨랐어요.
          </p>
        </Callout>
      </LearnSection>

      <LearnSection title="받지 않고 만든다">
        <p>
          처음에는 사각형 색인을 서버에서 미리 만들어 10.8MB짜리 파일로
          내려받았어요. 숫자를 이진으로 담아 2MB(압축 1.46MB)로 줄였다가, 다시
          생각해 보니 색인은 별 위치와 규칙만 있으면 언제든 똑같이 만들어져요.
          지금은 별 목록만 코드에 싣고, 색인은 사진을 고르는 동안 브라우저가 1초
          남짓에 직접 만들어요.
        </p>
        <Figure caption="플레이트 솔버를 열어 사진 한 장을 풀 때까지 받는 양 (압축 기준)">
          <BarChart
            format={(v) => `${v.toFixed(2)}MB`}
            items={[
              { label: "처음: 별 찾기 라이브러리(OpenCV)", value: 3.86 },
              { label: "처음: 글꼴 통짜 파일", value: 2.05 },
              { label: "처음: 사각형 색인 파일", value: 1.46 },
              { label: "처음: 앱 코드·수학 라이브러리·별 목록", value: 0.58 },
              { label: "지금: 전부 합쳐서", value: 0.68, highlight: true },
            ]}
          />
        </Figure>
        <div className="grid grid-cols-3 gap-3">
          <Stat value="8MB → 0.68MB" label="처음 받는 양" />
          <Stat value="약 0.8초" label="브라우저가 색인을 모두 만드는 시간" />
          <Stat value="41KB" label="별 목록 (압축)" />
        </div>
        <Callout kind="lesson">
          <p>
            &ldquo;DB를 받아야 한다&rdquo;는 처음 설계의 전제를 다시 보니, 받을
            것은 재료(별 위치)와 규칙뿐이었어요. 그리고 받는 양을 실제로 재 보니
            가장 큰 건 의외로 글꼴이었어요.
          </p>
        </Callout>
      </LearnSection>

      <LearnSection title="별자리선과 별자리 구역">
        <p>
          별자리 그림은 국제천문연맹(IAU) 별자리 그림(Sky &amp; Telescope의
          Roger Sinnott·Rick Fienberg)을 바탕으로 한 공개 자료(d3-celestial)를
          써요. 선을 어떻게 긋는지는 정해진 표준이 없어서, 별자리 책과 앱에서
          흔히 보는 모양을 골랐어요. 풀이에는 쓰지 않고, 답을 찾은 뒤 사진 위에
          그릴 때만 써요.
        </p>
        <p>
          오늘날 천문학에서 별자리는 선 그림이 아니라{" "}
          <b>하늘을 빈틈없이 나눈 88개 구역</b>이에요. 1930년 IAU가 경계를
          정했고, 경계선은 그때 기준의 적경·적위가 일정한 선이에요. 그래서 선
          그림 밖에 있는 별도 어느 별자리 &ldquo;구역&rdquo;에 속해요. 풀이
          결과에는 이 경계를 점선으로 그리고, 사진에 어느 구역이 얼마나 담겼는지
          알려 줘요.
        </p>
      </LearnSection>
    </LearnArticle>
  );
}
