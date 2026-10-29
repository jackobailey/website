import assert from "node:assert/strict";
import test from "node:test";
import { TAX_CURVE_SCENE as scene, taxCurveParameters, taxCurveY, taxCurvePath, taxCurveEchoes } from "../src/lib/taxCurve.ts";

test("the changing curve remains monotonic and anchored to both frame edges", () => {
  for (let time = -40; time < 70; time += .173) {
    assert.equal(taxCurveY(0, time), scene.height);
    assert.equal(taxCurveY(scene.width, time), 0);
    const points = [...taxCurvePath(time).matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
    assert.equal(points.length, scene.samples + 1);
    for (let index = 1; index < points.length; index++) {
      assert.ok(points[index][1] <= points[index - 1][1], "the curve must not fold or reverse");
      assert.ok(points[index][1] >= 0 && points[index][1] <= scene.height);
    }
  }
});

test("each ghost retains its sampled shape and fades fully before retirement", () => {
  const ghost = (time: number) => taxCurveEchoes(time).find(echo => echo.sampledAt === 0);
  assert.equal(ghost(0)?.opacity, 0, "a new ghost must appear without a flash");
  let previous = ghost(1)!;
  const heldPath = previous.path;
  for (let time = 2; time < scene.historySeconds; time += .37) {
    const current = ghost(time)!;
    assert.equal(current.path, heldPath, "history must retain the actual earlier shape");
    assert.ok(current.opacity < previous.opacity, "a retained ghost must fade as it ages");
    previous = current;
  }
  assert.ok(ghost(scene.historySeconds * (1 - 1e-6))!.opacity < 1e-8);
  assert.equal(ghost(scene.historySeconds), undefined);
});

test("purple, magenta and coral ghosts remain visible throughout the animation", () => {
  for (let time = 0; time < scene.sweepSeconds * 4; time += .137) {
    const visible = taxCurveEchoes(time).filter(echo => echo.opacity > .3);
    assert.ok(visible.some(echo => parseInt(echo.color.slice(1, 3), 16) < 100), "purple history must stay visible");
    assert.ok(visible.some(echo => {
      const red = parseInt(echo.color.slice(1, 3), 16);
      return red > 170 && red < 210;
    }), "the middle of the palette must stay visible");
    assert.ok(visible.some(echo => echo.color === "#f7705c"), "coral must appear before the final fade");
  }
});

test("random turns alternate sides without repeating a fixed shape", () => {
  const midpoints = new Set<number>();
  const slopes = new Set<number>();
  for (let turn = 4; turn < 100; turn++) {
    const parameters = taxCurveParameters(turn * scene.sweepSeconds, 12345);
    assert.ok(turn % 2 === 0 ? parameters.midpoint < .35 : parameters.midpoint > .65);
    assert.ok(parameters.steepness >= 10 && parameters.steepness <= 30,
      "random targets must keep the curve distinctly bent");
    midpoints.add(parameters.midpoint);
    slopes.add(parameters.steepness);
  }
  assert.equal(midpoints.size, 96);
  assert.equal(slopes.size, 96);
  assert.ok([...midpoints].filter(midpoint => midpoint < .15 || midpoint > .85).length > 48,
    "most turns should reach the outer parts of the frame");
  assert.ok([...slopes].filter(slope => slope > 25).length > 10, "very steep curves should recur");
});

test("each visit preserves the initial artwork then follows its own random targets", () => {
  for (const time of [scene.initialTime - scene.historySeconds, scene.initialTime, 12]) {
    assert.deepEqual(taxCurveParameters(time, 12345), taxCurveParameters(time, 67890));
  }
  assert.notDeepEqual(taxCurveParameters(16, 12345), taxCurveParameters(16, 67890));
  const oldGhost = taxCurveEchoes(15.9, 12345).find(echo => echo.sampledAt === 15.5)!;
  const retained = taxCurveEchoes(17, 12345).find(echo => echo.sampledAt === 15.5)!;
  assert.equal(retained.path, oldGhost.path, "turning must not change a ghost's sampled shape");
  assert.equal(retained.path, taxCurvePath(15.5, 128, 12345));
});

test("random targets join with continuous position, velocity and acceleration", () => {
  // Resolve the tighter bends close enough to the turn to distinguish their
  // ordinary acceleration from a discontinuity.
  const dt = .00003;
  for (let turn = 1; turn < 24; turn++) {
    const time = turn * scene.sweepSeconds;
    for (let x = 0; x <= scene.width; x += 31) {
      const at = taxCurveY(x, time, 12345);
      const before = taxCurveY(x, time - dt, 12345);
      const after = taxCurveY(x, time + dt, 12345);
      assert.ok(Math.abs(before - at) < 1e-8 && Math.abs(after - at) < 1e-8);
      assert.ok(Math.abs((at - before) / dt - (after - at) / dt) < 1e-5, "a turn must not jerk");
      assert.ok(Math.abs((after - 2 * at + before) / dt ** 2) < .1, "acceleration should approach zero at a turn");
    }
  }
});
