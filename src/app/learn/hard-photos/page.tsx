import Link from "next/link";
import LearnArticle, { LearnSection } from "@/learn/LearnArticle";
import { learnMetadata } from "@/learn/steps";

export const metadata = learnMetadata("hard-photos");

export default function Page() {
  return (
    <LearnArticle
      slug="hard-photos"
      lead="세 단계로 대부분의 사진이 풀리지만, 사람들이 실제로 찍는 밤하늘 사진은 훨씬 다양해요. 잘 안 풀리는 사진을 만날 때마다 더한 방법들이에요."
    >
      <LearnSection title="초광각(어안) 렌즈 사진">
        <p>
          보통 사진은 하늘을 평면에 곧게 펴서 담지만, 어안 렌즈는 화면
          가장자리로 갈수록 하늘을 크게 구부려 담아요. 이런 사진은 삼각형 모양
          자체가 일그러져서 보통 방법으로는 짝이 안 맞아요. 그래서 보통 방법으로
          확신하지 못하면, 어안 렌즈라고 가정하고 왜곡 정도까지 함께 맞춰 보는
          풀이를 한 번 더 돌려요. 많은 별이 작은 오차로 겹칠 때만 받아들여요.
        </p>
        <p className="text-sm opacity-70">
          덧붙여: 석촌호수 은하수 사진은 처음에 어안 사진인 줄 알았는데, 사실은
          건물을 똑바로 세우는 원근 보정을 한 사진이었어요. 이건 확인 단계의
          원근 변환으로 풀려요.
        </p>
      </LearnSection>

      <LearnSection title="별이 열 개 남짓인 사진">
        <p>
          사이판 바닷가 사진처럼 밝은 별이 몇 개뿐이면, 모양만으로는 확신할 만큼
          맞출 수가 없어요. 대신 <b>언제, 어디서</b> 찍었는지 알면 이야기가
          달라져요. 그 시각 그 장소의 하늘은 계산으로 정해지니까, 남은 건
          &ldquo;어느 쪽을 바라봤나(방위)&rdquo;와 &ldquo;얼마나 넓게
          찍었나(화각)&rdquo;뿐이에요.
        </p>
        <p>
          여기에 사진 속 <b>지평선</b>이 있으면 카메라가 얼마나 기울었는지도 알
          수 있어요. 지평선은 사진의 밝기가 위아래로 크게 바뀌는 곳을 찾아
          자동으로 제안하고, 틀리면 사람이 두 점을 찍어 고쳐요. 방위와 화각을
          바꿔 가며 별이 가장 많이 겹치는 조합을 찾고, 우연일 확률로 다시
          확인해요.
        </p>
      </LearnSection>

      <LearnSection title="찍은 시각을 거꾸로 찾기">
        <p>
          거꾸로, 사진이 풀리고 지평선이 보이면 <b>찍은 시각과 위도</b>를 계산할
          수 있어요. 지평선에서 머리 꼭대기(천정) 방향을 구하면, 천정이 하늘의
          어디를 가리키는지가 곧 그곳의 위도와 그 순간의 &ldquo;하늘
          시계&rdquo;(항성시)예요. 같은 하늘은 하루에 4분씩 일찍 돌아오기 때문에
          날짜마다 하나씩 후보 시각이 나와요. 사진에 달이 있으면, 달은 날마다
          자리를 옮기니 날짜까지 좁힐 수 있어요.
        </p>
        <p className="text-sm opacity-70">
          이 계산은 2022년 발표 &ldquo;이과생의 별 헤는 밤&rdquo;에서 사람이
          손으로 했던 추리를 코드로 옮긴 거예요.
        </p>
      </LearnSection>

      <LearnSection title="해·달·행성 그리기">
        <p>
          별은 거의 움직이지 않지만 해·달·행성은 날마다 자리를 옮겨요. 찍은
          시각을 알면(사진의 촬영 정보나 사람이 넣은 값) 궤도 계산으로 그 순간의
          위치를 구해 사진 위에 함께 그려요.
        </p>
      </LearnSection>

      <LearnSection title="사람과 함께, 언젠가는 혼자서">
        <p>
          처음에는 사람이 별을 골라 줘야 풀렸어요. 지금은 대부분 사람 손 없이
          풀리고, 안 될 때만 사람이 &ldquo;별 고치기&rdquo;로 도와줘요. 사람이
          도와준 사진에서 배운 것을 다시 자동으로 옮기는 것이 이 프로젝트의
          방향이에요.{" "}
          <Link href="/plate-solver" className="link">
            직접 사진을 올려 보세요.
          </Link>
        </p>
      </LearnSection>
    </LearnArticle>
  );
}
