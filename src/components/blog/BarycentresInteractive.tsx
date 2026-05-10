import {
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent
} from "react";

const ACCENT = "#F76F5C";
const INK = "#111111";
const DEFAULT_SHARES = [34, 33, 33] as const;
const PARTIES = ["Party 1", "Party 2", "Party 3"] as const;
const SHARE_STEP = 0.1;
const EFFECTIVE_PARTIES_MIN = 1;
const EFFECTIVE_PARTIES_MAX = 3;
const EFFECTIVE_PARTIES_STEP = 0.01;
const EFFECTIVE_CONTOUR_SAMPLES = 720;
const CHART_WIDTH = 640;
const CHART_HEIGHT = 510;
const TRIANGLE_SIDE = 448;
const TRIANGLE_HEIGHT = (Math.sqrt(3) / 2) * TRIANGLE_SIDE;
const TRIANGLE_CENTER_X = CHART_WIDTH / 2;
const TRIANGLE_TOP_Y = 64;
const TRIANGLE_BOTTOM_Y = TRIANGLE_TOP_Y + TRIANGLE_HEIGHT;
const VERTICES = [
  { x: TRIANGLE_CENTER_X, y: TRIANGLE_TOP_Y },
  { x: TRIANGLE_CENTER_X - TRIANGLE_SIDE / 2, y: TRIANGLE_BOTTOM_Y },
  { x: TRIANGLE_CENTER_X + TRIANGLE_SIDE / 2, y: TRIANGLE_BOTTOM_Y }
] as const;
const GRID_TICKS = [20, 40, 60, 80] as const;
const FLAT_HEATMAP_RESOLUTION = 38;
const HEATMAP_OPACITY = 0.52;
const MAGMA_COLOUR_RANGE = {
  start: 0.2,
  end: 0.7
} as const;
const MAGMA_STOPS = [
  { amount: 0, colour: [0, 0, 4] },
  { amount: 0.1, colour: [20, 14, 54] },
  { amount: 0.2, colour: [59, 15, 112] },
  { amount: 0.3, colour: [100, 26, 128] },
  { amount: 0.4, colour: [140, 41, 129] },
  { amount: 0.5, colour: [181, 54, 122] },
  { amount: 0.6, colour: [222, 73, 104] },
  { amount: 0.7, colour: [246, 110, 91] },
  { amount: 0.8, colour: [254, 159, 109] },
  { amount: 0.9, colour: [254, 207, 146] },
  { amount: 1, colour: [252, 253, 191] }
] as const;

type Point = {
  x: number;
  y: number;
};

type FlatHeatmapCell = {
  colour: string;
  id: string;
  points: string;
};

type BarycentricWeights = [number, number, number];
type ColourMode = "plain" | "effective";

const EQUAL_WEIGHTS: BarycentricWeights = [1 / 3, 1 / 3, 1 / 3];
const DEFAULT_EFFECTIVE_DIRECTION_WEIGHTS: BarycentricWeights = [1, 0, 0];
const EFFECTIVE_CONTOUR_BASIS = [
  [1 / Math.sqrt(2), -1 / Math.sqrt(2), 0],
  [1 / Math.sqrt(6), 1 / Math.sqrt(6), -2 / Math.sqrt(6)]
] as const;

function interpolate(start: Point, end: Point, amount: number) {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount
  };
}

function dot(left: Point, right: Point) {
  return left.x * right.x + left.y * right.y;
}

function subtract(left: Point, right: Point) {
  return {
    x: left.x - right.x,
    y: left.y - right.y
  };
}

function add(left: Point, right: Point) {
  return {
    x: left.x + right.x,
    y: left.y + right.y
  };
}

function scale(point: Point, factor: number) {
  return {
    x: point.x * factor,
    y: point.y * factor
  };
}

function getBarycentricPoint(shares: number[]) {
  return getBarycentricPointFromWeights(shares.map((share) => share / 100));
}

function getBarycentricPointFromWeights(weights: number[]) {
  return weights.reduce(
    (point, share, index) => ({
      x: point.x + share * VERTICES[index].x,
      y: point.y + share * VERTICES[index].y
    }),
    { x: 0, y: 0 }
  );
}

function formatPointForSvg(point: Point) {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

function formatHeatmapPoints(weights: BarycentricWeights[]) {
  return weights
    .map((weightSet) => formatPointForSvg(getBarycentricPointFromWeights(weightSet)))
    .join(" ");
}

function getAverageWeights(weightSets: BarycentricWeights[]): BarycentricWeights {
  return [0, 1, 2].map((index) => {
    return (
      weightSets.reduce((sum, weights) => sum + weights[index], 0) / weightSets.length
    );
  }) as BarycentricWeights;
}

function getMagmaColour(amount: number) {
  const clampedAmount = clamp(amount, 0, 1);
  const nextStopIndex = MAGMA_STOPS.findIndex((stop) => stop.amount >= clampedAmount);

  if (nextStopIndex <= 0) {
    return rgbToHex(MAGMA_STOPS[0].colour);
  }

  const nextStop = MAGMA_STOPS[nextStopIndex];
  const previousStop = MAGMA_STOPS[nextStopIndex - 1];
  const stopAmount =
    (clampedAmount - previousStop.amount) / (nextStop.amount - previousStop.amount);

  return rgbToHex(
    previousStop.colour.map((channel, index) => {
      return channel + (nextStop.colour[index] - channel) * stopAmount;
    })
  );
}

function rgbToHex(channels: readonly number[]) {
  return `#${channels
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function getEffectivePartyColour(weights: BarycentricWeights) {
  const effectiveParties = getEffectivePartiesFromWeights(weights);
  const normalisedParties = clamp((effectiveParties - 1) / 2, 0, 1);
  const magmaAmount =
    MAGMA_COLOUR_RANGE.start +
    normalisedParties * (MAGMA_COLOUR_RANGE.end - MAGMA_COLOUR_RANGE.start);

  return getMagmaColour(magmaAmount);
}

function getFlatHeatmapCells() {
  const cells: FlatHeatmapCell[] = [];

  for (let party1 = 0; party1 < FLAT_HEATMAP_RESOLUTION; party1 += 1) {
    for (let party2 = 0; party2 < FLAT_HEATMAP_RESOLUTION - party1; party2 += 1) {
      const party3 = FLAT_HEATMAP_RESOLUTION - party1 - party2;
      const first: BarycentricWeights = [
        party1 / FLAT_HEATMAP_RESOLUTION,
        party2 / FLAT_HEATMAP_RESOLUTION,
        party3 / FLAT_HEATMAP_RESOLUTION
      ];
      const second: BarycentricWeights = [
        (party1 + 1) / FLAT_HEATMAP_RESOLUTION,
        party2 / FLAT_HEATMAP_RESOLUTION,
        (party3 - 1) / FLAT_HEATMAP_RESOLUTION
      ];
      const third: BarycentricWeights = [
        party1 / FLAT_HEATMAP_RESOLUTION,
        (party2 + 1) / FLAT_HEATMAP_RESOLUTION,
        (party3 - 1) / FLAT_HEATMAP_RESOLUTION
      ];
      const firstCellWeights = [first, second, third];

      cells.push({
        colour: getEffectivePartyColour(getAverageWeights(firstCellWeights)),
        id: `${party1}-${party2}-a`,
        points: formatHeatmapPoints(firstCellWeights)
      });

      if (party1 + party2 < FLAT_HEATMAP_RESOLUTION - 1) {
        const fourth: BarycentricWeights = [
          (party1 + 1) / FLAT_HEATMAP_RESOLUTION,
          (party2 + 1) / FLAT_HEATMAP_RESOLUTION,
          (party3 - 2) / FLAT_HEATMAP_RESOLUTION
        ];
        const secondCellWeights = [second, fourth, third];

        cells.push({
          colour: getEffectivePartyColour(getAverageWeights(secondCellWeights)),
          id: `${party1}-${party2}-b`,
          points: formatHeatmapPoints(secondCellWeights)
        });
      }
    }
  }

  return cells;
}

function getEffectiveParties(shares: number[]) {
  return getEffectivePartiesFromWeights(shares.map((share) => share / 100));
}

function getEffectivePartiesFromWeights(weights: number[]) {
  const concentration = weights.reduce((total, weight) => {
    return total + weight * weight;
  }, 0);

  return 1 / concentration;
}

function getNormalisedWeights(weights: number[]): BarycentricWeights {
  const clampedWeights = weights.map((weight) => Math.max(0, weight));
  const total = clampedWeights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) {
    return [...EQUAL_WEIGHTS];
  }

  return clampedWeights.map((weight) => weight / total) as BarycentricWeights;
}

function isInSimplex(weights: number[], tolerance = 0.000001) {
  return weights.every((weight) => weight >= -tolerance && weight <= 1 + tolerance);
}

function getEffectiveContourRadius(effectiveParties: number) {
  const clampedParties = clamp(
    effectiveParties,
    EFFECTIVE_PARTIES_MIN,
    EFFECTIVE_PARTIES_MAX
  );

  return Math.sqrt(Math.max(0, 1 / clampedParties - 1 / EFFECTIVE_PARTIES_MAX));
}

function getWeightsOnEffectiveContour(
  effectiveParties: number,
  angle: number
): BarycentricWeights {
  const radius = getEffectiveContourRadius(effectiveParties);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [0, 1, 2].map((index) => {
    return (
      EQUAL_WEIGHTS[index] +
      radius *
        (cos * EFFECTIVE_CONTOUR_BASIS[0][index] +
          sin * EFFECTIVE_CONTOUR_BASIS[1][index])
    );
  }) as BarycentricWeights;
}

function getWeightDeviation(weights: number[]) {
  return weights.map((weight, index) => weight - EQUAL_WEIGHTS[index]);
}

function getDeviationLength(deviation: number[]) {
  return Math.sqrt(
    deviation.reduce((sum, amount) => {
      return sum + amount * amount;
    }, 0)
  );
}

function getBoundaryWeightsForEffectiveParties(effectiveParties: number) {
  const clampedParties = clamp(
    effectiveParties,
    EFFECTIVE_PARTIES_MIN,
    EFFECTIVE_PARTIES_MAX
  );
  const concentration = 1 / clampedParties;

  if (concentration < 0.5 - 0.000001) {
    return [];
  }

  const spread = Math.sqrt(Math.max(0, 2 * concentration - 1));
  const boundaryWeights: BarycentricWeights[] = [];

  for (let zeroIndex = 0; zeroIndex < 3; zeroIndex += 1) {
    const [firstIndex, secondIndex] = [0, 1, 2].filter((index) => index !== zeroIndex);
    const firstWeight = (1 + spread) / 2;
    const secondWeight = (1 - spread) / 2;
    const weights = [0, 0, 0] as BarycentricWeights;

    weights[zeroIndex] = 0;
    weights[firstIndex] = firstWeight;
    weights[secondIndex] = secondWeight;
    boundaryWeights.push(weights);

    if (spread > 0.000001) {
      const reversedWeights = [0, 0, 0] as BarycentricWeights;

      reversedWeights[zeroIndex] = 0;
      reversedWeights[firstIndex] = secondWeight;
      reversedWeights[secondIndex] = firstWeight;
      boundaryWeights.push(reversedWeights);
    }
  }

  return boundaryWeights;
}

function getEffectiveContourWeights(effectiveParties: number) {
  const clampedParties = clamp(
    effectiveParties,
    EFFECTIVE_PARTIES_MIN,
    EFFECTIVE_PARTIES_MAX
  );

  if (clampedParties >= EFFECTIVE_PARTIES_MAX - 0.000001) {
    return [[...EQUAL_WEIGHTS] as BarycentricWeights];
  }

  const weights: BarycentricWeights[] = [];

  for (let index = 0; index < EFFECTIVE_CONTOUR_SAMPLES; index += 1) {
    const candidateWeights = getWeightsOnEffectiveContour(
      clampedParties,
      (index / EFFECTIVE_CONTOUR_SAMPLES) * Math.PI * 2
    );

    if (isInSimplex(candidateWeights)) {
      weights.push(getNormalisedWeights(candidateWeights));
    }
  }

  return weights.concat(getBoundaryWeightsForEffectiveParties(clampedParties));
}

function getClosestWeightsAtEffectiveParties(
  targetWeights: BarycentricWeights,
  effectiveParties: number
) {
  const targetPoint = getBarycentricPointFromWeights(targetWeights);
  const contourWeights = getEffectiveContourWeights(effectiveParties);
  let closestWeights: BarycentricWeights | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  contourWeights.forEach((weights) => {
    const point = getBarycentricPointFromWeights(weights);
    const distance = Math.hypot(point.x - targetPoint.x, point.y - targetPoint.y);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestWeights = weights;
    }
  });

  return closestWeights ?? ([...EQUAL_WEIGHTS] as BarycentricWeights);
}

function getProjectedWeightsAtEffectiveParties(
  targetWeights: BarycentricWeights,
  effectiveParties: number,
  fallbackWeights: BarycentricWeights = targetWeights
) {
  const clampedParties = clamp(
    effectiveParties,
    EFFECTIVE_PARTIES_MIN,
    EFFECTIVE_PARTIES_MAX
  );

  if (clampedParties >= EFFECTIVE_PARTIES_MAX - 0.000001) {
    return [...EQUAL_WEIGHTS] as BarycentricWeights;
  }

  const targetDeviation = getWeightDeviation(targetWeights);
  const fallbackDeviation = getWeightDeviation(fallbackWeights);
  const defaultDeviation = getWeightDeviation(DEFAULT_EFFECTIVE_DIRECTION_WEIGHTS);
  const targetDeviationLength = getDeviationLength(targetDeviation);
  const fallbackDeviationLength = getDeviationLength(fallbackDeviation);
  const defaultDeviationLength = getDeviationLength(defaultDeviation);
  const sourceDeviation =
    targetDeviationLength > 0.000001
      ? targetDeviation
      : fallbackDeviationLength > 0.000001
        ? fallbackDeviation
        : defaultDeviation;
  const sourceDeviationLength =
    targetDeviationLength > 0.000001
      ? targetDeviationLength
      : fallbackDeviationLength > 0.000001
        ? fallbackDeviationLength
        : defaultDeviationLength;

  if (sourceDeviationLength > 0.000001) {
    const radius = getEffectiveContourRadius(clampedParties);
    const projectedWeights = sourceDeviation.map((amount, index) => {
      return EQUAL_WEIGHTS[index] + (amount / sourceDeviationLength) * radius;
    }) as BarycentricWeights;

    if (isInSimplex(projectedWeights)) {
      return getNormalisedWeights(projectedWeights);
    }
  }

  return getClosestWeightsAtEffectiveParties(targetWeights, clampedParties);
}

function getSharesAtEffectivePartiesNearTarget(
  targetShares: number[],
  effectiveParties: number,
  fallbackShares: number[] = targetShares
) {
  const weights = getProjectedWeightsAtEffectiveParties(
    getWeightsFromShares(targetShares),
    effectiveParties,
    getWeightsFromShares(fallbackShares)
  );

  return weights.map((weight) => weight * 100);
}

function getEffectivePartiesContourPath(effectiveParties: number) {
  const clampedParties = clamp(
    effectiveParties,
    EFFECTIVE_PARTIES_MIN,
    EFFECTIVE_PARTIES_MAX
  );

  if (clampedParties >= EFFECTIVE_PARTIES_MAX - 0.000001) {
    return "";
  }

  const segments: Point[][] = [];
  let currentSegment: Point[] = [];
  const isFirstPointValid = isInSimplex(getWeightsOnEffectiveContour(clampedParties, 0), 0.001);

  for (let index = 0; index <= EFFECTIVE_CONTOUR_SAMPLES; index += 1) {
    const weights = getWeightsOnEffectiveContour(
      clampedParties,
      (index / EFFECTIVE_CONTOUR_SAMPLES) * Math.PI * 2
    );

    if (isInSimplex(weights, 0.001)) {
      currentSegment.push(getBarycentricPointFromWeights(getNormalisedWeights(weights)));
    } else if (currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = [];
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  if (isFirstPointValid && segments.length > 1) {
    const firstSegment = segments.shift();
    const lastSegment = segments.pop();

    if (firstSegment && lastSegment) {
      segments.unshift(lastSegment.concat(firstSegment));
    }
  }

  return segments
    .filter((segment) => segment.length > 1)
    .map((segment) => {
      const [start, ...rest] = segment;
      const lineCommands = rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`);

      return [`M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`, ...lineCommands].join(" ");
    })
    .join(" ");
}

function roundToTotal(values: number[], total: number) {
  const floors = values.map((value) => Math.floor(value));
  let remainder = total - floors.reduce((sum, value) => sum + value, 0);
  const order = values
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((left, right) => right.fraction - left.fraction);

  for (let index = 0; index < order.length && remainder > 0; index += 1) {
    floors[order[index].index] += 1;
    remainder -= 1;
  }

  return floors;
}

function getLockedTotal(currentShares: number[], lockedParties: boolean[]) {
  return currentShares.reduce((total, share, index) => {
    return lockedParties[index] ? total + share : total;
  }, 0);
}

function getUnlockedIndexes(lockedParties: boolean[]) {
  return lockedParties
    .map((locked, index) => ({ index, locked }))
    .filter(({ locked }) => !locked)
    .map(({ index }) => index);
}

function rebalanceShares(
  currentShares: number[],
  lockedParties: boolean[],
  changedIndex: number,
  nextShare: number
) {
  if (lockedParties[changedIndex]) {
    return currentShares;
  }

  const unlockedIndexes = getUnlockedIndexes(lockedParties);
  const lockedTotal = getLockedTotal(currentShares, lockedParties);
  const availableShare = clamp(100 - lockedTotal, 0, 100);

  if (unlockedIndexes.length === 0) {
    return currentShares;
  }

  const otherIndexes = unlockedIndexes.filter((index) => index !== changedIndex);
  const clampedShare =
    otherIndexes.length === 0 ? availableShare : clamp(nextShare, 0, availableShare);
  const remainingShare = availableShare - clampedShare;
  const otherTotal = otherIndexes.reduce((sum, index) => sum + currentShares[index], 0);
  const rawOtherShares =
    otherTotal === 0
      ? otherIndexes.map(() => remainingShare / otherIndexes.length)
      : otherIndexes.map((index) => (currentShares[index] / otherTotal) * remainingShare);
  const nextShares = [...currentShares];

  nextShares[changedIndex] = clampedShare;
  otherIndexes.forEach((partyIndex, shareIndex) => {
    nextShares[partyIndex] = rawOtherShares[shareIndex];
  });

  return nextShares;
}

function applyLockedShareTarget(
  currentShares: number[],
  lockedParties: boolean[],
  targetShares: number[]
) {
  const unlockedIndexes = getUnlockedIndexes(lockedParties);

  if (unlockedIndexes.length === 0) {
    return currentShares;
  }

  const lockedTotal = getLockedTotal(currentShares, lockedParties);
  const availableShare = clamp(100 - lockedTotal, 0, 100);
  const targetUnlockedTotal = unlockedIndexes.reduce(
    (sum, index) => sum + Math.max(0, targetShares[index] ?? 0),
    0
  );
  const currentUnlockedTotal = unlockedIndexes.reduce(
    (sum, index) => sum + Math.max(0, currentShares[index] ?? 0),
    0
  );
  const sourceTotal =
    targetUnlockedTotal > 0
      ? targetUnlockedTotal
      : currentUnlockedTotal > 0
        ? currentUnlockedTotal
        : unlockedIndexes.length;
  const nextShares = [...currentShares];

  unlockedIndexes.forEach((index) => {
    const sourceShare =
      targetUnlockedTotal > 0
        ? Math.max(0, targetShares[index] ?? 0)
        : currentUnlockedTotal > 0
          ? Math.max(0, currentShares[index] ?? 0)
          : 1;

    nextShares[index] = (sourceShare / sourceTotal) * availableShare;
  });

  return nextShares;
}

function getConstantShareLine(index: number, share: number) {
  const amount = share / 100;
  const [firstOtherIndex, secondOtherIndex] = [0, 1, 2].filter(
    (partyIndex) => partyIndex !== index
  );

  return {
    start: interpolate(VERTICES[firstOtherIndex], VERTICES[index], amount),
    end: interpolate(VERTICES[secondOtherIndex], VERTICES[index], amount)
  };
}

function getSvgPoint(chart: SVGSVGElement, clientX: number, clientY: number) {
  const rect = chart.getBoundingClientRect();
  const scaleX = CHART_WIDTH / rect.width;
  const scaleY = CHART_HEIGHT / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function getClosestPointOnTriangle(point: Point, a: Point, b: Point, c: Point) {
  const ab = subtract(b, a);
  const ac = subtract(c, a);
  const ap = subtract(point, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);

  if (d1 <= 0 && d2 <= 0) {
    return { point: a, weights: [1, 0, 0] };
  }

  const bp = subtract(point, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);

  if (d3 >= 0 && d4 <= d3) {
    return { point: b, weights: [0, 1, 0] };
  }

  const vc = d1 * d4 - d3 * d2;

  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const amount = d1 / (d1 - d3);

    return {
      point: add(a, scale(ab, amount)),
      weights: [1 - amount, amount, 0]
    };
  }

  const cp = subtract(point, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);

  if (d6 >= 0 && d5 <= d6) {
    return { point: c, weights: [0, 0, 1] };
  }

  const vb = d5 * d2 - d1 * d6;

  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const amount = d2 / (d2 - d6);

    return {
      point: add(a, scale(ac, amount)),
      weights: [1 - amount, 0, amount]
    };
  }

  const va = d3 * d6 - d5 * d4;

  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const bc = subtract(c, b);
    const amount = (d4 - d3) / (d4 - d3 + (d5 - d6));

    return {
      point: add(b, scale(bc, amount)),
      weights: [0, 1 - amount, amount]
    };
  }

  const denominator = 1 / (va + vb + vc);
  const v = vb * denominator;
  const w = vc * denominator;
  const u = 1 - v - w;

  return {
    point: {
      x: a.x * u + b.x * v + c.x * w,
      y: a.y * u + b.y * v + c.y * w
    },
    weights: [u, v, w]
  };
}

function getWeightsFromShares(shares: number[]): BarycentricWeights {
  const total = shares.reduce((sum, share) => sum + share, 0) || 100;

  return [shares[0] / total, shares[1] / total, shares[2] / total];
}

function formatShare(share: number) {
  return `${Math.round(share)}%`;
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
      {locked ? (
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      ) : (
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      )}
    </svg>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const FLAT_HEATMAP_CELLS = getFlatHeatmapCells();

export default function BarycentresInteractive() {
  const controlId = useId();
  const activePointerIdRef = useRef<number | null>(null);
  const [shares, setShares] = useState<number[]>(() => [...DEFAULT_SHARES]);
  const [lockedParties, setLockedParties] = useState<boolean[]>(() => PARTIES.map(() => false));
  const [isEffectivePartiesLocked, setIsEffectivePartiesLocked] = useState(false);
  const [colourMode, setColourMode] = useState<ColourMode>("plain");
  const displayShares = roundToTotal(shares, 100);
  const effectiveParties = getEffectiveParties(shares);
  const point = getBarycentricPoint(shares);
  const controlIds = PARTIES.map((party) => `${controlId}-${party.toLowerCase().replace(" ", "-")}`);
  const effectivePartiesControlId = `${controlId}-effective-parties`;
  const isColourCoded = colourMode === "effective";
  const effectivePartiesLockLabel = isEffectivePartiesLocked
    ? "Unlock effective parties"
    : "Lock effective parties";
  const effectivePartiesSliderPosition = clamp(
    ((effectiveParties - EFFECTIVE_PARTIES_MIN) /
      (EFFECTIVE_PARTIES_MAX - EFFECTIVE_PARTIES_MIN)) *
      100,
    0,
    100
  );
  const effectivePartiesContourPath = useMemo(
    () => (isEffectivePartiesLocked ? getEffectivePartiesContourPath(effectiveParties) : ""),
    [effectiveParties, isEffectivePartiesLocked]
  );

  function updateSharesWithConstraints(targetShares: number[]) {
    setShares((currentShares) => {
      if (isEffectivePartiesLocked) {
        return getSharesAtEffectivePartiesNearTarget(
          targetShares,
          getEffectiveParties(currentShares),
          currentShares
        );
      }

      return applyLockedShareTarget(currentShares, lockedParties, targetShares);
    });
  }

  function updateSharesFromPlot(chart: SVGSVGElement, clientX: number, clientY: number) {
    const svgPoint = getSvgPoint(chart, clientX, clientY);
    const result = getClosestPointOnTriangle(
      svgPoint,
      VERTICES[0],
      VERTICES[1],
      VERTICES[2]
    );

    updateSharesWithConstraints(result.weights.map((weight) => weight * 100));
  }

  function handlePlotPointerDown(event: PointerEvent<SVGSVGElement>) {
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSharesFromPlot(event.currentTarget, event.clientX, event.clientY);
  }

  function handlePlotPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    updateSharesFromPlot(event.currentTarget, event.clientX, event.clientY);
  }

  function stopPlotPointer(event: PointerEvent<SVGSVGElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    activePointerIdRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function togglePartyLock(index: number) {
    setIsEffectivePartiesLocked(false);
    setLockedParties((currentLockedParties) =>
      currentLockedParties.map((locked, partyIndex) =>
        partyIndex === index ? !locked : locked
      )
    );
  }

  function toggleEffectivePartiesLock() {
    const nextIsLocked = !isEffectivePartiesLocked;

    if (nextIsLocked) {
      setLockedParties(PARTIES.map(() => false));
    }

    setIsEffectivePartiesLocked(nextIsLocked);
  }

  function handleShareChange(index: number, nextShare: number) {
    setShares((currentShares) => {
      if (isEffectivePartiesLocked) {
        const targetShares = rebalanceShares(
          currentShares,
          PARTIES.map(() => false),
          index,
          nextShare
        );

        return getSharesAtEffectivePartiesNearTarget(
          targetShares,
          getEffectiveParties(currentShares),
          currentShares
        );
      }

      return rebalanceShares(currentShares, lockedParties, index, nextShare);
    });
  }

  function handleEffectivePartiesChange(nextEffectiveParties: number) {
    setLockedParties(PARTIES.map(() => false));
    setShares((currentShares) =>
      getSharesAtEffectivePartiesNearTarget(
        currentShares,
        nextEffectiveParties,
        currentShares
      )
    );
  }

  return (
    <div className="not-prose my-10 w-full max-w-none sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-10 lg:w-[calc(100%+5rem)]">
      <section className="interactive-panel overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)]">
          <div className="border-b border-black/10 p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="eyebrow">Barycentric Coordinates</p>

            <div className="mt-6 space-y-5">
              <div className="border-b border-black/10 pb-5">
                <button
                  type="button"
                  onClick={() =>
                    setColourMode((currentMode) =>
                      currentMode === "effective" ? "plain" : "effective"
                    )
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-full border border-black/10 bg-black/[0.025] px-3 py-2 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F76F5C] focus-visible:ring-offset-2"
                  role="switch"
                  aria-checked={isColourCoded}
                  aria-label="Colour plot by effective parties"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">
                    Colour by N<sub>2</sub>
                  </span>
                  <span
                    className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${
                      isColourCoded ? "bg-[#F76F5C]" : "bg-black/15"
                    }`}
                    aria-hidden="true"
                  >
                    <span
                      className={`absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                        isColourCoded ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </span>
                </button>
              </div>

              <div className="space-y-5">
                {shares.map((share, index) => {
                  const isLocked = lockedParties[index];
                  const lockLabel = isLocked ? `Unlock ${PARTIES[index]}` : `Lock ${PARTIES[index]}`;

                  return (
                    <div key={PARTIES[index]} className="space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <label
                          htmlFor={controlIds[index]}
                          className="block text-sm font-semibold text-[#111111]"
                        >
                          {PARTIES[index]}
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums text-[#111111]">
                            {formatShare(displayShares[index])}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePartyLock(index)}
                            className={`grid h-7 w-7 place-items-center rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#F76F5C] focus:ring-offset-2 ${
                              isLocked
                                ? "border-[#F76F5C]/40 bg-[#F76F5C]/10 text-[#F76F5C]"
                                : "border-black/10 bg-black/[0.025] text-black/50 hover:text-[#111111]"
                            }`}
                            aria-label={lockLabel}
                            aria-pressed={isLocked}
                            title={lockLabel}
                          >
                            <LockIcon locked={isLocked} />
                          </button>
                        </div>
                      </div>
                      <input
                        id={controlIds[index]}
                        type="range"
                        min="0"
                        max="100"
                        step={SHARE_STEP}
                        value={share}
                        disabled={isLocked}
                        onChange={(event) => handleShareChange(index, Number(event.target.value))}
                        className={`difference-slider w-full ${isLocked ? "opacity-50" : ""}`}
                        style={
                          {
                            "--slider-color": ACCENT,
                            "--slider-position": `${share}%`
                          } as CSSProperties
                        }
                        aria-label={PARTIES[index]}
                        aria-valuetext={`${formatShare(displayShares[index])}${
                          isLocked ? ", locked" : ""
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-black/10 pt-5">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor={effectivePartiesControlId}
                    className="text-sm font-semibold text-[#111111]"
                  >
                    Effective parties (N<sub>2</sub>)
                  </label>
                  <div className="flex items-center gap-2">
                    <output
                      htmlFor={`${controlIds.join(" ")} ${effectivePartiesControlId}`}
                      className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-[#111111]"
                      aria-live="polite"
                    >
                      {effectiveParties.toFixed(2)}
                    </output>
                    <button
                      type="button"
                      onClick={toggleEffectivePartiesLock}
                      className={`grid h-7 w-7 place-items-center rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#F76F5C] focus:ring-offset-2 ${
                        isEffectivePartiesLocked
                          ? "border-[#F76F5C]/40 bg-[#F76F5C]/10 text-[#F76F5C]"
                          : "border-black/10 bg-black/[0.025] text-black/50 hover:text-[#111111]"
                      }`}
                      aria-label={effectivePartiesLockLabel}
                      aria-pressed={isEffectivePartiesLocked}
                      title={effectivePartiesLockLabel}
                    >
                      <LockIcon locked={isEffectivePartiesLocked} />
                    </button>
                  </div>
                </div>
                <input
                  id={effectivePartiesControlId}
                  type="range"
                  min={EFFECTIVE_PARTIES_MIN}
                  max={EFFECTIVE_PARTIES_MAX}
                  step={EFFECTIVE_PARTIES_STEP}
                  value={effectiveParties}
                  onChange={(event) =>
                    handleEffectivePartiesChange(Number(event.target.value))
                  }
                  className="difference-slider mt-4 w-full"
                  style={
                    {
                      "--slider-color": ACCENT,
                      "--slider-position": `${effectivePartiesSliderPosition}%`
                    } as CSSProperties
                  }
                  aria-label="Effective parties"
                  aria-valuetext={`${effectiveParties.toFixed(2)}${
                    isEffectivePartiesLocked ? ", locked" : ""
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center p-2 sm:p-4">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="block h-auto w-full cursor-crosshair select-none touch-none"
              style={{ touchAction: "none" }}
              role="img"
              aria-label={`Ternary plot${
                isColourCoded ? " colour-coded by effective parties" : ""
              } showing Party 1 at ${displayShares[0]} percent, Party 2 at ${displayShares[1]} percent, and Party 3 at ${displayShares[2]} percent`}
              onPointerDown={handlePlotPointerDown}
              onPointerMove={handlePlotPointerMove}
              onPointerUp={stopPlotPointer}
              onPointerCancel={stopPlotPointer}
            >
              {isColourCoded ? (
                <g aria-hidden="true" opacity={HEATMAP_OPACITY}>
                  {FLAT_HEATMAP_CELLS.map((cell) => (
                    <polygon
                      key={cell.id}
                      points={cell.points}
                      fill={cell.colour}
                      stroke={cell.colour}
                      strokeWidth="0.7"
                    />
                  ))}
                </g>
              ) : (
                <polygon
                  points={VERTICES.map((vertex) => `${vertex.x},${vertex.y}`).join(" ")}
                  fill="rgba(17,17,17,0.025)"
                />
              )}

              {GRID_TICKS.map((tick) =>
                PARTIES.map((_party, index) => {
                  const line = getConstantShareLine(index, tick);

                  return (
                    <line
                      key={`${index}-${tick}`}
                      x1={line.start.x}
                      y1={line.start.y}
                      x2={line.end.x}
                      y2={line.end.y}
                      stroke={
                        isColourCoded
                          ? "rgba(255,255,255,0.2)"
                          : "rgba(17,17,17,0.09)"
                      }
                      strokeWidth="1.5"
                    />
                  );
                })
              )}

              <polygon
                points={VERTICES.map((vertex) => `${vertex.x},${vertex.y}`).join(" ")}
                fill="none"
                stroke="rgba(17,17,17,0.38)"
                strokeWidth="3"
                strokeLinejoin="round"
              />

              {VERTICES.map((vertex, index) => (
                <circle
                  key={PARTIES[index]}
                  cx={vertex.x}
                  cy={vertex.y}
                  r="4.5"
                  fill={isColourCoded ? "#FFFFFF" : INK}
                  opacity={isColourCoded ? "0.72" : "0.42"}
                />
              ))}

              <polygon
                points={VERTICES.map((vertex) => `${vertex.x},${vertex.y}`).join(" ")}
                fill="transparent"
              />

              {isEffectivePartiesLocked && effectivePartiesContourPath ? (
                <path
                  d={effectivePartiesContourPath}
                  fill="none"
                  stroke={isColourCoded ? "rgba(255,255,255,0.9)" : ACCENT}
                  strokeWidth="3"
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                  opacity={isColourCoded ? "0.86" : "0.78"}
                  pointerEvents="none"
                />
              ) : null}

              <circle
                cx={point.x}
                cy={point.y}
                r="22"
                fill={isColourCoded ? "#FFFFFF" : ACCENT}
                opacity={isColourCoded ? "0.2" : "0.18"}
              />
              {isColourCoded ? (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="14"
                  fill="none"
                  stroke="rgba(17,17,17,0.24)"
                  strokeWidth="2"
                />
              ) : null}
              <circle
                cx={point.x}
                cy={point.y}
                r="12"
                fill={ACCENT}
                stroke="#FFFFFF"
                strokeWidth="4"
              />

              <text
                x={VERTICES[0].x}
                y={VERTICES[0].y - 22}
                textAnchor="middle"
                fontSize="21"
                fontWeight="600"
                fill={INK}
                opacity="0.64"
              >
                Party 1
              </text>
              <text
                x={VERTICES[1].x + 14}
                y={VERTICES[1].y + 34}
                textAnchor="middle"
                fontSize="21"
                fontWeight="600"
                fill={INK}
                opacity="0.64"
              >
                Party 2
              </text>
              <text
                x={VERTICES[2].x - 14}
                y={VERTICES[2].y + 34}
                textAnchor="middle"
                fontSize="21"
                fontWeight="600"
                fill={INK}
                opacity="0.64"
              >
                Party 3
              </text>
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
}
