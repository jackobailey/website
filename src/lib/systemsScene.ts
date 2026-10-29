import { DOUBLE_PENDULUM, PENDULUM_SCENE, pendulumRotations } from "./doublePendulum.ts";
import { initialPendulumFrame, pendulumTrailPaths } from "./pendulumTrail.ts";

/** The animation and lossless vector poster start at the same point in the motion. */
export function renderSystemsScene() {
  const { state, trail } = initialPendulumFrame();
  const { upper, lower } = pendulumRotations(state);
  const l1 = DOUBLE_PENDULUM.length1 * PENDULUM_SCENE.pixelsPerMetre;
  const l2 = DOUBLE_PENDULUM.length2 * PENDULUM_SCENE.pixelsPerMetre;
  const trailPaths = pendulumTrailPaths(trail);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-labelledby="systems-scene-title">
  <title id="systems-scene-title">A double pendulum with a fading trail tracing the centre of its lower weight.</title>
  <rect width="1280" height="720" fill="#E4D8ED"/>
  <g data-pendulum-trail="" fill="none" stroke="#B73779" stroke-width="4" stroke-linecap="butt" stroke-linejoin="round">
    ${trailPaths.map((d, i) => `<path d="${d}" stroke-opacity="${(0.42 * (i + 1) / trailPaths.length).toFixed(3)}"/>`).join("\n    ")}
  </g>
  <g transform="translate(${PENDULUM_SCENE.pivotX} ${PENDULUM_SCENE.pivotY})">
    <g data-pendulum-arm="upper" transform="rotate(${upper.toFixed(6)})">
      <path d="M-7 0V${l1}M7 0V${l1}" fill="none" stroke="#3B0F70" stroke-width="6"/>
      <path d="M-7 0V${l1}M7 0V${l1}" fill="none" stroke="#FEB77E" stroke-width="3"/>
      <g transform="translate(0 ${l1})">
        <g data-pendulum-arm="lower" transform="rotate(${lower.toFixed(6)})">
          <path d="M0 0V${l2 - 22}" stroke="#3B0F70" stroke-width="6"/>
          <path d="M0 0V${l2 - 22}" stroke="#FEB77E" stroke-width="3"/>
          <circle data-pendulum-tip="" cy="${l2}" r="17" fill="none" stroke="#3B0F70" stroke-width="12"/>
          <circle cy="${l2}" r="17" fill="none" stroke="#FEB77E" stroke-width="7"/>
        </g>
        <circle r="23" fill="#FEB77E" stroke="#3B0F70" stroke-width="2.5"/>
        <circle r="13" fill="#FCFDBF"/>
        <circle r="4" fill="#3B0F70"/>
      </g>
    </g>
    <g data-scene="fixed-pivot">
      <circle r="26" fill="#FEB77E" stroke="#3B0F70" stroke-width="2.5"/>
      <circle r="16" fill="#FCFDBF"/>
      <circle r="5" fill="#3B0F70"/>
    </g>
  </g>
</svg>`;
}
