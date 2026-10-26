export interface Sample {
  src: string;
  thumb: string; // 고르는 화면의 작은 사진 (400×300 WebP)
  title: string;
  caption: string;
  width: number;
  height: number;
}

// 작은 사진은 이렇게 만든다 (public/samples 에서):
//   magick "<원본>" -auto-orient -resize 400x300^ -gravity center -extent 400x300 -quality 72 "thumbs/<이름>.webp"
const sample = (
  file: string,
  title: string,
  caption: string,
  width: number,
  height: number,
): Sample => ({
  src: `/samples/${file}`,
  thumb: `/samples/thumbs/${file.replace(/\.[a-z]+$/, "")}.webp`,
  title,
  caption,
  width,
  height,
});

// 북두칠성(big-dipper.jpg)·석촌호수 은하수 사진은 별하늘지기 카페에서 가져온 외부 사진이라 예시로 보이지 않는다
// (회귀 테스트는 public/samples의 파일을 그대로 읽는다). 맨 앞은 빨리(약 0.1초) 풀리는 호주 ①
const samples: Sample[] = [
  sample(
    "20231012-nike-aust-01.jpg",
    "호주 ①",
    "2023년 10월 · 남반구",
    4000,
    3000,
  ),
  sample("20220607-berry-seoul.jpg", "서울 근처 산", "2021년 10월", 1440, 1080),
  sample(
    "20190617-jarrod-saipan.jpg",
    "사이판 바다",
    "2019년 6월 · 별이 적은 사진",
    1440,
    1920,
  ),
  sample(
    "20231012-nike-aust-02.jpg",
    "호주 ②",
    "2023년 10월 · 남반구",
    4000,
    3000,
  ),
  sample(
    "20230904-nike-jeungseun-01.png",
    "여름 여행 ①",
    "2023년 9월",
    1280,
    960,
  ),
  sample(
    "20230904-nike-jeungseun-02.png",
    "여름 여행 ②",
    "2023년 9월",
    978,
    1304,
  ),
  sample(
    "20230904-nike-jeungseun-03.png",
    "여름 여행 ③",
    "2023년 9월",
    1280,
    960,
  ),
  sample(
    "20230904-nike-jeungseun-04.png",
    "여름 여행 ④",
    "2023년 9월",
    1280,
    960,
  ),
  sample("20250117-carl-aurora-01.jpg", "오로라 ①", "2025년 1월", 3024, 4032),
  sample("20250117-carl-aurora-02.jpg", "오로라 ②", "2025년 1월", 3024, 4032),
  sample("20250117-carl-aurora-03.jpg", "오로라 ③", "2025년 1월", 3024, 4032),
  sample("20250117-carl-aurora-04.jpg", "오로라 ④", "2025년 1월", 3024, 4032),
  sample("cafe-orion.jpg", "오리온", "겨울 별자리", 1280, 742),
  sample("google-unknown.jpg", "출처 모를 사진", "어려운 문제", 699, 699),
];

export default samples;
