// Magma endpoint colours around a warm off-white midpoint.
export const REJOIN_COLOUR = '#3B0F70';
export const NEUTRAL_COLOUR = '#F6F1E7';
export const STAY_OUT_COLOUR = '#F76F5C';
export const LOGISTIC_STEEPNESS = 10;

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));
const lower = sigmoid(-LOGISTIC_STEEPNESS / 2);
const span = sigmoid(LOGISTIC_STEEPNESS / 2) - lower;

// Normalise to retain exact endpoints and the 50/50 midpoint. Only colour
// positions change: displayed shares, bar lengths and intervals stay unscaled.
export function colourPosition(stayOutShare: number) {
  const share = Math.max(0, Math.min(1, stayOutShare));
  return (sigmoid(LOGISTIC_STEEPNESS * (share - 0.5)) - lower) / span;
}

function mixColours(from: string, to: string, proportion: number) {
  return '#' + [1, 3, 5].map(start => {
    const a = parseInt(from.slice(start, start + 2), 16);
    const b = parseInt(to.slice(start, start + 2), 16);
    return Math.round(a + (b - a) * proportion).toString(16).padStart(2, '0');
  }).join('');
}

export function voteShareColour(stayOutShare: number) {
  const position = colourPosition(stayOutShare);
  return position <= 0.5
    ? mixColours(REJOIN_COLOUR, NEUTRAL_COLOUR, position * 2)
    : mixColours(NEUTRAL_COLOUR, STAY_OUT_COLOUR, (position - 0.5) * 2);
}

// The legend displays the colour ramp; actual share labels are positioned with
// the same logistic transform used by the map (40% Stay out = 60% Rejoin).
export const MAP_GRADIENT = `linear-gradient(to right in srgb, ${REJOIN_COLOUR}, ${NEUTRAL_COLOUR} 50%, ${STAY_OUT_COLOUR})`;
export const LEGEND_STOPS = [
  { share: 0, label: '100%' },
  { share: 0.4, label: '60%' },
  { share: 0.5, label: '50 / 50' },
  { share: 0.6, label: '60%' },
  { share: 1, label: '100%' },
] as const;
