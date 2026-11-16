import { defineConfig } from "rolldown";
import packageJson from "./package.json" with { type: "json" };

const input = "./src/index.ts";
const external = Object.keys(packageJson.dependencies || {});

export default defineConfig([
  // ESM 输出
  {
    input,
    external,
    output: {
      format: "esm",
      file: "dist/index.js",
      sourcemap: true,
      exports: "named",
    },
    resolve: {
      extensions: [".ts", ".js", ".mjs"],
    },
  },
  // CJS 输出
  {
    input,
    external,
    output: {
      format: "cjs",
      file: "dist/index.cjs",
      sourcemap: true,
      exports: "named",
    },
    resolve: {
      extensions: [".ts", ".js", ".mjs"],
    },
  },
]);
