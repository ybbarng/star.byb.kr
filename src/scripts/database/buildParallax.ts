import * as file from "@/scripts/file";

// 빛의 타임캡슐(게임)용 별 거리: BSC5 원본의 연주 시차(162~166열, 각초)를 HR 번호별로 뽑는다.
// 브라우저가 1.7MB 원본 대신 작은 파일만 받게, 앱이 쓰는 별(vectors-database.json)만 남긴다.
// 시차가 작은 먼 별은 측정 오차가 커서 화면에서 "약"으로만 보여 준다.

const run = () => {
  const bsc5 = file.load("data/database", "bsc5.dat").split("\n");
  const used = new Set(
    (
      JSON.parse(file.load("build/database", "vectors-database.json")) as {
        HR: string;
      }[]
    ).map((s) => s.HR),
  );
  const parallax: Record<string, number> = {};

  for (const row of bsc5) {
    const hr = row.slice(0, 4).trim();
    const value = parseFloat(row.slice(161, 166));

    if (used.has(hr) && Number.isFinite(value) && value > 0) {
      parallax[hr] = value;
    }
  }

  file.save("build/database", "parallax.json", JSON.stringify(parallax));
};

run();
