import { useState } from "react";
import ProbabilityPlot from "./ProbabilityPlot";
import { makeModel } from "./model";
import "./thresholds.css";

function NumberRange({ id, label, help, value, onChange, min, max, sliderMax = max, step = 1 }: {
  id: string; label: string; help?: string; value: string; onChange: (value: string) => void;
  min: number; max: number; sliderMax?: number; step?: number;
}) {
  return <div className="threshold-control">
    <div className="threshold-control__label">
      <label htmlFor={id}>{label}</label>
      <span className="threshold-number-wrap"><input id={id} type="number" min={min} max={max} step={step}
        value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={help ? `${id}-help` : undefined} /></span>
    </div>
    <input type="range" min={min} max={Math.max(sliderMax, Number(value) || sliderMax)} step={step}
      value={value || min} aria-label={`${label} slider`} aria-describedby={help ? `${id}-help` : undefined}
      onChange={(event) => onChange(event.target.value)} />
    {help ? <p id={`${id}-help`} className="threshold-help">{help}</p> : null}
  </div>;
}

export default function ThresholdExplorer() {
  const [magnitude, setMagnitude] = useState("1");
  const [effectiveParties, setEffectiveParties] = useState("4");
  const [voteShare, setVoteShare] = useState("35");
  const m = Number(magnitude), n = Number(effectiveParties), v = Number(voteShare);
  const vote = v / 100;
  let error = "";
  if (magnitude.trim() === "" || !Number.isInteger(m) || m < 1 || m > 1000) error = "Enter a whole number of seats from 1 to 1,000.";
  else if (!Number.isFinite(n) || n <= 1 || n > 100) error = "Enter an effective party count greater than 1 and no more than 100.";
  else if (voteShare.trim() === "" || !Number.isFinite(v) || v < 0 || v > 100) error = "Enter a vote share from 0 to 100%.";
  const model = error ? null : makeModel(m, n);
  return <div className="threshold-explorer">
    <div className="threshold-workspace">
      <section className="threshold-controls" aria-label="Election controls">
        <NumberRange id="threshold-magnitude" label="Seats in District" value={magnitude} onChange={setMagnitude} min={1} max={1000} sliderMax={30} />
        <NumberRange id="threshold-parties" label="Effective number of parties" value={effectiveParties} onChange={setEffectiveParties} min={1.1} max={100} sliderMax={10} step={0.1} />
        <NumberRange id="threshold-vote" label="Party vote share (%)" value={voteShare} onChange={setVoteShare} min={0} max={100} step={0.1} />
      </section>

      <section className="threshold-results" aria-label="Threshold and probability results">
        {model ? <>
          <ProbabilityPlot model={model} vote={vote} />
          {model.isStep ? <p className="threshold-notice">The model’s bounds coincide here, so its usual probability formula is undefined. The plot shows the limiting step, with 50% at the threshold as a display convention. It does not describe real-world certainty.</p> : null}
        </> : <div className="threshold-invalid" role="status"><h2>Complete your scenario</h2><p>{error}</p><p className="threshold-help">The plot will update once the inputs are valid.</p></div>}
      </section>
    </div>

  </div>;
}
