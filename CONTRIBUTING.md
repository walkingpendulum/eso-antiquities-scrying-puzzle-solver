# Contributing

Use English for code, comments, documentation, issues and pull requests.

1. Install Node 24 and run `npm ci`.
2. Run `npm run prepare:runtime` once on a fresh checkout.
3. Make the change, then run `npm run check` and `node --test test/built-worker.test.mjs`.
4. For recognition changes, retain the existing confidence checks and test all supplied board crops. Do not force uncertain cells into a valid solution.
5. For solver changes, compare against the exhaustive small-graph tests, including branches, free foci and custom/zero move limits.
6. Review the app at phone width. Check camera/file selection, each board view, exports, a changed budget, and offline reopening.

Keep photo processing on the device. Do not add uploads or analytics. New image fixtures must contain only relevant game artwork, without personal surroundings or metadata, and include manually checked labels.

Open a pull request against `master`. Pull requests run CI without deployment; a successful master push produces a release and updates GitHub Pages.
