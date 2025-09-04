import globals from "globals";

export default [
  {
    files: ["src/**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 2021,
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    // Keep rules empty here; use the local .eslintrc.cjs in this package to enable plugin rules.
    rules: {},
  },
];
