import Link from "next/link";
import FindStarsDemo from "@/learn/FindStarsDemo";
import LearnArticle, { Figure, LearnSection, Stat } from "@/learn/LearnArticle";
import MilkyWayBandDemo from "@/learn/MilkyWayBandDemo";
import MilkyWayCoarseDemo from "@/learn/MilkyWayCoarseDemo";
import MilkyWayMapDemo from "@/learn/MilkyWayMapDemo";
import { MILKY_WAY_PHOTOS } from "@/learn/milkyWayPhotos";
import MilkyWayTileDemo from "@/learn/MilkyWayTileDemo";
import { Callout, DataTable } from "@/learn/parts";
import { learnMetadata } from "@/learn/steps";

export const metadata = learnMetadata("milky-way");

// 은하수 사진: 은하수를 풀려고 한 일을 모았다 (journey 16·46~59장). 성공한 것은 체험 데모로, 실패한 것은 숫자와 함께.
export default function Page() {
  return (
    <LearnArticle
      slug="milky-way"
      lead="별이 많이 찍힐수록 풀기 쉬울 것 같지만, 은하수 사진은 반대예요. 처음 보는 인터넷 사진에서 가장 많이 못 푼 종류가 은하수였어요. 무엇이 어려웠고, 무엇이 통했고, 무엇이 헛디딘 길이었는지 모았어요."
    >
      <LearnSection title="숫자로 보면">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat
            value="21 → 34장"
            label="인터넷 은하수 사진 51장 중 확신 (V3 발표 무렵 → 지금)"
          />
          <Stat
            value="110 / 163장"
            label="지금 앱이 푸는 은하수 사진 (인터넷 사진 세 묶음)"
          />
          <Stat
            value="0장"
            label="은하수 사진에서 틀린 답을 확신한 수 (8초 조건)"
          />
        </div>
      </LearnSection>

      <LearnSection title="왜 어려운가: 진짜 밝은 별이 &ldquo;별답지 않다&rdquo;">
        <p>
          별 찾기는 점 둘레의 고리가 고른 하늘인지(
          <Link href="/learn/find-stars" className="link">
            별다움
          </Link>
          )를 보고, 고리가 들쭉날쭉한 점은 건물·나무 불빛일 수 있어서 뒤로
          미뤄요. 그런데 은하수 띠 안에서는 고리 한쪽에 밝은 구름이, 다른 쪽에
          어두운 띠(암흑대)가 걸려서 <b>진짜 밝은 별도 고리가 고르지 않아요</b>.
        </p>
        <p>
          풀린 은하수 사진에서 3등급보다 밝은 별을 세어 보니 36%가 &ldquo;별답지
          않다&rdquo;로 밀렸어요(별자리 사진은 19%). 여름철 대삼각형 사진에서 띠
          한가운데의 데네브는 별다운 순으로 3,749번째였어요. 은하수 사진에서
          밝은 순과 별다운 순을 비교해 보세요. 점을 누르면 고리를 들여다봐요.
        </p>
        <Figure caption="은하수 샘플에서 밝은 순·별다운 순 상위 60개. 별다운 순은 띠 밖의 어두운 하늘에 몰려요.">
          <FindStarsDemo
            photos={MILKY_WAY_PHOTOS}
            top={60}
            captions={{
              brightness:
                "밝은 순은 띠 안의 밝은 별을 잘 고르지만, 사진에 따라 지상 불빛도 섞여요.",
              priority:
                "별다운 순은 지상 불빛을 거르는 대신, 띠 안의 밝은 별을 뒤로 밀어요. 띠 밖에 몰린 것을 보세요.",
            }}
          />
        </Figure>
        <Callout kind="fail" title="헛디딘 길: 별다움 기준을 느슨하게">
          <p>
            띠를 가리고 풀기(새로 0장), 별다움을 흐린 밝기를 뺀 사진에서 재기,
            &ldquo;이 사진의 별 모양&rdquo;과 닮은 점을 되살리기를 해 봤어요.
            어느 쪽이든 진짜 밝은 별과 함께 창문·작은 불빛도 살아나서, 틀린 답을
            확신한 사진이 생겼어요. 작은 불빛도 사진에서는 별과 같은 점이거든요.
          </p>
        </Callout>
      </LearnSection>

      <LearnSection title="통한 방법 1: 줄여서 보기">
        <p>
          밝은 별이 부드럽게 퍼진 사진은 빛무리가 별 찾기의 흐림보다 넓어서
          오히려 약하게 잡혀요. 사진을 긴 변 480픽셀로 줄이면 같은 빛이 몇 칸에
          모여 또렷한 점이 돼요. 그래서 원래 크기로 확신하지 못하면, 줄인
          사진에서 찾은 별로 빠른 풀이를 0.64초 동안 한 번 더 해요.
        </p>
        <Figure caption="원래 크기의 별다운 순(초록)과 줄인 사진의 검출(하늘색·노랑). 노란 원을 누르면 두 크기로 확대해 봐요.">
          <MilkyWayCoarseDemo />
        </Figure>
        <p className="text-sm opacity-80">
          625장 번갈아 비교: 확신 445 → 451장(얻음 7·잃음 1, 틀림 그대로).
          카시오페이아·안드로메다가 찍힌 은하수 사진이 이렇게 풀렸어요. 처음에는
          느린 삼각형 풀이까지 25%를 줬다가 얻음 9·잃음 8이었어요. 실패할 때
          빨리 끝나는 것이 중요했어요.
        </p>
      </LearnSection>

      <LearnSection title="통한 방법 2: 잘라서 보기">
        <p>
          광각 은하수 사진은 가장자리가 보통 렌즈의 투영에서 벗어나요. 사진
          전체로는 별 모양이 조금씩 어긋나지만, 조각 하나는 잘 맞아요. 그래서
          사진 전체로 확신하지 못하면 가운데 절반부터 조각을 따로 풀어요. 조각은
          별이 적어 우연에 약하니, 조각 밖 둘레의 별까지 맞아야 받아들여요.
        </p>
        <Figure caption="조각을 눌러 그 조각만으로 풀어 보세요. 앱은 사진 전체로 못 찾으면 1번부터 차례로 풀어요.">
          <MilkyWayTileDemo />
        </Figure>
        <p className="text-sm opacity-80">
          625장 번갈아 비교: 확신 440 → 454장(얻음 19·잃음 5). 조각 답 9장은
          조각을 Astrometry.net으로 따로 푼 정답과 모두 0.8° 안이었어요. 지금
          8초 안에 풀리는 은하수 사진 상당수가 이 단계에서 풀려요.
        </p>
      </LearnSection>

      <LearnSection title="은하수 자체를 단서로">
        <p>
          사람은 은하수를 보면 하늘 어디인지 바로 알아봐요. 은하수 띠의
          한가운데(은하면)는 하늘의 큰 원이라 보통 사진에서는 직선이에요. 사진의
          흐린 밝기에서 그 선을 찾으면 사진이 얼마나 기울었는지 알 수 있어요.
        </p>
        <Figure caption="사진의 흐린 밝기에서 찾은 은하수 띠의 중심선 후보 다섯 개. 가장 밝은 줄은 실제 중심에서 조금 비켜나기 쉬워요.">
          <MilkyWayBandDemo />
        </Figure>
        <p>
          선을 찾으면 남은 모르는 값은 &ldquo;띠의 어느 부분인가&rdquo;와
          화각뿐이에요. 검출한 별과 별 지도의 별 중 띠에서 같은 거리에 있는
          짝마다 표를 던져 자리를 좁혔어요. 다만 가장 밝은 줄은 암흑대 때문에
          실제 중심에서 평균 4°쯤 비켜나서, 선을 조금씩 옮겨 가며 여러 번
          투표했어요. 여기에 은하수 밝기 지도(ESO의 전천 사진)를 사진과 통째로
          겹쳐 보는 대조를 더하니, 실험에서는 못 푼 은하수 사진 66장 중 6장을
          새로 풀었어요. 지도는 360×180 회색조(13KB)로 줄여도 같은 결과였어요.
        </p>
        <Figure caption="사진을 먼저 풀어 정답 자리를 얻고, 하늘을 은하 북극 둘레로 돌려 가며 지도에서 만든 은하수와 사진의 흐린 밝기가 얼마나 닮았는지 재요. 정답 자리(0°)에서 가장 닮아야 해요.">
          <MilkyWayMapDemo />
        </Figure>
        <p>
          대·소마젤란 은하도 단서로 써 봤어요. 하늘 위치를 아는 점 두 개가
          사진에 있으면 회전·크기·위치가 모두 정해져요. 이렇게 세운 배치로
          예측한 은하면이 사진 속 은하수 띠와 맞았고, 시리우스·카노푸스·용골자리
          성운이 실제 자리에 놓였어요.
        </p>
        <Callout kind="fail" title="헛디딘 길: 앱에 넣고 다시 재니 1장">
          <p>
            띠·지도 대조를 앱에 넣었더니 처음에는 지금 앱이 못 푸는 은하수 사진
            7~8장을 더 푸는 것처럼 보였어요. 그런데 브라우저에서 그 사진들을
            올려 보니 기존 흐름이 이미 7~8초에 풀었어요. &ldquo;못 푸는
            사진&rdquo; 목록을 컴퓨터가 바쁠 때 재서, 시간이 모자라 못 푼 사진이
            섞여 있었던 거예요.
          </p>
          <p>
            한가할 때 다시 재니 새로 푼 사진은 1장이었어요. 그 1장을 위해 못
            푸는 사진 모두가 6초를 더 기다려야 해서 앱에서 뺐어요. 같은 사진에
            기존 흐름의 시간을 8초 더 주면 3장이 풀렸어요. 마젤란 은하 배치도
            앱의 확신 기준(어두운 별까지 맞는지, 별을 둘로 나눠 서로
            확인하는지)을 넘지 못했어요.
          </p>
        </Callout>
        <Callout kind="lesson">
          <p>
            새 방법은 같은 때 잰 기준선과 사진마다 번갈아 비교해야 해요. 다른 때
            잰 숫자와 비교하면 컴퓨터가 바쁜 정도에 따라 이득이 부풀어요.
          </p>
        </Callout>
      </LearnSection>

      <LearnSection title="해 본 것 모아 보기">
        <DataTable
          head={["해 본 것", "결과", "앱에"]}
          highlight={[0, 1, 2, 3]}
          rows={[
            [
              "은하수는 어안이 아니었다: 원근 보정 + 밝은 별 삼각형",
              "처음으로 은하수 샘플을 자동으로 풂",
              "들어감",
            ],
            ["허용오차를 넓혔다 좁히는 정밀화", "점수 9.4 → 27", "들어감"],
            ["줄여서 보기", "625장 +7 · −1", "들어감"],
            ["잘라서 보기", "625장 +19 · −5", "들어감"],
            ["띠 가리기", "새로 0장", "넣지 않음"],
            [
              "별다움을 흐린 밝기를 뺀 사진에서",
              "+10 · −16, 틀린 확신 4장",
              "넣지 않음",
            ],
            [
              "이 사진의 별 모양과 닮은 점 되살리기",
              "+9 · −12, 틀린 확신",
              "넣지 않음",
            ],
            [
              "확신 못 하면 밝기 순으로 한 번 더",
              "처음 +12 → 다른 단계가 들어간 뒤 +4 · −5",
              "넣지 않음",
            ],
            [
              "마젤란 은하 두 점으로 배치 세우기",
              "배치는 맞음, 확신 기준 미달",
              "넣지 않음",
            ],
            [
              "은하수 띠 중심선 + 은하수 지도 대조",
              "한가할 때 다시 재니 +1장, 6초 더",
              "넣었다 뺌",
            ],
            ["조각 단계를 앞당기기", "+1 · −2", "넣지 않음"],
          ]}
        />
        <p className="text-sm opacity-70">
          자세한 시도와 숫자는 저장소의 실험 기록(experiments-journey)
          16·22·46~59장에 있어요.
        </p>
      </LearnSection>
    </LearnArticle>
  );
}
