import {
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent
} from "react";

const ACCENT = "#F76F5C";
const GALLAGHER_COLOUR = "#3B0F70";
const SEAT_COLOUR = GALLAGHER_COLOUR;
const INK = "#111111";
const PARTY_COLOURS = ["#3B0F70", "#B5367A", ACCENT] as const;
const PARTIES = ["Party 1", "Party 2", "Party 3"] as const;
const DEFAULT_VOTE_SHARES = [44, 34, 22] as const;
const DEFAULT_SEAT_SHARES = [58, 29, 13] as const;
const SHARE_STEP = 0.1;
const GALLAGHER_INDEX_MAX = 100;
const EFFECTIVE_PARTIES_MIN = 1;
const EFFECTIVE_PARTIES_MAX = 3;
const CONTOUR_SAMPLES = 720;
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
const EQUAL_WEIGHTS: BarycentricWeights = [1 / 3, 1 / 3, 1 / 3];
const CONTOUR_BASIS = [
  [1 / Math.sqrt(2), -1 / Math.sqrt(2), 0],
  [1 / Math.sqrt(6), 1 / Math.sqrt(6), -2 / Math.sqrt(6)]
] as const;

type Point = {
  x: number;
  y: number;
};

type BarycentricWeights = [number, number, number];
type Distribution = "votes" | "seats";

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function getWeightsFromShares(shares: number[]): BarycentricWeights {
  const total = shares.reduce((sum, share) => sum + share, 0) || 100;

  return [shares[0] / total, shares[1] / total, shares[2] / total];
}

function getNormalisedWeights(weights: number[]): BarycentricWeights {
  const clampedWeights = weights.map((weight) => Math.max(0, weight));
  const total = clampedWeights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) {
    return [...EQUAL_WEIGHTS];
  }

  return clampedWeights.map((weight) => weight / total) as BarycentricWeights;
}

function getEffectiveParties(shares: number[]) {
  return getEffectivePartiesFromWeights(shares.map((share) => share / 100));
}

function getEffectivePartiesFromWeights(weights: number[]) {
  const concentration = weights.reduce((total, weight) => total + weight * weight, 0);

  return 1 / concentration;
}

function getGallagherIndex(voteShares: number[], seatShares: number[]) {
  const squaredDifference = voteShares.reduce((sum, voteShare, index) => {
    const difference = voteShare - seatShares[index];

    return sum + difference * difference;
  }, 0);

  return Math.sqrt(squaredDifference / 2);
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

function getWeightsOnContour(
  centreWeights: BarycentricWeights,
  radius: number,
  angle: number
): BarycentricWeights {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [0, 1, 2].map((index) => {
    return (
      centreWeights[index] +
      radius *
        (cos * CONTOUR_BASIS[0][index] + sin * CONTOUR_BASIS[1][index])
    );
  }) as BarycentricWeights;
}

function getContourPath(centreWeights: BarycentricWeights, radius: number) {
  if (radius < 0.000001) {
    return "";
  }

  const segments: Point[][] = [];
  let currentSegment: Point[] = [];
  const isFirstPointValid = isInSimplex(getWeightsOnContour(centreWeights, radius, 0), 0.001);

  for (let index = 0; index <= CONTOUR_SAMPLES; index += 1) {
    const weights = getWeightsOnContour(
      centreWeights,
      radius,
      (index / CONTOUR_SAMPLES) * Math.PI * 2
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

function getEffectivePartiesContourPath(effectiveParties: number) {
  const clampedParties = clamp(
    effectiveParties,
    EFFECTIVE_PARTIES_MIN,
    EFFECTIVE_PARTIES_MAX
  );

  if (clampedParties >= EFFECTIVE_PARTIES_MAX - 0.000001) {
    return "";
  }

  return getContourPath(EQUAL_WEIGHTS, getEffectiveContourRadius(clampedParties));
}

function getGallagherContourPath(gallagherIndex: number, seatShares: number[]) {
  const seatWeights = getWeightsFromShares(seatShares);
  const radius = Math.SQRT2 * (gallagherIndex / 100);

  return getContourPath(seatWeights, radius);
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

function formatShare(share: number) {
  if (share > 0 && share < 1) {
    return "<1%";
  }

  return `${Math.round(share)}%`;
}

function formatGallagherIndex(value: number) {
  return value < 10 ? value.toFixed(2) : value.toFixed(1);
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

type PartySliderProps = {
  ariaLabel: string;
  ariaValueText: string;
  colour: string;
  formattedValue: string;
  id: string;
  isLocked: boolean;
  lockLabel: string;
  number: number;
  onChange: (value: number) => void;
  onToggleLock: () => void;
  value: number;
};

function PartySlider({
  ariaLabel,
  ariaValueText,
  colour,
  formattedValue,
  id,
  isLocked,
  lockLabel,
  number,
  onChange,
  onToggleLock,
  value
}: PartySliderProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_auto] items-center gap-2">
      <div className="relative h-8 px-3.5">
        <div className="relative h-full">
          <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-black/10" />
          <div
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
            style={{
              backgroundColor: isLocked
                ? `color-mix(in srgb, ${colour} 60%, white)`
                : colour,
              width: `${value}%`
            }}
          />
          <input
            id={id}
            type="range"
            min="0"
            max="100"
            step={SHARE_STEP}
            value={value}
            disabled={isLocked}
            onChange={(event) => onChange(Number(event.target.value))}
            className={`peer party-slider absolute inset-0 z-20 h-full w-full ${
              isLocked ? "cursor-not-allowed" : ""
            }`}
            aria-label={ariaLabel}
            aria-valuetext={ariaValueText}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-xs font-bold leading-none text-white shadow-[0_0_0_1px_rgba(17,17,17,0.08),0_8px_18px_rgba(17,17,17,0.18)] transition-shadow duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[#F76F5C] peer-focus-visible:ring-offset-2"
            style={{
              backgroundColor: isLocked
                ? `color-mix(in srgb, ${colour} 60%, white)`
                : colour,
              left: `${value}%`
            }}
          >
            {number}
          </span>
        </div>
      </div>
      <span className="text-right text-sm font-semibold tabular-nums text-[#111111]">
        {formattedValue}
      </span>
      <button
        type="button"
        onClick={onToggleLock}
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
  );
}

export default function EffectivePartiesGallagherInteractive() {
  const controlId = useId();
  const activePointerIdRef = useRef<number | null>(null);
  const activeDistributionRef = useRef<Distribution>("votes");
  const [voteShares, setVoteShares] = useState<number[]>(() => [...DEFAULT_VOTE_SHARES]);
  const [seatShares, setSeatShares] = useState<number[]>(() => [...DEFAULT_SEAT_SHARES]);
  const [lockedVoteParties, setLockedVoteParties] = useState<boolean[]>(() =>
    PARTIES.map(() => false)
  );
  const [lockedSeatParties, setLockedSeatParties] = useState<boolean[]>(() =>
    PARTIES.map(() => false)
  );
  const effectiveParties = getEffectiveParties(voteShares);
  const gallagherIndex = getGallagherIndex(voteShares, seatShares);
  const displayedGallagherValue = formatGallagherIndex(gallagherIndex);
  const votePoint = getBarycentricPoint(voteShares);
  const seatPoint = getBarycentricPoint(seatShares);
  const voteControlIds = PARTIES.map(
    (party) => `${controlId}-${party.toLowerCase().replace(" ", "-")}-vote`
  );
  const seatControlIds = PARTIES.map(
    (party) => `${controlId}-${party.toLowerCase().replace(" ", "-")}-seat`
  );
  const effectivePartiesContourPath = useMemo(
    () => getEffectivePartiesContourPath(effectiveParties),
    [effectiveParties]
  );
  const gallagherContourPath = useMemo(
    () => getGallagherContourPath(gallagherIndex, seatShares),
    [gallagherIndex, seatShares]
  );
  const effectivePartiesSliderPosition = clamp(
    ((effectiveParties - EFFECTIVE_PARTIES_MIN) /
      (EFFECTIVE_PARTIES_MAX - EFFECTIVE_PARTIES_MIN)) *
      100,
    0,
    100
  );
  const gallagherSliderPosition = clamp(
    (gallagherIndex / GALLAGHER_INDEX_MAX) * 100,
    0,
    100
  );

  function updateDistributionWithConstraints(
    distribution: Distribution,
    targetShares: number[]
  ) {
    if (distribution === "votes") {
      setVoteShares((currentShares) =>
        applyLockedShareTarget(currentShares, lockedVoteParties, targetShares)
      );
      return;
    }

    setSeatShares((currentShares) =>
      applyLockedShareTarget(currentShares, lockedSeatParties, targetShares)
    );
  }

  function updateDistributionFromPlot(
    distribution: Distribution,
    chart: SVGSVGElement,
    clientX: number,
    clientY: number
  ) {
    const svgPoint = getSvgPoint(chart, clientX, clientY);
    const result = getClosestPointOnTriangle(
      svgPoint,
      VERTICES[0],
      VERTICES[1],
      VERTICES[2]
    );

    updateDistributionWithConstraints(
      distribution,
      result.weights.map((weight) => weight * 100)
    );
  }

  function getDistributionForPointer(svgPoint: Point) {
    const voteDistance = Math.hypot(svgPoint.x - votePoint.x, svgPoint.y - votePoint.y);
    const seatDistance = Math.hypot(svgPoint.x - seatPoint.x, svgPoint.y - seatPoint.y);

    if (seatDistance < 30 && seatDistance < voteDistance) {
      return "seats";
    }

    return "votes";
  }

  function handlePlotPointerDown(event: PointerEvent<SVGSVGElement>) {
    const svgPoint = getSvgPoint(event.currentTarget, event.clientX, event.clientY);
    const distribution = getDistributionForPointer(svgPoint);

    activePointerIdRef.current = event.pointerId;
    activeDistributionRef.current = distribution;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateDistributionFromPlot(
      distribution,
      event.currentTarget,
      event.clientX,
      event.clientY
    );
  }

  function handlePlotPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    updateDistributionFromPlot(
      activeDistributionRef.current,
      event.currentTarget,
      event.clientX,
      event.clientY
    );
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

  function toggleVoteLock(index: number) {
    setLockedVoteParties((currentLockedParties) =>
      currentLockedParties.map((locked, partyIndex) =>
        partyIndex === index ? !locked : locked
      )
    );
  }

  function toggleSeatLock(index: number) {
    setLockedSeatParties((currentLockedParties) =>
      currentLockedParties.map((locked, partyIndex) =>
        partyIndex === index ? !locked : locked
      )
    );
  }

  function handleVoteShareChange(index: number, nextShare: number) {
    setVoteShares((currentShares) =>
      rebalanceShares(currentShares, lockedVoteParties, index, nextShare)
    );
  }

  function handleSeatShareChange(index: number, nextShare: number) {
    setSeatShares((currentShares) =>
      rebalanceShares(currentShares, lockedSeatParties, index, nextShare)
    );
  }

  return (
    <div className="not-prose my-10 w-full max-w-none sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-10 lg:w-[calc(100%+5rem)]">
      <section className="interactive-panel overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(300px,0.95fr)_minmax(0,1.05fr)]">
          <div className="border-b border-black/10 p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="eyebrow">Effective Parties &amp; Gallagher</p>

            <div className="mt-6 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                  Vote Share
                </p>
                {voteShares.map((share, index) => {
                  const isVoteLocked = lockedVoteParties[index];
                  const voteLockLabel = isVoteLocked
                    ? `Unlock ${PARTIES[index]} vote share`
                    : `Lock ${PARTIES[index]} vote share`;

                  return (
                    <PartySlider
                      key={`${PARTIES[index]}-vote`}
                      id={voteControlIds[index]}
                      value={share}
                      number={index + 1}
                      colour={PARTY_COLOURS[index]}
                      formattedValue={formatShare(share)}
                      isLocked={isVoteLocked}
                      lockLabel={voteLockLabel}
                      ariaLabel={`${PARTIES[index]} vote share`}
                      ariaValueText={`${formatShare(share)}${
                        isVoteLocked ? ", locked" : ""
                      }`}
                      onChange={(nextShare) => handleVoteShareChange(index, nextShare)}
                      onToggleLock={() => toggleVoteLock(index)}
                    />
                  );
                })}
              </div>

              <div className="space-y-3 border-t border-black/10 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                  Seat Share
                </p>
                {seatShares.map((share, index) => {
                  const isSeatLocked = lockedSeatParties[index];
                  const seatLockLabel = isSeatLocked
                    ? `Unlock ${PARTIES[index]} seat share`
                    : `Lock ${PARTIES[index]} seat share`;

                  return (
                    <PartySlider
                      key={`${PARTIES[index]}-seat`}
                      id={seatControlIds[index]}
                      value={share}
                      number={index + 1}
                      colour={PARTY_COLOURS[index]}
                      formattedValue={formatShare(share)}
                      isLocked={isSeatLocked}
                      lockLabel={seatLockLabel}
                      ariaLabel={`${PARTIES[index]} seat share`}
                      ariaValueText={`${formatShare(share)}${
                        isSeatLocked ? ", locked" : ""
                      }`}
                      onChange={(nextShare) => handleSeatShareChange(index, nextShare)}
                      onToggleLock={() => toggleSeatLock(index)}
                    />
                  );
                })}
              </div>

              <div className="space-y-3 border-t border-black/10 pt-5">
                <div className="grid grid-cols-[3.8rem_minmax(0,1fr)_3.5rem] items-center gap-x-3">
                  <span className="text-sm font-semibold text-[#111111]">
                    N<sub>2</sub>
                  </span>
                  <div className="relative h-8 px-3.5">
                    <div className="relative h-full">
                      <input
                        type="range"
                        min={EFFECTIVE_PARTIES_MIN}
                        max={EFFECTIVE_PARTIES_MAX}
                        step="0.01"
                        value={effectiveParties}
                        readOnly
                        tabIndex={-1}
                        className="difference-slider metric-slider pointer-events-none absolute inset-0 h-full w-full"
                        style={
                          {
                            "--slider-color": ACCENT,
                            "--slider-position": `${effectivePartiesSliderPosition}%`
                          } as CSSProperties
                        }
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <output
                    htmlFor={voteControlIds.join(" ")}
                    className="text-right text-sm font-semibold tabular-nums text-[#111111]"
                    aria-live="polite"
                  >
                    {effectiveParties.toFixed(2)}
                  </output>

                  <span className="text-sm font-semibold text-[#111111]">
                    LSq
                  </span>
                  <div className="relative h-8 px-3.5">
                    <div className="relative h-full">
                      <input
                        type="range"
                        min="0"
                        max={GALLAGHER_INDEX_MAX}
                        step="0.01"
                        value={clamp(gallagherIndex, 0, GALLAGHER_INDEX_MAX)}
                        readOnly
                        tabIndex={-1}
                        className="difference-slider metric-slider pointer-events-none absolute inset-0 h-full w-full"
                        style={
                          {
                            "--slider-color": GALLAGHER_COLOUR,
                            "--slider-position": `${gallagherSliderPosition}%`
                          } as CSSProperties
                        }
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <output
                    htmlFor={`${voteControlIds.join(" ")} ${seatControlIds.join(" ")}`}
                    className="text-right text-sm font-semibold tabular-nums text-[#111111]"
                    aria-live="polite"
                  >
                    {displayedGallagherValue}
                  </output>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center p-2 sm:p-4">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="block h-auto w-full cursor-crosshair select-none touch-none"
              style={{ touchAction: "none" }}
              role="img"
              aria-label={`Ternary plot showing vote shares of ${formatShare(
                voteShares[0]
              )}, ${formatShare(voteShares[1])}, and ${formatShare(
                voteShares[2]
              )}; seat shares of ${formatShare(seatShares[0])}, ${formatShare(
                seatShares[1]
              )}, and ${formatShare(seatShares[2])}; N2 at ${effectiveParties.toFixed(
                2
              )}; and Gallagher index at ${displayedGallagherValue}`}
              onPointerDown={handlePlotPointerDown}
              onPointerMove={handlePlotPointerMove}
              onPointerUp={stopPlotPointer}
              onPointerCancel={stopPlotPointer}
            >
              <polygon
                points={VERTICES.map((vertex) => `${vertex.x},${vertex.y}`).join(" ")}
                fill="rgba(17,17,17,0.025)"
              />

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
                      stroke="rgba(17,17,17,0.09)"
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
                  fill={INK}
                  opacity="0.42"
                />
              ))}

              <polygon
                points={VERTICES.map((vertex) => `${vertex.x},${vertex.y}`).join(" ")}
                fill="transparent"
              />

              {effectivePartiesContourPath ? (
                <path
                  d={effectivePartiesContourPath}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="3"
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                  opacity="0.72"
                  pointerEvents="none"
                />
              ) : null}

              {gallagherContourPath ? (
                <path
                  d={gallagherContourPath}
                  fill="none"
                  stroke={GALLAGHER_COLOUR}
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.78"
                  pointerEvents="none"
                />
              ) : (
                <circle
                  cx={seatPoint.x}
                  cy={seatPoint.y}
                  r="9"
                  fill="none"
                  stroke={GALLAGHER_COLOUR}
                  strokeWidth="3"
                  opacity="0.78"
                  pointerEvents="none"
                />
              )}

              <line
                x1={seatPoint.x}
                y1={seatPoint.y}
                x2={votePoint.x}
                y2={votePoint.y}
                stroke="rgba(17,17,17,0.24)"
                strokeWidth="2.5"
                strokeDasharray="5 6"
                strokeLinecap="round"
                pointerEvents="none"
              />

              <g transform="translate(430 72)" pointerEvents="none" aria-hidden="true">
                <rect
                  width="152"
                  height="58"
                  rx="18"
                  fill="rgba(255,255,255,0.84)"
                  stroke="rgba(17,17,17,0.08)"
                />
                <line
                  x1="18"
                  x2="46"
                  y1="22"
                  y2="22"
                  stroke={ACCENT}
                  strokeWidth="3"
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                />
                <text x="58" y="27" fontSize="16" fontWeight="600" fill={INK}>
                  N2
                </text>
                <line
                  x1="18"
                  x2="46"
                  y1="46"
                  y2="46"
                  stroke={GALLAGHER_COLOUR}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <text x="58" y="51" fontSize="16" fontWeight="600" fill={INK}>
                  LSq
                </text>
              </g>

              <circle cx={seatPoint.x} cy={seatPoint.y} r="20" fill={SEAT_COLOUR} opacity="0.14" />
              <circle
                cx={seatPoint.x}
                cy={seatPoint.y}
                r="10"
                fill={SEAT_COLOUR}
                stroke="#FFFFFF"
                strokeWidth="4"
              />
              <circle cx={votePoint.x} cy={votePoint.y} r="22" fill={ACCENT} opacity="0.18" />
              <circle
                cx={votePoint.x}
                cy={votePoint.y}
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
