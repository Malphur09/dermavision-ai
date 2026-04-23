import next from "eslint-config-next";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  { ignores: ["node_modules/**", ".next/**", "dist/**", "out/**", "api/**", "venv/**", ".venv/**"] },
  ...next,
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
    },
  },
];

export default config;
