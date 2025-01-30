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
        label: rowData[0],
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

run();
