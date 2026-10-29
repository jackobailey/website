/** An editorial illustration, not a scaled election result or quantitative plot. */
import { MMP_SEAT_COLORS, MMP_SEAT_POSITIONS, MMP_STILL_SLOTS } from "./mmpSeats.ts";
type Point = [number, number, number];
const ORIGIN = [640, 180];
const project = ([x, y, z]: Point) => [ORIGIN[0] + (x - y) * Math.sqrt(3) / 2, ORIGIN[1] + (x + y) / 2 - z];
const xy = (point: Point) => project(point).map(n => n.toFixed(2)).join(",");
const polygon = (points: Point[], fill: string, extra = "") => `<polygon points="${points.map(xy).join(" ")}" fill="${fill}" ${extra}/>`;
const line = (a: Point, b: Point) => `M${xy(a)}L${xy(b)}`;

function shade(hex: string, amount: number) {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16);
    return Math.round(amount > 0 ? value + (255 - value) * amount : value * (1 + amount));
  };
  return `#${[1, 3, 5].map(start => channel(start).toString(16).padStart(2, "0")).join("")}`;
}

function block(x: number, y: number, z: number, width: number, depth: number, height: number, color: string) {
  const a: Point = [x, y, z + height], b: Point = [x + width, y, z + height];
  const c: Point = [x + width, y + depth, z + height], d: Point = [x, y + depth, z + height];
  return polygon([b, [x + width, y, z], [x + width, y + depth, z], c], shade(color, -.23))
    + polygon([d, c, [x + width, y + depth, z], [x, y + depth, z]], shade(color, -.12))
    + polygon([a, b, c, d], shade(color, .14));
}

function chair(color: string) {
  // The rear posts share the legs' footprint and pass through the seat.
  // Split at the seat so its top cannot paint over the upper supports.
  const rearLegs = [[3, 1], [39, 1]];
  const legs = [...rearLegs, [3, 39], [39, 39]];
  const back = project([0, 7, 0]);
  return `<g stroke-linejoin="round">
    ${legs.map(([x, y]) => block(x, y, 0, 6, 6, 43, shade(color, -.25))).join("")}
    ${block(-2, -1, 43, 51, 51, 7, color)}
    ${polygon([[0, 11, 50.3], [46, 11, 50.3], [46, 44, 50.3], [0, 44, 50.3]], shade(color, .23))}
    ${rearLegs.map(([x, y]) => block(x, y, 50, 6, 6, 21, shade(color, -.25))).join("")}
    ${polygon([[0, 0, 105], [46, 0, 105], [46, 7, 105], [0, 7, 105]], shade(color, .35))}
    ${polygon([[46, 0, 64], [46, 0, 105], [46, 7, 105], [46, 7, 64]], shade(color, -.22))}
    <g transform="matrix(.8660254 .5 0 -1 ${back[0]} ${back[1]})">
      <rect x="0" y="63" width="46" height="44" rx="5" fill="${color}"/>
      <path d="M5 101H40" fill="none" stroke="${shade(color, .36)}" stroke-width="1.4" stroke-linecap="round"/>
    </g>
  </g>`;
}

export function renderMmpSeatsScene() {
  const extent = 820;
  const grid: string[] = [];
  for (let n = 0; n <= extent; n += 54) {
    grid.push(line([n, 0, 0], [n, extent, 0]), line([0, n, 0], [extent, n, 0]));
    grid.push(line([n, 0, 0], [n, 0, 600]), line([0, n, 0], [0, n, 600]));
    if (n > 0) grid.push(line([0, 0, n], [extent, 0, n]), line([0, 0, n], [0, extent, n]));
  }
  const seats = MMP_STILL_SLOTS.map((slot, index) => ({
    ...MMP_SEAT_POSITIONS[slot], slot, color: index % MMP_SEAT_COLORS.length,
  })).sort((a, b) => a.depth - b.depth || a.slot - b.slot);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-labelledby="mmp-scene-title mmp-scene-desc">
    <title id="mmp-scene-title">Making room for more voices</title>
    <desc id="mmp-scene-desc">At most ten chairs gently fade out and reappear at random positions in an isometric room with three arrowed spatial axes. Each appearance uses a randomly chosen colour from the site's Magma palette. This is a symbolic illustration, not an election result.</desc>
    <defs>
      <linearGradient id="mmp-floor" x2="0" y2="1"><stop stop-color="#EEE8DD"/><stop offset="1" stop-color="#FAF7F0"/></linearGradient>
      <radialGradient id="mmp-light"><stop stop-color="#FFFFFF" stop-opacity=".35"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
      <filter id="mmp-shadow" x="-40%" y="-70%" width="190%" height="240%"><feGaussianBlur stdDeviation="3.5"/></filter>
      <filter id="mmp-paper"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".035"/></feComponentTransfer></filter>
      <marker id="mmp-arrow" viewBox="0 0 16 16" refX="12" refY="8" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M2 2L12 8L2 14" fill="none" stroke="#937B88" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"/></marker>
      ${MMP_SEAT_COLORS.map((color, index) => `<g id="mmp-chair-${index}" transform="translate(-640 -180)">${chair(color)}</g>`).join("")}
    </defs>
    <rect width="1280" height="720" fill="#FAF7F0"/>
    ${polygon([[0, 0, 0], [0, extent, 0], [0, extent, 900], [0, 0, 900]], "#F1E6DF")}
    ${polygon([[0, 0, 0], [extent, 0, 0], [extent, 0, 900], [0, 0, 900]], "#E8E9E3")}
    ${polygon([[0, 0, 0], [extent, 0, 0], [extent, extent, 0], [0, extent, 0]], "url(#mmp-floor)")}
    <path d="${grid.join("")}" fill="none" stroke="#B6B6AF" stroke-opacity=".32" stroke-width="1"/>
    <rect width="1280" height="720" fill="url(#mmp-light)"/>
    <g fill="none" stroke="#937B88" stroke-width="4" marker-end="url(#mmp-arrow)">
      <path d="${line([0, 0, 0], [590, 0, 0])}"/>
      <path d="${line([0, 0, 0], [0, 590, 0])}"/>
      <path d="${line([0, 0, 0], [0, 0, 142])}"/>
    </g>
    <circle cx="640" cy="180" r="5" fill="#937B88"/>
    <g data-seats="">
    ${seats.map(seat => `<g data-seat="" data-slot="${seat.slot}" data-color="${seat.color}" transform="translate(${seat.x.toFixed(2)} ${seat.y.toFixed(2)})">
      <path d="M-35 25L8 2L67 35L23 59Z" fill="#5E4D5D" opacity=".16" filter="url(#mmp-shadow)"/>
      <use href="#mmp-chair-${seat.color}"/>
    </g>`).join("")}
    </g>
    <rect width="1280" height="720" filter="url(#mmp-paper)" opacity=".65" pointer-events="none"/>
  </svg>`;
}
