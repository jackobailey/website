import assert from "node:assert/strict";
import { test } from "node:test";
import { makeModel, winProbability, voteForProbability } from "../src/components/thresholds/model.ts";

const close = (a: number, b: number, tolerance = 1e-12) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test("paper's examples and algebraic special cases", () => {
  close(makeModel(1, 4).threshold, 0.3125);
  close(makeModel(2, 3).threshold, 7 / 27);
  assert.equal(Math.round(makeModel(1, 3.83).threshold * 100), 32);
  assert.equal(Math.round(makeModel(1, 2.16).threshold * 100), 48);
  close(makeModel(1000, 1001).threshold * 1001, 1 - (999 / 1000) * (1000 / 1001) ** 1000);
});

test("bounded, monotonic probabilities and inversion across district sizes", () => {
  for (const m of [1, 2, 5, 30, 100, 1000]) {
    for (const n of [1.01, 1.5, 2, 2.001, 3.83, 10, 100]) {
      const model = makeModel(m, n);
      assert.ok(model.lower <= model.threshold && model.threshold <= model.upper);
      close(winProbability(model.threshold, model), 0.5);
      assert.equal(winProbability(0, model), 0);
      assert.equal(winProbability(1, model), 1);
      let last = 0;
      for (let i = 0; i <= 1000; i++) {
        const p = winProbability(i / 1000, model);
        assert.ok(Number.isFinite(p) && p >= last && p <= 1);
        last = p;
      }
      if (!model.isStep) for (const p of [0.01, 0.1, 0.5, 0.9, 0.99, 0.999]) {
        close(winProbability(voteForProbability(p, model)!, model), p, 1e-9);
      }
    }
  }
});

test("zero-width limit avoids NaN and does not invent a target", () => {
  for (const [m, n] of [[1, 2], [1, 1.01], [2, 1.5]]) {
    const model = makeModel(m, n);
    assert.ok(model.isStep);
    assert.equal(winProbability(model.threshold - 0.00001, model), 0);
    assert.equal(winProbability(model.threshold + 0.00001, model), 1);
    assert.equal(voteForProbability(0.9, model), null);
    assert.equal(voteForProbability(0.5, model), model.threshold);
  }
});

test("invalid model and probability inputs fail explicitly", () => {
  for (const [m, n] of [[0, 4], [1.5, 4], [1, 1], [1, NaN], [Infinity, 4]]) assert.throws(() => makeModel(m, n), RangeError);
  const model = makeModel(1, 4);
  for (const v of [-0.1, 1.1, NaN]) assert.throws(() => winProbability(v, model), RangeError);
  for (const p of [0, 1, NaN]) assert.throws(() => voteForProbability(p, model), RangeError);
});
