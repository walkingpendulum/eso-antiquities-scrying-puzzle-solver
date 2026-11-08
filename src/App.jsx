import React, { useEffect, useMemo, useRef, useState } from "react";
import Algorithm from "./components/Algorithm.jsx";
import { createBudgetSettings } from "./core/preferences.js";
import {
  imagePixels,
  photoDataURL,
  download,
  downloadPNG,
} from "./core/image.js";
import { orderHexSolution, renderHexSVG } from "./core/render.js";

const BASE = import.meta.env.BASE_URL;
const REPO =
  "https://github.com/walkingpendulum/eso-antiquities-scrying-puzzle-solver";
const views = {
  solution: "Solution",
  components: "Components",
  recognized: "Recognized grid",
  photo: "Aligned photo",
};
const captions = {
  solution:
    "Red outlines mark the chosen regions. Click them in numbered order, growing outwards from the start. Pink foci are reached; gray foci are outside the plan.",
  components:
    "Each region is a connected component of edge-adjacent cells with the same glyph. A shared side is a connection.",
  recognized:
    "Compare these labels with the photograph. Orange outlines indicate uncertain cells. 1: star · 2: sparks · 3: ring · 4: spiral · 5: ray star.",
  photo:
    "The detected board after automatic perspective correction and cropping.",
};
function settings() {
  let storage = null;
  try {
    storage = window.localStorage;
  } catch {
    /* Private browsing can deny storage. */
  }
  return createBudgetSettings(storage);
}
export default function App() {
  const [preferences] = useState(settings);
  const [limitInput, setLimitInput] = useState(String(preferences.value));
  const [persistent, setPersistent] = useState(preferences.persistent);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading the local recognizer…");
  const [error, setError] = useState(false);
  const [result, setResult] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [fileName, setFileName] = useState("");
  const [view, setView] = useState("solution");
  const [offline, setOffline] = useState(false);
  const workerRef = useRef(null);
  const resultRef = useRef(null);
  const running = useRef(false);
  const report = (text, isError = false) => {
    setMessage(text);
    setError(isError);
  };
  const working = (value) => {
    running.current = value;
    setBusy(value);
  };
  const accept = (next) => {
    resultRef.current = next;
    setResult(next);
  };

  useEffect(() => {
    let alive = true;
    if (!window.Worker || !window.WebAssembly) {
      report("Use a modern browser with WebAssembly and Web Workers.", true);
      return;
    }
    const worker = new Worker(`${BASE}worker/vision-worker.js`);
    workerRef.current = worker;
    worker.onerror = (event) => {
      if (alive) {
        working(false);
        setReady(false);
        report(
          `The recognizer could not start. ${event.message || "Reload the page to try again."}`,
          true,
        );
      }
    };
    worker.onmessage = async (event) => {
      if (!alive) return;
      const data = event.data;
      try {
        if (data.type === "runtime") {
          report("Preparing calibration data…");
          const [layout, symbols, alignment, pixels] = await Promise.all([
            fetch(`${BASE}calibration/layout.json`).then(checkedJSON),
            fetch(`${BASE}calibration/symbol-templates.json`).then(checkedJSON),
            fetch(`${BASE}calibration/alignment-templates.json`).then(
              checkedJSON,
            ),
            imagePixels(`${BASE}calibration/reference.jpg`),
          ]);
          if (!alive) return;
          layout.symbol_templates = symbols;
          layout.alignment_templates = alignment;
          worker.postMessage(
            {
              type: "init",
              layout,
              pixels: pixels.data,
              width: pixels.width,
              height: pixels.height,
            },
            [pixels.data.buffer],
          );
        } else if (data.type === "ready") {
          setReady(true);
          report("Ready. Take a photo, choose an image, or try the example.");
        } else if (data.type === "result") {
          working(false);
          const next = data.result;
          setPhoto(photoDataURL(next.photo));
          delete next.photo;
          if (next.solution)
            next.solution.order = orderHexSolution(next.graph, next.solution);
          accept(next);
          if (next.status === "solved") {
            setView("solution");
            report("Plan ready. Select the regions in numbered order.");
          } else {
            setView("recognized");
            report(
              next.warning ||
                `${next.uncertain.length} uncertain cells are outlined in orange. Try a sharper photograph.`,
              true,
            );
          }
        } else if (data.type === "solution") {
          working(false);
          const previous = resultRef.current;
          if (previous) {
            data.solution.order = orderHexSolution(
              previous.graph,
              data.solution,
            );
            accept({ ...previous, solution: data.solution });
            setView("solution");
            report("Plan updated for your move limit.");
          }
        } else if (data.type === "error") {
          working(false);
          report(data.message, true);
        }
      } catch (failure) {
        working(false);
        report(failure.message, true);
      }
    };
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker
        .register(`${BASE}sw.js`)
        .then(() => navigator.serviceWorker.ready)
        .then(() => {
          if (alive) setOffline(true);
        })
        .catch(() => {
          /* Online use remains available. */
        });
    }
    return () => {
      alive = false;
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  function saveLimit(replan = true) {
    if (running.current) return null;
    try {
      const previous = preferences.value;
      const budget = preferences.save(limitInput);
      setLimitInput(String(budget));
      setPersistent(preferences.persistent);
      if (
        replan &&
        budget !== previous &&
        resultRef.current?.solution &&
        ready
      ) {
        working(true);
        report(`Finding the best plan within ${budget} moves…`);
        workerRef.current.postMessage({ type: "solve", budget });
      }
      return budget;
    } catch (failure) {
      report(failure.message, true);
      return null;
    }
  }
  async function analyze(source, name) {
    if (!ready || running.current) return;
    const budget = saveLimit(false);
    if (budget === null) return;
    working(true);
    accept(null);
    setPhoto(null);
    setFileName(name);
    report("Reading the photograph…");
    try {
      const pixels = await imagePixels(source);
      report("Aligning the board, reading glyphs, and optimizing the plan…");
      workerRef.current.postMessage(
        {
          type: "analyze",
          pixels: pixels.data,
          width: pixels.width,
          height: pixels.height,
          budget,
        },
        [pixels.data.buffer],
      );
    } catch (failure) {
      working(false);
      report(failure.message, true);
    }
  }
  function upload(event) {
    const file = event.target.files?.[0];
    if (file) analyze(file, file.name || "Camera photograph");
    event.target.value = "";
  }
  const svg = useMemo(
    () =>
      result && view !== "photo"
        ? renderHexSVG(
            result.graph,
            view === "solution" ? result.solution : null,
            view === "recognized",
            result.uncertain,
          )
        : "",
    [result, view],
  );
  const plan = result?.solution;
  const disabled = !ready || busy;

  return (
    <main>
      <header className="site-header">
        <a className="brand" href={BASE}>
          <img src={`${BASE}icon.svg`} alt="" />
          <span>
            ESO ANTIQUITIES
            <span className="brand-sub">Scrying Puzzle Solver</span>
          </span>
        </a>
        <a className="source-link" href={REPO} target="_blank" rel="noreferrer">
          Source on GitHub ↗
        </a>
      </header>
      <section className="intro">
        <div className="eyebrow">PHOTO → CONNECTED REGIONS → PLAYABLE PLAN</div>
        <h1>Find your way to the foci.</h1>
        <p>
          Photograph the board. Choose your move limit. Get the best connected
          plan — all on your device.
        </p>
        <div className="trust">
          <span>
            <i />
            No photo uploads
          </span>
          <span>{offline ? "Available offline" : "Local processing"}</span>
          <span>v{__APP_VERSION__}</span>
        </div>
      </section>
      <section className="card upload-card" aria-labelledby="input-title">
        <div className="section-heading">
          <div>
            <span className="step-label">01 / THE BOARD</span>
            <h2 id="input-title">Start with a photograph</h2>
          </div>
          <span className={`runtime ${ready ? "is-ready" : ""}`}>
            <i />
            {ready ? "Recognizer ready" : "Starting…"}
          </span>
        </div>
        <div className="photo-actions">
          <label className={`button primary ${disabled ? "disabled" : ""}`}>
            ▧ Take a photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={upload}
              disabled={disabled}
            />
          </label>
          <label className={`button secondary ${disabled ? "disabled" : ""}`}>
            Choose an image
            <input
              type="file"
              accept="image/*"
              onChange={upload}
              disabled={disabled}
            />
          </label>
          <button
            className="example"
            disabled={disabled}
            onClick={() =>
              analyze(`${BASE}calibration/reference.jpg`, "Built-in example")
            }
          >
            Try the example ↗
          </button>
        </div>
        <form
          className="budget"
          onSubmit={(event) => {
            event.preventDefault();
            saveLimit();
          }}
        >
          <div>
            <label htmlFor="move-limit">Move limit</label>
            <span>Default: 8. Your choice carries over to the next board.</span>
          </div>
          <div className="budget-controls">
            <input
              id="move-limit"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              required
              value={limitInput}
              onChange={(event) => setLimitInput(event.target.value)}
              disabled={busy}
            />
            <button className="button secondary" disabled={busy} type="submit">
              Apply
            </button>
          </div>
        </form>
        {!persistent && (
          <p className="storage-note">
            This browser does not allow persistent storage. The limit is
            remembered until you close this page.
          </p>
        )}
        {fileName && <p className="file-name">{fileName}</p>}
        <div
          className={`message ${error ? "error" : ""}`}
          role={error ? "alert" : "status"}
          aria-live="polite"
        >
          {busy && <span className="spinner" />}
          {message}
        </div>
      </section>
      {result && (
        <section className="card results" aria-labelledby="result-title">
          <span className="step-label">02 / THE PLAN</span>
          <div className="result-heading">
            <h2 id="result-title">
              {plan
                ? `${plan.goal_count} of 6 foci within ${plan.budget} moves`
                : "Check the highlighted cells"}
            </h2>
            <span
              className={`pill ${plan?.goal_count === 6 ? "complete" : ""}`}
            >
              {plan
                ? plan.goal_count === 6
                  ? "All foci reached"
                  : "Best within budget"
                : "Recognition uncertain"}
            </span>
          </div>
          <p className="result-meta">
            {result.configuration.cell_count} cells ·{" "}
            {result.configuration.type_count} glyph types ·{" "}
            {Object.keys(result.graph.nodes).length - 1} regions
            {plan && (
              <>
                {" "}
                · Plan: <strong>{plan.minimum} moves</strong> · All six need{" "}
                {plan.full_minimum}
              </>
            )}
          </p>
          <div className="tabs" role="tablist" aria-label="Board views">
            {Object.entries(views).map(([key, title]) => (
              <button
                id={`tab-${key}`}
                role="tab"
                aria-selected={view === key}
                aria-controls="board-view"
                key={key}
                className={view === key ? "active" : ""}
                disabled={busy || (key === "solution" && !plan)}
                onClick={() => setView(key)}
              >
                {title}
              </button>
            ))}
          </div>
          <div
            id="board-view"
            role="tabpanel"
            aria-labelledby={`tab-${view}`}
            className="diagram"
          >
            {view === "photo" ? (
              <img
                src={photo}
                alt="The photographed board after perspective correction"
              />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: svg }} />
            )}
          </div>
          <p className="caption">{captions[view]}</p>
          <div className="downloads">
            <span>Keep this plan</span>
            <button
              disabled={busy || !svg}
              onClick={() =>
                downloadPNG(svg).catch((failure) =>
                  report(failure.message, true),
                )
              }
            >
              PNG ↓
            </button>
            <button
              disabled={busy || !svg}
              onClick={() =>
                download(`scrying-${view}.svg`, svg, "image/svg+xml")
              }
            >
              SVG ↓
            </button>
            <button
              disabled={busy}
              onClick={() =>
                download(
                  "scrying-result.json",
                  JSON.stringify(
                    {
                      version: __APP_VERSION__,
                      labels: result.labels,
                      uncertain: result.uncertain,
                      configuration: result.configuration,
                      alignment: result.alignment,
                      graph: result.graph,
                      solution: result.solution || null,
                    },
                    null,
                    2,
                  ),
                  "application/json",
                )
              }
            >
              JSON ↓
            </button>
          </div>
        </section>
      )}
      <section className="card information">
        <div className="info-heading">
          <span className="step-label">UNDER THE SURFACE</span>
          <span>Deterministic recognition · Exact optimization</span>
        </div>
        <Algorithm />
      </section>
      <footer>
        <span>Independent ESO fan tool. Photographs stay on your device.</span>
        <span>React · OpenCV 4.13 · v{__APP_VERSION__}</span>
      </footer>
    </main>
  );
}
async function checkedJSON(response) {
  if (!response.ok)
    throw Error(
      `Calibration data could not load (HTTP ${response.status}). Reload the page.`,
    );
  return response.json();
}
