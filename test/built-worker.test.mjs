import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import sharp from "sharp";

test(
  "production worker runs locally, recognizes a board, and respects changed budgets",
  { timeout: 120_000 },
  async () => {
    const outbound = [];
    const messages = [];
    let waiting = null;
    const sandbox = {
      console,
      WebAssembly,
      atob,
      btoa,
      TextDecoder,
      TextEncoder,
      URL,
      setTimeout,
      clearTimeout,
      performance,
      location: { href: "https://solver.invalid/app/worker/vision-worker.js" },
    };
    sandbox.self = sandbox;
    sandbox.fetch = async (url) => {
      if (String(url).startsWith("data:")) return fetch(url);
      outbound.push(String(url));
      throw Error("External network disabled by test");
    };
    sandbox.XMLHttpRequest = function () {
      throw Error("External network disabled by test");
    };
    sandbox.postMessage = (message) => {
      if (
        waiting &&
        (message.type === waiting.type || message.type === "error")
      ) {
        const current = waiting;
        waiting = null;
        clearTimeout(current.timer);
        if (message.type === "error") current.reject(Error(message.message));
        else current.resolve(message);
      } else messages.push(message);
    };
    const context = vm.createContext(sandbox);
    sandbox.importScripts = (url) => {
      assert.equal(new URL(url).pathname, "/app/vendor/opencv.js");
      vm.runInContext(
        fs.readFileSync("dist/vendor/opencv.js", "utf8"),
        context,
      );
    };
    const receive = (type) => {
      const index = messages.findIndex(
        (message) => message.type === type || message.type === "error",
      );
      if (index >= 0) {
        const message = messages.splice(index, 1)[0];
        return message.type === "error"
          ? Promise.reject(Error(message.message))
          : Promise.resolve(message);
      }
      return new Promise((resolve, reject) => {
        waiting = {
          type,
          resolve,
          reject,
          timer: setTimeout(
            () => reject(Error(`Timed out waiting for ${type}`)),
            90_000,
          ),
        };
      });
    };
    const ask = async (data, type) => {
      const answer = receive(type);
      sandbox.onmessage({ data });
      return answer;
    };
    vm.runInContext(
      fs.readFileSync("dist/worker/vision-worker.js", "utf8"),
      context,
    );
    await receive("runtime");
    const layout = JSON.parse(fs.readFileSync("dist/calibration/layout.json"));
    layout.symbol_templates = JSON.parse(
      fs.readFileSync("dist/calibration/symbol-templates.json"),
    );
    layout.alignment_templates = JSON.parse(
      fs.readFileSync("dist/calibration/alignment-templates.json"),
    );
    const reference = await sharp("dist/calibration/reference.jpg")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    await ask(
      {
        type: "init",
        layout,
        pixels: reference.data,
        width: reference.info.width,
        height: reference.info.height,
      },
      "ready",
    );
    const first = (
      await ask(
        {
          type: "analyze",
          pixels: reference.data,
          width: reference.info.width,
          height: reference.info.height,
          budget: 8,
        },
        "result",
      )
    ).result;
    assert.equal(first.status, "solved");
    assert.equal(first.solution.goal_count, 6);
    assert.equal(first.solution.minimum, 8);
    const zero = (await ask({ type: "solve", budget: 0 }, "solution")).solution;
    assert.equal(zero.budget, 0);
    assert.equal(zero.minimum, 0);
    assert.equal(zero.goal_count, 0);
    const photo = await sharp("dist/calibration/reference.jpg")
      .composite([
        { input: "test/fixtures/animated-rays.webp", left: 220, top: 220 },
      ])
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const next = (
      await ask(
        {
          type: "analyze",
          pixels: photo.data,
          width: photo.info.width,
          height: photo.info.height,
          budget: 8,
        },
        "result",
      )
    ).result;
    assert.equal(next.status, "solved");
    assert.equal(next.solution.goal_count, 5);
    assert.deepEqual(
      JSON.parse(JSON.stringify(next.labels)),
      JSON.parse(fs.readFileSync("test/fixtures/board-animated-rays.json")),
    );
    const nine = (await ask({ type: "solve", budget: 9 }, "solution")).solution;
    assert.equal(nine.budget, 9);
    assert.equal(nine.goal_count, 6);
    assert.deepEqual(outbound, []);
  },
);
