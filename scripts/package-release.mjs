import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync("package.json"));
const suffix = process.env.GITHUB_RUN_NUMBER
  ? `-build.${process.env.GITHUB_RUN_NUMBER}`
  : "";
const name = `eso-scrying-solver-v${version}${suffix}`;
mkdirSync("release", { recursive: true });
writeFileSync("dist/VERSION.txt", `${version}${suffix}\n`);
execFileSync("zip", ["-q", "-r", `../release/${name}.zip`, "."], {
  cwd: "dist",
});
console.log(`release/${name}.zip`);
