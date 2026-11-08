import React from "react";
export default function Algorithm() {
  return (
    <details className="algorithm">
      <summary>How recognition and solving work</summary>
      <p>
        <strong>Input:</strong> a screenshot or photograph of an ESO Antiquities
        Scrying board. Include all 110 cells, the bottom start and as much of
        the frame as possible. Camera and image uploads are supported; large
        images are resized locally.
      </p>
      <p>
        <strong>Supported layouts:</strong> the same 110-cell grid with six
        empty foci, four or five known glyph types and the start at the bottom.
        Focus positions and the glyph set are detected from the photograph. No
        manual alignment or game abilities are required. This is not a
        recognizer for arbitrary hexagonal boards.
      </p>
      <ol>
        <li>
          <strong>Locate the board.</strong> Match AKAZE features from the
          stationary frame, reject outliers with RANSAC, and correct scale,
          rotation and perspective with a homography.
        </li>
        <li>
          <strong>Read the schematic grid.</strong> Compare local contrast
          descriptors against embedded glyph templates. Detect six empty foci,
          then label them A–F clockwise from the lower left. Ambiguous glyphs
          get a second pass using at least two confident examples of the same
          type from this photograph.
        </li>
        <li>
          <strong>Build connected components.</strong> Join cells of the same
          type that share an edge. Every resulting region becomes a graph
          vertex. Regions sharing a side become adjacent; the start touches the
          three bottom cells.
        </li>
        <li>
          <strong>Optimize within the move limit.</strong> Exact vertex-weighted
          Steiner dynamic programming finds the minimum cost for every subset of
          foci. Ordinary regions cost one move; the start and automatically
          reached foci cost zero. Choose the largest achievable set of foci;
          break ties by using fewer moves. One region may reach several foci.
          Branches are allowed.
        </li>
        <li>
          <strong>Show a playable sequence.</strong> Draw each vertex as its
          original region. Number selected regions so move 1 touches the start
          and every later move touches the already connected area. Unreached
          foci stay gray.
        </li>
      </ol>
      <p>
        <strong>Uncertain recognition:</strong> orange cells need a clearer
        image; no solution is presented until recognition passes the confidence
        checks. Glare, moiré, animation and severe perspective may still cause
        errors. Compare the recognized grid against the aligned photograph
        before playing. Optimality applies to the recognized graph, not to an
        incorrectly read photograph.
      </p>
      <p>
        <strong>Privacy and offline use:</strong> photographs stay on your
        device. The page fetches its own static application assets only, with no
        analytics, accounts or external runtime CDN. Once “Available offline”
        appears, it can be reopened without a connection. Only the move limit is
        saved; photographs are not stored.
      </p>
      <p>
        Independent fan project, not affiliated with or endorsed by ZeniMax
        Online Studios or Bethesda. Game imagery and trademarks belong to their
        respective owners.
      </p>
    </details>
  );
}
