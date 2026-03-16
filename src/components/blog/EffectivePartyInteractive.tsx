import { useState } from "react";

const DEFAULT_N0 = 5;
const DEFAULT_THETA = 0.65;

function getThetaDescription(theta: number) {
  if (theta === 0) {
    return "At θ = 0, the effective count is 1 regardless of how many actual parties there are.";
  }

  if (theta <= 0.2) {
    return "Low values of θ compress the party system sharply, so many actual parties still behave like a concentrated competition.";
  }

  if (theta <= 0.5) {
    return "Mid-range values of θ still compress the system, but some of the extra parties remain visible in the effective count.";
  }

  if (theta < 1) {
    return "Higher values of θ keep the effective count closer to the actual count, so influence is spread more evenly across parties.";
  }

  return "At θ = 1, the effective number of parties matches the actual number exactly.";
}

export default function EffectivePartyInteractive() {
  const [n0, setN0] = useState(DEFAULT_N0);
  const [theta, setTheta] = useState(DEFAULT_THETA);

  const n2 = Math.pow(n0, theta);
  const relativeWidth = Math.max((n2 / n0) * 100, 4);

  return (
    <div className="not-prose my-10">
      <section className="interactive-panel overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="border-b border-black/10 p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="eyebrow">Overview</p>
            <p className="mt-3 text-sm leading-6 text-[#111111]">
              The simplest model linking effective parties (N<sub>2</sub>) and actual parties (N
              <sub>0</sub>) is:
            </p>
            <p className="mt-5 text-center text-3xl font-semibold tracking-tight text-[#111111] sm:text-[2.2rem]">
              N<sub className="text-base align-sub sm:text-lg">2</sub> = N
              <sub className="text-base align-sub sm:text-lg">0</sub>
              <sup className="text-base align-super sm:text-lg">&theta;</sup>
            </p>
            <p className="mt-4 text-sm leading-6 text-black/70">
              The parameter &theta; determines the concentration of political support across
              parties. When &theta; = 1, there are as many effective as actual parties. As
              &theta; moves from 1 to 0, the effective number of parties falls towards 1.
            </p>
          </div>

          <div className="p-6 sm:p-7">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="effective-party-n0"
                    className="block text-sm font-semibold text-[#111111]"
                  >
                    Actual parties (N<sub>0</sub>)
                  </label>
                  <span className="text-sm font-semibold tabular-nums text-[#111111]">{n0}</span>
                </div>
                <input
                  id="effective-party-n0"
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={n0}
                  onChange={(event) => setN0(Number(event.target.value))}
                  className="w-full accent-[#F76F5C]"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="effective-party-theta"
                    className="block text-sm font-semibold text-[#111111]"
                  >
                    Concentration parameter (&theta;)
                  </label>
                  <span className="text-sm font-semibold tabular-nums text-[#111111]">
                    {theta.toFixed(2)}
                  </span>
                </div>
                <input
                  id="effective-party-theta"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={theta}
                  onChange={(event) => setTheta(Number(event.target.value))}
                  className="w-full accent-[#F76F5C]"
                />
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm text-[#111111]">
                    <span>
                      Effective parties (N<sub>2</sub>)
                    </span>
                    <span className="tabular-nums">{n2.toFixed(2)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-black/8">
                    <div
                      className="h-3 rounded-full bg-[#F76F5C]"
                      style={{ width: `${relativeWidth}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-sm leading-6 text-black/70">{getThetaDescription(theta)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
