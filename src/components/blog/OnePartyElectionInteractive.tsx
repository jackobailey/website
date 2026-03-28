const CHART_WIDTH = 420;
const CHART_HEIGHT = 420;
const PADDING = {
  top: 72,
  right: 44,
  bottom: 74,
  left: 64
};
const TICKS = [0, 25, 50, 75, 100];
const ORANGE = "#F76F5C";

function getX(share: number) {
  const axisWidth = CHART_WIDTH - PADDING.left - PADDING.right;

  return PADDING.left + (share / 100) * axisWidth;
}

export default function OnePartyElectionInteractive() {
  const axisY = CHART_HEIGHT / 2;
  const pointX = getX(100);

  return (
    <div className="not-prose my-10">
      <section className="interactive-panel overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(250px,0.82fr)_minmax(0,1.18fr)]">
          <div className="border-b border-black/10 p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="eyebrow">The One Party Case</p>

            <div className="mt-6 space-y-5">
              <div className="border-b border-black/10 pb-4">
                <p className="text-sm leading-6 text-black/70">Party 1</p>
                <p className="text-lg font-semibold tracking-tight tabular-nums text-[#111111] sm:text-[1.5rem]">
                  100%
                </p>
              </div>

              <p className="text-sm leading-6 text-black/70">
                With only one party on the ballot, every vote goes to the same place, so the
                space of possible outcomes collapses to a single point at 100%.
              </p>
            </div>
          </div>

          <div className="p-4 pl-7 sm:p-6 sm:pl-10">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="h-auto w-full"
              role="img"
              aria-label="Horizontal vote-share axis showing the single permissible outcome in a one-party election at 100 percent"
            >
              {TICKS.map((tick) => {
                const x = getX(tick);

                return (
                  <g key={tick}>
                    <line
                      x1={x}
                      x2={x}
                      y1={axisY - 92}
                      y2={axisY}
                      stroke="rgba(17,17,17,0.12)"
                      strokeDasharray="4 5"
                    />
                    <line
                      x1={x}
                      x2={x}
                      y1={axisY - 10}
                      y2={axisY + 10}
                      stroke="rgba(17,17,17,0.24)"
                      strokeWidth="1.5"
                    />
                    <text
                      x={x}
                      y={axisY + 38}
                      textAnchor="middle"
                      fontSize="22"
                      fill="#111111"
                    >
                      {tick}%
                    </text>
                  </g>
                );
              })}

              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={axisY}
                y2={axisY}
                stroke="rgba(17,17,17,0.24)"
                strokeWidth="2"
              />

              <circle
                cx={pointX}
                cy={axisY}
                r="13"
                fill={ORANGE}
                stroke="#FFFFFF"
                strokeWidth="4"
              />
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
}
