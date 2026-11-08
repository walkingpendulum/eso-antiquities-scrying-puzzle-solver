import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url)),
);
export default defineConfig({
  base: process.env.BASE_PATH || "./",
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: "es2022" },
  server: { host: "0.0.0.0", allowedHosts: true },
});
