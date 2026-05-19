import {
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";

const ACCENT = "#F76F5C";
const GRADUATE_COLOUR = "#3B0F70";
const MAX_INCOME = 250_000;
const SLOPE_SCALE = 50_000;
const CHART_WIDTH = 680;
const CHART_HEIGHT = 390;
const PLOT = {
  top: 24,
  right: 24,
  bottom: 58,
  left: 62
};
const PLOT_WIDTH = CHART_WIDTH - PLOT.left - PLOT.right;
const PLOT_HEIGHT = CHART_HEIGHT - PLOT.top - PLOT.bottom;
const TOOLTIP_WIDTH = 154;
const TOOLTIP_HEIGHT = 76;

type TaxParameters = {
  floor: number;
  ceiling: number;
  progressivity: number;
  midpoint: number;
  graduatePremium: number;
};

type ParameterKey = keyof TaxParameters;
type ScenarioId = "negative-income-tax" | "graduate-tax" | "flat-tax";

type Scenario = {
  id: ScenarioId;
  label: string;
  values: TaxParameters;
};

type SliderControlProps = {
  id: string;
  label: string;
  color?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  displayValue: string;
  onChange: (value: number) => void;
};

const DEFAULT_PARAMETERS: TaxParameters = {
  floor: 0,
  ceiling: 50,
  progressivity: 4,
  midpoint: 35_000,
  graduatePremium: 0
};

const SCENARIOS: Scenario[] = [
  {
    id: "negative-income-tax",
    label: "Negative Income Tax",
    values: {
      floor: -20,
      ceiling: 60,
      progressivity: 3.5,
      midpoint: 35_000,
      graduatePremium: 0
    }
  },
  {
    id: "graduate-tax",
    label: "Graduate Tax",
    values: {
      floor: 0,
      ceiling: 45,
      progressivity: 4,
      midpoint: 40_000,
      graduatePremium: 8
    }
  },
  {
    id: "flat-tax",
    label: "Flat Tax",
    values: {
      floor: 30,
      ceiling: 30,
      progressivity: 4,
      midpoint: 35_000,
      graduatePremium: 0
    }
  }
];

const X_TICKS = [0, 50_000, 100_000, 150_000, 200_000, 250_000];
const RATE_READOUT_INCOMES = [
  { label: "£0k", income: 0 },
  { label: "£35k", income: 35_000 },
  { label: "£125k", income: 125_000 }
];

function calculateLogisticRate(parameters: TaxParameters, income: number, ceiling: number) {
  const exponent = -parameters.progressivity * ((income - parameters.midpoint) / SLOPE_SCALE);

  return parameters.floor + (ceiling - parameters.floor) / (1 + Math.exp(exponent));
}

function calculateNonGraduateTaxRate(parameters: TaxParameters, income: number) {
  return calculateLogisticRate(parameters, income, parameters.ceiling);
}

function calculateGraduateTaxRate(parameters: TaxParameters, income: number) {
  return calculateLogisticRate(parameters, income, parameters.ceiling + parameters.graduatePremium);
}

function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

function formatIncome(value: number) {
  if (value === 0) {
    return "£0";
  }

  return `£${Math.round(value / 1000)}k`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTickStep() {
  return 25;
}

function buildChart(parameters: TaxParameters) {
  const samples = Array.from({ length: 161 }, (_, index) => {
    const income = (index / 160) * MAX_INCOME;
    return {
      income,
      nonGraduateRate: calculateNonGraduateTaxRate(parameters, income),
      graduateRate: calculateGraduateTaxRate(parameters, income)
    };
  });
  const rates = samples.flatMap((point) => [point.nonGraduateRate, point.graduateRate]);
  const low = Math.min(0, ...rates);
  const high = Math.max(100, ...rates);
  const tickStep = getTickStep();
  const yMin = Math.floor(low / tickStep) * tickStep;
  const yMax = Math.ceil(high / tickStep) * tickStep;
  const yTicks: number[] = [];

  for (let tick = yMin; tick <= yMax; tick += tickStep) {
    yTicks.push(tick);
  }

  const mapX = (income: number) => PLOT.left + (income / MAX_INCOME) * PLOT_WIDTH;
  const mapY = (rate: number) =>
    PLOT.top + ((yMax - rate) / Math.max(yMax - yMin, 1)) * PLOT_HEIGHT;
  const nonGraduatePath = samples
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${mapX(point.income).toFixed(2)} ${mapY(point.nonGraduateRate).toFixed(2)}`;
    })
    .join(" ");
  const graduatePath = samples
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${mapX(point.income).toFixed(2)} ${mapY(point.graduateRate).toFixed(2)}`;
    })
    .join(" ");

  return {
    yMin,
    yMax,
    yTicks,
    mapX,
    mapY,
    graduatePath,
    nonGraduatePath
  };
}

function getSliderPosition(value: number, min: number, max: number) {
  return `${((value - min) / (max - min)) * 100}%`;
}

function SliderControl({
  id,
  label,
  color = ACCENT,
  min,
  max,
  step,
  value,
  displayValue,
  onChange
}: SliderControlProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="block text-sm font-semibold text-[#111111]">
          {label}
        </label>
        <span className="text-sm font-semibold tabular-nums text-[#111111]">
          {displayValue}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="difference-slider w-full"
        style={
          {
            "--slider-color": color,
            "--slider-position": getSliderPosition(value, min, max)
          } as CSSProperties
        }
        aria-label={label}
        aria-valuetext={displayValue}
      />
    </div>
  );
}

export default function GrowthCurveTaxInteractive() {
  const idBase = useId();
  const titleId = `${idBase}-title`;
  const descriptionId = `${idBase}-description`;
  const [parameters, setParameters] = useState<TaxParameters>(DEFAULT_PARAMETERS);
  const [activeScenario, setActiveScenario] = useState<ScenarioId | null>(null);
  const [hoveredIncome, setHoveredIncome] = useState<number | null>(null);
  const chart = useMemo(() => buildChart(parameters), [parameters]);

  function updateParameter(key: ParameterKey, value: number) {
    setActiveScenario(null);
    setParameters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function applyScenario(scenario: Scenario) {
    setActiveScenario(scenario.id);
    setParameters(scenario.values);
  }

  function resetParameters() {
    setActiveScenario(null);
    setHoveredIncome(null);
    setParameters(DEFAULT_PARAMETERS);
  }

  function handleChartPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH;
    const svgY = ((event.clientY - rect.top) / rect.height) * CHART_HEIGHT;
    const isInsidePlot =
      svgX >= PLOT.left &&
      svgX <= CHART_WIDTH - PLOT.right &&
      svgY >= PLOT.top &&
      svgY <= CHART_HEIGHT - PLOT.bottom;

    if (!isInsidePlot) {
      setHoveredIncome(null);
      return;
    }

    const nextIncome = Math.round(((svgX - PLOT.left) / PLOT_WIDTH) * MAX_INCOME / 1000) * 1000;
    setHoveredIncome((currentIncome) => (currentIncome === nextIncome ? currentIncome : nextIncome));
  }

  const hoverDetails =
    hoveredIncome === null
      ? null
      : (() => {
          const income = clamp(hoveredIncome, 0, MAX_INCOME);
          const nonGraduateRate = calculateNonGraduateTaxRate(parameters, income);
          const graduateRate = calculateGraduateTaxRate(parameters, income);
          const x = chart.mapX(income);
          const nonGraduateY = chart.mapY(nonGraduateRate);
          const graduateY = chart.mapY(graduateRate);
          const tooltipX =
            x + TOOLTIP_WIDTH + 16 <= CHART_WIDTH - PLOT.right
              ? x + 14
              : x - TOOLTIP_WIDTH - 14;
          const tooltipY = clamp(
            Math.min(nonGraduateY, graduateY) - TOOLTIP_HEIGHT - 12,
            PLOT.top + 8,
            CHART_HEIGHT - PLOT.bottom - TOOLTIP_HEIGHT - 8
          );

          return {
            graduateRate,
            graduateY,
            income,
            nonGraduateRate,
            nonGraduateY,
            tooltipX,
            tooltipY,
            x
          };
        })();

  return (
    <div className="not-prose relative left-1/2 my-10 w-[min(100vw-2.5rem,56rem)] -translate-x-1/2">
      <section className="interactive-panel overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)]">
          <div className="border-b border-black/8 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <p className="eyebrow">Parameters</p>

            <div className="mt-6 space-y-6">
              <SliderControl
                id={`${idBase}-floor`}
                label="Floor"
                min={-25}
                max={100}
                step={1}
                value={parameters.floor}
                displayValue={formatPercent(parameters.floor)}
                onChange={(value) => updateParameter("floor", value)}
              />
              <SliderControl
                id={`${idBase}-ceiling`}
                label="Ceiling"
                min={0}
                max={100}
                step={1}
                value={parameters.ceiling}
                displayValue={formatPercent(parameters.ceiling)}
                onChange={(value) => updateParameter("ceiling", value)}
              />
              <SliderControl
                id={`${idBase}-progressivity`}
                label="Slope"
                min={0.2}
                max={12}
                step={0.1}
                value={parameters.progressivity}
                displayValue={parameters.progressivity.toFixed(1)}
                onChange={(value) => updateParameter("progressivity", value)}
              />
              <SliderControl
                id={`${idBase}-midpoint`}
                label="Midpoint"
                min={0}
                max={MAX_INCOME}
                step={1_000}
                value={parameters.midpoint}
                displayValue={formatIncome(parameters.midpoint)}
                onChange={(value) => updateParameter("midpoint", value)}
              />
              <SliderControl
                id={`${idBase}-graduate-premium`}
                label="Graduate Premium"
                min={0}
                max={10}
                step={0.1}
                value={parameters.graduatePremium}
                color={GRADUATE_COLOUR}
                displayValue={formatPercent(parameters.graduatePremium, 1)}
                onChange={(value) => updateParameter("graduatePremium", value)}
              />
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="overflow-x-auto">
              <svg
                role="img"
                aria-labelledby={`${titleId} ${descriptionId}`}
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="h-auto min-w-[30rem] max-w-full cursor-crosshair"
                onPointerMove={handleChartPointerMove}
                onPointerLeave={() => setHoveredIncome(null)}
              >
                <title id={titleId}>Logistic income tax curve</title>
                <desc id={descriptionId}>
                  Two four parameter logistic curves showing non-graduate and graduate tax rates for
                  incomes between zero pounds and two hundred and fifty thousand pounds.
                </desc>

                <rect
                  x={PLOT.left}
                  y={PLOT.top}
                  width={PLOT_WIDTH}
                  height={PLOT_HEIGHT}
                  fill="rgba(17, 17, 17, 0.025)"
                />

                {chart.yTicks.map((tick) => {
                  const y = chart.mapY(tick);

                  return (
                    <g key={tick}>
                      <line
                        x1={PLOT.left}
                        x2={CHART_WIDTH - PLOT.right}
                        y1={y}
                        y2={y}
                        stroke="rgba(17, 17, 17, 0.08)"
                      />
                      <text
                        x={PLOT.left - 12}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-black/45 text-[0.72rem] font-semibold"
                      >
                        {formatPercent(tick)}
                      </text>
                    </g>
                  );
                })}

                {X_TICKS.map((tick) => {
                  const x = chart.mapX(tick);

                  return (
                    <g key={tick}>
                      <line
                        x1={x}
                        x2={x}
                        y1={PLOT.top}
                        y2={CHART_HEIGHT - PLOT.bottom}
                        stroke="rgba(17, 17, 17, 0.06)"
                      />
                      <text
                        x={x}
                        y={CHART_HEIGHT - 22}
                        textAnchor="middle"
                        className="fill-black/45 text-[0.72rem] font-semibold"
                      >
                        {formatIncome(tick)}
                      </text>
                    </g>
                  );
                })}

                {chart.yMin < 0 && (
                  <line
                    x1={PLOT.left}
                    x2={CHART_WIDTH - PLOT.right}
                    y1={chart.mapY(0)}
                    y2={chart.mapY(0)}
                    stroke="rgba(17, 17, 17, 0.3)"
                    strokeDasharray="5 5"
                  />
                )}

                <line
                  x1={PLOT.left}
                  x2={PLOT.left}
                  y1={PLOT.top}
                  y2={CHART_HEIGHT - PLOT.bottom}
                  stroke="rgba(17, 17, 17, 0.28)"
                />
                <line
                  x1={PLOT.left}
                  x2={CHART_WIDTH - PLOT.right}
                  y1={CHART_HEIGHT - PLOT.bottom}
                  y2={CHART_HEIGHT - PLOT.bottom}
                  stroke="rgba(17, 17, 17, 0.28)"
                />

                <path
                  d={chart.graduatePath}
                  fill="none"
                  stroke={GRADUATE_COLOUR}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d={chart.nonGraduatePath}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {hoverDetails && (
                  <g
                    className="pointer-events-none"
                    data-tax-tooltip="true"
                    data-hover-income={hoverDetails.income}
                  >
                    <line
                      x1={hoverDetails.x}
                      x2={hoverDetails.x}
                      y1={PLOT.top}
                      y2={CHART_HEIGHT - PLOT.bottom}
                      stroke="rgba(17, 17, 17, 0.28)"
                      strokeDasharray="4 5"
                    />
                    <circle
                      cx={hoverDetails.x}
                      cy={hoverDetails.graduateY}
                      r="4.5"
                      fill={GRADUATE_COLOUR}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx={hoverDetails.x}
                      cy={hoverDetails.nonGraduateY}
                      r="5"
                      fill={ACCENT}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                    />
                    <rect
                      x={hoverDetails.tooltipX}
                      y={hoverDetails.tooltipY}
                      width={TOOLTIP_WIDTH}
                      height={TOOLTIP_HEIGHT}
                      rx="8"
                      fill="rgba(255, 255, 255, 0.96)"
                      stroke="rgba(17, 17, 17, 0.14)"
                    />
                    <text
                      x={hoverDetails.tooltipX + 12}
                      y={hoverDetails.tooltipY + 19}
                      className="fill-[#111111] text-[0.72rem] font-semibold"
                    >
                      {formatIncome(hoverDetails.income)}
                    </text>
                    <circle
                      cx={hoverDetails.tooltipX + 15}
                      cy={hoverDetails.tooltipY + 39}
                      r="3.5"
                      fill={ACCENT}
                    />
                    <text
                      x={hoverDetails.tooltipX + 26}
                      y={hoverDetails.tooltipY + 43}
                      className="fill-[#111111] text-[0.68rem] font-semibold"
                    >
                      Non-graduate {formatPercent(hoverDetails.nonGraduateRate, 1)}
                    </text>
                    <circle
                      cx={hoverDetails.tooltipX + 15}
                      cy={hoverDetails.tooltipY + 59}
                      r="3.5"
                      fill={GRADUATE_COLOUR}
                    />
                    <text
                      x={hoverDetails.tooltipX + 26}
                      y={hoverDetails.tooltipY + 63}
                      className="fill-[#111111] text-[0.68rem] font-semibold"
                    >
                      Graduate {formatPercent(hoverDetails.graduateRate, 1)}
                    </text>
                  </g>
                )}

                <text
                  x={PLOT.left + PLOT_WIDTH / 2}
                  y={CHART_HEIGHT - 4}
                  textAnchor="middle"
                  className="fill-black/55 text-[0.72rem] font-semibold uppercase tracking-[0.14em]"
                >
                  Income
                </text>
                <text
                  x={16}
                  y={PLOT.top + PLOT_HEIGHT / 2}
                  textAnchor="middle"
                  transform={`rotate(-90 16 ${PLOT.top + PLOT_HEIGHT / 2})`}
                  className="fill-black/55 text-[0.72rem] font-semibold uppercase tracking-[0.14em]"
                >
                  Tax rate
                </text>
              </svg>
            </div>

            <div className="mx-auto mt-4 grid max-w-lg grid-cols-[auto_repeat(3,minmax(0,1fr))] items-baseline gap-x-4 gap-y-1 border-t border-black/8 pt-4">
              <span aria-hidden="true" />
              {RATE_READOUT_INCOMES.map((readout) => (
                <p
                  key={readout.label}
                  className="text-center text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-black/45"
                >
                  {readout.label}
                </p>
              ))}

              <p className="pr-1 text-right text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-black/45">
                Non-Graduate
              </p>
              {RATE_READOUT_INCOMES.map((readout) => (
                <p
                  key={`non-graduate-${readout.label}`}
                  className="text-center text-base font-semibold tabular-nums text-[#F76F5C]"
                >
                  {formatPercent(calculateNonGraduateTaxRate(parameters, readout.income), 1)}
                </p>
              ))}

              <p className="pr-1 text-right text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-black/45">
                Graduate
              </p>
              {RATE_READOUT_INCOMES.map((readout) => (
                <p
                  key={`graduate-${readout.label}`}
                  className="text-center text-base font-semibold tabular-nums text-[#3B0F70]"
                >
                  {formatPercent(calculateGraduateTaxRate(parameters, readout.income), 1)}
                </p>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-1.5 border-t border-black/8 pt-4">
              {SCENARIOS.map((scenario) => {
                const isActive = activeScenario === scenario.id;

                return (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => applyScenario(scenario)}
                    className={`rounded-full px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-white transition focus:outline-none focus:ring-2 focus:ring-[#F76F5C] focus:ring-offset-2 ${
                      isActive
                        ? "bg-[#E56553] shadow-[inset_0_0_0_2px_rgba(17,17,17,0.18)]"
                        : "bg-[#F76F5C] hover:bg-[#E56553]"
                    }`}
                  >
                    {scenario.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={resetParameters}
                className="rounded-full border border-black/15 bg-white px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#111111] transition hover:border-[#F76F5C] hover:text-[#F76F5C] focus:outline-none focus:ring-2 focus:ring-[#F76F5C] focus:ring-offset-2"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
