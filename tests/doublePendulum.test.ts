import assert from "node:assert/strict";
import test from "node:test";
import {
  DOUBLE_PENDULUM as P, PENDULUM_SCENE as scene,
  pendulumEnergy, pendulumPositions, randomPendulum, stepPendulum
} from "../src/lib/doublePendulum.ts";
import { initialPendulumFrame, pendulumTrailPaths } from "../src/lib/pendulumTrail.ts";

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

test("fresh releases produce different opening poses and their own continuous trails", () => {
  const random = seededRandom(12345);
  const openings = new Set<string>();
  for (let i = 0; i < 24; i++) {
    const { state, trail } = initialPendulumFrame(randomPendulum(random));
    openings.add(JSON.stringify(state));
    const tip = pendulumPositions(state).end;
    assert.deepEqual(trail.at(-1), tip);
    assert.ok(pendulumTrailPaths(trail).at(-1)!.endsWith(`${tip.x.toFixed(3)} ${tip.y.toFixed(3)}`));
    for (let j = 1; j < trail.length; j++) {
      assert.ok(Math.hypot(trail[j].x - trail[j - 1].x, trail[j].y - trail[j - 1].y) < 20,
        "history should follow the physical tip without jumps");
    }
  }
  assert.equal(openings.size, 24);
  assert.deepEqual(initialPendulumFrame(), initialPendulumFrame(), "the poster must remain reproducible");
});

test("random trajectories conserve energy, move freely and keep the linkage inside the artwork", () => {
  const random = seededRandom(67890);
  const starts = Array.from({ length: 16 }, () => randomPendulum(random));
  // Include the extremes of the random release envelope, not only typical draws.
  for (const upper of [0, 0.5, 1]) {
    for (const lower of [0, 1]) {
      for (const side of [0, 1]) {
        const draws = [upper, lower, side];
        starts.push(randomPendulum(() => draws.shift()!));
      }
    }
  }
  const energyScale = P.gravity * ((P.mass1 + P.mass2) * P.length1 + P.mass2 * P.length2);
  for (const start of starts) {
    let state = start;
    const energy = pendulumEnergy(start);
    const first = pendulumPositions(start).end;
    let travelled = 0;
    for (let step = 0; step < 60 / P.step; step++) {
      state = stepPendulum(state);
      assert.ok(state.every(Number.isFinite));
      assert.ok(Math.abs(pendulumEnergy(state) - energy) / energyScale < 0.00001,
        "the integrator must not inject or remove meaningful energy");
      const { joint, end } = pendulumPositions(state);
      for (const point of [joint, end]) {
        assert.ok(point.x >= scene.bobRadius && point.x <= scene.width - scene.bobRadius);
        assert.ok(point.y >= scene.bobRadius && point.y <= scene.height - scene.bobRadius);
      }
      assert.ok(Math.abs(Math.hypot(joint.x - scene.pivotX, joint.y - scene.pivotY) - P.length1 * scene.pixelsPerMetre) < 1e-9);
      assert.ok(Math.abs(Math.hypot(end.x - joint.x, end.y - joint.y) - P.length2 * scene.pixelsPerMetre) < 1e-9);
      travelled = Math.max(travelled, Math.hypot(end.x - first.x, end.y - first.y));
    }
    assert.ok(travelled > 200, "a random release should not get stuck near equilibrium");
  }
});
