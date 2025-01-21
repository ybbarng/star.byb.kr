import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import noRelativeImportPaths from "eslint-plugin-no-relative-import-paths";
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
      "no-extra-boolean-cast": "warn",
      "newline-before-return": "error",
      "comma-dangle": ["error", "always-multiline"],
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "function", next: "*" },
        { blankLine: "always", prev: "*", next: "function" },
        { blankLine: "always", prev: "*", next: "multiline-block-like" },
        { blankLine: "always", prev: "multiline-block-like", next: "*" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prettier/prettier": [
        "error",
        {
          doubleQuote: true,
          plugins: ["prettier-plugin-tailwindcss"],
        },
      ],
    },
  },
  {
    plugins: {
      "no-relative-import-paths": noRelativeImportPaths,
    },
    rules: {
      "no-relative-import-paths/no-relative-import-paths": [
        "warn",
        { allowSameFolder: true, rootDir: "src", prefix: "@" },
      ],
    },
  },
];

export default eslintConfig;
