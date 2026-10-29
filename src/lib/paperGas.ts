/** Twice the interactive's 6px radius, measured in CSS pixels on every screen. */
export const PAPER_GAS = { radius: 12, maxCount: 100, step: 1 / 120 } as const;
export const GAS_COLORS = ["#F76F5C", "#3B0F70"] as const;

export type GasParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: 0 | 1;
};

export function createGas(width: number, height: number): GasParticle[] {
  const radius = PAPER_GAS.radius;
  if (width < radius * 2 || height < radius * 2) return [];
  // Keep the disks large on phones without overcrowding the smaller frame.
  const count = Math.min(PAPER_GAS.maxCount, Math.floor(width * height / 4800));
  let seed = 17;
  const random = () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const particles: GasParticle[] = [];
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 4000; attempt++) {
      const x = radius + random() * (width - radius * 2);
      const y = radius + random() * (height - radius * 2);
      if (particles.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < (radius * 2 + 2) ** 2)) continue;
      const angle = random() * Math.PI * 2;
      const speed = 96 + random() * 56;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color: i % 2 as 0 | 1 });
      break;
    }
  }
  return particles;
}

function contain(p: GasParticle, width: number, height: number) {
  const r = PAPER_GAS.radius;
  if (p.x < r) { p.x = r; p.vx = Math.abs(p.vx); }
  if (p.x > width - r) { p.x = width - r; p.vx = -Math.abs(p.vx); }
  if (p.y < r) { p.y = r; p.vy = Math.abs(p.vy); }
  if (p.y > height - r) { p.y = height - r; p.vy = -Math.abs(p.vy); }
}

/** Equal-mass elastic collisions, matching the article's interactive. */
export function stepGas(particles: GasParticle[], width: number, height: number, dt: number) {
  const diameter = PAPER_GAS.radius * 2;
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    contain(p, width, height);
  }
  // A second pass resolves neighbours displaced by another collision in dense patches.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const squared = dx * dx + dy * dy;
        if (squared >= diameter * diameter) continue;
        const distance = Math.sqrt(squared);
        const nx = distance ? dx / distance : 1;
        const ny = distance ? dy / distance : 0;
        const overlap = (diameter - distance) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
        const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (approach > 0) {
          a.vx -= approach * nx;
          a.vy -= approach * ny;
          b.vx += approach * nx;
          b.vy += approach * ny;
        }
      }
    }
    for (const p of particles) contain(p, width, height);
  }
}
