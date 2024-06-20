import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";


export default [
  {files: ["**/*.{ts}"]},
  {languageOptions: { globals: globals.node }},
  ...tseslint.configs.recommended,
  { rules: {
    "@typescript-eslint/no-unused-vars": 0
  }},
{ignores: ["**/*.js"]}
];