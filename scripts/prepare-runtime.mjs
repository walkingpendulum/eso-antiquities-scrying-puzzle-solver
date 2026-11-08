import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const url = "https://docs.opencv.org/4.13.0/opencv.js";
const expected =
  "63366510248adf3a7eddf3e793dd825404efb7df3749f4d6f8557c7fa4ca8aa0";
const path = new URL("../public/vendor/opencv.js", import.meta.url);
await mkdir(new URL("../public/vendor/", import.meta.url), { recursive: true });
let bytes;
try {
  bytes = await readFile(path);
} catch {
  /* Download on a clean checkout. */
}
if (!bytes || createHash("sha256").update(bytes).digest("hex") !== expected) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok)
    throw Error(`OpenCV download failed: HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== expected)
    throw Error(
      "OpenCV integrity check failed. Review the upstream artifact before updating its hash.",
    );
  await writeFile(path, bytes);
}
await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
await writeFile(new URL("../.cache/opencv.cjs", import.meta.url), bytes);
console.log("OpenCV 4.13.0: SHA-256 verified.");
