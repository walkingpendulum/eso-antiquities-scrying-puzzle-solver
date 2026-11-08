// A playable order: grow the selected connected region outwards from S.
export function orderHexSolution(g, solution) {
  const remaining = new Set(solution.ordinary),
    owned = new Set(["S"]),
    order = [];
  const free = new Set(["S", ..."ABCDEF"]);
  const closeTargets = () => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of free)
        if (
          g.nodes[n] &&
          !owned.has(n) &&
          g.adjacency[n].some((a) => owned.has(a))
        ) {
          owned.add(n);
          changed = true;
        }
    }
  };
  const bottom = (n) =>
    Math.max(
      ...g.nodes[n].cells.map((k) => {
        const [c, r] = k.split(",").map(Number);
        return r + (c % 2 === 0 ? 0.5 : 0);
      }),
    );
  closeTargets();
  while (remaining.size) {
    const candidates = [...remaining].filter((n) =>
      g.adjacency[n].some((a) => owned.has(a)),
    );
    candidates.sort(
      (a, b) => bottom(b) - bottom(a) || (a < b ? -1 : a > b ? 1 : 0),
    );
    if (!candidates.length)
      throw Error("Selected components are disconnected from the start.");
    const next = candidates[0];
    remaining.delete(next);
    owned.add(next);
    order.push(next);
    closeTargets();
  }
  const expected = solution.goals || [..."ABCDEF"];
  if (!expected.every((n) => owned.has(n)))
    throw Error("The move order does not reach the selected foci.");
  if (
    solution.goals &&
    [..."ABCDEF"].filter((n) => owned.has(n)).length !== solution.goals.length
  )
    throw Error("Reached focus count does not match the plan.");
  return order;
}

export function renderHexSVG(g, solution = null, grid = false, uncertain = []) {
  const colors = {
      s: "#b9dffb",
      d: "#ffe49a",
      h: "#d6c9f8",
      w: "#b6e9d9",
      r: "#ffd2ac",
      A: "#ffb8c5",
      B: "#ffb8c5",
      C: "#ffb8c5",
      D: "#ffb8c5",
      E: "#ffb8c5",
      F: "#ffb8c5",
    },
    nums = { s: "1", d: "2", h: "3", w: "4", r: "5" },
    chosen = new Set(solution?.ordinary || []),
    unsure = new Set(uncertain),
    R = 36,
    DY = Math.sqrt(3) * R;
  const pos = (k) => {
    let [c, r] = k.split(",").map(Number);
    return [55 + c * 54, 45 + r * DY + (c % 2 === 0 ? DY / 2 : 0)];
  };
  const poly = (k) => {
    let [x, y] = pos(k);
    return Array.from({ length: 6 }, (_, i) => [
      +(x + R * Math.cos((i * Math.PI) / 3)).toFixed(4),
      +(y + R * Math.sin((i * Math.PI) / 3)).toFixed(4),
    ]);
  };
  const pts = (p) => p.map((x) => x.join(",")).join(" "),
    boundary = new Map(),
    perimeters = {},
    representatives = {};
  let out = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 670" role="img" aria-label="Connected components shown as regions"><defs><g id="icon-s" fill="currentColor">',
  ];
  for (let i = 0; i < 6; i++)
    out.push(
      `<path transform="rotate(${i * 60})" fill-rule="evenodd" d="M0 -26 L4 -15 L0 -6 L-4 -15 Z M0 -19 L1 -15 L0 -12 L-1 -15 Z"/>`,
    );
  out.push(
    '</g><g id="icon-d" fill="currentColor"><path d="M0 -6 L2 -2 L6 0 L2 2 L0 6 L-2 2 L-6 0 L-2 -2 Z"/>',
  );
  for (let i = 0; i < 6; i++)
    out.push(
      `<path transform="rotate(${i * 60})" d="M0 -23 L2 -19 L0 -16 L-2 -19 Z"/>`,
    );
  out.push(
    '</g><g id="icon-h" fill="none" stroke="currentColor" stroke-width="2.3">',
  );
  for (const r of [10, 21])
    out.push(
      `<polygon points="${pts(Array.from({ length: 6 }, (_, i) => [r * Math.cos((i * Math.PI) / 3), r * Math.sin((i * Math.PI) / 3)]))}"/>`,
    );
  out.push('</g><g id="icon-w" fill="currentColor">');
  for (let i = 0; i < 6; i++)
    out.push(
      `<path transform="rotate(${i * 60})" d="M2 3 C1 -4 5 -12 12 -10 C19 -7 22 -12 20 -20 C16 -10 12 -17 7 -16 C-1 -14 -6 -4 2 3Z"/>`,
    );
  out.push('</g><g id="icon-r" stroke="currentColor" stroke-width="1.5">');
  for (let i = 0; i < 12; i++)
    out.push(
      `<path transform="rotate(${i * 30})" d="M0 -${i % 3 === 0 ? 26 : 18} L0 0"/>`,
    );
  out.push(
    '</g></defs><style>text{font-family:system-ui,sans-serif;text-anchor:middle;dominant-baseline:central;fill:#172f43}.target{font-size:25px;font-weight:700}.num{font-size:22px}.badge{fill:white;font-size:13px;font-weight:700}</style><rect width="760" height="670" fill="white"/>',
  );
  for (const [n, v] of Object.entries(g.nodes)) {
    if (n === "S") continue;
    const t = v.type,
      edges = new Map(),
      fill =
        !solution ||
        chosen.has(n) ||
        ("ABCDEF".includes(n) &&
          (!solution?.goals || solution.goals.includes(n)))
          ? colors[t]
          : "#f1f3f5";
    for (const k of v.cells) {
      const p = poly(k);
      out.push(
        `<polygon points="${pts(p)}" fill="${fill}" stroke="${fill}" stroke-width=".7"/>`,
      );
      for (let i = 0; i < 6; i++) {
        const ends = [p[i], p[(i + 1) % 6]].sort(
            (a, b) => a[0] - b[0] || a[1] - b[1],
          ),
          key = JSON.stringify(ends);
        edges.set(key, (edges.get(key) || 0) + 1);
      }
      if (grid) {
        out.push(
          `<polygon points="${pts(p)}" fill="none" stroke="${unsure.has(k) ? "#ef8a23" : "#66788c"}" stroke-width="${unsure.has(k) ? 3 : 1}"/>`,
        );
        const [x, y] = pos(k);
        out.push(`<text x="${x}" y="${y}" class="num">${nums[t] || t}</text>`);
      }
    }
    const outer = [...edges]
      .filter(([, count]) => count === 1)
      .map(([key]) => JSON.parse(key));
    perimeters[n] = outer;
    for (const e of outer) boundary.set(JSON.stringify(e), e);
    const xy = v.cells.map(pos),
      mean = xy.reduce(
        (s, p) => [s[0] + p[0] / xy.length, s[1] + p[1] / xy.length],
        [0, 0],
      ),
      center = xy.reduce((a, b) =>
        Math.hypot(a[0] - mean[0], a[1] - mean[1]) <=
        Math.hypot(b[0] - mean[0], b[1] - mean[1])
          ? a
          : b,
      );
    representatives[n] = { xy, center };
  }
  function line(a, b, color, width) {
    out.push(
      `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" fill="none" stroke="${color}" stroke-width="${width}"/>`,
    );
  }
  if (!grid) {
    for (const [a, b] of boundary.values()) line(a, b, "#425367", 1.4);
    for (const n of chosen)
      for (const [a, b] of perimeters[n]) line(a, b, "#dc3757", 3);
    for (const [n, v] of Object.entries(g.nodes)) {
      if (n === "S") continue;
      const [x, y] = representatives[n].center;
      if ("ABCDEF".includes(v.type))
        out.push(`<text x="${x}" y="${y}" class="target">${v.type}</text>`);
      else
        out.push(
          `<use href="#icon-${v.type}" transform="translate(${x} ${y})" style="color:${solution && !chosen.has(n) ? "#bec6ce" : "#172f43"}"/>`,
        );
    }
    if (solution) {
      const order = orderHexSolution(g, solution);
      order.forEach((n, i) => {
        const { xy, center } = representatives[n];
        let [x, y] = xy.reduce((a, b) =>
          Math.hypot(a[0] - center[0], a[1] - center[1]) >=
          Math.hypot(b[0] - center[0], b[1] - center[1])
            ? a
            : b,
        );
        if (xy.length === 1) {
          x += 18;
          y += 18;
        }
        out.push(
          `<circle cx="${x}" cy="${y}" r="10" fill="#dc3757" stroke="white" stroke-width="1.5"/><text data-component="${n}" x="${x}" y="${y}" class="badge">${i + 1}</text>`,
        );
      });
    }
  }
  for (const k of ["5,8", "6,7", "7,8"]) {
    const [x, y] = pos(k);
    line(
      [379, 613],
      [x, y + DY / 2],
      chosen.has(g.owner[k]) ? "#dc3757" : "#66788c",
      2,
    );
  }
  out.push(
    '<rect x="341" y="613" width="76" height="30" rx="8" fill="white" stroke="#425367"/><text x="379" y="628" font-size="17" font-weight="700">Start</text></svg>',
  );
  return out.join("");
}
