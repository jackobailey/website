import { initialPendulum, pendulumPositions, stepPendulum } from "./doublePendulum.ts";

export type TrailPoint = { x: number; y: number };

// Eight simulated seconds, sampled at 120 Hz regardless of display refresh rate.
export const PENDULUM_TRAIL = { stepsPerSample: 2, maxPoints: 961, segments: 24 } as const;

export function initialPendulumFrame() {
  let state = initialPendulum();
  const trail = [pendulumPositions(state).end];
  for (let i = 1; i <= (PENDULUM_TRAIL.maxPoints - 1) * PENDULUM_TRAIL.stepsPerSample; i++) {
    state = stepPendulum(state);
    if (i % PENDULUM_TRAIL.stepsPerSample === 0) trail.push(pendulumPositions(state).end);
  }
  return { state, trail };
}

/** Adjacent paths share endpoints, with opacity increasing towards the current weight. */
export function pendulumTrailPaths(points: TrailPoint[]) {
  return Array.from({ length: PENDULUM_TRAIL.segments }, (_, i) => {
    const start = Math.floor(i * (points.length - 1) / PENDULUM_TRAIL.segments);
    const end = Math.floor((i + 1) * (points.length - 1) / PENDULUM_TRAIL.segments);
    return points.slice(start, end + 1).map((p, j) => `${j ? "L" : "M"}${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(" ");
  });
}
