import { useEffect, useRef, useState } from "react";

const BOX_WIDTH = 620;
const BOX_HEIGHT = 520;
const PARTICLE_RADIUS = 6;
const PARTICLE_COUNT = 250;
const PARTY_SPLIT = PARTICLE_COUNT / 2;
const MAX_DT_MS = 32;
const MIN_SPEED = 96;
const MAX_SPEED = 152;
const PARTY_COLORS = ["#3B0F70", "#F76F5C"] as const;

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: (typeof PARTY_COLORS)[number];
};

type CollisionStats = {
  total: number;
  sameColor: number;
};

type SimulationState = "idle" | "running" | "stopped";

function createRng(seed: number) {
  let value = seed >>> 0;

  return function next() {
    value += 0x6d2b79f5;
    let output = Math.imul(value ^ (value >>> 15), value | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);

    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

function getRandomSpeed(rng: () => number) {
  return MIN_SPEED + rng() * (MAX_SPEED - MIN_SPEED);
}

function createParticle(
  id: number,
  color: Particle["color"],
  particles: Particle[],
  rng: () => number
) {
  const radius = PARTICLE_RADIUS;

  for (let attempt = 0; attempt < 4000; attempt += 1) {
    const x = radius + rng() * (BOX_WIDTH - radius * 2);
    const y = radius + rng() * (BOX_HEIGHT - radius * 2);
    const angle = rng() * Math.PI * 2;
    const speed = getRandomSpeed(rng);
    const overlaps = particles.some((particle) => {
      const dx = particle.x - x;
      const dy = particle.y - y;

      return dx * dx + dy * dy < (radius * 2 + 1.5) ** 2;
    });

    if (!overlaps) {
      return {
        id,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color
      };
    }
  }

  const angle = rng() * Math.PI * 2;
  const speed = getRandomSpeed(rng);

  return {
    id,
    x: radius + rng() * (BOX_WIDTH - radius * 2),
    y: radius + rng() * (BOX_HEIGHT - radius * 2),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    color
  };
}

function createParticles(seed: number) {
  const rng = createRng(seed);
  const particles: Particle[] = [];

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const color = index < PARTY_SPLIT ? PARTY_COLORS[0] : PARTY_COLORS[1];
    particles.push(createParticle(index, color, particles, rng));
  }

  return particles;
}

function clampDelta(deltaMs: number) {
  return Math.min(deltaMs, MAX_DT_MS) / 1000;
}

function formatEffectiveParties(stats: CollisionStats) {
  if (stats.total === 0 || stats.sameColor === 0) {
    return "–";
  }

  return (stats.total / stats.sameColor).toFixed(2);
}

export default function EffectivePartiesCollisionInteractive() {
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const restartSeedRef = useRef(2);
  const particlesRef = useRef<Particle[]>(createParticles(1));
  const activeCollisionPairsRef = useRef<Set<string>>(new Set());
  const statsRef = useRef<CollisionStats>({ total: 0, sameColor: 0 });
  const [particles, setParticles] = useState<Particle[]>(() => particlesRef.current);
  const [stats, setStats] = useState<CollisionStats>(statsRef.current);
  const [simulationState, setSimulationState] = useState<SimulationState>("idle");

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  function step(timestamp: number) {
    const previousTimestamp = lastFrameTimeRef.current ?? timestamp;
    const dt = clampDelta(timestamp - previousTimestamp);

    lastFrameTimeRef.current = timestamp;

    const nextParticles = particlesRef.current.map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * dt,
      y: particle.y + particle.vy * dt
    }));

    for (const particle of nextParticles) {
      if (particle.x <= PARTICLE_RADIUS) {
        particle.x = PARTICLE_RADIUS;
        particle.vx = Math.abs(particle.vx);
      } else if (particle.x >= BOX_WIDTH - PARTICLE_RADIUS) {
        particle.x = BOX_WIDTH - PARTICLE_RADIUS;
        particle.vx = -Math.abs(particle.vx);
      }

      if (particle.y <= PARTICLE_RADIUS) {
        particle.y = PARTICLE_RADIUS;
        particle.vy = Math.abs(particle.vy);
      } else if (particle.y >= BOX_HEIGHT - PARTICLE_RADIUS) {
        particle.y = BOX_HEIGHT - PARTICLE_RADIUS;
        particle.vy = -Math.abs(particle.vy);
      }
    }

    const nextActivePairs = new Set<string>();
    let totalCollisions = statsRef.current.total;
    let sameColorCollisions = statsRef.current.sameColor;

    for (let i = 0; i < nextParticles.length; i += 1) {
      const particleA = nextParticles[i];

      for (let j = i + 1; j < nextParticles.length; j += 1) {
        const particleB = nextParticles[j];
        const dx = particleB.x - particleA.x;
        const dy = particleB.y - particleA.y;
        const distanceSquared = dx * dx + dy * dy;
        const minDistance = PARTICLE_RADIUS * 2;
        const pairKey = `${particleA.id}:${particleB.id}`;

        if (distanceSquared > minDistance * minDistance) {
          continue;
        }

        nextActivePairs.add(pairKey);

        const distance = Math.sqrt(distanceSquared) || 0.0001;
        const nx = dx / distance;
        const ny = dy / distance;
        const overlap = minDistance - distance;

        if (overlap > 0) {
          particleA.x -= nx * (overlap / 2);
          particleA.y -= ny * (overlap / 2);
          particleB.x += nx * (overlap / 2);
          particleB.y += ny * (overlap / 2);
        }

        const relativeVelocity =
          (particleA.vx - particleB.vx) * nx + (particleA.vy - particleB.vy) * ny;

        if (relativeVelocity > 0) {
          particleA.vx -= relativeVelocity * nx;
          particleA.vy -= relativeVelocity * ny;
          particleB.vx += relativeVelocity * nx;
          particleB.vy += relativeVelocity * ny;
        }

        if (!activeCollisionPairsRef.current.has(pairKey)) {
          totalCollisions += 1;

          if (particleA.color === particleB.color) {
            sameColorCollisions += 1;
          }
        }
      }
    }

    particlesRef.current = nextParticles;
    activeCollisionPairsRef.current = nextActivePairs;
    statsRef.current = {
      total: totalCollisions,
      sameColor: sameColorCollisions
    };

    setParticles(nextParticles);
    setStats(statsRef.current);
    frameRef.current = requestAnimationFrame(step);
  }

  function startSimulation() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    const initialParticles = createParticles(restartSeedRef.current);
    restartSeedRef.current += 1;

    particlesRef.current = initialParticles;
    activeCollisionPairsRef.current = new Set();
    statsRef.current = { total: 0, sameColor: 0 };
    lastFrameTimeRef.current = null;

    setParticles(initialParticles);
    setStats(statsRef.current);
    setSimulationState("running");

    frameRef.current = requestAnimationFrame(step);
  }

  function stopSimulation() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    setSimulationState("stopped");
  }

  function handleButtonClick() {
    if (simulationState === "running") {
      stopSimulation();
      return;
    }

    startSimulation();
  }

  function getButtonLabel() {
    if (simulationState === "running") {
      return "Stop";
    }

    if (simulationState === "stopped") {
      return "Restart";
    }

    return "Start";
  }

  return (
    <div className="not-prose my-10 w-full max-w-none sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-12 lg:w-[calc(100%+6rem)]">
      <section className="interactive-panel overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="border-b border-black/10 p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="eyebrow">Collision Model</p>
            <p className="mt-4 text-sm leading-6 text-black/70">
              Half of the particles are purple and half orange. As they collide, the total
              collisions divided by those of the same colour converges on the effective number of
              parties, here N<sub>2</sub> = 2.
            </p>

            <div className="mt-8 space-y-6">
              <div className="border-b border-black/10 pb-6">
                <p className="flex flex-nowrap items-baseline justify-center gap-2 whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums text-[#111111] sm:text-4xl">
                  <span className="font-medium tracking-normal text-[#111111]">
                    N<sub>2</sub> =
                  </span>
                  <span className="text-[#111111]">{formatEffectiveParties(stats)}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleButtonClick}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#F76F5C] px-5 py-3 text-sm font-semibold tracking-[0.08em] text-white transition-colors duration-150 hover:bg-[#e56553] focus:outline-none focus:ring-2 focus:ring-[#F76F5C] focus:ring-offset-2"
              >
                {getButtonLabel()}
              </button>
            </div>
          </div>

          <div className="p-1 sm:p-2 lg:p-3">
            <div
              className="interactive-subpanel aspect-[31/26] w-full overflow-hidden p-0"
              style={{ background: "rgba(17,17,17,0.035)" }}
            >
              <svg
                viewBox={`0 0 ${BOX_WIDTH} ${BOX_HEIGHT}`}
                className="block h-full w-full"
                role="img"
                aria-label="A box of moving particles used to estimate the effective number of parties from collision frequencies"
              >
                {particles.map((particle) => (
                  <circle
                    key={particle.id}
                    cx={particle.x}
                    cy={particle.y}
                    r={PARTICLE_RADIUS}
                    fill={particle.color}
                    opacity="0.96"
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
