import ChanceDemo from "@/learn/ChanceDemo";
import LearnArticle, { Figure, LearnSection } from "@/learn/LearnArticle";
import { learnMetadata } from "@/learn/steps";

export const metadata = learnMetadata("verify");

export default function Page() {
  return (
    <LearnArticle
      slug="verify"
      lead="모양이 닮은 짝은 하늘에 수없이 많아요. 그 짝이 진짜인지 알려면, 그 짝대로 별 지도를 사진 위에 겹쳐 보고 나머지 별까지 맞는지 봐야 해요. 그리고 '이만큼 맞는 게 우연일 수 있나?'를 숫자로 따져요."
    >
      <LearnSection title="1. 짝대로 겹쳐 보기">
        <p>
          후보 짝(사진 별 셋 ↔ 하늘 별 셋)이 있으면, 사진의 점을 하늘의
          방향으로 바꾸는 변환을 정할 수 있어요. 이 변환으로 별 지도의 별들을
          사진 위에 투영하면, 정답일 때는 사진 속 다른 별들 위에도 지도 별이
          척척 겹쳐요. 틀린 짝이면 몇 개만 우연히 겹치고 말아요.
        </p>
      </LearnSection>

      <LearnSection title="2. 더 잘 맞는 변환 찾기 (RANSAC)">
        <p>
          처음 고른 세 별의 위치에는 오차가 있어서, 그것만으로 만든 변환은 사진
          끝으로 갈수록 어긋나요. 그래서 겹친 별 중 셋을 무작위로 골라 변환을
          다시 만들고, 더 많은 별이 겹치는 변환을 남기는 일을 여러 번
          되풀이해요. 가짜 별이 섞여 있어도 진짜 별들이 이기는 방식이에요.
        </p>
        <p>
          겹친 별이 8개 이상이면 <b>원근 변환</b>으로 한 번 더 다듬어요. 사진을
          비스듬히 찍었거나 건물을 똑바로 세우는 보정을 한 사진도 이걸로 맞춰요.
        </p>
      </LearnSection>

      <LearnSection title="3. 우연일 확률">
        <p>
          별이 많은 하늘에서는 아무렇게나 겹쳐도 몇 개는 맞아요. 그래서
          &ldquo;몇 개 맞았다&rdquo;가 아니라{" "}
          <b>틀린 답이어도 이만큼 맞을 확률</b>을 계산해요. 이 확률이{" "}
          <b>10억 분의 1(10⁻⁹)</b>보다 작을 때만 &ldquo;찾았어요!&rdquo;라고
          말해요.
        </p>
        <Figure caption="숫자를 바꿔 보세요. 사진에 별이 많을수록 우연히 겹치는 개수도 늘어서, 더 많이 맞아야 확신해요.">
          <ChanceDemo />
        </Figure>
      </LearnSection>

      <LearnSection title="4. 확신하지 못하면 사람에게">
        <p>
          기준을 넘는 답이 없으면, 가장 그럴듯한 후보들을 보여 주고 사람이
          고르게 해요. 기준이 엄격해서 놓치는 사진은 있어도, 시험한 사진
          전체에서 <b>틀린 답을 확신한 적은 한 번도 없어요</b>. 틀린 별자리를
          자신 있게 그리는 것보다 &ldquo;모르겠어요&rdquo;가 낫다고 봤어요.
        </p>
        <p>
          확신하면 마지막으로 그 영역의 별 60개로 한 번 더 확인해서, 점수가
          오르면 그 변환으로 바꿔요. 이 변환으로 별자리선·별 이름·성운·행성을
          사진 위에 그려요.
        </p>
      </LearnSection>
    </LearnArticle>
  );
}
