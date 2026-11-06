/** An imaginary ballot: symbols and lines are decorative, not election data. */
export const CLEA_BALLOT = {
  width: 1280,
  height: 720,
  period: 26,
  posterTime: 17.2,
  zoom: 1.85,
  lensRadius: 104,
  background: "#E4D8ED"
} as const;

const INK = "#000004";
const PAPER = "#FAF8F5";
const PURPLE = "#3B0F70";
const MAGENTA = "#B73779";
const CORAL = "#F76F5C";
const APRICOT = "#FEB77E";

export function ballotLensFrame(seconds: number) {
  const phase = (seconds % CLEA_BALLOT.period) / CLEA_BALLOT.period * Math.PI * 2;
  const x = 615 + 190 * Math.sin(phase);
  const y = 350 - 150 * Math.cos(phase);
  // In lens-local coordinates, p becomes zoom * (p - centre).
  // The outer translation puts the lens centre back at exactly the source point.
  const { zoom } = CLEA_BALLOT;
  return {
    x, y,
    position: `translate(${x.toFixed(4)} ${y.toFixed(4)})`,
    magnification: `matrix(${zoom} 0 0 ${zoom} ${(-zoom * x).toFixed(4)} ${(-zoom * y).toFixed(4)})`
  };
}

function star() {
  return `<path d="M0 -27 L7.4 -8.5 L27 -7.5 L11.8 5 L16.7 24 L0 13.4 L-16.7 24 L-11.8 5 L-27 -7.5 L-7.4 -8.5 Z" fill="${PURPLE}"/>`;
}

function leaf() {
  return `<path d="M-20 23 C-35 -6 -15 -28 24 -26 C26 8 9 28 -20 23Z" fill="${MAGENTA}"/>
    <path d="M-26 31 Q-6 9 11 -12" fill="none" stroke="${PAPER}" stroke-width="3" stroke-linecap="round"/>`;
}

function sun() {
  const rays = Array.from({ length: 8 }, (_, i) => `<path d="M0 -24 V-32" transform="rotate(${i * 45})"/>`).join("");
  return `<circle r="17" fill="${CORAL}"/><g fill="none" stroke="${CORAL}" stroke-width="5" stroke-linecap="round">${rays}</g>`;
}

function diamond() {
  return `<path d="M0 -29 L27 0 L0 29 L-27 0Z" fill="${APRICOT}"/>
    <path d="M0 -13 L12 0 L0 13 L-12 0Z" fill="${PAPER}"/>`;
}

function ballotLines(index: number) {
  const lengths = [194, 176, 205, 180];
  return `<path d="M0 0 H${lengths[index]}" fill="none" stroke="${INK}" stroke-opacity="0.76" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M0 22 H112" fill="none" stroke="${INK}" stroke-opacity="0.35" stroke-width="2.8" stroke-linecap="round"/>`;
}

function ballotPaper(prefix: string) {
  const symbols = [star(), leaf(), sun(), diamond()];
  const rows = symbols.map((symbol, index) => {
    const y = 236 + index * 100;
    return `<g>
      <path d="M407 ${y + 47} H825" fill="none" stroke="#D8D0D6" stroke-width="1.5"/>
      <g transform="translate(450 ${y})">${symbol}</g>
      <g transform="translate(505 ${y - 4})">${ballotLines(index)}</g>
      <rect x="771" y="${y - 17}" width="34" height="34" rx="2" fill="none" stroke="${INK}" stroke-opacity="0.7" stroke-width="3"/>
      ${index === 1 ? `<path data-ballot-cross="" d="M779 ${y - 9} L797 ${y + 9} M797 ${y - 9} L779 ${y + 9}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>` : ""}
    </g>`;
  }).join("");
  return `<g transform="rotate(-5 615 360)">
    <path d="M375 69 H815 L853 107 V651 H375Z" fill="${PAPER}" filter="url(#${prefix}-paper-shadow)"/>
    <path d="M815 69 V107 H853" fill="#EAE3E7"/>
    <path d="M410 119 H610" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <path d="M410 145 H565 M580 145 H644" stroke="${INK}" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>
    <path d="M407 184 H825" stroke="${INK}" stroke-width="2"/>
    ${rows}
    <path d="M399 613 H829" stroke="#C3B8C6" stroke-width="1.5" stroke-dasharray="3 7"/>
    <path d="M410 631 H451 M461 631 H480" stroke="${INK}" stroke-opacity="0.28" stroke-width="2.5" stroke-linecap="round"/>
  </g>`;
}

/** Shared SVG renderer for the animated lead and the standalone preview image. */
export function renderCleaBallotScene(seconds = CLEA_BALLOT.posterTime, prefix = "clea-ballot") {
  const frame = ballotLensFrame(seconds);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-labelledby="${prefix}-title ${prefix}-description">
  <title id="${prefix}-title">A closer look at an imaginary ballot</title>
  <desc id="${prefix}-description">A magnifying glass moves across one stationary ballot paper, enlarging the coloured party symbols, straight lines, and voting boxes beneath its lens. A black X marks the leaf party's box. The ballot is illustrative and contains no real candidates or election results.</desc>
  <defs>
    <filter id="${prefix}-paper-shadow" x="-25%" y="-20%" width="160%" height="160%" color-interpolation-filters="sRGB">
      <feDropShadow dx="4" dy="12" stdDeviation="10" flood-color="${PURPLE}" flood-opacity="0.14"/>
    </filter>
    <filter id="${prefix}-glass-shadow" x="-45%" y="-40%" width="190%" height="190%" color-interpolation-filters="sRGB">
      <feDropShadow dx="6" dy="9" stdDeviation="7" flood-color="${INK}" flood-opacity="0.19"/>
    </filter>
    <clipPath id="${prefix}-lens-clip"><circle r="${CLEA_BALLOT.lensRadius}"/></clipPath>
    <g id="${prefix}-world">
      <rect width="1280" height="720" fill="${CLEA_BALLOT.background}"/>
      ${ballotPaper(prefix)}
    </g>
  </defs>
  <use href="#${prefix}-world" data-ballot-base=""/>
  <g data-ballot-lens="" transform="${frame.position}" filter="url(#${prefix}-glass-shadow)">
    <g transform="rotate(-40)">
      <rect x="-14" y="100" width="28" height="43" rx="8" fill="${INK}"/>
      <rect x="-21" y="130" width="42" height="112" rx="21" fill="${PURPLE}"/>
      <path d="M-12 151 V215" fill="none" stroke="#7A4A9F" stroke-width="4" stroke-linecap="round"/>
      <path d="M-20 147 H20" stroke="${MAGENTA}" stroke-width="6"/>
    </g>
    <circle r="116" fill="${INK}"/>
    <g clip-path="url(#${prefix}-lens-clip)">
      <use href="#${prefix}-world" data-ballot-magnified="" transform="${frame.magnification}"/>
    </g>
    <circle r="109" fill="none" stroke="#614477" stroke-width="3"/>
    <path d="M-83 -28 A88 88 0 0 1 -32 -82" fill="none" stroke="white" stroke-opacity="0.68" stroke-width="5" stroke-linecap="round"/>
    <path d="M70 58 A91 91 0 0 1 52 75" fill="none" stroke="white" stroke-opacity="0.4" stroke-width="2.5" stroke-linecap="round"/>
  </g>
</svg>`.replace(/[ \t]+$/gm, "");
}
