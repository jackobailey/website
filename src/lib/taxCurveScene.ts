import { TAX_CURVE_SCENE, taxCurvePath, taxCurveEchoes } from "./taxCurve.ts";

/** One renderer supplies the live illustration, static fallback and SVG poster. */
export function renderTaxCurveScene(time: number = TAX_CURVE_SCENE.initialTime) {
  const path = taxCurvePath(time);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-labelledby="tax-curve-title tax-curve-desc">
  <title id="tax-curve-title">Reshaping the tax curve</title>
  <desc id="tax-curve-desc">A purple S-shaped curve sweeps from left to right, smoothly changing towards a randomly chosen midpoint and steepness at each turn. Its endpoints stay on the bottom and top edges of the frame. Sixty-four previous curves hold their earlier shapes and quickly fade away, progressing through Magma from purple towards magenta and coral as they age. This is an illustration of flexibility, not a numerical tax proposal.</desc>
  <rect width="1280" height="720" fill="#EFE4DB"/>
  <g fill="none" stroke-width="2.5">
    ${taxCurveEchoes(time).map(echo => `<path data-tax-echo="" data-sampled-at="${echo.sampledAt}" d="${echo.path}" stroke="${echo.color}" opacity="${echo.opacity.toFixed(5)}"/>`).join("\n    ")}
  </g>
  <path data-tax-track="" d="${path}" fill="none" stroke="#3B0F70" stroke-width="6"/>
</svg>`;
}
