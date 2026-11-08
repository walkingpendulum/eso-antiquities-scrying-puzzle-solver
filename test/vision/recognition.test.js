import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import sharp from "sharp";
import { createVisionEngine } from "../../src/core/vision.js";
import { buildComponentGraph } from "../../src/core/graph.js";
import { solveComponentGraph } from "../../src/core/solver.js";
import { layout, fixture } from "../helpers.js";
const require = createRequire(import.meta.url);
const { cv } = await new Promise((resolve) =>
  require("../../.cache/opencv.cjs").then((cv) => resolve({ cv })),
);
const reference = await sharp("public/calibration/reference.jpg")
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const calibration = {
  ...layout,
  symbol_templates: JSON.parse(
    await readFile("public/calibration/symbol-templates.json"),
  ),
  alignment_templates: JSON.parse(
    await readFile("public/calibration/alignment-templates.json"),
  ),
};
const engine = createVisionEngine(cv, calibration);
engine.init(reference.data, reference.info.width, reference.info.height);
const alternate = [
  "wdhhdwds",
  "hhwsBhdsw",
  "ddwsshsd",
  "sCshwhwAs",
  "whddwdsh",
  "dwshdswsw",
  "hddswhhs",
  "swdhwhwwh",
  "ddwsdsdw",
  "hDwhdhhFd",
  "swhwswss",
  "wdwwEhsdw",
  "swddwdds",
];
const cases = [
  [
    "reference",
    Object.fromEntries(layout.cells.map((c) => [c.id, c.reference_type])),
    4,
    6,
  ],
  ["four-types", fixture("board-four-types"), 4, 5],
  [
    "alternate-four-types",
    Object.fromEntries(
      alternate.flatMap((col, c) => [...col].map((t, r) => [`${c},${r}`, t])),
    ),
    4,
    5,
  ],
  ["five-types", fixture("board-five-types"), 5, 6],
  ["animated-rays", fixture("board-animated-rays"), 5, 5],
];
for (const [name, truth, types, goals] of cases) {
  test(`all 110 glyphs, dynamic foci and the move budget: ${name}`, async () => {
    const image = await sharp("public/calibration/reference.jpg")
      .composite([{ input: `test/fixtures/${name}.webp`, left: 220, top: 220 }])
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const matrix = engine.mat(image.data, image.info.width, image.info.height);
    try {
      const result = engine.classify(matrix);
      assert.deepEqual(result.labels, truth);
      assert.deepEqual(result.uncertain, []);
      assert.equal(result.configuration.type_count, types);
      const graph = buildComponentGraph(result.labels, layout),
        plan = solveComponentGraph(graph, 8);
      assert.equal(plan.goal_count, goals);
    } finally {
      matrix.delete();
    }
  });
}
test("alignment tolerates a resized, dimmed and JPEG-compressed photograph", async () => {
  const jpeg = await sharp("public/calibration/reference.jpg")
    .resize({ width: 1280 })
    .modulate({ brightness: 0.85 })
    .jpeg({ quality: 85 })
    .toBuffer();
  const raw = await sharp(jpeg)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = engine.analyze(raw.data, raw.info.width, raw.info.height, 8);
  assert.equal(result.status, "solved");
  assert.deepEqual(result.labels, cases[0][1]);
  assert.equal(result.solution.goal_count, 6);
});
test("unrelated and cropped photographs fail safely", async () => {
  assert.throws(() =>
    engine.analyze(new Uint8Array(640 * 480 * 4).fill(80), 640, 480, 8),
  );
  const cropped = await sharp("public/calibration/reference.jpg")
    .extract({ left: 500, top: 0, width: 900, height: 1000 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.throws(() =>
    engine.analyze(cropped.data, cropped.info.width, cropped.info.height, 8),
  );
});
