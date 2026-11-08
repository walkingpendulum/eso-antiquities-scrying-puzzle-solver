import { createVisionEngine } from "../core/vision.js";
let engine = null;
let lastGraph = null;
self.importScripts(new URL("../vendor/opencv.js", self.location.href).href);
// OpenCV is self-thenable: resolving a native Promise with it would recurse.
self.cv.then((runtime) => {
  self.onmessage = (event) => {
    const message = event.data;
    try {
      if (message.type === "init") {
        engine = createVisionEngine(runtime, message.layout);
        const stats = engine.init(
          message.pixels,
          message.width,
          message.height,
        );
        self.postMessage({ type: "ready", stats });
      } else if (message.type === "analyze") {
        if (!engine) throw Error("The recognizer is still loading.");
        lastGraph = null;
        const result = engine.analyze(
          message.pixels,
          message.width,
          message.height,
          message.budget,
        );
        lastGraph = result.status === "solved" ? result.graph : null;
        self.postMessage({ type: "result", result }, [
          result.photo.pixels.buffer,
        ]);
      } else if (message.type === "solve") {
        if (!lastGraph) throw Error("Recognize a photograph first.");
        self.postMessage({
          type: "solution",
          solution: engine.solve(lastGraph, message.budget),
        });
      }
    } catch (error) {
      self.postMessage({
        type: "error",
        message:
          error?.message || "Image processing failed. Try another photograph.",
      });
    }
  };
  self.postMessage({ type: "runtime" });
});
