import { buildComponentGraph } from "./graph.js";
import { solveComponentGraph } from "./solver.js";
/* Deterministic local computer vision and exact vertex-weighted Steiner solver. */
export function createVisionEngine(cv, layout) {
  const graph = (labels) => buildComponentGraph(labels, layout),
    solve = solveComponentGraph;
  const cells = layout.cells,
    byId = new Map(cells.map((c) => [c.id, c])),
    types = ["s", "d", "h", "w", "r"];
  const targets = new Map(
    cells
      .filter((c) => "ABCDEF".includes(c.reference_type))
      .map((c) => [c.id, c.reference_type]),
  );
  let reference,
    kpRef,
    desRef,
    detector,
    templates = [];
  function imageMat(data, w, h) {
    const rgba = cv.matFromArray(h, w, cv.CV_8UC4, data),
      rgb = new cv.Mat();
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
    rgba.delete();
    return rgb;
  }
  function feature(image, c, dx = 0, dy = 0) {
    const patch = new cv.Mat(),
      a = new cv.Mat(64, 64, cv.CV_32F),
      blur = new cv.Mat(),
      smooth = new cv.Mat(),
      small = new cv.Mat();
    try {
      cv.getRectSubPix(
        image,
        new cv.Size(64, 64),
        new cv.Point(c.x + dx, c.y + dy),
        patch,
      );
      const d = patch.data;
      for (let i = 0; i < 4096; i++)
        a.data32F[i] = d[i * 3] - 0.45 * d[i * 3 + 2];
      cv.GaussianBlur(a, blur, new cv.Size(0, 0), 5, 5, cv.BORDER_DEFAULT);
      for (let i = 0; i < 4096; i++)
        a.data32F[i] = Math.max(0, a.data32F[i] - blur.data32F[i]);
      cv.GaussianBlur(
        a,
        smooth,
        new cv.Size(0, 0),
        0.65,
        0.65,
        cv.BORDER_DEFAULT,
      );
      cv.resize(smooth, small, new cv.Size(40, 40), 0, 0, cv.INTER_AREA);
      const f = new Float32Array(1600);
      let energy = 0;
      for (let y = 0; y < 40; y++)
        for (let x = 0; x < 40; x++) {
          let i = y * 40 + x;
          f[i] =
            (x - 19.5) ** 2 + (y - 19.5) ** 2 <= 19 ** 2 ? small.data32F[i] : 0;
          energy += f[i] * f[i];
        }
      energy = Math.sqrt(energy);
      for (let i = 0; i < 1600; i++) f[i] /= energy + 1e-8;
      return { f, energy };
    } finally {
      [patch, a, blur, smooth, small].forEach((m) => m.delete());
    }
  }
  function init(data, w, h) {
    reference = imageMat(data, w, h);
    const gray = new cv.Mat(),
      mask = new cv.Mat.zeros(h, w, cv.CV_8UC1);
    try {
      cv.rectangle(
        mask,
        new cv.Point(120, 20),
        new cv.Point(w - 120, h - 20),
        new cv.Scalar(255),
        -1,
      );
      for (const c of cells)
        if (!targets.has(c.id))
          cv.circle(
            mask,
            new cv.Point(Math.round(c.x), Math.round(c.y)),
            37,
            new cv.Scalar(0),
            -1,
          );
      cv.cvtColor(reference, gray, cv.COLOR_RGB2GRAY);
      detector = new cv.AKAZE();
      kpRef = new cv.KeyPointVector();
      desRef = new cv.Mat();
      detector.detectAndCompute(gray, mask, kpRef, desRef);
      // Keep a spatially balanced reference bank; input detection uses the same robust nonlinear-scale-space features.
      const oldKP = kpRef,
        oldDes = desRef,
        bins = new Map(),
        keep = [];
      for (let i = 0; i < oldKP.size(); i++) {
        const p = oldKP.get(i).pt,
          key = Math.floor((p.x / w) * 8) + "," + Math.floor((p.y / h) * 6),
          count = bins.get(key) || 0;
        if (count < 65) {
          bins.set(key, count + 1);
          keep.push(i);
        }
      }
      kpRef = new cv.KeyPointVector();
      const bytes = new Uint8Array(keep.length * oldDes.cols);
      keep.forEach((i, j) => {
        kpRef.push_back(oldKP.get(i));
        bytes.set(
          oldDes.data.subarray(i * oldDes.cols, (i + 1) * oldDes.cols),
          j * oldDes.cols,
        );
      });
      desRef = cv.matFromArray(keep.length, oldDes.cols, cv.CV_8U, bytes);
      oldKP.delete();
      oldDes.delete();

      // A second photographed frame supplies descriptors at another viewing angle.
      // Its keypoint coordinates are already mapped into the canonical board.
      const bank = layout.alignment_templates;
      if (bank && bank.points.length) {
        const all = new Uint8Array(desRef.data.length + bank.bytes.length);
        all.set(desRef.data);
        all.set(bank.bytes, desRef.data.length);
        const example = kpRef.get(0);
        for (const [x, y] of bank.points)
          kpRef.push_back({ ...example, pt: { x, y } });
        const previous = desRef;
        desRef = cv.matFromArray(kpRef.size(), bank.cols, cv.CV_8U, all);
        previous.delete();
      }
      templates = cells
        .filter((c) => !targets.has(c.id))
        .map((c) => ({
          type: c.reference_type,
          id: c.id,
          f: feature(reference, c).f,
        }));
      templates.push(
        ...(layout.symbol_templates || []).map((t) => ({
          ...t,
          f: new Float32Array(t.f),
        })),
      );
      return { features: kpRef.size(), templates: templates.length };
    } finally {
      gray.delete();
      mask.delete();
    }
  }
  function align(image) {
    cv.setRNGSeed(0);
    const gray = new cv.Mat(),
      kp = new cv.KeyPointVector(),
      des = new cv.Mat(),
      mask = new cv.Mat(),
      matches = new cv.DMatchVectorVector(),
      matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
    let src, dst, H, inliers;
    try {
      cv.cvtColor(image, gray, cv.COLOR_RGB2GRAY);
      detector.detectAndCompute(gray, mask, kp, des);
      if (des.empty())
        throw Error("Board not found. Try a sharper photograph.");
      matcher.knnMatch(desRef, des, matches, 2);
      const source = [],
        dest = [];
      for (let i = 0; i < matches.size(); i++) {
        const pair = matches.get(i);
        try {
          if (pair.size() === 2) {
            const a = pair.get(0),
              b = pair.get(1);
            if (a.distance < 0.72 * b.distance) {
              const p = kp.get(a.trainIdx).pt,
                q = kpRef.get(a.queryIdx).pt;
              source.push(p.x, p.y);
              dest.push(q.x, q.y);
            }
          }
        } finally {
          pair.delete();
        }
      }
      if (source.length < 24)
        throw Error(
          "Could not locate the board. Include the complete board and frame.",
        );
      src = cv.matFromArray(source.length / 2, 1, cv.CV_32FC2, source);
      dst = cv.matFromArray(dest.length / 2, 1, cv.CV_32FC2, dest);
      inliers = new cv.Mat();
      H = cv.findHomography(src, dst, cv.RANSAC, 4, inliers, 4000, 0.999);
      let count = 0,
        minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (let i = 0; i < inliers.rows; i++)
        if (inliers.data[i]) {
          count++;
          minX = Math.min(minX, dest[2 * i]);
          maxX = Math.max(maxX, dest[2 * i]);
          minY = Math.min(minY, dest[2 * i + 1]);
          maxY = Math.max(maxY, dest[2 * i + 1]);
        }
      if (
        H.empty() ||
        count < 12 ||
        count / (source.length / 2) < 0.22 ||
        maxX - minX < 650 ||
        maxY - minY < 450
      )
        throw Error(
          "Board alignment is unreliable. Try a straighter photograph.",
        );
      const inv = new cv.Mat(),
        corners = [],
        projected = new cv.Mat();
      let cm;
      try {
        cv.invert(H, inv);
        for (const c of cells)
          for (const [dx, dy] of [
            [-32, -32],
            [32, -32],
            [32, 32],
            [-32, 32],
          ])
            corners.push(c.x + dx, c.y + dy);
        cm = cv.matFromArray(corners.length / 2, 1, cv.CV_32FC2, corners);
        cv.perspectiveTransform(cm, projected, inv);
        let d = projected.data32F;
        for (let i = 0; i < d.length; i += 2)
          if (
            !Number.isFinite(d[i]) ||
            !Number.isFinite(d[i + 1]) ||
            d[i] < 0 ||
            d[i] >= image.cols ||
            d[i + 1] < 0 ||
            d[i + 1] >= image.rows
          )
            throw Error("The board is cropped. Include the entire board.");
      } finally {
        inv.delete();
        projected.delete();
        if (cm) cm.delete();
      }
      const warped = new cv.Mat();
      cv.warpPerspective(
        image,
        warped,
        H,
        new cv.Size(reference.cols, reference.rows),
      );
      return {
        warped,
        alignment: { inliers: count, matches: source.length / 2 },
      };
    } finally {
      [gray, kp, des, mask, matches, matcher, src, dst, H, inliers].forEach(
        (m) => {
          if (m) m.delete();
        },
      );
    }
  }
  function classify(image, excludeSelf = false) {
    const labels = {},
      uncertain = [],
      confidence = {},
      predictions = new Map(),
      samples = new Map(),
      centers = new Map(cells.map((c) => [c.id, feature(image, c)]));
    // Empty foci lack a central glyph. Rank the local high-frequency signal,
    // then require a gap and a plausible six-focus arrangement.
    const ranked = cells
      .slice()
      .sort((a, b) => centers.get(a.id).energy - centers.get(b.id).energy);
    const cx = cells.reduce((sum, c) => sum + c.x, 0) / cells.length,
      cy = cells.reduce((sum, c) => sum + c.y, 0) / cells.length;
    const angle = (c) =>
      (Math.atan2(c.y - cy, c.x - cx) - Math.PI / 2 + 2 * Math.PI) %
      (2 * Math.PI);
    const focus = ranked.slice(0, 6).sort((a, b) => angle(a) - angle(b));
    const gap =
      centers.get(ranked[6].id).energy /
      (centers.get(ranked[5].id).energy + 1e-8);
    const separated = focus.every(
      (c, i) =>
        (angle(focus[(i + 1) % 6]) - angle(c) + 2 * Math.PI) % (2 * Math.PI) >
        0.12,
    );
    const targetsReliable =
      gap >= 1.15 && focus.filter((c) => c.x < cx).length === 3 && separated;
    const detectedTargets = new Map(focus.map((c, i) => [c.id, "ABCDEF"[i]]));
    if (!targetsReliable) uncertain.push(...focus.map((c) => c.id));
    for (const c of cells) {
      if (detectedTargets.has(c.id)) {
        labels[c.id] = detectedTargets.get(c.id);
        continue;
      }
      const scores = Object.fromEntries(types.map((t) => [t, -1]));
      let energy = 0;
      const patches = [];
      for (const [dx, dy] of [
        [0, 0],
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ]) {
        const f =
          dx === 0 && dy === 0 ? centers.get(c.id) : feature(image, c, dx, dy);
        energy = Math.max(energy, f.energy);
        patches.push(f.f);
        for (const t of templates) {
          if (excludeSelf && t.id === c.id) continue;
          let dot = 0;
          for (let i = 0; i < 1600; i++) dot += t.f[i] * f.f[i];
          if (dot > scores[t.type]) scores[t.type] = dot;
        }
      }
      const order = types
          .slice()
          .sort((a, b) => scores[b] - scores[a] || a.localeCompare(b)),
        best = order[0],
        margin = scores[best] - scores[order[1]];
      samples.set(c.id, patches);
      predictions.set(c.id, { scores, best, margin, energy });
      labels[c.id] = best;
      confidence[c.id] = Math.max(0, Math.min(1, margin / 0.25));
      if (scores[best] < 0.53 || margin < 0.09 || energy < 25)
        uncertain.push(c.id);
    }
    // Calibrate to this photograph's glyph rendering using only strong initial
    // matches. Ambiguous cells never train the bank, and each class needs two
    // independent seeds. This accommodates animation, bloom and camera sampling.
    const local = [];
    for (const t of types) {
      const seeds = [...predictions]
        .filter(
          ([id, p]) =>
            p.best === t &&
            p.scores[t] >= 0.7 &&
            p.margin >= 0.16 &&
            !uncertain.includes(id),
        )
        .sort((a, b) => b[1].margin - a[1].margin || a[0].localeCompare(b[0]))
        .slice(0, 8);
      if (seeds.length >= 2)
        for (const [id] of seeds)
          for (const f of samples.get(id)) local.push({ id, type: t, f });
    }
    for (let k = uncertain.length - 1; k >= 0; k--) {
      const id = uncertain[k],
        p = predictions.get(id);
      if (!p) continue;
      const scores = { ...p.scores };
      const patches = samples.get(id).slice();
      for (const dx of [-4, 0, 4])
        for (const dy of [-4, 0, 4])
          if (dx || dy) patches.push(feature(image, byId.get(id), dx, dy).f);
      for (const f of patches)
        for (const t of local) {
          let dot = 0;
          for (let i = 0; i < 1600; i++) dot += t.f[i] * f[i];
          if (dot > scores[t.type]) scores[t.type] = dot;
        }
      const order = types
          .slice()
          .sort((a, b) => scores[b] - scores[a] || a.localeCompare(b)),
        best = order[0],
        margin = scores[best] - scores[order[1]];
      labels[id] = best;
      confidence[id] = Math.max(0, Math.min(1, margin / 0.25));
      if (scores[best] >= 0.53 && margin >= 0.09 && p.energy >= 25)
        uncertain.splice(k, 1);
    }
    const present = types.filter((t) => Object.values(labels).includes(t));
    return {
      labels,
      uncertain: [...new Set(uncertain)],
      confidence,
      configuration: {
        cell_count: cells.length,
        type_count: present.length,
        types: present,
        targets: Object.fromEntries(
          [...detectedTargets].map(([id, t]) => [t, id]),
        ),
        target_gap: gap,
      },
      warning: targetsReliable
        ? null
        : "Could not confidently locate all six empty foci. Try a photograph without glare.",
    };
  }

  function analyze(data, w, h, budget = 8) {
    const image = imageMat(data, w, h);
    let warped;
    try {
      const aligned = align(image);
      warped = aligned.warped;
      const result = classify(warped),
        g = graph(result.labels);
      result.graph = g;
      result.alignment = aligned.alignment;
      const crop = warped.roi(new cv.Rect(220, 220, 1020, 790)),
        rgba = new cv.Mat();
      try {
        cv.cvtColor(crop, rgba, cv.COLOR_RGB2RGBA);
        result.photo = {
          width: rgba.cols,
          height: rgba.rows,
          pixels: new Uint8ClampedArray(rgba.data),
        };
      } finally {
        crop.delete();
        rgba.delete();
      }
      if (result.uncertain.length) result.status = "uncertain";
      else {
        result.solution = solve(g, budget);
        result.status = "solved";
      }
      return result;
    } finally {
      image.delete();
      if (warped) warped.delete();
    }
  }
  return { init, analyze, graph, solve, classify, mat: imageMat };
}
