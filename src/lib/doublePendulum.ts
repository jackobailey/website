/** Angles from vertical down; angular velocities in radians per second. */
export type PendulumState = [number, number, number, number];

export const DOUBLE_PENDULUM = {
  length1: 1.1,
  length2: 1.2,
  mass1: 1,
  mass2: 1,
  gravity: 9.81,
  step: 1 / 240,
  timeScale: 0.72
} as const;

export const PENDULUM_SCENE = {
  width: 1280,
  height: 720,
  pivotX: 640,
  pivotY: 215,
  pixelsPerMetre: 170,
  bobRadius: 23
} as const;

export function initialPendulum(): PendulumState {
  return [-0.68, -2.25, 0.45, -3.6];
}

/**
 * Ideal rigid, massless rods with point masses and no damping.
 * Solve the coupled equations as a 2x2 mass matrix rather than expanding them.
 * Derivation: https://www.myphysicslab.com/pendulum/double-pendulum-en.html
 */
export function pendulumDerivative([a, b, u, v]: PendulumState): PendulumState {
  const { length1: l1, length2: l2, mass1: m1, mass2: m2, gravity: g } = DOUBLE_PENDULUM;
  const delta = a - b;
  const coupling = m2 * l1 * l2;
  const aa = (m1 + m2) * l1 * l1;
  const ab = coupling * Math.cos(delta);
  const bb = m2 * l2 * l2;
  const f1 = -(m1 + m2) * g * l1 * Math.sin(a) - coupling * v * v * Math.sin(delta);
  const f2 = -m2 * g * l2 * Math.sin(b) + coupling * u * u * Math.sin(delta);
  const determinant = aa * bb - ab * ab;
  return [u, v, (bb * f1 - ab * f2) / determinant, (aa * f2 - ab * f1) / determinant];
}

function advance(state: PendulumState, derivative: PendulumState, dt: number): PendulumState {
  return state.map((value, i) => value + derivative[i] * dt) as PendulumState;
}

/** Fixed-step fourth-order Runge–Kutta keeps motion independent of display refresh rate. */
export function stepPendulum(state: PendulumState, dt: number = DOUBLE_PENDULUM.step): PendulumState {
  const k1 = pendulumDerivative(state);
  const k2 = pendulumDerivative(advance(state, k1, dt / 2));
  const k3 = pendulumDerivative(advance(state, k2, dt / 2));
  const k4 = pendulumDerivative(advance(state, k3, dt));
  const next = state.map((value, i) => value + dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6) as PendulumState;
  next[0] = Math.atan2(Math.sin(next[0]), Math.cos(next[0]));
  next[1] = Math.atan2(Math.sin(next[1]), Math.cos(next[1]));
  return next;
}

export function pendulumEnergy([a, b, u, v]: PendulumState) {
  const { length1: l1, length2: l2, mass1: m1, mass2: m2, gravity: g } = DOUBLE_PENDULUM;
  const kinetic = (m1 + m2) * l1 * l1 * u * u / 2 + m2 * l2 * l2 * v * v / 2
    + m2 * l1 * l2 * u * v * Math.cos(a - b);
  return kinetic - (m1 + m2) * g * l1 * Math.cos(a) - m2 * g * l2 * Math.cos(b);
}

export function pendulumPositions([a, b]: PendulumState) {
  const s = PENDULUM_SCENE;
  const l1 = DOUBLE_PENDULUM.length1 * s.pixelsPerMetre;
  const l2 = DOUBLE_PENDULUM.length2 * s.pixelsPerMetre;
  const joint = { x: s.pivotX + l1 * Math.sin(a), y: s.pivotY + l1 * Math.cos(a) };
  return { joint, end: { x: joint.x + l2 * Math.sin(b), y: joint.y + l2 * Math.cos(b) } };
}

export function pendulumRotations([a, b]: PendulumState) {
  return { upper: -a * 180 / Math.PI, lower: -(b - a) * 180 / Math.PI };
}
