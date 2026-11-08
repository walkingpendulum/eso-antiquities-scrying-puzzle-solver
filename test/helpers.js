import fs from "node:fs";
import { buildComponentGraph } from "../src/core/graph.js";
export const layout = JSON.parse(
  fs.readFileSync(
    new URL("../public/calibration/layout.json", import.meta.url),
  ),
);
export function fixture(name) {
  return JSON.parse(
    fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)),
  );
}
export function boardGraph(name) {
  return buildComponentGraph(fixture(name), layout);
}
export function reached(graph, ordinary) {
  const allowed = new Set(["S", ..."ABCDEF", ...ordinary]),
    seen = new Set(["S"]),
    queue = ["S"];
  for (let i = 0; i < queue.length; i++)
    for (const next of graph.adjacency[queue[i]])
      if (allowed.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
  return seen;
}
