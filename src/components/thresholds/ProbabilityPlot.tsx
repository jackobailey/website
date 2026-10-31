import { useId, useMemo, useState } from "react";
import { percent, probabilityLabel, voteForProbability, winProbability, type ThresholdModel } from "./model";
import { useAnimatedPlot } from "./useAnimatedPlot";

interface Props { model: ThresholdModel; vote: number; showHeading?: boolean; }
const WIDTH = 720, HEIGHT = 390;
const LEFT = 65, RIGHT = 22, TOP = 30, BOTTOM = 58;
const INNER_WIDTH = WIDTH - LEFT - RIGHT, INNER_HEIGHT = HEIGHT - TOP - BOTTOM;

function makeCurve(model: ThresholdModel, vote: number) {
  // Sample both axes so steep curves and their flat tails remain well resolved.
  const votes = [0, 1, model.threshold, vote];
  if (!model.isStep) {
    for (let i = 1; i < 200; i++) {
      votes.push(i / 200, voteForProbability(i / 200, model)!);
    }
  }
  const points = [...new Set(votes)].map((v) => ({ vote: v, probability: winProbability(v, model), distance: 0 }));
  if (model.isStep) {
    points.push({ vote: model.threshold, probability: 0, distance: 0 }, { vote: model.threshold, probability: 1, distance: 0 });
  }
  points.sort((a, b) => a.vote - b.vote || a.probability - b.probability);
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1], point = points[i];
    point.distance = previous.distance + Math.hypot((point.vote - previous.vote) * INNER_WIDTH,
      (point.probability - previous.probability) * INNER_HEIGHT);
  }
  const length = points[points.length - 1].distance;
  const selected = points.find((point) => point.vote === vote && point.probability === winProbability(vote, model))!;
  return { points, length, position: selected.distance / length };
}

function pointOnCurve(curve: ReturnType<typeof makeCurve>, position: number) {
  const distance = position * curve.length;
  const index = curve.points.findIndex((point) => point.distance >= distance);
  if (index <= 0) return curve.points[index === 0 ? 0 : curve.points.length - 1];
  const before = curve.points[index - 1], after = curve.points[index];
  const progress = (distance - before.distance) / (after.distance - before.distance);
  return { vote: before.vote + (after.vote - before.vote) * progress,
    probability: before.probability + (after.probability - before.probability) * progress };
}

export default function ProbabilityPlot({ model, vote, showHeading = true }: Props) {
  const id = useId();
  const [hoverVote, setHoverVote] = useState<number | null>(null);
  const tickStep = 0.2;
  const maxVote = 1;
  const x = (v: number) => LEFT + v / maxVote * INNER_WIDTH;
  const y = (p: number) => TOP + (1 - p) * INNER_HEIGHT;
  const activeVote = hoverVote === null ? vote : Math.min(hoverVote, maxVote);
  const activeProbability = winProbability(activeVote, model);
  const ticks = Array.from({ length: Math.floor(maxVote / tickStep + 1e-8) + 1 }, (_, i) => i * tickStep);
  const selectedProbability = winProbability(vote, model);
  const targetThresholdLabelX = x(model.threshold) + 14;
  const thresholdLabelY = y(0.5) + 34;
  const labelWidth = 220;
  // Clamp a consistently left-aligned label instead of flipping its text anchor.
  const voteLabelX = Math.min(x(activeVote) + 14, WIDTH - RIGHT - labelWidth);
  let voteLabelY = y(activeProbability) + (activeProbability > 0.78 ? 32 : -36);
  // Keep the two annotations apart when the selected share is near the threshold.
  if (voteLabelX < targetThresholdLabelX + labelWidth && voteLabelX + labelWidth > targetThresholdLabelX &&
    voteLabelY + 24 > thresholdLabelY - 22 && voteLabelY - 22 < thresholdLabelY + 24) {
    voteLabelY = thresholdLabelY - 64;
  }
  const targetCurve = useMemo(() => makeCurve(model, activeVote), [model.threshold, model.logitWidth, model.isStep, activeVote]);
  const frame = useAnimatedPlot({ threshold: model.threshold, logitWidth: model.logitWidth,
    position: targetCurve.position, labelX: voteLabelX, labelY: voteLabelY });
  const displayModel = { ...model, threshold: frame.threshold, logitWidth: frame.logitWidth, isStep: frame.logitWidth === 0 };
  const thresholdLabelX = x(frame.threshold) + 14;
  const displayCurve = makeCurve(displayModel, activeVote);
  // Travel along the curve, including its vertical step, rather than cutting across it.
  const displayed = pointOnCurve(displayCurve, frame.position);
  const path = displayCurve.points.map((point, i) => `${i === 0 ? "M" : "L"}${x(point.vote).toFixed(3)},${y(point.probability).toFixed(3)}`).join(" ");

  return <figure className="threshold-plot">
    {showHeading && <div className="threshold-plot__heading">
      <h2>Chance of Winning a Seat</h2>
    </div>}
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const px = (event.clientX - bounds.left) / bounds.width * WIDTH;
        setHoverVote(Math.max(0, Math.min(maxVote, (px - LEFT) / INNER_WIDTH * maxVote)));
      }} onPointerLeave={() => setHoverVote(null)}>
      <title id={`${id}-title`}>Vote share and modelled chance of winning a seat</title>
      <desc id={`${id}-desc`}>At {model.magnitude} {model.magnitude === 1 ? "seat" : "seats"} and {model.parties.toFixed(2)} effective parties, the effective threshold is {percent(model.threshold, 2)}. The modelled chance is {probabilityLabel(selectedProbability)} at {percent(vote)} of the vote. The effective party count is held fixed along this curve.</desc>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => <g key={p}>
        <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(p)} y2={y(p)} className={p === 0.5 ? "threshold-grid threshold-grid--half" : "threshold-grid"} />
        <text x={LEFT - 12} y={y(p) + 5} textAnchor="end" className="threshold-axis">{percent(p, 0)}</text>
      </g>)}
      {ticks.map((v) => <g key={v}>
        <line x1={x(v)} x2={x(v)} y1={y(0)} y2={y(0) + 6} className="threshold-grid" />
        <text x={x(v)} y={y(0) + 27} textAnchor="middle" className="threshold-axis">{Number((v * 100).toFixed(5))}%</text>
      </g>)}
      <text x={LEFT + INNER_WIDTH / 2} y={HEIGHT - 4} textAnchor="middle" className="threshold-axis-title">Party vote share</text>
      <line x1={x(frame.threshold)} x2={x(frame.threshold)} y1={y(0)} y2={y(1)} className="threshold-marker" />
      <path d={`${path}L${x(maxVote)},${y(0)}Z`} className="threshold-area" />
      <path d={path} className="threshold-curve" />
      <circle cx={x(frame.threshold)} cy={y(0.5)} r="6" className="threshold-crossing" />
      <line x1={x(displayed.vote)} x2={x(displayed.vote)} y1={y(0)} y2={y(displayed.probability)} className="threshold-vote-guide" />
      <circle cx={x(displayed.vote)} cy={y(displayed.probability)} r="6" className="threshold-vote-dot" />
      <text x={thresholdLabelX} y={thresholdLabelY} className="threshold-annotation threshold-annotation--threshold" aria-hidden="true">
        <tspan x={thresholdLabelX}>Effective threshold</tspan>
        <tspan x={thresholdLabelX} dy="26" className="threshold-annotation__value">{percent(frame.threshold, 2)}</tspan>
      </text>
      <text x={frame.labelX} y={frame.labelY} className="threshold-annotation threshold-annotation--vote" aria-hidden="true">
        <tspan x={frame.labelX}>{percent(displayed.vote)} vote share</tspan>
        <tspan x={frame.labelX} dy="26" className="threshold-annotation__value">{probabilityLabel(displayed.probability)} chance</tspan>
      </text>
    </svg>
    <p className="sr-only" aria-live="polite" aria-atomic="true">Effective threshold: {percent(model.threshold, 2)}. Party vote share: {percent(vote)}, {probabilityLabel(selectedProbability)} chance of winning a seat.</p>
  </figure>;
}
