import { test } from "node:test";
import assert from "node:assert/strict";
import { solveComponentGraph } from "../src/core/solver.js";
import { buildComponentGraph } from "../src/core/graph.js";
import { orderHexSolution, renderHexSVG } from "../src/core/render.js";
import { layout, fixture, reached } from "./helpers.js";

test("budgeted Steiner solver matches exhaustive search on 100 branching cases", () => {
  const terms = ["S", ..."ABCDEF"],
    ordinary = ["x", "y", "z", "v"];
  let seed = 482;
  const random = () =>
    (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let trial = 0; trial < 20; trial++) {
    const names = [...terms, ...ordinary];
    const graph = {
      nodes: Object.fromEntries(
        names.map((name, i) => [name, { cells: [`0,${i % 8}`] }]),
      ),
      adjacency: Object.fromEntries(names.map((name) => [name, []])),
    };
    const connect = (a, b) => {
      if (!graph.adjacency[a].includes(b)) {
        graph.adjacency[a].push(b);
        graph.adjacency[b].push(a);
      }
    };
    for (let i = 1; i < names.length; i++)
      connect(names[i], names[Math.floor(random() * i)]);
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++)
        if (random() < 0.1) connect(names[i], names[j]);
    for (let budget = 0; budget <= 4; budget++) {
      let bestCount = -1,
        bestCost = Infinity;
      for (let mask = 0; mask < 16; mask++) {
        const selected = ordinary.filter((_, i) => (mask >> i) & 1);
        if (selected.length > budget) continue;
        const seen = reached(graph, selected),
          count = [..."ABCDEF"].filter((t) => seen.has(t)).length;
        if (
          count > bestCount ||
          (count === bestCount && selected.length < bestCost)
        ) {
          bestCount = count;
          bestCost = selected.length;
        }
      }
      const plan = solveComponentGraph(graph, budget);
      assert.equal(plan.goal_count, bestCount);
      assert.equal(plan.minimum, bestCost);
      const order = orderHexSolution(graph, plan);
      for (let i = 0; i < order.length; i++) {
        const owned = reached(graph, order.slice(0, i));
        assert(graph.adjacency[order[i]].some((n) => owned.has(n)));
      }
    }
  }
});

test("one purchased component can unlock three foci in the same move", () => {
  const names = ["S", ..."ABCDEF", "x", "y"];
  const graph = {
    nodes: Object.fromEntries(names.map((n) => [n, { cells: ["0,0"] }])),
    adjacency: Object.fromEntries(names.map((n) => [n, []])),
  };
  for (const [a, b] of [
    ["S", "x"],
    ["x", "A"],
    ["x", "B"],
    ["x", "C"],
    ["x", "y"],
    ["y", "D"],
    ["y", "E"],
    ["y", "F"],
  ]) {
    graph.adjacency[a].push(b);
    graph.adjacency[b].push(a);
  }
  assert.equal(solveComponentGraph(graph, 1).goal_count, 3);
  assert.equal(solveComponentGraph(graph, 2).goal_count, 6);
  assert.equal(solveComponentGraph(graph, 0).minimum, 0);
});

test("real board regressions preserve the requested budget, exact costs and playable SVG order", () => {
  const boards = [
    [
      Object.fromEntries(layout.cells.map((c) => [c.id, c.reference_type])),
      6,
      8,
      8,
    ],
    [fixture("board-four-types"), 5, 7, 9],
    [fixture("board-five-types"), 6, 7, 7],
    [fixture("board-animated-rays"), 5, 7, 9],
  ];
  for (const [labels, count, cost, full] of boards) {
    const graph = buildComponentGraph(labels, layout),
      plan = solveComponentGraph(graph, 8),
      svg = renderHexSVG(graph, plan);
    assert.equal(plan.goal_count, count);
    assert.equal(plan.minimum, cost);
    assert.equal(plan.full_minimum, full);
    assert.equal((svg.match(/class="badge"/g) || []).length, cost);
    assert.equal((svg.match(/class="target"/g) || []).length, 6);
    assert(!svg.includes("undefined"));
    assert.equal(orderHexSolution(graph, plan).length, cost);
    const zero = solveComponentGraph(graph, 0);
    assert.equal(zero.minimum, 0);
    assert.equal(solveComponentGraph(graph, full).goal_count, 6);
  }
});

test("invalid move limits are rejected", () => {
  const graph = buildComponentGraph(fixture("board-four-types"), layout);
  for (const budget of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => solveComponentGraph(graph, budget));
});
