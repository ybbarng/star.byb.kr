export interface SampleCredit {
  author: string;
  license: string; // "CC BY 4.0", "CC0", "퍼블릭 도메인" 등
  licenseUrl?: string;
  sourceUrl: string; // 원본 페이지 (위키미디어 공용)
}

export interface Sample {
  src: string;
  thumb: string; // 고르는 화면의 작은 사진 (400×300 WebP)
  title: string;
  caption: string;
  width: number;
  height: number;
  // 바깥에서 가져온 사진의 출처. 직원이 찍은 사진은 없다.
  credit?: SampleCredit;
}

// 작은 사진은 이렇게 만든다 (public/samples 에서):
//   magick "<원본>" -auto-orient -resize 400x300^ -gravity center -extent 400x300 -quality 72 "thumbs/<이름>.webp"
// 바깥 사진은 위키미디어 공용의 긴 변 2000px 사본을 그대로 싣는다. 다시 압축하면(품질 85)
// 어두운 별이 뭉개져 8초 안에 못 푸는 사진이 있었다 (집 위 은하수).
const sample = (
  file: string,
  title: string,
  caption: string,
  width: number,
  height: number,
  credit?: SampleCredit,
): Sample => ({
  src: `/samples/${file}`,
  thumb: `/samples/thumbs/${file.replace(/\.[a-z]+$/, "")}.webp`,
  title,
  caption,
  width,
  height,
  ...(credit ? { credit } : {}),
});

const CC_BY_4 = {
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
};
const CC0 = {
  license: "CC0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
};
const PUBLIC_DOMAIN = { license: "퍼블릭 도메인 (미국 국립공원관리청)" };
const commons = (file: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;

// 북두칠성(big-dipper.jpg)·석촌호수 은하수·오리온(cafe-orion.jpg)·출처 모를 사진(google-unknown.jpg)은
// 바깥에서 출처를 밝히지 않고 가져온 사진이라 예시로 보이지 않는다 (회귀 테스트는 public/samples의 파일을 그대로 읽는다).
// 빈자리는 위키미디어 공용의 자유 이용 사진으로 채웠다: 사이트에서 확신으로 풀리고, 땅 위 물체가 함께 찍힌 사진.
// 맨 앞은 만든 사람(Brice)이 2024년 버즈홀리데이 때 캐나다 옐로나이프에서 찍은 오로라 (0.2초에 확신, 첫 화면 그림과 같은 사진).
// EXIF(GPS 포함)는 jpegtran -copy none으로 지웠다. 촬영 시각·장소는 shotTime.ts에 대략으로 적었다.
const samples: Sample[] = [
  sample(
    "20240401-brice-yellowknife-aurora.jpg",
    "옐로나이프 오로라",
    "2024년 4월",
    4000,
    1848,
  ),
  sample(
    "iau-watchtower-orion.jpg",
    "망루와 논",
    "오리온 · 겨울 하늘",
    2000,
    1384,
    {
      author: "Likai Lin/IAU OAE",
      ...CC_BY_4,
      sourceUrl: commons(
        "Watchtower and Paddy Fields Under the Starry Sky (ann22042j).jpg",
      ),
    },
  ),
  sample(
    "20231012-nike-aust-01.jpg",
    "호주 ①",
    "2023년 10월 · 남반구",
    4000,
    3000,
  ),
  sample(
    "wikimedia-holma-big-dipper.jpg",
    "보트 창고",
    "북두칠성 · 달빛",
    2000,
    1333,
    {
      author: "W.carter",
      ...CC0,
      sourceUrl: commons(
        "Holma Boat Club in moonlight under the Big Dipper.jpg",
      ),
    },
  ),
  sample("20220607-berry-seoul.jpg", "서울 근처 산", "2021년 10월", 1440, 1080),
  sample(
    "iau-nindiri-scorpius.jpg",
    "니카라과 마을",
    "전갈·센타우루스 · 남쪽 하늘",
    2000,
    1126,
    {
      author: "René Antonio Urroz Álvarez/IAU OAE",
      ...CC_BY_4,
      sourceUrl: commons(
        "Sky Over the Town of Nindirí, in Masaya, Nicaragua (ann22042ad).jpg",
      ),
    },
  ),
  sample(
    "20190617-jarrod-saipan.jpg",
    "사이판 바다",
    "2019년 6월 · 별이 적은 사진",
    1440,
    1920,
  ),
  sample(
    "iau-snow-tree-summer-triangle.jpg",
    "눈밭의 나무",
    "여름의 대삼각형 · 초겨울 저녁",
    2000,
    1600,
    {
      author: "Kouij Ohnishi/IAU OAE",
      ...CC_BY_4,
      sourceUrl: commons(
        "Forgoing the Summer Triangle as it Sets in the Early Winter Evening Author- Kouij Ohnishi (ann22042r).jpg",
      ),
    },
  ),
  sample(
    "20231012-nike-aust-02.jpg",
    "호주 ②",
    "2023년 10월 · 남반구",
    4000,
    3000,
  ),
  sample(
    "eso-southern-cross.jpg",
    "천문대 돔",
    "남십자·용골자리 성운",
    2000,
    1333,
    {
      author: "ESO/B. Tafreshi",
      ...CC_BY_4,
      sourceUrl: commons("Under the Southern Cross (potw1832a).jpg"),
    },
  ),
  sample(
    "20230904-nike-jeungseun-01.png",
    "여름 여행 ①",
    "2023년 9월",
    1280,
    960,
  ),
  sample(
    "wikimedia-lightning-cassiopeia.jpg",
    "번개 치는 마을",
    "카시오페이아",
    2000,
    1333,
    {
      author: "Kevin M. Gill",
      license: "CC BY 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
      sourceUrl: commons("Lighting, Stars, and Houses (36962357236).jpg"),
    },
  ),
  sample("20250117-carl-aurora-01.jpg", "오로라 ①", "2025년 1월", 3024, 4032),
  sample(
    "iau-etna-orion.jpg",
    "에트나 화산",
    "오리온 · 붉은 성운",
    2000,
    1406,
    {
      author: "Dario Giannobile/IAU OAE",
      ...CC_BY_4,
      sourceUrl: commons("Orion Rises Over Mount Etna (ann22042ag).jpg"),
    },
  ),
  sample(
    "20230904-nike-jeungseun-02.png",
    "여름 여행 ②",
    "2023년 9월",
    978,
    1304,
  ),
  sample(
    "nps-medano-milky-way.jpg",
    "모래 언덕",
    "은하수 중심 · 궁수·전갈",
    2000,
    1333,
    {
      author: "Great Sand Dunes National Park and Preserve",
      ...PUBLIC_DOMAIN,
      sourceUrl: commons("Milky Way over Medano Creek (52746254466).jpg"),
    },
  ),
  sample("20250117-carl-aurora-02.jpg", "오로라 ②", "2025년 1월", 3024, 4032),
  sample(
    "wikimedia-windfarm-big-dipper.jpg",
    "풍력 발전기",
    "북두칠성 · 지상 불빛",
    2000,
    1676,
    {
      author: "nanamori",
      license: "CC BY 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
      sourceUrl: commons(
        "Big Dipper and wind farms 北斗七星と風力発電所 山口県下関市豊北町白滝山 - panoramio.jpg",
      ),
    },
  ),
  sample(
    "20230904-nike-jeungseun-03.png",
    "여름 여행 ③",
    "2023년 9월",
    1280,
    960,
  ),
  sample(
    "iau-baigorri-orion.jpg",
    "교회 폐허",
    "오리온·에리다누스",
    2000,
    1333,
    {
      author: "Carlos Zudaire/IAU OAE",
      ...CC_BY_4,
      sourceUrl: commons("The Kingdom of Orion (ann22042a).jpg"),
    },
  ),
  sample("20250117-carl-aurora-03.jpg", "오로라 ③", "2025년 1월", 3024, 4032),
  sample(
    "nps-manitou-milky-way.jpg",
    "섬마을 집",
    "여름 은하수 · 넓은 화각",
    2000,
    1281,
    {
      author: "NPS Photo",
      ...PUBLIC_DOMAIN,
      sourceUrl: commons(
        "Milky Way Galaxy Over North Manitou Village (02d407c9-8929-4e76-b784-3f161060c0bb).jpg",
      ),
    },
  ),
  sample(
    "20230904-nike-jeungseun-04.png",
    "여름 여행 ④",
    "2023년 9월",
    1280,
    960,
  ),
  sample(
    "wikimedia-tents-sagittarius.jpg",
    "바위 옆 텐트",
    "남쪽 은하수 · 전갈 꼬리",
    2000,
    1333,
    {
      author: "Văn Ngọc Tăng",
      ...CC0,
      sourceUrl: commons("Clear night sky over tents (Unsplash).jpg"),
    },
  ),
  sample("20250117-carl-aurora-04.jpg", "오로라 ④", "2025년 1월", 3024, 4032),
];

export default samples;

// image.src(URL)에서 파일 이름을 뽑아 샘플 사진의 출처를 찾는다. 직원 사진·업로드 사진은 없다.
export const getSampleCredit = (src?: string): SampleCredit | null => {
  if (!src) {
    return null;
  }

  const file = decodeURIComponent(src.split("/").pop() ?? "");

  return samples.find((s) => s.src.endsWith(`/${file}`))?.credit ?? null;
};
