// Run with Node 22.18+ after changing the gas colours, radius or population.
// The balls stay vector shapes; only the existing paper backdrop is raster artwork.
import { readFile, writeFile } from "node:fs/promises";
import { PAPER_GAS, GAS_COLORS, createGas, stepGas } from "../src/lib/paperGas.ts";

const texture = await readFile(new URL("../src/assets/writing/collision-paper-source.webp", import.meta.url));
const particles = createGas(1280, 720);
for (let step = 0; step < 180; step++) stepGas(particles, 1280, 720, PAPER_GAS.step);
const circles = particles.map((p) => `  <circle cx="${p.x.toFixed(3)}" cy="${p.y.toFixed(3)}" r="${PAPER_GAS.radius}" fill="${GAS_COLORS[p.color]}"/>`).join("\n");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <image id="paper-source" width="1672" height="941" xlink:href="data:image/webp;base64,${texture.toString("base64")}"/>
    <clipPath id="paper-crop"><rect width="280" height="220"/></clipPath>
    <g id="paper-tile" clip-path="url(#paper-crop)"><use xlink:href="#paper-source"/></g>
    <pattern id="paper" width="560" height="440" patternUnits="userSpaceOnUse">
      <use xlink:href="#paper-tile"/>
      <use xlink:href="#paper-tile" transform="translate(560 0) scale(-1 1)"/>
      <use xlink:href="#paper-tile" transform="translate(0 440) scale(1 -1)"/>
      <use xlink:href="#paper-tile" transform="translate(560 440) scale(-1 -1)"/>
    </pattern>
  </defs>
  <rect width="1280" height="720" fill="url(#paper)"/>
  <rect width="1280" height="720" fill="#faf8f5" opacity=".55"/>
${circles}
</svg>\n`;
await writeFile(new URL("../src/assets/writing/collision-gas.svg", import.meta.url), svg);
console.log(`Rendered ${particles.length} vector circles on the existing paper backdrop.`);
