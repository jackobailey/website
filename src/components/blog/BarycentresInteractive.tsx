import { useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";

const ACCENT = "#F76F5C";
const INK = "#111111";
const DEFAULT_SHARES = [34, 33, 33] as const;
const PARTIES = ["Party 1", "Party 2", "Party 3"] as const;
const SHARE_STEP = 0.1;
const CHART_WIDTH = 640;
const CHART_HEIGHT = 540;
const VERTICES = [
  { x: 320, y: 54 },
  { x: 86, y: 460 },
  { x: 554, y: 460 }
] as const;
const GRID_TICKS = [20, 40, 60, 80] as const;

type Point = {
  x: number;
  y: number;
};

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
  return shares.reduce(
    (point, share, index) => ({
      x: point.x + (share / 100) * VERTICES[index].x,
      y: point.y + (share / 100) * VERTICES[index].y
    }),
    { x: 0, y: 0 }
  );
}

function getEffectiveParties(shares: number[]) {
  const concentration = shares.reduce((total, share) => {
    const proportion = share / 100;

    return total + proportion * proportion;
  }, 0);

  return 1 / concentration;
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

function rebalanceShares(currentShares: number[], changedIndex: number, nextShare: number) {
  const clampedShare = Math.min(100, Math.max(0, nextShare));
  const remainingShare = 100 - clampedShare;
  const otherIndexes = currentShares
    .map((_share, index) => index)
    .filter((index) => index !== changedIndex);
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
  return `${Math.round(share)}%`;
}

export default function BarycentresInteractive() {
  const controlId = useId();
  const activePointerIdRef = useRef<number | null>(null);
  const [shares, setShares] = useState<number[]>(() => [...DEFAULT_SHARES]);
  const displayShares = roundToTotal(shares, 100);
  const effectiveParties = getEffectiveParties(shares);
  const point = getBarycentricPoint(shares);
  const controlIds = PARTIES.map((party) => `${controlId}-${party.toLowerCase().replace(" ", "-")}`);

  function updateSharesFromPlot(chart: SVGSVGElement, clientX: number, clientY: number) {
    const svgPoint = getSvgPoint(chart, clientX, clientY);
    const result = getClosestPointOnTriangle(
      svgPoint,
      VERTICES[0],
      VERTICES[1],
      VERTICES[2]
    );

    setShares(result.weights.map((weight) => weight * 100));
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

  return (
    <div className="not-prose my-10 w-full max-w-none sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-10 lg:w-[calc(100%+5rem)]">
      <section className="interactive-panel overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)]">
          <div className="border-b border-black/10 p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="eyebrow">Barycentric Coordinates</p>

            <div className="mt-6 space-y-5">
              <div className="space-y-5">
                {shares.map((share, index) => (
                  <div key={PARTIES[index]} className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <label
                        htmlFor={controlIds[index]}
                        className="block text-sm font-semibold text-[#111111]"
                      >
                        {PARTIES[index]}
                      </label>
                      <span className="text-sm font-semibold tabular-nums text-[#111111]">
                        {formatShare(displayShares[index])}
                      </span>
                    </div>
                    <input
                      id={controlIds[index]}
                      type="range"
                      min="0"
                      max="100"
                      step={SHARE_STEP}
                      value={share}
                      onChange={(event) =>
                        setShares((currentShares) =>
                          rebalanceShares(currentShares, index, Number(event.target.value))
                        )
                      }
                      className="difference-slider w-full"
                      style={
                        {
                          "--slider-color": ACCENT,
                          "--slider-position": `${share}%`
                        } as CSSProperties
                      }
                      aria-label={PARTIES[index]}
                      aria-valuetext={formatShare(displayShares[index])}
                    />
                  </div>
                ))}
              </div>

              <div className="border-t border-black/10 pt-5">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-sm font-semibold text-[#111111]">
                    Effective parties (N<sub>2</sub>)
                  </p>
                  <output
                    htmlFor={controlIds.join(" ")}
                    className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-[#111111]"
                    aria-live="polite"
                  >
                    {effectiveParties.toFixed(2)}
                  </output>
                </div>
                <div className="mt-4 h-2 rounded-full bg-black/8">
                  <div
                    className="h-2 rounded-full bg-[#F76F5C]"
                    style={{ width: `${(effectiveParties / 3) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center p-4 sm:p-6">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="block h-auto w-full cursor-crosshair select-none touch-none"
              style={{ touchAction: "none" }}
              role="img"
              aria-label={`Ternary plot showing Party 1 at ${displayShares[0]} percent, Party 2 at ${displayShares[1]} percent, and Party 3 at ${displayShares[2]} percent`}
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

              <circle cx={point.x} cy={point.y} r="22" fill={ACCENT} opacity="0.18" />
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
