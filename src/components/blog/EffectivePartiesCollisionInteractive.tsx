import { useEffect, useRef, useState } from "react";

const BOX_WIDTH = 620;
const BOX_HEIGHT = 520;
const PARTICLE_RADIUS = 6;
const PARTICLE_COUNT = 200;
const SHARE_STEPS = 100;
const PARTICLES_PER_STEP = PARTICLE_COUNT / SHARE_STEPS;
const DEFAULT_ORANGE_STEPS = SHARE_STEPS / 2;
const MAX_DT_MS = 32;
const MIN_SPEED = 96;
const MAX_SPEED = 152;
const PURPLE = "#3B0F70";
const ORANGE = "#F76F5C";
const PARTY_COLORS = [PURPLE, ORANGE] as const;

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

type SimulationState = "idle" | "running" | "paused";

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
  rng: () => number,
  boxWidth: number,
  boxHeight: number
) {
  const radius = PARTICLE_RADIUS;

  for (let attempt = 0; attempt < 4000; attempt += 1) {
    const x = radius + rng() * (boxWidth - radius * 2);
    const y = radius + rng() * (boxHeight - radius * 2);
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
    x: radius + rng() * (boxWidth - radius * 2),
    y: radius + rng() * (boxHeight - radius * 2),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    color
  };
}

function createParticles(
  seed: number,
  orangeCount: number,
  boxWidth: number,
  boxHeight: number
) {
  const rng = createRng(seed);
  const particles: Particle[] = [];
  const colors: Particle["color"][] = Array.from({ length: PARTICLE_COUNT }, (_, index) =>
    index < orangeCount ? ORANGE : PURPLE
  );

  for (let index = colors.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const currentColor = colors[index];

    colors[index] = colors[swapIndex];
    colors[swapIndex] = currentColor;
  }

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    particles.push(createParticle(index, colors[index], particles, rng, boxWidth, boxHeight));
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

function formatCount(count: number) {
  return count.toLocaleString("en-GB");
}

function getExpectedEffectiveParties(orangeCount: number) {
  const orangeShare = orangeCount / PARTICLE_COUNT;
  const purpleShare = 1 - orangeShare;

  return 1 / (orangeShare * orangeShare + purpleShare * purpleShare);
}

export default function EffectivePartiesCollisionInteractive() {
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const restartSeedRef = useRef(2);
  const simulationBoxRef = useRef<HTMLDivElement | null>(null);
  const [orangeSteps, setOrangeSteps] = useState(DEFAULT_ORANGE_STEPS);
  const orangeCount = orangeSteps * PARTICLES_PER_STEP;
  const [boxSize, setBoxSize] = useState({ width: BOX_WIDTH, height: BOX_HEIGHT });
  const particlesRef = useRef<Particle[]>(
    createParticles(1, orangeCount, BOX_WIDTH, BOX_HEIGHT)
  );
  const activeCollisionPairsRef = useRef<Set<string>>(new Set());
  const statsRef = useRef<CollisionStats>({ total: 0, sameColor: 0 });
  const [particles, setParticles] = useState<Particle[]>(() => particlesRef.current);
  const [stats, setStats] = useState<CollisionStats>(statsRef.current);
  const [simulationState, setSimulationState] = useState<SimulationState>("idle");
  const purpleCount = PARTICLE_COUNT - orangeCount;
  const purplePercentage = ((purpleCount / PARTICLE_COUNT) * 100).toFixed(0);
  const orangePercentage = ((orangeCount / PARTICLE_COUNT) * 100).toFixed(0);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const element = simulationBoxRef.current;

    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const nextWidth = Math.max(PARTICLE_RADIUS * 2 + 1, Math.round(entry.contentRect.width));
      const nextHeight = Math.max(PARTICLE_RADIUS * 2 + 1, Math.round(entry.contentRect.height));

      setBoxSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return { width: nextWidth, height: nextHeight };
      });
    });

    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    resetSimulation(simulationState === "running" ? "running" : "idle");
  }, [orangeCount, boxSize.height, boxSize.width]);

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
      } else if (particle.x >= boxSize.width - PARTICLE_RADIUS) {
        particle.x = boxSize.width - PARTICLE_RADIUS;
        particle.vx = -Math.abs(particle.vx);
      }

      if (particle.y <= PARTICLE_RADIUS) {
        particle.y = PARTICLE_RADIUS;
        particle.vy = Math.abs(particle.vy);
      } else if (particle.y >= boxSize.height - PARTICLE_RADIUS) {
        particle.y = boxSize.height - PARTICLE_RADIUS;
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

  function resetSimulation(nextState: SimulationState) {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    const initialParticles = createParticles(
      restartSeedRef.current,
      orangeCount,
      boxSize.width,
      boxSize.height
    );
    restartSeedRef.current += 1;

    particlesRef.current = initialParticles;
    activeCollisionPairsRef.current = new Set();
    statsRef.current = { total: 0, sameColor: 0 };
    lastFrameTimeRef.current = null;

    setParticles(initialParticles);
    setStats(statsRef.current);
    setSimulationState(nextState);

    if (nextState === "running") {
      frameRef.current = requestAnimationFrame(step);
    } else {
      frameRef.current = null;
    }
  }

  function startSimulation() {
    resetSimulation("running");
  }

  function pauseSimulation() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    setSimulationState("paused");
  }

  function resumeSimulation() {
    lastFrameTimeRef.current = null;
    setSimulationState("running");
    frameRef.current = requestAnimationFrame(step);
  }

  function handlePlayPauseClick() {
    if (simulationState === "running") {
      pauseSimulation();
      return;
    }

    if (simulationState === "paused") {
      resumeSimulation();
      return;
    }

    startSimulation();
  }

  function handleRestartClick() {
    resetSimulation(simulationState === "running" ? "running" : "idle");
  }

  const expectedN2 = getExpectedEffectiveParties(orangeCount);
  const observedN2 = formatEffectiveParties(stats);
  const playPauseLabel = simulationState === "running" ? "Pause" : "Play";

  return (
    <div className="not-prose my-10 w-full max-w-none sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-12 lg:w-[calc(100%+6rem)]">
      <section className="interactive-panel overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-stretch">
          <div className="border-b border-black/10 p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="eyebrow">Collision Model</p>

            <div className="mt-6 space-y-6">
              <div className="space-y-3 border-b border-black/10 pb-6">
                <input
                  id="orange-share"
                  type="range"
                  min="0"
                  max={SHARE_STEPS}
                  step="1"
                  value={orangeSteps}
                  onChange={(event) => setOrangeSteps(Number(event.target.value))}
                  aria-label="Orange share"
                  className="w-full accent-[#F76F5C]"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="block h-6 w-6 rounded-full"
                      style={{ backgroundColor: PURPLE }}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold tabular-nums text-[#111111]">
                      {purplePercentage}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-[#111111]">
                      {orangePercentage}%
                    </span>
                    <span
                      className="block h-6 w-6 rounded-full"
                      style={{ backgroundColor: ORANGE }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              <div className="border-b border-black/10 pb-6">
                <p className="text-sm font-semibold tracking-tight text-[#111111] sm:text-base">
                  Expected N<sub>2</sub>:{" "}
                  <span className="tabular-nums">{expectedN2.toFixed(2)}</span>
                </p>
                <p className="mt-2 text-sm font-semibold tracking-tight text-[#111111] sm:text-base">
                  Observed N<sub>2</sub>: <span className="tabular-nums">{observedN2}</span>
                </p>
                <div className="mt-4 space-y-2 border-t border-black/10 pt-4">
                  <p className="text-sm font-semibold tracking-tight text-[#111111] sm:text-base">
                    Total:{" "}
                    <span className="tabular-nums text-[#111111]">
                      {formatCount(stats.total)}
                    </span>
                  </p>
                  <p className="text-sm font-semibold tracking-tight text-[#111111] sm:text-base">
                    Similar:{" "}
                    <span className="tabular-nums text-[#111111]">
                      {formatCount(stats.sameColor)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handlePlayPauseClick}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#F76F5C] px-5 py-3 text-sm font-semibold tracking-[0.08em] text-white transition-colors duration-150 hover:bg-[#e56553] focus:outline-none focus:ring-2 focus:ring-[#F76F5C] focus:ring-offset-2"
                >
                  {playPauseLabel}
                </button>

                <button
                  type="button"
                  onClick={handleRestartClick}
                  className="inline-flex w-full items-center justify-center rounded-full border border-black/15 px-5 py-3 text-sm font-semibold tracking-[0.08em] text-[#111111] transition-colors duration-150 hover:border-[#F76F5C] hover:text-[#F76F5C] focus:outline-none focus:ring-2 focus:ring-[#F76F5C] focus:ring-offset-2"
                >
                  Restart
                </button>
              </div>
            </div>
          </div>

          <div className="p-1 sm:p-2 lg:flex lg:p-3">
            <div
              ref={simulationBoxRef}
              className="interactive-subpanel h-full min-h-[320px] w-full overflow-hidden p-0 lg:min-h-0"
              style={{ background: "rgba(17,17,17,0.035)" }}
            >
              <svg
                viewBox={`0 0 ${boxSize.width} ${boxSize.height}`}
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
