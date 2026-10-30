/** Original pixel artwork. Race positions illustrate competition, not electoral estimates. */
export const RACE_SCENE = {
  width: 320, height: 180, start: 48, finish: 272,
  runSeconds: 7.8, holdSeconds: 1.8, fadeSeconds: 0.35, restSeconds: 0.3,
  posterTime: 5.9
};

type Point = readonly [number, number];
type Coat = "coral" | "purple" | "magenta" | "apricot";
const INK = "#261A32";
const PAPER = "#FAF8F5";
const COATS: Record<Coat, { main: string; shade: string; light: string; silk: string }> = {
  coral: { main: "#F76F5C", shade: "#B73779", light: "#FEB77E", silk: "#F76F5C" },
  purple: { main: "#67438F", shade: "#3B0F70", light: "#9D80BB", silk: "#3B0F70" },
  magenta: { main: "#B73779", shade: "#72295F", light: "#E579A3", silk: "#B73779" },
  apricot: { main: "#FEB77E", shade: "#CF8865", light: "#FCFDBF", silk: "#FEB77E" }
};

export const RACERS: readonly { id: string; coat: Coat; feet: number; speed: number; phase: number }[] = [
  { id: "upper-purple", coat: "purple", feet: 61, speed: 1.13, phase: 2 },
  { id: "upper-coral", coat: "coral", feet: 80, speed: 1, phase: 0 },
  { id: "lower-purple", coat: "purple", feet: 113, speed: 0.91, phase: 2 },
  { id: "lower-coral", coat: "coral", feet: 129, speed: 1, phase: 0 },
  { id: "lower-magenta", coat: "magenta", feet: 145, speed: 0.82, phase: 4 },
  { id: "lower-apricot", coat: "apricot", feet: 161, speed: 0.74, phase: 1 }
];

/** Rasterise at the sprite's native resolution, then emit crisp horizontal SVG runs. */
class Pixels {
  private cells: (string | undefined)[][] = Array.from({ length: 34 }, () => Array(48));
  rect(x: number, y: number, w: number, h: number, colour: string) {
    for (let row = Math.max(0, y); row < Math.min(34, y + h); row++) {
      for (let col = Math.max(0, x); col < Math.min(48, x + w); col++) this.cells[row][col] = colour;
    }
  }
  polygon(points: readonly Point[], colour: string) {
    for (let y = 0; y < 34; y++) for (let x = 0; x < 48; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        if ((a[1] > y + 0.5) !== (b[1] > y + 0.5) &&
          x + 0.5 < (b[0] - a[0]) * (y + 0.5 - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      if (inside) this.cells[y][x] = colour;
    }
  }
  line(a: Point, b: Point, width: number, colour: string) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / length * width / 2, ny = (b[0] - a[0]) / length * width / 2;
    this.polygon([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny],
      [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], colour);
  }
  render() {
    return this.cells.map((row, y) => {
      let output = "";
      for (let x = 0; x < row.length;) {
        const colour = row[x];
        let end = x + 1;
        while (end < row.length && row[end] === colour) end++;
        if (colour) output += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${colour}"/>`;
        x = end;
      }
      return output;
    }).join("");
  }
}

// Each limb retains its hip/shoulder anchor throughout the six-frame gallop.
const POSES: readonly (readonly Point[])[] = [
  [[9, 24], [3, 28], [19, 24], [23, 27], [37, 23], [44, 27], [30, 25], [25, 29]],
  [[12, 25], [8, 31], [20, 23], [24, 25], [36, 25], [37, 31], [28, 23], [25, 24]],
  [[18, 24], [23, 27], [13, 25], [9, 30], [28, 24], [31, 28], [34, 24], [40, 27]],
  [[20, 22], [19, 26], [17, 24], [23, 25], [27, 23], [23, 25], [35, 22], [34, 26]],
  [[15, 25], [11, 30], [10, 24], [5, 27], [34, 24], [41, 28], [29, 24], [26, 27]],
  [[10, 24], [5, 29], [17, 25], [21, 28], [36, 24], [42, 29], [32, 25], [28, 30]]
];

function horseSprite(coat: Coat, frame: number) {
  const p = new Pixels(), c = COATS[coat], pose = POSES[frame];
  const limb = (anchor: Point, knee: Point, hoof: Point, colour: string) => {
    p.line(anchor, knee, 3, INK); p.line(knee, hoof, 2, INK);
    p.line(anchor, knee, 2, colour); p.line(knee, hoof, 1, colour);
    p.rect(hoof[0] - 1, hoof[1], 3, 2, INK);
  };
  limb([15, 18], pose[2], pose[3], c.shade);
  limb([30, 18], pose[6], pose[7], c.shade);
  // A raised poll, pointed ears and downward-sloping face separate the head
  // from the rider, instead of merging them into one horizontal silhouette.
  p.polygon([[11, 13], [6, 13], [3, 10], [0, 11], [3, 15], [8, 17], [12, 16]], INK);
  p.rect(2, 12, 5, 1, c.shade);
  p.polygon([[8, 14], [12, 11], [26, 12], [29, 10], [32, 6], [34, 4], [37, 4],
    [40, 7], [41, 10], [43, 12], [45, 14], [44, 16], [41, 17], [39, 15],
    [37, 13], [35, 14], [35, 19], [31, 22],
    [25, 22], [20, 21], [13, 22], [9, 20]], INK);
  p.polygon([[9, 15], [13, 12], [26, 13], [30, 11], [33, 7], [35, 5], [37, 5],
    [39, 8], [40, 11], [42, 13], [44, 14], [43, 15], [41, 16], [39, 14],
    [37, 12], [34, 15], [33, 20], [28, 21],
    [22, 20], [14, 21], [10, 19]], c.main);
  p.polygon([[11, 18], [18, 19], [26, 18], [32, 16], [33, 20], [27, 21],
    [22, 20], [14, 21], [10, 19]], c.shade);
  p.line([14, 13], [25, 14], 2, c.light);
  p.line([34, 10], [36, 6], 2, c.light);
  p.line([39, 10], [41, 13], 1, c.light);
  p.polygon([[28, 12], [30, 8], [33, 5], [35, 4], [34, 7], [32, 10], [31, 13]], INK);
  p.polygon([[34, 5], [33, 1], [35, 2], [36, 5]], INK);
  p.polygon([[37, 5], [37, 0], [39, 2], [39, 6]], INK);
  p.rect(38, 2, 1, 2, c.light);
  p.rect(38, 8, 1, 1, INK); p.rect(42, 14, 1, 1, INK);
  // Noseband follows the angled face; reins connect to the rider's hands.
  p.line([41, 12], [39, 14], 1, PAPER);
  p.line([40, 13], [33, 11], 1, INK);
  limb([13, 19], pose[0], pose[1], c.main);
  limb([32, 19], pose[4], pose[5], c.main);
  // A flatter, angular back and a helmet set behind the ears keep the jockey
  // distinct from the horse. One bent trouser leg meets the stirrup and boot.
  p.rect(18, 14, 11, 6, INK); p.rect(19, 15, 9, 4, c.silk);
  p.rect(19, 18, 9, 1, PAPER);
  p.polygon([[20, 9], [24, 10], [25, 13], [22, 15], [26, 18], [25, 20],
    [20, 16], [19, 13]], INK);
  p.polygon([[21, 10], [23, 11], [23, 13], [21, 15], [24, 18], [23, 18], [20, 15]], PAPER);
  p.rect(24, 18, 4, 2, INK);
  p.polygon([[19, 7], [24, 3], [27, 4], [29, 7], [26, 10], [23, 12], [19, 10]], INK);
  p.polygon([[20, 7], [24, 4], [26, 5], [27, 7], [24, 10], [20, 9]], c.silk);
  p.line([26, 7], [29, 10], 3, INK); p.line([29, 10], [34, 11], 2, INK);
  p.line([26, 7], [29, 10], 2, c.silk); p.line([29, 10], [34, 11], 1, PAPER);
  p.rect(33, 11, 2, 1, "#FEB77E");
  p.rect(27, 3, 4, 4, INK); p.rect(28, 4, 3, 2, "#FEB77E");
  p.rect(30, 5, 2, 1, "#FEB77E");
  p.rect(25, 0, 6, 4, INK); p.rect(26, 1, 4, 2, c.silk);
  p.rect(26, 1, 2, 1, PAPER); p.rect(30, 3, 3, 1, INK);
  return p.render();
}

function trophySprite() {
  return `<path d="M4 3H0v5h1v2h4V8H3V5h1zM12 3h4v5h-1v2h-4V8h2V5h-1z" fill="${INK}"/>
    ${rect(1, 4, 3, 1, "#FEB77E")}${rect(1, 5, 1, 3, "#FEB77E")}${rect(2, 8, 2, 1, "#FEB77E")}
    ${rect(12, 4, 3, 1, "#FEB77E")}${rect(14, 5, 1, 3, "#FEB77E")}${rect(12, 8, 2, 1, "#FEB77E")}
    <path d="M3 1h10v7h-1v2h-2v2H9v4h4v3H3v-3h4v-4H6v-2H4V8H3z" fill="${INK}"/>
    <path d="M4 2h8v6h-1v1H9v2H7V9H5V8H4z" fill="#FEB77E"/>
    ${rect(4, 2, 8, 2, "#FCFDBF")}${rect(4, 4, 2, 3, "#FCFDBF")}
    ${rect(10, 4, 2, 3, "#CF8865")}${rect(7, 11, 2, 5, "#FEB77E")}
    ${rect(4, 17, 8, 1, "#FEB77E")}`;
}

function rect(x: number, y: number, w: number, h: number, fill: string, extra = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
}

function scenery(upperWon: boolean, lowerWon: boolean) {
  let s = rect(0, 0, 320, 180, "#A9BCAE");
  // Repeated small turf marks, original rails, and sandy tracks; no starting gates or official.
  for (let i = 0; i < 65; i++) {
    const x = (i * 71 + 11) % 320, y = (i * 29 + 4) % 180;
    s += rect(x, y, 2, 1, i % 2 ? "#95AD9B" : "#BACABD");
  }
  for (const [top, bottom] of [[35, 86], [104, 167]]) {
    s += rect(0, top, 320, bottom - top, "#E9DCC1");
    s += rect(0, top + 2, 320, 2, "#D0BD9B");
    s += rect(0, bottom - 2, 320, 2, "#D0BD9B");
    for (let x = 5; x < 320; x += 19) {
      s += rect(x, top + 10 + (x % 7), 2, 1, "#DDCBAA");
      s += rect(x + 5, bottom - 9 - (x % 11), 3, 1, "#DDCBAA");
    }
    // Checkered finish stripe, set back behind the horses.
    for (let y = top + 3; y < bottom - 2; y += 3) {
      s += rect(RACE_SCENE.finish, y, 3, Math.min(3, bottom - 2 - y), (y - top) % 6 ? "#776583" : PAPER);
      s += rect(RACE_SCENE.finish + 3, y, 3, Math.min(3, bottom - 2 - y), (y - top) % 6 ? PAPER : "#776583");
    }
    // Rail posts and a cream rail provide a quiet horizontal course boundary.
    for (let x = 10; x < 320; x += 26) {
      s += rect(x + 1, top - 7, 2, 8, "#82958A");
      s += rect(x, top - 8, 2, 8, PAPER);
    }
    s += rect(0, top - 8, 320, 2, PAPER);
    s += rect(0, top - 6, 320, 1, "#D9D7C6");
    s += rect(RACE_SCENE.finish + 7, top - 15, 2, 16, "#776583");
    const winner = top === 35 ? upperWon : lowerWon;
    const winnerColour = top === 35 ? "#3B0F70" : "#F76F5C";
    s += `<path data-finish-flag="" d="M${RACE_SCENE.finish + 9} ${top - 15}h11v3h-2v3h-9z" fill="${winner ? winnerColour : PAPER}"/>`;
  }
  // Tiny flowers use the same warm highlights as the racing silks.
  for (const [x, y] of [[18, 17], [23, 19], [111, 94], [117, 94], [302, 15]]) {
    s += rect(x, y, 3, 2, "#FEB77E") + rect(x + 1, y - 1, 1, 1, "#FCFDBF");
  }
  return s;
}

export function raceFrame(elapsed: number) {
  const p = RACE_SCENE;
  const duration = p.runSeconds + p.holdSeconds + p.fadeSeconds * 2 + p.restSeconds;
  const remainder = elapsed % duration;
  const time = remainder < 0 ? remainder + duration : remainder;
  const raceTime = Math.min(time, p.runSeconds);
  const fadeOutAt = p.runSeconds + p.holdSeconds;
  const fadeInAt = duration - p.fadeSeconds;
  const reset = time >= fadeOutAt + p.fadeSeconds;
  const progress = reset ? 0 : raceTime / p.runSeconds;
  const opacity = time < fadeOutAt ? 1 : time < fadeOutAt + p.fadeSeconds
    ? 1 - (time - fadeOutAt) / p.fadeSeconds : time < fadeInAt ? 0 : (time - fadeInAt) / p.fadeSeconds;
  return {
    opacity,
    awardProgress: !reset && time >= p.runSeconds ? Math.min(1, (time - p.runSeconds) / 0.24) : 0,
    upperWon: progress * RACERS[0].speed >= 1,
    lowerWon: progress >= 1,
    racers: RACERS.map(racer => {
      const frame = reset ? 0 : Math.floor(raceTime * 10 + racer.phase) % 6;
      const bob = [0, -1, -1, 0, 1, 0][frame];
      return { ...racer, frame, bob,
        x: Math.round(p.start + (p.finish - p.start) * progress * racer.speed) - 46,
        dust: time < p.runSeconds && progress > 0.03 ? (Math.floor(time * 7) + racer.phase) % 3 : -1
      };
    })
  };
}

/** Shared source for the animated lead, reduced-motion fallback, and SVG card image. */
export function renderThresholdRaceScene(prefix = "threshold-race", elapsed = RACE_SCENE.posterTime) {
  const state = raceFrame(elapsed);
  const sprites = (Object.keys(COATS) as Coat[]).flatMap(coat => POSES.map((_, frame) =>
    `<symbol id="${prefix}-${coat}-${frame}" viewBox="0 0 48 34">${horseSprite(coat, frame)}</symbol>`)).join("");
  const horses = state.racers.map(racer => `<g data-racer="${racer.id}" transform="translate(${racer.x} ${racer.feet})">
    <g data-dust="" fill="#BDA582" opacity="0.55">${rect(1, -2, 3, 1, "#BDA582")}${rect(-5, -4, 2, 2, "#BDA582")}</g>
    <path d="M10 0h24v1h3v1H7V1h3z" fill="#927D68" opacity="0.24"/>
    <use data-horse="" href="#${prefix}-${racer.coat}-${racer.frame}" width="48" height="34" y="${-32 + racer.bob}"/>
    ${racer.id === "upper-purple" || racer.id === "lower-coral" ? `<g data-trophy="" visibility="${state.awardProgress > 0 ? "visible" : "hidden"}" transform="translate(48 ${-21 - Math.round(state.awardProgress * 4)})"><use href="#${prefix}-trophy" width="16" height="20"/></g>` : ""}
  </g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 320 180" shape-rendering="crispEdges" role="img" aria-labelledby="${prefix}-title ${prefix}-description">
  <title id="${prefix}-title">The same horse, two different races</title>
  <desc id="${prefix}-description">Original pixel-art horses and jockeys race from left to right on two tracks. The coral horse keeps the same pace in both. A purple rival beats it on the upper track; it leads the more evenly matched field below. Each winner receives a pixel trophy at the finish. This is an illustration of relative competition, not numerical election results.</desc>
  <defs>${sprites}<symbol id="${prefix}-trophy" viewBox="0 0 16 20">${trophySprite()}</symbol></defs>${scenery(state.upperWon, state.lowerWon)}
  <g data-race-field="" opacity="${state.opacity}">${horses}</g>
  </svg>`.replace(/[ \t]+$/gm, "");
}
