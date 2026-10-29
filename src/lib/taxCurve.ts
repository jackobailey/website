/** Decorative tax-curve geometry; these parameters are not a proposed tax schedule. */
export const TAX_CURVE_SCENE = {
  width: 1280,
  height: 720,
  sweepSeconds: 4,
  posterSeed: 0x74617831,
  initialTime: 9,
  samples: 512,
  historySeconds: 4,
} as const;

// Equally spaced samples of the canonical Magma map from 0.2 to 0.7,
// generated with d3-scale-chromatic's interpolateMagma. Newest to oldest.
const MAGMA_MEMORY_COLORS = [
  "#3b0f70", "#3f0f72", "#420f75", "#451077", "#491078", "#4c117a", "#4f127b", "#52137c",
  "#56147d", "#59157e", "#5c167f", "#5f187f", "#621980", "#651a80", "#681c81", "#6b1d81",
  "#6e1e81", "#721f81", "#752181", "#782281", "#7b2382", "#7e2482", "#812581", "#842681",
  "#882781", "#8b2981", "#902a81", "#932b80", "#962c80", "#992d80", "#9c2e7f", "#a02f7f",
  "#a3307e", "#a6317d", "#aa337d", "#ad347c", "#b0357b", "#b3367a", "#b73779", "#ba3878",
  "#bd3977", "#c03a76", "#c43c75", "#c73d73", "#ca3e72", "#cd4071", "#d0416f", "#d3436e",
  "#d6456c", "#d9466b", "#dc4869", "#df4a68", "#e24d66", "#e44f64", "#e75263", "#e95462",
  "#eb5760", "#ee5b5e", "#f05f5e", "#f2625d", "#f3655c", "#f4695c", "#f66c5c", "#f7705c",
] as const;

// Indexing the random choices by turn lets a ghost recover its exact earlier
// shape without storing an ever-growing sequence of targets.
function turnRandom(turn: number, seed: number, salt: number) {
  let value = (turn ^ seed ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function turnTarget(turn: number, seed: number) {
  // Preserve the poster and its initial sweep; introduce this visit's random
  // sequence at the next turn, so hydration never changes the visible shape.
  const firstRandomTarget = Math.floor(TAX_CURVE_SCENE.initialTime / TAX_CURVE_SCENE.sweepSeconds) + 2;
  const targetSeed = turn < firstRandomTarget ? TAX_CURVE_SCENE.posterSeed : seed;
  // Favour the outer edges and steeper bends, keeping the S-shape pronounced
  // as the midpoint sweeps across the frame.
  const edgeDistance = .04 + .2 * turnRandom(turn, targetSeed, 0x9e3779b9) ** 2;
  const slopeBias = Math.sqrt(turnRandom(turn, targetSeed, 0x85ebca6b));
  return {
    midpoint: turn % 2 === 0 ? edgeDistance : 1 - edgeDistance,
    steepness: 10 + 20 * slopeBias,
  };
}

export function taxCurveParameters(time: number, seed: number = TAX_CURVE_SCENE.posterSeed) {
  const turn = Math.floor(time / TAX_CURVE_SCENE.sweepSeconds);
  const progress = time / TAX_CURVE_SCENE.sweepSeconds - turn;
  // Zero velocity and acceleration at each reversal, even when the next
  // randomly chosen slope or midpoint differs substantially.
  const blend = progress ** 3 * (progress * (progress * 6 - 15) + 10);
  const from = turnTarget(turn, seed);
  const to = turnTarget(turn + 1, seed);
  return {
    lowerY: TAX_CURVE_SCENE.height,
    upperY: 0,
    midpoint: from.midpoint + (to.midpoint - from.midpoint) * blend,
    steepness: from.steepness + (to.steepness - from.steepness) * blend,
  };
}

/** Sixteen new traces per second form a short, rapidly fading history. */
export function taxCurveEchoes(time: number, seed: number = TAX_CURVE_SCENE.posterSeed) {
  const count = MAGMA_MEMORY_COLORS.length;
  const interval = TAX_CURVE_SCENE.historySeconds / count;
  const newestSample = Math.floor(time / interval);
  return MAGMA_MEMORY_COLORS.map((_, index) => {
    const sampledAt = (newestSample - (count - 1 - index)) * interval;
    const age = time - sampledAt;
    const progress = Math.min(1, age / TAX_CURVE_SCENE.historySeconds);
    const arrival = Math.min(1, age / interval);
    const fadeIn = arrival * arrival * (3 - 2 * arrival);
    const departure = Math.min(1, Math.max(0, (1 - progress) / .25));
    const fadeOut = departure * departure * (3 - 2 * departure);
    return {
      sampledAt,
      path: taxCurvePath(sampledAt, 128, seed),
      // Reach coral while still clearly visible, before the final one-second fade.
      color: MAGMA_MEMORY_COLORS[1 + Math.floor(Math.min(1, progress / .75) * (count - 2))],
      opacity: .55 * (1 - .3 * progress) * fadeIn * fadeOut,
    };
  });
}

export function taxCurveY(x: number, time: number, seed: number = TAX_CURVE_SCENE.posterSeed) {
  return curveY(x, taxCurveParameters(time, seed));
}

function curveY(x: number, { lowerY, upperY, midpoint, steepness }: ReturnType<typeof taxCurveParameters>) {
  const logistic = 1 / (1 + Math.exp(-steepness * (x / TAX_CURVE_SCENE.width - midpoint)));
  const start = 1 / (1 + Math.exp(steepness * midpoint));
  const end = 1 / (1 + Math.exp(-steepness * (1 - midpoint)));
  // Fit the visible domain to the floor and ceiling even as the bend moves sideways.
  const progress = (logistic - start) / (end - start);
  return lowerY + (upperY - lowerY) * progress;
}

export function taxCurvePath(time: number, samples: number = TAX_CURVE_SCENE.samples, seed: number = TAX_CURVE_SCENE.posterSeed) {
  const { width } = TAX_CURVE_SCENE;
  const parameters = taxCurveParameters(time, seed);
  return Array.from({ length: samples + 1 }, (_, index) => {
    const x = width * index / samples;
    return `${index ? "L" : "M"}${x.toFixed(2)} ${curveY(x, parameters).toFixed(3)}`;
  }).join(" ");
}
