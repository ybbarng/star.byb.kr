import LearnArticle, { Figure, LearnSection } from "@/learn/LearnArticle";
import { BarChart, Callout } from "@/learn/parts";
import { learnMetadata } from "@/learn/steps";

export const metadata = learnMetadata("history");

// 걸어온 길: docs/experiments-journey.md의 굵직한 전환점만 골라 시간 순서로
const MILESTONES: {
  when: string;
  title: string;
  body: string;
  numbers?: string;
}[] = [
  {
    when: "2022년 6월 · 데브 세미나",
    title: "Plate Solving을 처음 소개하다",
    body: "동료가 찍은 사이판·석촌호수 사진을 사람이 별자리 앱으로 풀어 보고, Astrometry.net이 사각형과 KD-tree로 푸는 방법을 소개했어요. 마지막 장의 목표는 '밝은 별만으로, 땅이나 구름이 찍힌 사진에서도, 안 되면 사진 두 장만이라도'였어요.",
  },
  {
    when: "2023년 4월 · 드림 챌린지",
    title: "삼각형으로 직접 만들다가 실패 선언",
    body: "별 9,082개로 삼각형 284만 개를 만들었는데, 각도가 같은 삼각형이 2,903개나 나와 가를 수 없었어요. 발표 직전에 북두칠성을 5시간 만에 풀고, 다음 날 3분 24초로 줄였어요.",
    numbers: "북두칠성 5시간 → 3분 24초",
  },
  {
    when: "2025년 3월 · V2 발표",
    title: "사각형 해싱 하나",
    body: "별 넷의 모양을 숫자 넷으로 바꾸는 기하 해싱으로 다시 만들었어요. 별 찾기는 OpenCV, 모양 색인은 서버에서 10.8MB 파일로 받았고, 사람이 별 마커를 고쳐 줘야 풀렸어요.",
  },
  {
    when: "V3 초기",
    title: "노이즈 많은 사진과 사람의 협업",
    body: "사이판 사진은 물결 반사광이 전부 가짜 별이고, 진짜 별은 밝기 순위 284~405위였어요. 사람이 별 있는 영역을 고르면 그 안에서 다시 찾게 해, 진짜 별 8개로 8/8 맞게 풀었어요. 병목은 짝 찾기가 아니라 '어두운 진짜 별이 안 보이는 것'이었어요.",
  },
  {
    when: "V3 초기",
    title: "어안이라 믿은 은하수",
    body: "석촌호수 은하수 사진을 손 라벨 8개로 맞춰 어안 렌즈로 결론 내리고, 작은 패턴 투표로 렌즈까지 맞추는 어안 풀이를 만들었어요. 합성 어안은 가짜 50%에도 정확히 풀었지만, 실제 사진은 못 풀었어요.",
  },
  {
    when: "V3 초기",
    title: "사진에 맞춘 코드 지우기",
    body: "은하수만 저장된 라벨로 그리던 길을 지웠어요. 어떤 사진이든 같은 흐름으로 풀고, 안 풀리면 정직하게 '모르겠어요'라고 하기로 했어요.",
  },
  {
    when: "2026년 10월 19일",
    title: "확신의 기준을 다시 세우다",
    body: "샘플 16장을 앱과 같은 흐름으로 돌리자 거의 다 '찾았다'고 했고, 그중 여럿이 틀렸어요. '우연 기대치의 몇 배'를 '우연일 확률 10억 분의 1'로 바꾸자 틀린 확신이 사라졌어요.",
    numbers: "틀린 확신 13장 → 0장",
  },
  {
    when: "2026년 10월 19일",
    title: "멈출 때를 알게 되다",
    body: "확신 기준이 생기자 '확신하면 바로 멈추기'가 안전해졌어요. 못 푸는 사진은 8초에서 끊어요. 삼각형 색인은 KD-tree 대신 격자 칸으로 바꿔 17배 빨리 만들어요.",
    numbers: "북두칠성 0.9초 → 0.18초, 최악 70초 → 9.4초",
  },
  {
    when: "2026년 10월 20일",
    title: "두 패턴을 함께",
    body: "삼각형과 사각형을 실제 사진에 각각 돌려 보니 서로 못 푸는 사진을 풀었어요. 사각형 먼저, 안 되면 삼각형.",
    numbers: "자동으로 풀리는 샘플 3장 → 6장",
  },
  {
    when: "2026년 10월 20일",
    title: "땅을 가리다",
    body: "똑똑한 필터를 두 번 실패한 뒤, 사람이 하는 단순한 일(땅을 가리고 하늘만 보기)을 흉내 냈어요. 사진 위쪽 75·55·45%로 차례로 풀어요.",
    numbers: "6장 → 13장",
  },
  {
    when: "2026년 10월 20일",
    title: "은하수는 어안이 아니었다",
    body: "원근 변환이 어안보다 잘 맞았고, 자동 풀이가 라벨에 없던 별 26개를 2~4픽셀로 맞췄어요. 원근 정밀화와 밝은 별 삼각형 색인을 더했어요.",
    numbers: "13장 → 14장 (16장 중)",
  },
  {
    when: "2026년 10월 20일",
    title: "별다움",
    body: "풀린 사진의 답으로 검출마다 진짜인지 자동으로 표시하는 측정 기준부터 만들고, '주변이 고른 하늘인가' 하나로 가짜를 뒤로 미뤘어요. 땅 위치를 가정하지 않아도 거의 다 풀려요.",
    numbers: "앞쪽 25개 안의 진짜 별 124 → 280",
  },
  {
    when: "2026년 10월 20일",
    title: "합성 장면, 줄지음, 처음 보는 사진",
    body: "창문·전봇대·바다 반사·비행기를 넣은 픽셀 합성 장면으로 시험하고, 줄지은 점을 뒤로 미뤘어요. 받은 그대로 돌린 처음 보는 사진 8장도 작성자의 정답 그림과 1~3픽셀로 맞았어요.",
    numbers: "모든 거짓 요소를 섞은 장면 0/8 → 7/8",
  },
  {
    when: "2026년 10월 20일",
    title: "하늘 계산",
    body: "해·달·행성 위치를 직접 계산해 그리고, 지평선으로 촬영 시각을 거꾸로 찾고, 별 10개짜리 사이판 사진을 시각·장소·지평선으로 풀었어요. 지평선도 자동으로 찾아요.",
    numbers: "사이판: 클릭 없이 풀림",
  },
  {
    when: "2026년 10월 20일",
    title: "받는 것에서 만드는 것으로",
    body: "OpenCV를 직접 짠 코드로 바꾸고, 모양 색인은 받지 않고 브라우저가 만들고, 글꼴은 쓰는 글자 조각만 받아요.",
    numbers: "처음 받는 양 8MB → 0.68MB",
  },
  {
    when: "2026년 10월 20일",
    title: "흔들려도 풀리게",
    body: "사진을 WebP·재압축·축소로 흔들어 112장으로 시험했어요. 시간 제한 없이 잰 개선이 8초 안에서는 퇴보라는 걸 발견하고, 마지막 단계에서만 검색을 넓혔어요.",
    numbers: "112장 중 107 → 108, 틀린 확신 0",
  },
  {
    when: "2026년 10월 21일",
    title: "사람에게 먼저 묻지 않는다",
    body: "화면 흐름도 바꿨어요. 사진을 고르면 바로 풀고, 못 찾거나 틀렸을 때만 사람이 별·지평선·달을 고쳐요.",
  },
];

export default function Page() {
  return (
    <LearnArticle
      slug="history"
      lead="처음부터 지금의 방법을 알았던 건 아니에요. 사진 한 장씩 막힐 때마다 시도하고, 측정하고, 틀린 걸 거둬들이며 여기까지 왔어요. 그 전환점들이에요."
    >
      <Figure caption="자동으로 풀리는 실제 샘플 수 (16장 중)">
        <BarChart
          items={[
            { label: "확신 기준을 세운 직후 (삼각형만)", value: 3 },
            { label: "+ 사각형과 함께", value: 6 },
            { label: "+ 땅 가리기", value: 13 },
            { label: "+ 원근 변환·밝은 별 색인", value: 14, highlight: true },
          ]}
        />
      </Figure>

      <LearnSection title="전환점">
        <ol className="relative flex flex-col gap-5 border-l border-indigo-300/30 pl-6">
          {MILESTONES.map((m, i) => (
            <li key={i} className="relative">
              <span className="absolute top-1.5 -left-[31px] size-3 rounded-full bg-indigo-300 ring-4 ring-indigo-300/20" />
              <div className="text-xs opacity-60">{m.when}</div>
              <div className="font-bold">{m.title}</div>
              <p className="text-sm opacity-80">{m.body}</p>
              {m.numbers && (
                <div className="mt-1 inline-block rounded bg-amber-300/15 px-2 py-0.5 text-xs font-bold text-amber-200">
                  {m.numbers}
                </div>
              )}
            </li>
          ))}
        </ol>
      </LearnSection>

      <LearnSection title="되풀이해서 배운 것">
        <Callout kind="lesson" title="틀린 답을 확신하지 않는다">
          <p>
            놓치는 사진이 있어도 괜찮아요. 틀린 별자리를 자신 있게 그리는 것보다
            &ldquo;모르겠어요&rdquo;가 낫고, 그때는 사람이 도우면 돼요.
          </p>
        </Callout>
        <Callout kind="lesson" title="짝에 쓰지 않은 별까지 맞는가">
          <p>
            사람에게도 컴퓨터에게도 가장 강한 확인이에요. 라벨 몇 개에 맞는
            모델이 정답이라는 보장은 없어요(은하수).
          </p>
        </Callout>
        <Callout kind="lesson" title="감 대신 측정, 사진 하나 대신 여럿">
          <p>
            감으로 만든 기준(흐릿함)은 진짜 별을 지우라고 했어요. 측정 기준·합성
            장면·처음 보는 사진으로 확인하고, 사진 한 장에 맞추지 않아요.
          </p>
        </Callout>
        <Callout kind="lesson" title="앱과 같은 조건으로 잰다">
          <p>
            테스트와 브라우저의 흐림이 달랐고, 시간 제한 없이 잰 개선은 8초
            안에서 퇴보였어요. 재는 조건이 실제와 다르면 엉뚱한 결론이 나요.
          </p>
        </Callout>
        <Callout kind="lesson" title="사람이 하던 일을 흉내 낸다">
          <p>
            땅을 가리고 하늘만 보기, 지평선 긋기, 시각·장소로 별자리 앱
            찾아보기. 똑똑한 필터보다 사람이 실제로 하는 단순한 일을 흉내 내는
            편이 강했어요.
          </p>
        </Callout>
      </LearnSection>
    </LearnArticle>
  );
}
