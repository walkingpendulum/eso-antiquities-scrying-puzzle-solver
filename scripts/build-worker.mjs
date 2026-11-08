import { build } from "vite";
await build({
  configFile: false,
  publicDir: false,
  build: {
    outDir: "public/worker",
    emptyOutDir: true,
    target: "es2022",
    lib: {
      entry: "src/worker/vision.worker.js",
      name: "ScryingWorker",
      formats: ["iife"],
      fileName: () => "vision-worker.js",
    },
  },
});
