import { convertTo3DCoordinates } from "@/app/database/utils/coordinates";
import * as file from "@/scripts/file";

const run = () => {
  const catalog = loadStars();
  console.log(
    `로드한 카탈로그에는 총 ${catalog.size} 개의 별 정보가 있습니다.`,
  );
  const constellations = loadConstellationLines(catalog);
  file.save(
    "build/database",
    "vectors-constellations.json",
    JSON.stringify(constellations, null, 2),
  );
};

const loadStars = () => {
  const bsc5dat = file.load("data/database", "bsc5.dat");
  const starData = bsc5dat.split("\n");
  const starCatalog = new Map<number, Star>();
  starData.forEach((row: string) => {
    const vector = convertTo3DCoordinates(row.slice(83, 90), row.slice(75, 83));
    const star: Star = {
      id: Number(row.slice(0, 4)),
      v: [vector.x, vector.y, vector.z],
    };
    starCatalog.set(star.id, star);
  });

  return starCatalog;
};

const loadConstellationLines = (catalog: Map<number, Star>) => {
  const constellationLines = file.load(
    "data/database",
    "ConstellationLines.dat",
  );

  const constellationLinesData = constellationLines.split("\n");
  const constellations: ConstellationLineData[] = [];
  constellationLinesData.forEach((row) => {
    if (!row.startsWith("#") && row.length > 1) {
      const rowData = row.split(/[ ,]+/);
      const stars: [number, number, number][] = [];

      for (let i = 0; i < rowData.length - 2; i++) {
        const starId = parseInt(rowData[i + 2].trim());
        const star = catalog.get(starId);

        if (star) {
          stars.push(star.v);
        }
      }

      constellations.push({
        label: koreanName[rowData[0]],
        stars,
      });
    }
  });

  return constellations;
};

interface Star {
  id: number;
  v: [number, number, number];
}

interface ConstellationLineData {
  label: string;
  stars: [number, number, number][];
}

const koreanName: { [key: string]: string } = {
  And: "안드로메다자리",
  Ant: "공기펌프자리",
  Aps: "극락조자리",
  Apr: "물병자리",
  Aql: "독수리자리",
  Ara: "제단자리",
  Ari: "양자리",
  Aur: "마차부자리",
  Boo: "목동자리",
  Cae: "조각칼자리",
  Cam: "기린자리",
  Cnc: "게자리",
  CVn: "사냥개자리",
  CMa: "큰개자리",
  CMi: "작은개자리",
  Cap: "염소자리",
  Car: "용골자리",
  Cas: "카시오페이아자리",
  Cen: "센타우루스자리",
  Cep: "세페우스자리",
  Cet: "고래자리",
  Cha: "카멜레온자리",
  Cir: "컴퍼스자리",
  Col: "비둘기자리",
  Com: "머리털자리",
  CrA: "남쪽왕관자리",
  CrB: "북쪽왕관자리",
  Crv: "까마귀자리",
  Crt: "컵자리",
  Cru: "남십자자리",
  Cyg: "백조자리",
  Del: "돌고래자리",
  Dor: "황새치자리",
  Dra: "용자리",
  Equ: "조랑말자리",
  Eri: "에리다누스자리",
  For: "화로자리",
  Gem: "쌍둥이자리",
  Gru: "두루미자리",
  Her: "헤르쿨레스자리",
  Hor: "시계자리",
  Hya: "바다뱀자리",
  Hyi: "물뱀자리",
  Ind: "인디언자리",
  Lac: "도마뱀자리",
  Leo: "사자자리",
  LMi: "작은사자자리",
  Lep: "토끼자리",
  Lib: "천칭자리",
  Lup: "이리자리",
  Lyn: "살쾡이자리",
  Lyr: "거문고자리",
  Men: "테이블산자리",
  Mic: "현미경자리",
  Mon: "외뿔소자리",
  Mus: "파리자리",
  Nor: "직각자자리",
  Oct: "팔분의자리",
  Oph: "뱀주인자리",
  Ori: "오리온자리",
  Pav: "공작자리",
  Peg: "페가수스자리",
  Per: "페르세우스자리",
  Phe: "불사조자리",
  Pic: "화가자리",
  Psc: "물고기자리",
  PsA: "남쪽물고기자리",
  Pup: "고물자리",
  Pyx: "나침반자리",
  Ret: "그물자리",
  Sge: "화살자리",
  Sgr: "궁수자리",
  Sco: "전갈자리",
  Scl: "조각가자리",
  Sct: "방패자리",
  Ser: "뱀자리",
  Sex: "육분의자리",
  Tau: "황소자리",
  Tel: "망원경자리",
  Tri: "삼각형자리",
  TrA: "남쪽삼각형자리",
  Tuc: "큰부리새자리",
  UMa: "큰곰자리",
  UMi: "작은곰자리",
  Vel: "돛자리",
  Vir: "처녀자리",
  Vol: "날치자리",
  Vul: "여우자리",
};

run();
