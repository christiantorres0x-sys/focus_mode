// Lint rules (SRS Phase 1: "establish linting and project conventions").
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "scripts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.serviceworker } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["error", "log", "warn"] }],
    },
  },
  { files: ["src/**/*.test.ts", "tests/**/*.ts"], languageOptions: { globals: globals.node } },
);
