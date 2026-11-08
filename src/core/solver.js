/** Exact vertex-weighted Steiner DP, then maximize focus coverage within the budget. */
export function solveComponentGraph(g, budget = Infinity) {
  if (budget !== Infinity && (!Number.isSafeInteger(budget) || budget < 0))
    throw Error("The move limit must be a non-negative safe integer.");
  const nodes = Object.keys(g.nodes),
    ix = new Map(nodes.map((n, i) => [n, i])),
    N = nodes.length,
    terms = ["S", ..."ABCDEF"],
    cost = nodes.map((n) => (terms.includes(n) ? 0 : 1)),
    adj = nodes.map((n) => g.adjacency[n].map((b) => ix.get(b))),
    dp = Array.from({ length: 128 }, () => new Int16Array(N).fill(10000)),
    how = Array.from({ length: 128 }, () => new Uint8Array(N)),
    param = Array.from({ length: 128 }, () => new Int16Array(N));
  for (let j = 0; j < 7; j++) dp[1 << j][ix.get(terms[j])] = 0;
  for (let m = 1; m < 128; m++) {
    for (let sub = (m - 1) & m; sub; sub = (sub - 1) & m) {
      let other = m ^ sub;
      if (other && sub < other)
        for (let v = 0; v < N; v++) {
          let val = dp[sub][v] + dp[other][v] - cost[v];
          if (val < dp[m][v]) {
            dp[m][v] = val;
            how[m][v] = 1;
            param[m][v] = sub;
          }
        }
    }
    // Dense Dijkstra: at most 111 vertices, avoids heap allocation on mobile.
    const seen = new Uint8Array(N);
    for (let step = 0; step < N; step++) {
      let v = -1;
      for (let u = 0; u < N; u++)
        if (!seen[u] && (v < 0 || dp[m][u] < dp[m][v])) v = u;
      if (v < 0 || dp[m][v] >= 10000) break;
      seen[v] = 1;
      for (const u of adj[v]) {
        const d = dp[m][v] + cost[u];
        if (d < dp[m][u]) {
          dp[m][u] = d;
          how[m][u] = 2;
          param[m][u] = v;
        }
      }
    }
  }
  const root = ix.get("S"),
    full_minimum = dp[127][root];
  let bestMask = 127;
  if (Number.isFinite(budget)) {
    if (!Number.isSafeInteger(budget) || budget < 0)
      throw Error("The move limit must be a non-negative safe integer.");
    const bitCount = (m) => {
      let count = 0;
      while (m) {
        count += m & 1;
        m >>>= 1;
      }
      return count;
    };
    bestMask = 1;
    for (let m = 1; m < 128; m += 2) {
      if (dp[m][root] > budget) continue;
      const count = bitCount(m) - 1,
        bestCount = bitCount(bestMask) - 1;
      if (
        count > bestCount ||
        (count === bestCount && dp[m][root] < dp[bestMask][root])
      )
        bestMask = m;
    }
  }
  const minimum = dp[bestMask][root],
    selected = new Set(),
    visited = new Set();
  function recover(m, v) {
    const key = m * N + v;
    if (visited.has(key)) return;
    visited.add(key);
    selected.add(nodes[v]);
    if (how[m][v] === 2) {
      recover(m, param[m][v]);
    } else if (how[m][v] === 1) {
      const sub = param[m][v];
      recover(sub, v);
      recover(m ^ sub, v);
    }
  }
  recover(bestMask, root);
  const ordinary = [...selected].filter((n) => !terms.includes(n)).sort(),
    ordinarySet = new Set(ordinary),
    seen = new Set(["S"]),
    queue = ["S"],
    edges = [];
  // Count every automatically reached focus, including foci not requested by the mask.
  for (let i = 0; i < queue.length; i++)
    for (const b of g.adjacency[queue[i]])
      if ((ordinarySet.has(b) || terms.includes(b)) && !seen.has(b)) {
        seen.add(b);
        queue.push(b);
        edges.push([queue[i], b].sort());
      }
  const required = terms.filter((t, i) => i > 0 && bestMask & (1 << i)),
    goals = [..."ABCDEF"].filter((t) => seen.has(t));
  if (
    ordinary.length !== minimum ||
    ordinary.some((n) => !seen.has(n)) ||
    required.some((t) => !seen.has(t))
  )
    throw Error("Solution verification failed.");
  return {
    minimum,
    ordinary,
    selected: [...seen].sort(),
    edges,
    goals,
    goal_count: goals.length,
    required,
    full_minimum,
    budget: Number.isFinite(budget) ? budget : null,
  };
}
