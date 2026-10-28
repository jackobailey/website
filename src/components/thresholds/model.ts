/**
 * Bailey, Estimating Effective Electoral Thresholds (14 October 2026).
 * Equations 7–9; lambda is the rounded posterior median in Table 1.
 * The PDF supplied for this implementation is served at /papers/thresholds.pdf.
 * These are model predictions, not an implementation of a seat-allocation rule.
 */
export const DISCRIMINATION = 13.99;

export interface ThresholdModel {
  magnitude: number;
  parties: number;
  lower: number;
  upper: number;
  theta: number;
  threshold: number;
  logitWidth: number;
  isStep: boolean;
}

export const logit = (p: number) => Math.log(p) - Math.log1p(-p);
export function logistic(x: number) {
  return x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
}

export function makeModel(magnitude: number, parties: number): ThresholdModel {
  if (!Number.isInteger(magnitude) || magnitude < 1 || !Number.isFinite(parties) || parties <= 1) {
    throw new RangeError("Use a positive whole number of seats and more than one effective party.");
  }
  const upper = 1 / (magnitude + 1);
  const lower = Math.min(1 / (magnitude * parties), upper);
  const theta = -Math.expm1(magnitude * Math.log1p(-1 / parties));
  const threshold = (1 - theta) * lower + theta * upper;
  const logitWidth = logit(upper) - logit(lower);
  return { magnitude, parties, lower, upper, theta, threshold, logitWidth, isStep: lower === upper };
}

export function winProbability(vote: number, model: ThresholdModel): number {
  if (!Number.isFinite(vote) || vote < 0 || vote > 1) throw new RangeError("Vote share must be between 0 and 1.");
  if (vote === 0) return 0;
  if (vote === 1) return 1;
  // Equation 9 divides by zero when the bounds coincide. Show its positive-slope
  // step limit; 0.5 at the threshold is an explicit display convention.
  if (vote === model.threshold) return 0.5;
  if (model.isStep) return vote < model.threshold ? 0 : 1;
  return logistic(DISCRIMINATION * (logit(vote) - logit(model.threshold)) / model.logitWidth);
}

/** A step has no unique vote share for probabilities other than 0.5. */
export function voteForProbability(probability: number, model: ThresholdModel): number | null {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    throw new RangeError("Target probability must be strictly between 0 and 1.");
  }
  if (probability === 0.5) return model.threshold;
  if (model.isStep) return null;
  return logistic(logit(model.threshold) + logit(probability) * model.logitWidth / DISCRIMINATION);
}

export function percent(value: number, digits = 1) { return `${(100 * value).toFixed(digits)}%`; }
export function probabilityLabel(value: number) {
  if (value < 0.001) return "<0.1%";
  if (value > 0.999) return ">99.9%";
  return percent(value);
}
