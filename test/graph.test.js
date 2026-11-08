import { test } from "node:test";
import assert from "node:assert/strict";
import { buildComponentGraph } from "../src/core/graph.js";
import { layout, fixture } from "./helpers.js";

test("components partition all 110 cells, with symmetric edges and the three start neighbors", () => {
  const graph = buildComponentGraph(fixture("board-five-types"), layout);
  assert.equal(Object.keys(graph.owner).length, 110);
  const cells = Object.values(graph.nodes).flatMap((n) => n.cells);
  assert.equal(new Set(cells).size, 110);
  assert.equal(cells.length, 110);
  for (const [a, b] of graph.edges) {
    assert.notEqual(a, b);
    assert(graph.adjacency[a].includes(b));
    assert(graph.adjacency[b].includes(a));
  }
  assert.deepEqual(
    new Set(graph.adjacency.S),
    new Set(layout.start_cells.map((id) => graph.owner[id])),
  );
  for (const target of "ABCDEF")
    assert.equal(graph.nodes[target].cells.length, 1);
});

test("variable focus positions are read from labels, not the calibration layout", () => {
  const graph = buildComponentGraph(fixture("board-five-types"), layout);
  assert.deepEqual(graph.nodes.A.cells, ["1,6"]);
  assert.deepEqual(graph.nodes.B.cells, ["2,3"]);
});

test("invalid glyphs and missing or duplicate foci are rejected", () => {
  const truth = fixture("board-five-types");
  for (const value of ["", "unknown", undefined])
    assert.throws(() =>
      buildComponentGraph({ ...truth, "0,0": value }, layout),
    );
  assert.throws(() => buildComponentGraph({ ...truth, "1,6": "s" }, layout));
  assert.throws(() => buildComponentGraph({ ...truth, "0,0": "A" }, layout));
});
