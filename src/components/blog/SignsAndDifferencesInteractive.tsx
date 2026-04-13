import { useId, useState, type CSSProperties } from "react";

const RED = "#FF4136";
const BLUE = "#0074D9";
const DEFAULT_RED_SHARE = 68;

const DIFFERENCE_STATES = {
  positive: {
    label: "Positive",
    summary: "Red ahead",
    answerClass: "text-[#FF4136]",
    badgeClass: "border-[#FF4136]/15 bg-[#FF4136]/10 text-[#9F251D]"
  },
  zero: {
    label: "Zero",
    summary: "Red and Blue tied",
    answerClass: "text-[#111111]",
    badgeClass: "border-black/10 bg-black/[0.05] text-[#111111]"
  },
  negative: {
    label: "Negative",
    summary: "Blue ahead",
    answerClass: "text-[#0074D9]",
    badgeClass: "border-[#0074D9]/15 bg-[#0074D9]/10 text-[#005090]"
  }
} as const;

function formatShare(value: number) {
  return `${value}%`;
}

function formatDifference(value: number) {
  if (value === 0) {
    return "0%";
  }

  const sign = value > 0 ? "+" : "−";

  return `${sign}${Math.abs(value)}%`;
}

function getDifferenceState(value: number) {
  if (value > 0) {
    return DIFFERENCE_STATES.positive;
  }

  if (value < 0) {
    return DIFFERENCE_STATES.negative;
  }

  return DIFFERENCE_STATES.zero;
}

export default function SignsAndDifferencesInteractive() {
  const redId = useId();
  const blueId = useId();

  const [redShare, setRedShare] = useState<number>(DEFAULT_RED_SHARE);
  const blueShare = 100 - redShare;

  const difference = redShare - blueShare;
  const differenceState = getDifferenceState(difference);

  const liveDescription =
    difference > 0
      ? `Red share ${redShare} percent minus Blue share ${blueShare} percent equals positive ${Math.abs(difference)} percent. Red is ahead.`
      : difference < 0
        ? `Red share ${redShare} percent minus Blue share ${blueShare} percent equals negative ${Math.abs(difference)} percent. Blue is ahead.`
        : `Red share ${redShare} percent minus Blue share ${blueShare} percent equals zero. The shares are equal.`;

  return (
    <div className="not-prose my-10">
      <section className="interactive-panel overflow-hidden">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <p className="eyebrow">Signs and Differences</p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="px-5 pb-5 sm:px-6 sm:pb-6 lg:px-7 lg:pb-7 lg:pt-0">
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor={redId}
                    className="flex items-center gap-3 text-sm font-semibold text-[#111111]"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: RED }}
                    />
                    Red
                  </label>

                  <span className="text-sm font-semibold tabular-nums text-[#111111]">
                    {formatShare(redShare)}
                  </span>
                </div>

                <input
                  id={redId}
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={redShare}
                  onChange={(event) => setRedShare(Number(event.target.value))}
                  className="difference-slider w-full"
                  style={
                    {
                      "--slider-color": RED,
                      "--slider-position": `${redShare}%`
                    } as CSSProperties
                  }
                  aria-label="Red share"
                  aria-valuetext={formatShare(redShare)}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor={blueId}
                    className="flex items-center gap-3 text-sm font-semibold text-[#111111]"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: BLUE }}
                    />
                    Blue
                  </label>

                  <span className="text-sm font-semibold tabular-nums text-[#111111]">
                    {formatShare(blueShare)}
                  </span>
                </div>

                <input
                  id={blueId}
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={blueShare}
                  onChange={(event) => setRedShare(100 - Number(event.target.value))}
                  className="difference-slider w-full"
                  style={
                    {
                      "--slider-color": BLUE,
                      "--slider-position": `${blueShare}%`
                    } as CSSProperties
                  }
                  aria-label="Blue share"
                  aria-valuetext={formatShare(blueShare)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center px-5 lg:self-center lg:px-0">
            <div
              aria-hidden="true"
              className="h-px w-20 bg-black/10 lg:h-24 lg:w-px"
            />
          </div>

          <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 lg:px-7 lg:pb-7 lg:pt-0">
            <div className="flex h-full min-h-full flex-col items-center justify-center text-center">
              <div aria-live="polite">
                <span className="sr-only">{liveDescription}</span>
                <p className="grid grid-cols-[5ch_1.25ch_5ch_1.25ch_6ch] items-end gap-y-2 text-[1.05rem] font-semibold tracking-tight text-[#111111] sm:text-[1.25rem] lg:text-[1.4rem]">
                  <span className="tabular-nums text-center text-[#FF4136]">
                    {formatShare(redShare)}
                  </span>
                  <span aria-hidden="true" className="text-center text-black/35">
                    −
                  </span>
                  <span className="tabular-nums text-center text-[#0074D9]">
                    {formatShare(blueShare)}
                  </span>
                  <span aria-hidden="true" className="text-center text-black/35">
                    =
                  </span>
                  <output
                    htmlFor={`${redId} ${blueId}`}
                    className={`tabular-nums text-center transition-colors duration-150 ${differenceState.answerClass}`}
                  >
                    {formatDifference(difference)}
                  </output>
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${differenceState.badgeClass}`}
                >
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
                  {differenceState.label}
                </span>

                <p className="text-sm font-medium text-black/65">{differenceState.summary}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
