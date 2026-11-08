import { test } from "node:test";
import assert from "node:assert/strict";
import { createBudgetSettings } from "../src/core/preferences.js";
test("eight is the default and custom limits persist across boards and page opens", () => {
  const map = new Map(),
    storage = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
    };
  const first = createBudgetSettings(storage);
  assert.equal(first.value, 8);
  first.save("12");
  assert.equal(createBudgetSettings(storage).value, 12);
  first.save("0");
  assert.equal(createBudgetSettings(storage).value, 0);
  for (const value of ["", "-1", "0.5", "no", "Infinity", "9007199254740992"])
    assert.throws(() => first.save(value));
  assert.equal(first.value, 0);
});
test("blocked or corrupted storage does not prevent session use", () => {
  const blocked = createBudgetSettings({
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  });
  assert.equal(blocked.value, 8);
  assert.equal(blocked.save("11"), 11);
  assert.equal(blocked.persistent, false);
  const corrupt = createBudgetSettings({
    getItem: () => "not a number",
    setItem() {},
  });
  assert.equal(corrupt.value, 8);
});
