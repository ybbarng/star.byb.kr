import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  eslintPluginPrettierRecommended,
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "import/order": [
        "error",
        {
          groups: [
            "type",
            "builtin",
            "external",
            "parent",
            "sibling",
            "index",
            "unknown",
          ],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
          "newlines-between": "never",
        },
      ],
    }
  }
];

export default eslintConfig;
