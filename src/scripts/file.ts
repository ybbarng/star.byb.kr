import fs from "fs";

type Module = "database";

const ROOT = "../../../";
const INPUT_DIR = "data/";
const OUTPUT_DIR = "build/";

export const loadJson = (module: Module, fileName: string) => {
  const jsonFile = fs.readFileSync(
    `${ROOT}/${INPUT_DIR}/${module}/${fileName}`,
    "utf8",
  );

  return JSON.parse(jsonFile);
};

export const saveJson = (module: Module, fileName: string, payload: object) => {
  fs.writeFileSync(
    `${ROOT}/${OUTPUT_DIR}/${module}/${fileName}`,
    JSON.stringify(payload),
  );
};
