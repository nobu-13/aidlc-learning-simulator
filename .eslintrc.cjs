/* eslint-disable */
// ESLint 設定。TypeScript strict と accessibility を静的に担保する。
// 決定性（NFR2 / BR8.2）: domain/evaluation/semantic-ID レイヤーから
// Date / Math.random / performance.now を no-restricted-globals / no-restricted-properties で静的排除する。
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  settings: { react: { version: "18.3" } },
  plugins: ["@typescript-eslint", "react", "react-hooks", "jsx-a11y"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
  ],
  ignorePatterns: ["dist", "coverage", "node_modules", "*.cjs"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      // 決定的 core（評価 / 進行 / semantic-ID 導出）は time/random を参照禁止。
      files: ["src/domain/**/*.ts"],
      rules: {
        "no-restricted-globals": [
          "error",
          { name: "Date", message: "domain は決定的: Date を参照しない（BR8.2/NFR2）。" },
          { name: "performance", message: "domain は決定的: performance を参照しない（BR8.2/NFR2）。" },
        ],
        "no-restricted-properties": [
          "error",
          { object: "Math", property: "random", message: "domain は決定的: Math.random を参照しない（BR8.2/NFR2）。" },
          { object: "Date", property: "now", message: "domain は決定的: Date.now を参照しない（BR8.2/NFR2）。" },
          { object: "performance", property: "now", message: "domain は決定的: performance.now を参照しない（BR8.2/NFR2）。" },
        ],
      },
    },
    {
      // テストでは axe matcher 等のため一部緩和。
      files: ["**/*.test.ts", "**/*.test.tsx"],
      env: { node: true },
    },
  ],
};
