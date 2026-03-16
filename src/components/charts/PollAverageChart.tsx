import { useEffect, useState, type PointerEvent } from "react";

type PointRow = {
  date: string;
  pollster: string;
  gb: string;
  lab?: number;
  con?: number;
  ref?: number;
  ld?: number;
  grn?: number;
  snp?: number;
  oth?: number;
};

type PredictionRow = {
  date: string;
  party: string;
  est: number;
  lower: number;
  upper: number;
};

type Props = {
  pointData: PointRow[];
  predictionData: PredictionRow[];
  updatedLabel?: string;
};

type PartyConfig = {
  key: string;
  label: string;
  pointKey: keyof PointRow;
  predictionKey: string;
  color: string;
};

const partyColors = {
  Conservative: "#0087DC",
  Labour: "#E4003B",
  Reform: "#12B6CF",
  "Lib Dem": "#FF6400",
  Green: "#02A95B",
  SNP: "#FCED4A",
  Other: "#6B7280"
} as const;

const partyConfig: PartyConfig[] = [
  {
    key: "labour",
    label: "Labour",
    pointKey: "lab",
    predictionKey: "Labour",
    color: partyColors.Labour
  },
  {
    key: "conservative",
    label: "Conservative",
    pointKey: "con",
    predictionKey: "Conservative",
    color: partyColors.Conservative
  },
  {
    key: "reform",
    label: "Reform",
    pointKey: "ref",
    predictionKey: "Reform",
    color: partyColors.Reform
  },
  {
    key: "libdem",
    label: "Lib Dem",
    pointKey: "ld",
    predictionKey: "Lib Dem",
    color: partyColors["Lib Dem"]
  },
  { key: "green", label: "Green", pointKey: "grn", predictionKey: "Green", color: partyColors.Green },
  { key: "snp", label: "SNP", pointKey: "snp", predictionKey: "SNP", color: partyColors.SNP },
  { key: "other", label: "Other", pointKey: "oth", predictionKey: "Other", color: partyColors.Other }
];

const chartHeight = 580;
const chartWidth = 980;
const padding = { top: 20, right: 28, bottom: 38, left: 56 };

function toUtcTime(date: string) {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function formatAxisDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit"
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((char) => `${char}${char}`).join("") : value;
  const numeric = Number.parseInt(normalized, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getX(time: number, min: number, max: number) {
  const usableWidth = chartWidth - padding.left - padding.right;
  const denominator = Math.max(1, max - min);

  return padding.left + ((time - min) / denominator) * usableWidth;
}

function getY(value: number, maxValue: number) {
  const usableHeight = chartHeight - padding.top - padding.bottom;

  return padding.top + ((maxValue - value) / Math.max(1, maxValue)) * usableHeight;
}

function buildLinePath(series: PredictionRow[], minTime: number, maxTime: number, maxValue: number) {
  return series
    .map((row, index) => {
      const x = getX(toUtcTime(row.date), minTime, maxTime);
      const y = getY(row.est * 100, maxValue);

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildRibbonPath(series: PredictionRow[], minTime: number, maxTime: number, maxValue: number) {
  if (series.length === 0) {
    return "";
  }

  const upper = series
    .map((row, index) => {
      const x = getX(toUtcTime(row.date), minTime, maxTime);
      const y = getY(row.upper * 100, maxValue);

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const lower = [...series]
    .reverse()
    .map((row) => {
      const x = getX(toUtcTime(row.date), minTime, maxTime);
      const y = getY(row.lower * 100, maxValue);

      return `L ${x} ${y}`;
    })
    .join(" ");

  return `${upper} ${lower} Z`;
}

export default function PollAverageChart({ pointData, predictionData, updatedLabel }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobile(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const sortedPrediction = [...predictionData].sort(
    (left, right) => toUtcTime(left.date) - toUtcTime(right.date)
  );
  const basePredictionDates = Array.from(new Set(sortedPrediction.map((row) => row.date)));
  const latestPredictionDate = basePredictionDates[basePredictionDates.length - 1];
  const latestPointDate = pointData.reduce(
    (latest, row) => (row.date > latest ? row.date : latest),
    ""
  );
  const predictionDates = basePredictionDates;
  const minTime = toUtcTime(basePredictionDates[0] ?? latestPointDate);
  const latestVisualDate =
    [latestPredictionDate, latestPointDate].filter((value): value is string => Boolean(value)).sort().at(-1) ??
    basePredictionDates[0];
  const latestVisualTime = toUtcTime(latestVisualDate);
  const axisPadding = Math.max(5 * 24 * 60 * 60 * 1000, Math.round((latestVisualTime - minTime) * 0.02));
  const maxTime = latestVisualTime + axisPadding;
  const allUpperValues = sortedPrediction.map((row) => row.upper * 100);
  const maxValue = Math.max(40, Math.ceil(Math.max(...allUpperValues, 0) / 10) * 10);
  const yTicks = Array.from({ length: maxValue / 10 + 1 }, (_, index) => index * 10);
  const xTickStep = Math.max(1, Math.ceil(predictionDates.length / (isMobile ? 4 : 6)));
  const xTicks = predictionDates.filter(
    (_date, index) => index % xTickStep === 0 || index === predictionDates.length - 1
  );
  const axisFontSize = isMobile ? 12 : 15;
  const readoutWidth = isMobile ? 164 : 188;
  const readoutX = chartWidth - readoutWidth - (isMobile ? 18 : 26);
  const visibleParties = partyConfig;
  const activeDate = hoveredIndex !== null ? predictionDates[hoveredIndex] : null;
  const latestRows = partyConfig
    .map((party) => {
      const row = sortedPrediction
        .filter((item) => item.party === party.predictionKey)
        .at(-1);

      return row ? { party, row } : null;
    })
    .filter((item): item is { party: PartyConfig; row: PredictionRow } => Boolean(item))
    .sort((left, right) => right.row.est - left.row.est);
  const activeRows = visibleParties
    .map((party) => {
      const row = activeDate
        ? sortedPrediction.find(
            (item) => item.party === party.predictionKey && item.date === activeDate
          )
        : undefined;

      return row ? { party, row } : null;
    })
    .filter((item): item is { party: PartyConfig; row: PredictionRow } => Boolean(item))
    .sort((left, right) => right.row.est - left.row.est);
  const readoutHeight = 40 + activeRows.length * (isMobile ? 16 : 18);

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = event.clientX - bounds.left - padding.left;
    const usableWidth = bounds.width - padding.left - padding.right;
    const ratio = Math.min(Math.max(relativeX / Math.max(1, usableWidth), 0), 1);
    const hoveredTime = minTime + ratio * Math.max(1, maxTime - minTime);
    let nextIndex = 0;
    let smallestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < predictionDates.length; index += 1) {
      const distance = Math.abs(toUtcTime(predictionDates[index] ?? predictionDates[0]) - hoveredTime);

      if (distance < smallestDistance) {
        smallestDistance = distance;
        nextIndex = index;
      }
    }

    setHoveredIndex(nextIndex);
  }

  function getSeriesOpacity(key: string, fadedOpacity: number) {
    return highlightedKey && highlightedKey !== key ? fadedOpacity : 1;
  }

  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.14fr)_20rem] lg:items-stretch">
        <div className="interactive-panel min-w-0 py-4 pl-4 pr-0 sm:py-5 sm:pl-5 sm:pr-0">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="h-auto w-full"
            role="img"
            aria-label="Polling chart with raw poll points, smoothed party lines, and translucent uncertainty ribbons"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoveredIndex(null)}
          >
            {yTicks.map((tick) => {
              const y = getY(tick, maxValue);

              return (
                <g key={tick}>
                  <line
                    x1={padding.left}
                    x2={chartWidth - padding.right}
                    y1={y}
                    y2={y}
                    stroke="rgba(17,17,17,0.12)"
                    strokeDasharray="3 6"
                  />
                  <text x="10" y={y + 5} fontSize={axisFontSize} fill="#111111">
                    {tick}%
                  </text>
                </g>
              );
            })}

            {xTicks.map((date, index) => {
              const x = getX(toUtcTime(date), minTime, maxTime);
              const textAnchor =
                index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle";

              return (
                <g key={date}>
                  <line
                    x1={x}
                    x2={x}
                    y1={padding.top}
                    y2={chartHeight - padding.bottom}
                    stroke="rgba(17,17,17,0.08)"
                  />
                  <text
                    x={x}
                    y={chartHeight - 10}
                    textAnchor={textAnchor}
                    fontSize={axisFontSize}
                    fill="#111111"
                  >
                    {formatAxisDate(date)}
                  </text>
                </g>
              );
            })}

            {visibleParties.map((party) => {
              const series = sortedPrediction.filter((row) => row.party === party.predictionKey);
              const path = buildRibbonPath(series, minTime, maxTime, maxValue);

              return (
                <path
                  key={`${party.key}-ribbon`}
                  d={path}
                  fill={hexToRgba(party.color, 0.1)}
                  stroke="none"
                  opacity={getSeriesOpacity(party.key, 0.16)}
                />
              );
            })}

            {visibleParties.map((party) =>
              pointData.map((row, index) => {
                const value = row[party.pointKey];

                if (typeof value !== "number") {
                  return null;
                }

                return (
                  <circle
                    key={`${party.key}-${row.date}-${row.pollster}-${index}`}
                    cx={getX(toUtcTime(row.date), minTime, maxTime)}
                    cy={getY(value * 100, maxValue)}
                    r="2.6"
                    fill={hexToRgba(party.color, 0.34)}
                    opacity={getSeriesOpacity(party.key, 0.14)}
                  />
                );
              })
            )}

            {visibleParties.map((party) => {
              const series = sortedPrediction.filter((row) => row.party === party.predictionKey);
              const path = buildLinePath(series, minTime, maxTime, maxValue);

              return (
                <path
                  key={`${party.key}-line`}
                  d={path}
                  fill="none"
                  stroke={party.color}
                  strokeWidth={highlightedKey === party.key ? "4.25" : "3.25"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={getSeriesOpacity(party.key, 0.2)}
                />
              );
            })}

            {activeDate && (
              <line
                x1={getX(toUtcTime(activeDate), minTime, maxTime)}
                x2={getX(toUtcTime(activeDate), minTime, maxTime)}
                y1={padding.top}
                y2={chartHeight - padding.bottom}
                stroke="rgba(17,17,17,0.24)"
                strokeDasharray="4 5"
              />
            )}

            {activeRows.map(({ party, row }) => (
              <circle
                key={`${party.key}-active-point`}
                cx={getX(toUtcTime(row.date), minTime, maxTime)}
                cy={getY(row.est * 100, maxValue)}
                r="5"
                fill={party.color}
                stroke="#FFFFFF"
                strokeWidth="2"
                opacity={getSeriesOpacity(party.key, 0.2)}
              />
            ))}

            {activeDate && activeRows.length > 0 && (
              <g transform={`translate(${readoutX}, 24)`}>
                <rect
                  width={readoutWidth}
                  height={readoutHeight}
                  rx="16"
                  fill="rgba(255,255,255,0.72)"
                />
                <text x="16" y="24" fontSize={isMobile ? 13 : 14} fontWeight="600" fill="#111111">
                  {formatLongDate(activeDate)}
                </text>
                {activeRows.map(({ party, row }, index) => (
                  <g
                    key={`${party.key}-readout`}
                    transform={`translate(16, ${44 + index * (isMobile ? 16 : 18)})`}
                  >
                    <circle cx="4" cy="-4" r="4" fill={party.color} />
                    <text x="14" y="0" fontSize={isMobile ? 12 : 13} fill="#111111">
                      {party.label}: {formatPercent(row.est)}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </svg>
        </div>

        <div className="interactive-panel px-3 py-4 sm:px-4 sm:py-5 lg:flex lg:h-full lg:items-center">
          <div className="w-full space-y-3">
            <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-[0.95rem] tabular-nums text-[#111111]">
              <caption className="sr-only">Latest polling model estimates</caption>
              <thead>
                <tr className="border-b border-black/10">
                  <th className="px-0 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent">
                    Party
                  </th>
                  <th className="px-0 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent">
                    Vote
                  </th>
                  <th className="px-0 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent">
                    Low
                  </th>
                  <th className="px-0 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent">
                    High
                  </th>
                </tr>
              </thead>
              <tbody>
                {latestRows.map(({ party, row }) => (
                  <tr key={party.key} className="border-b border-black/10 last:border-b-0">
                    <td className="px-0 py-3 font-medium">
                      <span
                        className="inline-flex cursor-default items-center gap-2"
                        onMouseEnter={() => setHighlightedKey(party.key)}
                        onMouseLeave={() => setHighlightedKey(null)}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: party.color }}
                          aria-hidden="true"
                        />
                        {party.label}
                      </span>
                    </td>
                    <td className="px-0 py-3">{formatPercent(row.est)}</td>
                    <td className="px-0 py-3">{formatPercent(row.lower)}</td>
                    <td className="px-0 py-3">{formatPercent(row.upper)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {updatedLabel && (
              <p className="text-right text-[0.8rem] leading-5 text-black/50">
                Updated {updatedLabel}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
