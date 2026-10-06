/** Pure tests of the two-way model ↔ colour availability used on the product page. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { availableColors, availableModels, choose, findVariant, type AvailVariant } from "../lib/variant-availability";

const v = (id: string, modelId: string | null, colorId: string | null, stock: number, brandId = "apple", seriesId: string | null = null): AvailVariant => ({ id, modelId, colorId, stock, brandId, seriesId });
// The example from the requirements (only ACTIVE variants are passed to the picker; stock is checked here).
const V = [v("a", "i13", "black", 5, "apple", "s13"), v("b", "i13", "green", 0, "apple", "s13"), v("c", "i14", "black", 3, "apple", "s14"), v("d", "i14", "white", 4, "apple", "s14")];
const E = { model: "", color: "" };
const set = (s: Set<string>) => [...s].sort();

describe("two-way availability", () => {
  it("nothing chosen: everything with at least one buyable variant is selectable", () => {
    assert.deepEqual(set(availableModels(V, E)), ["i13", "i14"]);
    assert.deepEqual(set(availableColors(V, E)), ["black", "white"], "green has stock 0 → not selectable");
  });
  it("Color → Model", () => {
    assert.deepEqual(set(availableModels(V, { model: "", color: "black" })), ["i13", "i14"]);
    assert.deepEqual(set(availableModels(V, { model: "", color: "white" })), ["i14"]);
    assert.deepEqual(set(availableModels(V, { model: "", color: "green" })), [], "green: iPhone 13 has stock 0");
  });
  it("Model → Color", () => {
    assert.deepEqual(set(availableColors(V, { model: "i13", color: "" })), ["black"], "Green is unavailable for iPhone 13");
    assert.deepEqual(set(availableColors(V, { model: "i14", color: "" })), ["black", "white"]);
  });
  it("exact combination: valid, missing, zero stock", () => {
    assert.equal(findVariant(V, { model: "i13", color: "black" })?.id, "a");
    assert.equal(findVariant(V, { model: "i13", color: "white" }), null, "combination does not exist");
    assert.equal(findVariant(V, { model: "i13", color: "green" }), null, "stock 0");
    assert.equal(findVariant(V, { model: "i13", color: "" }), null, "incomplete selection");
  });
  it("changing one side repairs an incompatible other side", () => {
    // Color white chosen, then iPhone 13 is not offered (disabled) — forcing it clears the colour instead of leaving a broken state.
    assert.deepEqual(choose(V, { model: "", color: "white" }, "model", "i13"), { model: "i13", color: "" });
    assert.deepEqual(choose(V, { model: "i13", color: "black" }, "color", "white"), { model: "", color: "white" });
    // compatible change keeps the other side
    assert.deepEqual(choose(V, { model: "i14", color: "black" }, "color", "white"), { model: "i14", color: "white" });
    assert.deepEqual(choose(V, { model: "", color: "black" }, "model", "i14"), { model: "i14", color: "black" });
    // clicking the chosen chip unselects it
    assert.deepEqual(choose(V, { model: "i14", color: "white" }, "model", "i14"), { model: "", color: "white" });
  });
  it("all variants out of stock / no variants: nothing selectable", () => {
    const z = V.map((x) => ({ ...x, stock: 0 }));
    assert.equal(availableModels(z, E).size, 0); assert.equal(availableColors(z, E).size, 0);
    assert.equal(availableModels([], E).size, 0);
  });
  it("brand / series filter narrows the models considered, availability still comes from real variants", () => {
    const W = [...V, v("e", "gx", "black", 2, "samsung", "sg")];
    assert.deepEqual(set(availableModels(W, E, { brand: "apple" })), ["i13", "i14"]);
    assert.deepEqual(set(availableModels(W, E, { brand: "samsung" })), ["gx"]);
    assert.deepEqual(set(availableModels(W, E, { series: "s14" })), ["i14"]);
    assert.deepEqual(set(availableColors(W, E, { series: "s14" })), ["black", "white"]);
    assert.deepEqual(set(availableColors(W, { model: "", color: "" }, { brand: "samsung" })), ["black"]);
    assert.deepEqual(set(availableModels(W, { model: "", color: "white" }, { brand: "samsung" })), [], "white only exists on Apple");
  });
  it("one axis only (colour-only / model-only products)", () => {
    const C = [v("x", null, "red", 1), v("y", null, "blue", 0)];
    assert.deepEqual(set(availableColors(C, E)), ["red"]);
    assert.equal(findVariant(C, { model: "", color: "red" })?.id, "x");
    assert.equal(findVariant(C, { model: "", color: "blue" }), null);
    const M = [v("m", "i13", null, 2)];
    assert.equal(findVariant(M, { model: "i13", color: "" })?.id, "m");
  });
});
