/** Six-sided adjacency on the fixed 110-cell offset grid. */
export function buildComponentGraph(labels, layout) {
  const cells = layout.cells,
    byId = new Map(cells.map((c) => [c.id, c])),
    types = ["s", "d", "h", "w", "r"];
  function neighbors(k) {
    const [c, r] = k.split(",").map(Number),
      out = [];
    for (const [a, b] of [
      [c, r - 1],
      [c, r + 1],
      ...[-1, 1].flatMap((dc) =>
        (c % 2 === 0 ? [0, 1] : [-1, 0]).map((dr) => [c + dc, r + dr]),
      ),
    ]) {
      const n = `${a},${b}`;
      if (byId.has(n)) out.push(n);
    }
    return out;
  }
  function graph(labels) {
    const seen = new Set(),
      nodes = {},
      owner = {},
      edgesSet = new Set();
    for (const t of "ABCDEF")
      if (cells.filter((c) => labels[c.id] === t).length !== 1)
        throw Error("The board must contain six distinct foci A–F.");
    for (const c of cells) {
      if (seen.has(c.id)) continue;
      const t = labels[c.id];
      if (
        typeof t !== "string" ||
        (!types.includes(t) && !(t.length === 1 && "ABCDEF".includes(t)))
      )
        throw Error("Invalid board labels.");
      const stack = [c.id],
        part = [];
      seen.add(c.id);
      while (stack.length) {
        const a = stack.pop();
        part.push(a);
        for (const b of neighbors(a))
          if (!seen.has(b) && labels[b] === t) {
            seen.add(b);
            stack.push(b);
          }
      }
      const n = "ABCDEF".includes(t) ? t : `n${Object.keys(nodes).length + 1}`;
      nodes[n] = { type: t, cells: part.sort() };
      for (const k of part) owner[k] = n;
    }
    function edge(a, b) {
      edgesSet.add([a, b].sort().join("|"));
    }
    for (const k of Object.keys(owner))
      for (const j of neighbors(k))
        if (owner[k] !== owner[j]) edge(owner[k], owner[j]);
    nodes.S = { type: "S", cells: [] };
    for (const k of layout.start_cells) edge("S", owner[k]);
    const edges = [...edgesSet].sort().map((k) => k.split("|")),
      adjacency = Object.fromEntries(Object.keys(nodes).map((n) => [n, []]));
    for (const [a, b] of edges) {
      adjacency[a].push(b);
      adjacency[b].push(a);
    }
    return { nodes, owner, edges, adjacency };
  }
  return graph(labels);
}
