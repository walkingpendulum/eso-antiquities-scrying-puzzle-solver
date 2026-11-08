// Preferences contain only the move limit; no photographs are stored.
export function createBudgetSettings(storage) {
  const KEY = "hexsolver.moveBudget.v1",
    DEFAULT = 8;
  function parse(raw) {
    const text = String(raw ?? "").trim(),
      n = Number(text);
    if (!text || !Number.isSafeInteger(n) || n < 0)
      throw Error("Enter a non-negative whole number of moves.");
    return n;
  }
  let value = DEFAULT,
    persistent = false;
  try {
    const saved = storage?.getItem(KEY);
    if (saved !== null && saved !== undefined) value = parse(saved);
  } catch {}
  function save(raw) {
    value = parse(raw);
    try {
      if (!storage) throw Error("Storage unavailable");
      storage.setItem(KEY, String(value));
      persistent = true;
    } catch {
      persistent = false;
    }
    return value;
  }
  save(value);
  return {
    get value() {
      return value;
    },
    get persistent() {
      return persistent;
    },
    save,
  };
}
