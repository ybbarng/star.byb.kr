import fs from "fs";

type Module = "database";

// TODO: 프로젝트 루트를 정확하게 찾도록 변경하기
// 지금은 항상 프로젝트 루트에서 스크립트를 실행한다고 가정
const ROOT = ".";
const INPUT_DIR = "data";
const OUTPUT_DIR = "build";

export const loadJson = (module: Module, fileName: string) => {
  const jsonFile = fs.readFileSync(
    `${ROOT}/${INPUT_DIR}/${module}/${fileName}`,
    "utf8",
  );

  return JSON.parse(jsonFile);
};

export const saveJson = (module: Module, fileName: string, payload: string) => {
  const outputDirPath = `${ROOT}/${OUTPUT_DIR}/${module}`;
  const outputFilePath = `${outputDirPath}/${fileName}`;

  // 디렉토리가 없으면 생성
  if (!fs.existsSync(outputDirPath)) {
    fs.mkdirSync(outputDirPath, { recursive: true });
    console.log(`디렉토리 생성 완료: ${outputDirPath}`);
  }

  fs.writeFileSync(`${outputDirPath}/${fileName}`, payload, "utf8");
  console.log(`파일이 성공적으로 저장되었습니다: ${outputFilePath}`);
};
