import { useState } from "react";

const DEFAULT_PARTY_1_SHARE = 50;
const CHART_WIDTH = 720;
const CHART_HEIGHT = 420;
const PADDING = {
  top: 24,
  right: 28,
  bottom: 96,
  left: 136
};
const X_TICKS = [0, 25, 50, 75, 100];
const Y_TICKS = [1, 1.5, 2];

function getEffectiveNumber(party1Share: number) {
  const p = party1Share / 100;
  const q = 1 - p;

  return 1 / (p * p + q * q);
}

function getX(party1Share: number) {
  return (
    PADDING.left +
    (party1Share / 100) * (CHART_WIDTH - PADDING.left - PADDING.right)
  );
}

function getY(effectiveNumber: number) {
  return (
    PADDING.top +
    ((2 - effectiveNumber) / (2 - 1)) * (CHART_HEIGHT - PADDING.top - PADDING.bottom)
  );
}

function formatTick(value: number) {
  return value.toFixed(1);
}

export default function TwoPartyEffectiveNumberInteractive() {
  const [party1Share, setParty1Share] = useState(DEFAULT_PARTY_1_SHARE);

  const party2Share = 100 - party1Share;
  const effectiveNumber = getEffectiveNumber(party1Share);
  const pointX = getX(party1Share);
  const pointY = getY(effectiveNumber);
  const calloutWidth = 108;
  const calloutHeight = 40;
  const calloutX = Math.min(
    Math.max(pointX - calloutWidth / 2, PADDING.left),
    CHART_WIDTH - PADDING.right - calloutWidth
  );
  const calloutY = Math.max(pointY - 62, PADDING.top + 4);
  const curvePath = Array.from({ length: 101 }, (_, share) => {
    const value = getEffectiveNumber(share);
    const x = getX(share);
    const y = getY(value);

    return `${share === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  return (
    <div className="not-prose my-10">
      <section className="interactive-panel overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(250px,0.76fr)_minmax(0,1.24fr)]">
          <div className="border-b border-black/10 p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="eyebrow whitespace-nowrap">The Two Party Case</p>

            <div className="mt-6 space-y-5">
              <div className="flex items-end justify-between gap-4 border-b border-black/10 pb-4">
                <div>
                  <p className="text-sm leading-6 text-black/70">Party 1</p>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums text-[#111111]">
                    {party1Share}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm leading-6 text-black/70">Party 2</p>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums text-[#111111]">
                    {party2Share}%
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="two-party-share"
                    className="block text-sm font-semibold text-[#111111]"
                  >
                    Party 1 vote share
                  </label>
                  <span className="text-sm font-semibold tabular-nums text-[#111111]">
                    {party1Share}%
                  </span>
                </div>
                <input
                  id="two-party-share"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={party1Share}
                  onChange={(event) => setParty1Share(Number(event.target.value))}
                  className="w-full accent-[#F76F5C]"
                />
              </div>
            </div>
          </div>

          <div className="p-4 pl-7 sm:p-6 sm:pl-10">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="h-auto w-full"
              role="img"
              aria-label="Plot of Party 1 vote share against the effective number of parties in a two-party system"
            >
              {Y_TICKS.map((tick) => {
                const y = getY(tick);

                return (
                  <g key={tick}>
                    <line
                      x1={PADDING.left}
                      x2={CHART_WIDTH - PADDING.right}
                      y1={y}
                      y2={y}
                      stroke="rgba(17,17,17,0.12)"
                      strokeDasharray="4 5"
                    />
                    <text x="60" y={y + 8} fontSize="24" fill="#111111">
                      {formatTick(tick)}
                    </text>
                  </g>
                );
              })}

              {X_TICKS.map((tick) => {
                const x = getX(tick);

                return (
                  <g key={tick}>
                    <line
                      x1={x}
                      x2={x}
                      y1={PADDING.top}
                      y2={CHART_HEIGHT - PADDING.bottom}
                      stroke="rgba(17,17,17,0.08)"
                    />
                    <text
                      x={x}
                      y={CHART_HEIGHT - PADDING.bottom + 34}
                      textAnchor="middle"
                      fontSize="24"
                      fill="#111111"
                    >
                      {tick}%
                    </text>
                  </g>
                );
              })}

              <line
                x1={PADDING.left}
                x2={PADDING.left}
                y1={PADDING.top}
                y2={CHART_HEIGHT - PADDING.bottom}
                stroke="rgba(17,17,17,0.22)"
              />
              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={CHART_HEIGHT - PADDING.bottom}
                y2={CHART_HEIGHT - PADDING.bottom}
                stroke="rgba(17,17,17,0.22)"
              />

              <path
                d={curvePath}
                fill="none"
                stroke="#F76F5C"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <line
                x1={pointX}
                x2={pointX}
                y1={pointY}
                y2={CHART_HEIGHT - PADDING.bottom}
                stroke="rgba(17,17,17,0.18)"
                strokeDasharray="4 5"
              />
              <line
                x1={PADDING.left}
                x2={pointX}
                y1={pointY}
                y2={pointY}
                stroke="rgba(17,17,17,0.18)"
                strokeDasharray="4 5"
              />

              <circle cx={pointX} cy={pointY} r="13" fill="#F76F5C" stroke="#FFFFFF" strokeWidth="4" />

              <g transform={`translate(${calloutX}, ${calloutY})`}>
                <rect width={calloutWidth} height={calloutHeight} rx="14" fill="rgba(255,255,255,0.82)" />
                <text x={calloutWidth / 2} y="26" textAnchor="middle" fontSize="22" fontWeight="600" fill="#111111">
                  N2 = {effectiveNumber.toFixed(2)}
                </text>
              </g>

              <text
                x={(PADDING.left + CHART_WIDTH - PADDING.right) / 2}
                y={CHART_HEIGHT - 10}
                textAnchor="middle"
                fontSize="24"
                fill="#111111"
              >
                Party 1 Vote Share
              </text>
              <text
                x="30"
                y={(PADDING.top + CHART_HEIGHT - PADDING.bottom) / 2}
                transform={`rotate(-90 30 ${(PADDING.top + CHART_HEIGHT - PADDING.bottom) / 2})`}
                textAnchor="middle"
                fontSize="24"
                fill="#111111"
              >
                Effective Parties
              </text>
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
}
