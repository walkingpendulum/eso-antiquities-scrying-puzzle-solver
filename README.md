# ESO Antiquities Scrying Puzzle Solver

A photo-based, entirely client-side solver for **The Elder Scrolls Online: Antiquities Scrying**. Take a photo on your phone, choose a move limit, and follow a numbered plan that reaches as many foci as possible.

[Open the app](https://walkingpendulum.github.io/eso-antiquities-scrying-puzzle-solver/) · [Download a release](https://github.com/walkingpendulum/eso-antiquities-scrying-puzzle-solver/releases) · [Build status](https://github.com/walkingpendulum/eso-antiquities-scrying-puzzle-solver/actions)

## Features

- React interface with camera capture, image upload and an included example.
- Automatic frame detection, perspective correction, six-focus detection, and recognition of four or five glyph types.
- Adaptive recognition using confident glyphs from the current photograph, without lowering the uncertainty threshold.
- Exact optimization for a custom move budget. Eight moves is the default; the setting persists across puzzles and page opens when browser storage is available.
- A valid move order: the first region touches the start, and every later region touches the already connected area. Branches and regions touching multiple foci are supported.
- Views for the solution, component regions, recognized grid and aligned photograph; PNG, SVG and JSON export.
- Offline reopening after the app reports **Available offline**. All runtime assets are hosted with the app.
- Photographs are processed locally in a Web Worker and are never uploaded or stored. No analytics, account, backend or runtime CDN is required.

## Using the app

1. Wait for **Recognizer ready**.
2. Set the number of available moves. Apply the setting to recalculate an existing board without reading the photo again.
3. Select **Take a photo** or **Choose an image**, or try the built-in example.
4. Check the recognized grid against the photograph. If cells are uncertain, they are orange and no solution is shown.
5. Select the regions in numbered order. Pink foci are reached by the plan; gray foci are outside it.

A plan can use fewer moves than the limit when extra moves do not improve focus coverage. The app also reports the minimum required for all six foci.

## Assumptions and limitations

The recognizer supports the calibrated **110-cell grid**, a start at the bottom, **six empty foci** arranged around the board, and the known star, sparks, ring, spiral and optional ray-star glyphs. Focus positions and the glyph set are detected automatically; they are not fixed to the first screenshot. Cells connect only across shared sides.

Include the entire board and its frame. JPEG, PNG, WebP and other browser-decodable images work; high-resolution phone photos are resized before processing, with no arbitrary 25-megapixel rejection. Strong glare, moiré, blur, unusual animation frames or severe distortion can still prevent reliable recognition. This is not a generic recognizer for arbitrary hex grids, and the solver does not model optional in-game abilities.

Recognition is heuristic. **The solver is exact for the recognized graph**, not proof that the photograph was read correctly. Review the schematic before playing. The regression suite contains five real board crops and generated image variations; it is not a large-scale accuracy evaluation.

## Algorithm

1. **Align:** AKAZE descriptors from two calibrated frame views, Hamming matching, RANSAC and a homography locate and rectify the board. Alignment and crop checks reject unreliable photographs.
2. **Recognize:** sample cell centers on the fixed grid; suppress blue background and local illumination; compare normalized glyph descriptors over small offsets. Find six empty centers by contrast, require a separation gap, then label A–F clockwise from the lower left. For ambiguous cells, build a local template bank from at least two independently confident examples of a class. Ambiguous cells never train that bank.
3. **Contract:** flood-fill edge-adjacent cells with equal glyphs into connected regions. Each region is a vertex. Touching regions are connected; the start and six foci are vertices too.
4. **Optimize:** exact vertex-weighted Steiner dynamic programming considers all 128 subsets of the seven terminals (start plus six foci). Each ordinary region costs one; the start and automatically reached foci cost zero. Choose the most foci within the requested budget, breaking ties by fewer moves. A region may have any number of neighbors and unlock several foci at once.
5. **Order and render:** recover a connected solution, close zero-cost foci automatically and grow a legal click sequence from the start. Render each vertex using its original component shape.

The state space is small: seven terminals and at most 111 graph vertices. No model, random search, network service or API key is involved. OpenCV's RANSAC is seeded for reproducible processing.

## Development

Use **Node.js 24** and npm (Node 22.12+ is supported by the application toolchain).

```sh
npm ci
npm run dev
```

`npm run dev` verifies/downloads OpenCV, builds the classic Web Worker and starts Vite. React UI changes use hot reload. Restart the dev command after editing worker/core code so its separately bundled worker is rebuilt.

```sh
npm test                 # graph invariants, exhaustive solver comparisons, move order, preferences
npm run prepare:runtime  # pinned runtime plus Node test adapter
npm run test:vision      # all 110 labels on five real board crops; alignment and safe rejection
npm run build            # worker, React app and content-versioned offline cache
node --test test/built-worker.test.mjs  # real production worker, including custom budgets
npm run preview          # serve dist locally
npm run release:archive  # ZIP of dist, with version in its filename
```

`npm run check` prepares the runtime and runs unit tests, image tests, the production build and the built-worker test.

### Project layout

| Path                                  | Purpose                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `src/App.jsx`, `src/components/`      | React interface and inline algorithm description                            |
| `src/core/vision.js`                  | OpenCV alignment and deterministic recognition                              |
| `src/core/graph.js`                   | Hex adjacency and component contraction                                     |
| `src/core/solver.js`                  | Exact budgeted Steiner solver                                               |
| `src/core/render.js`                  | Region-shaped SVG graph and legal move order                                |
| `src/core/preferences.js`, `image.js` | Move-limit persistence, local image decoding and exports                    |
| `src/worker/vision.worker.js`         | Background recognition and cached replanning                                |
| `public/calibration/`                 | Reference image, grid and glyph/frame descriptors                           |
| `scripts/`                            | Runtime integrity checks, worker build, offline cache and release packaging |
| `test/`                               | Solver, graph, storage, real-image and production-worker tests              |
| `.github/workflows/release.yml`       | CI, releases and Pages deployment                                           |

### OpenCV integrity and licensing

A clean build downloads OpenCV 4.13.0 from `https://docs.opencv.org/4.13.0/opencv.js` and requires SHA-256 `63366510248adf3a7eddf3e793dd825404efb7df3749f4d6f8557c7fa4ca8aa0`. A mismatched artifact fails the build. The verified runtime is copied into the deployment; visitors do not fetch it from OpenCV's website. The generated runtime, worker bundle, dependencies and build output are excluded from Git.

## GitHub Actions and releases

Pushes to **`master`** and pull requests run the tests and production build. Pull requests do not publish anything. A successful push to `master` also:

- publishes a ZIP release tagged `v<package-version>-build.<workflow-run-number>`;
- deploys the same verified build to GitHub Pages.

Versions are recorded in `package.json`, the interface and release filenames. The React migration starts at **2.0.0**, following the standalone HTML 1.x releases. Every master push receives a unique release tag, even if the application version has not changed.

For a new GitHub repository, set the default branch to `master` and select **Settings → Pages → Source → GitHub Actions** once. The workflow then handles subsequent deployments; no deployment secrets are needed. Pages publishing and releases use separate jobs with only their required token permissions. The deploy job serializes Pages deployments; CI and releases still run for every master push.

The Vite base path is set from the repository name in CI so worker, calibration and offline-cache URLs work under a project Pages subdirectory. For other hosting, run `BASE_PATH=/your/path/ npm run build` (the default is relative URLs).

Offline cache versions are derived from the complete build contents. A successful new installation replaces only this app's old caches; other sites and photo data are untouched. Opening the hosted app online loads the current HTML; the worker caches its accompanying static assets for later offline use.

## License and credits

The software is released under the [MIT license](LICENSE). OpenCV is distributed under its own [Apache 2.0 license](public/vendor/OPENCV-LICENSE.txt); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Calibration and regression images contain game artwork and are not relicensed under MIT.

This is an independent fan project and is not affiliated with or endorsed by ZeniMax Online Studios, Bethesda or Microsoft. The Elder Scrolls Online, associated trademarks and game artwork belong to their respective owners.
