import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent
} from "react";

const ACCENT = "#F76F5C";
const INK = "#111111";
const DEFAULT_SHARES = [34, 33, 33] as const;
const PARTIES = ["Party 1", "Party 2", "Party 3"] as const;
const VIEW_MODES = [
  { id: "flat", label: "Flat" },
  { id: "surface", label: "3D" }
] as const;
const SHARE_STEP = 0.1;
const CHART_WIDTH = 640;
const CHART_HEIGHT = 510;
const VERTICES = [
  { x: 320, y: 42 },
  { x: 46, y: 456 },
  { x: 594, y: 456 }
] as const;
const GRID_TICKS = [20, 40, 60, 80] as const;
const FLAT_HEATMAP_RESOLUTION = 38;
const HEATMAP_OPACITY = 0.52;
const SURFACE_PLAIN_OPACITY = 0.82;
const MAGMA_COLOUR_RANGE = {
  start: 0.2,
  end: 0.7
} as const;
const MAGMA_STOPS = [
  { amount: 0, colour: [0, 0, 4] },
  { amount: 0.1, colour: [20, 14, 54] },
  { amount: 0.2, colour: [59, 15, 112] },
  { amount: 0.3, colour: [100, 26, 128] },
  { amount: 0.4, colour: [140, 41, 129] },
  { amount: 0.5, colour: [181, 54, 122] },
  { amount: 0.6, colour: [222, 73, 104] },
  { amount: 0.7, colour: [246, 110, 91] },
  { amount: 0.8, colour: [254, 159, 109] },
  { amount: 0.9, colour: [254, 207, 146] },
  { amount: 1, colour: [252, 253, 191] }
] as const;
const SURFACE_RESOLUTION = 42;
const SURFACE_HEIGHT_SCALE = 0.42;
const SURFACE_VERTICES = [
  { x: 0, z: -1.18 },
  { x: -1.36, z: 1.08 },
  { x: 1.36, z: 1.08 }
] as const;
const SURFACE_DRAG_THRESHOLD = 5;
const SURFACE_ORBIT_DRAG_SPEED = 0.008;
const SURFACE_INITIAL_ORBIT = {
  phi: 1.15,
  radius: 6.34,
  theta: 0
} as const;
const SURFACE_ORBIT_TARGET = {
  x: 0,
  y: 0.34,
  z: 0.1
} as const;

type Point = {
  x: number;
  y: number;
};

type FlatHeatmapCell = {
  colour: string;
  id: string;
  points: string;
};

type SurfacePoint = {
  x: number;
  y: number;
  z: number;
};

type SurfaceBasePoint = {
  x: number;
  z: number;
};

type BarycentricWeights = [number, number, number];
type ViewMode = (typeof VIEW_MODES)[number]["id"];
type ColourMode = "plain" | "effective";
type ThreeModule = typeof import("three");

type SurfaceOrbit = {
  phi: number;
  radius: number;
  theta: number;
};

type SurfaceRuntime = {
  THREE: ThreeModule;
  camera: import("three").PerspectiveCamera;
  cameraTarget: import("three").Vector3;
  labelMaterials: import("three").SpriteMaterial[];
  labelTextures: import("three").CanvasTexture[];
  marker: import("three").Mesh;
  orbit: SurfaceOrbit;
  raycaster: import("three").Raycaster;
  renderer: import("three").WebGLRenderer;
  scene: import("three").Scene;
  stem: import("three").Line;
  surface: import("three").Mesh<import("three").BufferGeometry, import("three").MeshLambertMaterial>;
  pointer: import("three").Vector2;
  render: () => void;
  resizeObserver: ResizeObserver;
};

type SurfaceDragState = {
  hasDragged: boolean;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPhi: number;
  startTheta: number;
};

function interpolate(start: Point, end: Point, amount: number) {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount
  };
}

function dot(left: Point, right: Point) {
  return left.x * right.x + left.y * right.y;
}

function subtract(left: Point, right: Point) {
  return {
    x: left.x - right.x,
    y: left.y - right.y
  };
}

function add(left: Point, right: Point) {
  return {
    x: left.x + right.x,
    y: left.y + right.y
  };
}

function scale(point: Point, factor: number) {
  return {
    x: point.x * factor,
    y: point.y * factor
  };
}

function getBarycentricPoint(shares: number[]) {
  return getBarycentricPointFromWeights(shares.map((share) => share / 100));
}

function getBarycentricPointFromWeights(weights: number[]) {
  return weights.reduce(
    (point, share, index) => ({
      x: point.x + share * VERTICES[index].x,
      y: point.y + share * VERTICES[index].y
    }),
    { x: 0, y: 0 }
  );
}

function formatPointForSvg(point: Point) {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

function formatHeatmapPoints(weights: BarycentricWeights[]) {
  return weights
    .map((weightSet) => formatPointForSvg(getBarycentricPointFromWeights(weightSet)))
    .join(" ");
}

function getAverageWeights(weightSets: BarycentricWeights[]): BarycentricWeights {
  return [0, 1, 2].map((index) => {
    return (
      weightSets.reduce((sum, weights) => sum + weights[index], 0) / weightSets.length
    );
  }) as BarycentricWeights;
}

function getMagmaColour(amount: number) {
  const clampedAmount = clamp(amount, 0, 1);
  const nextStopIndex = MAGMA_STOPS.findIndex((stop) => stop.amount >= clampedAmount);

  if (nextStopIndex <= 0) {
    return rgbToHex(MAGMA_STOPS[0].colour);
  }

  const nextStop = MAGMA_STOPS[nextStopIndex];
  const previousStop = MAGMA_STOPS[nextStopIndex - 1];
  const stopAmount =
    (clampedAmount - previousStop.amount) / (nextStop.amount - previousStop.amount);

  return rgbToHex(
    previousStop.colour.map((channel, index) => {
      return channel + (nextStop.colour[index] - channel) * stopAmount;
    })
  );
}

function rgbToHex(channels: readonly number[]) {
  return `#${channels
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function getEffectivePartyColour(weights: BarycentricWeights) {
  const effectiveParties = getEffectivePartiesFromWeights(weights);
  const normalisedParties = clamp((effectiveParties - 1) / 2, 0, 1);
  const magmaAmount =
    MAGMA_COLOUR_RANGE.start +
    normalisedParties * (MAGMA_COLOUR_RANGE.end - MAGMA_COLOUR_RANGE.start);

  return getMagmaColour(magmaAmount);
}

function getFlatHeatmapCells() {
  const cells: FlatHeatmapCell[] = [];

  for (let party1 = 0; party1 < FLAT_HEATMAP_RESOLUTION; party1 += 1) {
    for (let party2 = 0; party2 < FLAT_HEATMAP_RESOLUTION - party1; party2 += 1) {
      const party3 = FLAT_HEATMAP_RESOLUTION - party1 - party2;
      const first: BarycentricWeights = [
        party1 / FLAT_HEATMAP_RESOLUTION,
        party2 / FLAT_HEATMAP_RESOLUTION,
        party3 / FLAT_HEATMAP_RESOLUTION
      ];
      const second: BarycentricWeights = [
        (party1 + 1) / FLAT_HEATMAP_RESOLUTION,
        party2 / FLAT_HEATMAP_RESOLUTION,
        (party3 - 1) / FLAT_HEATMAP_RESOLUTION
      ];
      const third: BarycentricWeights = [
        party1 / FLAT_HEATMAP_RESOLUTION,
        (party2 + 1) / FLAT_HEATMAP_RESOLUTION,
        (party3 - 1) / FLAT_HEATMAP_RESOLUTION
      ];
      const firstCellWeights = [first, second, third];

      cells.push({
        colour: getEffectivePartyColour(getAverageWeights(firstCellWeights)),
        id: `${party1}-${party2}-a`,
        points: formatHeatmapPoints(firstCellWeights)
      });

      if (party1 + party2 < FLAT_HEATMAP_RESOLUTION - 1) {
        const fourth: BarycentricWeights = [
          (party1 + 1) / FLAT_HEATMAP_RESOLUTION,
          (party2 + 1) / FLAT_HEATMAP_RESOLUTION,
          (party3 - 2) / FLAT_HEATMAP_RESOLUTION
        ];
        const secondCellWeights = [second, fourth, third];

        cells.push({
          colour: getEffectivePartyColour(getAverageWeights(secondCellWeights)),
          id: `${party1}-${party2}-b`,
          points: formatHeatmapPoints(secondCellWeights)
        });
      }
    }
  }

  return cells;
}

function getEffectiveParties(shares: number[]) {
  return getEffectivePartiesFromWeights(shares.map((share) => share / 100));
}

function getEffectivePartiesFromWeights(weights: number[]) {
  const concentration = weights.reduce((total, weight) => {
    return total + weight * weight;
  }, 0);

  return 1 / concentration;
}

function roundToTotal(values: number[], total: number) {
  const floors = values.map((value) => Math.floor(value));
  let remainder = total - floors.reduce((sum, value) => sum + value, 0);
  const order = values
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((left, right) => right.fraction - left.fraction);

  for (let index = 0; index < order.length && remainder > 0; index += 1) {
    floors[order[index].index] += 1;
    remainder -= 1;
  }

  return floors;
}

function getLockedTotal(currentShares: number[], lockedParties: boolean[]) {
  return currentShares.reduce((total, share, index) => {
    return lockedParties[index] ? total + share : total;
  }, 0);
}

function getUnlockedIndexes(lockedParties: boolean[]) {
  return lockedParties
    .map((locked, index) => ({ index, locked }))
    .filter(({ locked }) => !locked)
    .map(({ index }) => index);
}

function rebalanceShares(
  currentShares: number[],
  lockedParties: boolean[],
  changedIndex: number,
  nextShare: number
) {
  if (lockedParties[changedIndex]) {
    return currentShares;
  }

  const unlockedIndexes = getUnlockedIndexes(lockedParties);
  const lockedTotal = getLockedTotal(currentShares, lockedParties);
  const availableShare = clamp(100 - lockedTotal, 0, 100);

  if (unlockedIndexes.length === 0) {
    return currentShares;
  }

  const otherIndexes = unlockedIndexes.filter((index) => index !== changedIndex);
  const clampedShare =
    otherIndexes.length === 0 ? availableShare : clamp(nextShare, 0, availableShare);
  const remainingShare = availableShare - clampedShare;
  const otherTotal = otherIndexes.reduce((sum, index) => sum + currentShares[index], 0);
  const rawOtherShares =
    otherTotal === 0
      ? otherIndexes.map(() => remainingShare / otherIndexes.length)
      : otherIndexes.map((index) => (currentShares[index] / otherTotal) * remainingShare);
  const nextShares = [...currentShares];

  nextShares[changedIndex] = clampedShare;
  otherIndexes.forEach((partyIndex, shareIndex) => {
    nextShares[partyIndex] = rawOtherShares[shareIndex];
  });

  return nextShares;
}

function applyLockedShareTarget(
  currentShares: number[],
  lockedParties: boolean[],
  targetShares: number[]
) {
  const unlockedIndexes = getUnlockedIndexes(lockedParties);

  if (unlockedIndexes.length === 0) {
    return currentShares;
  }

  const lockedTotal = getLockedTotal(currentShares, lockedParties);
  const availableShare = clamp(100 - lockedTotal, 0, 100);
  const targetUnlockedTotal = unlockedIndexes.reduce(
    (sum, index) => sum + Math.max(0, targetShares[index] ?? 0),
    0
  );
  const currentUnlockedTotal = unlockedIndexes.reduce(
    (sum, index) => sum + Math.max(0, currentShares[index] ?? 0),
    0
  );
  const sourceTotal =
    targetUnlockedTotal > 0
      ? targetUnlockedTotal
      : currentUnlockedTotal > 0
        ? currentUnlockedTotal
        : unlockedIndexes.length;
  const nextShares = [...currentShares];

  unlockedIndexes.forEach((index) => {
    const sourceShare =
      targetUnlockedTotal > 0
        ? Math.max(0, targetShares[index] ?? 0)
        : currentUnlockedTotal > 0
          ? Math.max(0, currentShares[index] ?? 0)
          : 1;

    nextShares[index] = (sourceShare / sourceTotal) * availableShare;
  });

  return nextShares;
}

function getConstantShareLine(index: number, share: number) {
  const amount = share / 100;
  const [firstOtherIndex, secondOtherIndex] = [0, 1, 2].filter(
    (partyIndex) => partyIndex !== index
  );

  return {
    start: interpolate(VERTICES[firstOtherIndex], VERTICES[index], amount),
    end: interpolate(VERTICES[secondOtherIndex], VERTICES[index], amount)
  };
}

function getSvgPoint(chart: SVGSVGElement, clientX: number, clientY: number) {
  const rect = chart.getBoundingClientRect();
  const scaleX = CHART_WIDTH / rect.width;
  const scaleY = CHART_HEIGHT / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function getClosestPointOnTriangle(point: Point, a: Point, b: Point, c: Point) {
  const ab = subtract(b, a);
  const ac = subtract(c, a);
  const ap = subtract(point, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);

  if (d1 <= 0 && d2 <= 0) {
    return { point: a, weights: [1, 0, 0] };
  }

  const bp = subtract(point, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);

  if (d3 >= 0 && d4 <= d3) {
    return { point: b, weights: [0, 1, 0] };
  }

  const vc = d1 * d4 - d3 * d2;

  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const amount = d1 / (d1 - d3);

    return {
      point: add(a, scale(ab, amount)),
      weights: [1 - amount, amount, 0]
    };
  }

  const cp = subtract(point, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);

  if (d6 >= 0 && d5 <= d6) {
    return { point: c, weights: [0, 0, 1] };
  }

  const vb = d5 * d2 - d1 * d6;

  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const amount = d2 / (d2 - d6);

    return {
      point: add(a, scale(ac, amount)),
      weights: [1 - amount, 0, amount]
    };
  }

  const va = d3 * d6 - d5 * d4;

  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const bc = subtract(c, b);
    const amount = (d4 - d3) / (d4 - d3 + (d5 - d6));

    return {
      point: add(b, scale(bc, amount)),
      weights: [0, 1 - amount, amount]
    };
  }

  const denominator = 1 / (va + vb + vc);
  const v = vb * denominator;
  const w = vc * denominator;
  const u = 1 - v - w;

  return {
    point: {
      x: a.x * u + b.x * v + c.x * w,
      y: a.y * u + b.y * v + c.y * w
    },
    weights: [u, v, w]
  };
}

function getWeightsFromShares(shares: number[]): BarycentricWeights {
  const total = shares.reduce((sum, share) => sum + share, 0) || 100;

  return [shares[0] / total, shares[1] / total, shares[2] / total];
}

function getSurfaceBasePoint(weights: BarycentricWeights): SurfaceBasePoint {
  return weights.reduce(
    (point, weight, index) => ({
      x: point.x + weight * SURFACE_VERTICES[index].x,
      z: point.z + weight * SURFACE_VERTICES[index].z
    }),
    { x: 0, z: 0 }
  );
}

function getSurfacePoint(weights: BarycentricWeights): SurfacePoint {
  const basePoint = getSurfaceBasePoint(weights);

  return {
    ...basePoint,
    y: (getEffectivePartiesFromWeights(weights) - 1) * SURFACE_HEIGHT_SCALE
  };
}

function getSurfaceWeightsFromBasePoint(point: SurfaceBasePoint): BarycentricWeights {
  const [a, b, c] = SURFACE_VERTICES;
  const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
  const party1 = ((b.z - c.z) * (point.x - c.x) + (c.x - b.x) * (point.z - c.z)) / denominator;
  const party2 = ((c.z - a.z) * (point.x - c.x) + (a.x - c.x) * (point.z - c.z)) / denominator;
  const party3 = 1 - party1 - party2;

  return [party1, party2, party3];
}

function createSurfaceMesh(THREE: ThreeModule, isColourCoded: boolean) {
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  const vertexLookup = new Map<string, number>();

  for (let party1 = 0; party1 <= SURFACE_RESOLUTION; party1 += 1) {
    for (let party2 = 0; party2 <= SURFACE_RESOLUTION - party1; party2 += 1) {
      const party3 = SURFACE_RESOLUTION - party1 - party2;
      const weights: BarycentricWeights = [
        party1 / SURFACE_RESOLUTION,
        party2 / SURFACE_RESOLUTION,
        party3 / SURFACE_RESOLUTION
      ];
      const point = getSurfacePoint(weights);
      const vertexIndex = positions.length / 3;
      const colour = new THREE.Color(getEffectivePartyColour(weights));

      vertexLookup.set(`${party1}:${party2}`, vertexIndex);
      positions.push(point.x, point.y, point.z);
      colours.push(colour.r, colour.g, colour.b);
    }
  }

  for (let party1 = 0; party1 < SURFACE_RESOLUTION; party1 += 1) {
    for (let party2 = 0; party2 < SURFACE_RESOLUTION - party1; party2 += 1) {
      const first = vertexLookup.get(`${party1}:${party2}`);
      const second = vertexLookup.get(`${party1 + 1}:${party2}`);
      const third = vertexLookup.get(`${party1}:${party2 + 1}`);

      if (first === undefined || second === undefined || third === undefined) {
        continue;
      }

      indices.push(first, second, third);

      if (party1 + party2 < SURFACE_RESOLUTION - 1) {
        const fourth = vertexLookup.get(`${party1 + 1}:${party2 + 1}`);

        if (fourth !== undefined) {
          indices.push(second, fourth, third);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      color: isColourCoded ? 0xffffff : 0xf2f2f1,
      depthWrite: !isColourCoded,
      opacity: isColourCoded ? HEATMAP_OPACITY : SURFACE_PLAIN_OPACITY,
      side: THREE.DoubleSide,
      transparent: true,
      vertexColors: isColourCoded
    })
  );
}

function createSurfaceGrid(THREE: ThreeModule) {
  const group = new THREE.Group();
  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0x111111,
    depthTest: false,
    depthWrite: false,
    opacity: 0.11,
    transparent: true
  });
  const outlineMaterial = new THREE.LineBasicMaterial({
    color: 0x111111,
    depthTest: false,
    depthWrite: false,
    opacity: 0.34,
    transparent: true
  });
  const sampleCount = 38;

  for (const tick of GRID_TICKS) {
    const fixedShare = tick / 100;

    for (let partyIndex = 0; partyIndex < 3; partyIndex += 1) {
      const otherIndexes = [0, 1, 2].filter((index) => index !== partyIndex);
      const points = Array.from({ length: sampleCount + 1 }, (_value, sampleIndex) => {
        const amount = sampleIndex / sampleCount;
        const weights = [0, 0, 0] as BarycentricWeights;

        weights[partyIndex] = fixedShare;
        weights[otherIndexes[0]] = (1 - fixedShare) * (1 - amount);
        weights[otherIndexes[1]] = (1 - fixedShare) * amount;

        const point = getSurfacePoint(weights);

        return new THREE.Vector3(point.x, point.y + 0.012, point.z);
      });
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, gridMaterial);

      line.renderOrder = 2;
      group.add(line);
    }
  }

  for (let partyIndex = 0; partyIndex < 3; partyIndex += 1) {
    const nextPartyIndex = (partyIndex + 1) % 3;
    const points = Array.from({ length: sampleCount + 1 }, (_value, sampleIndex) => {
      const amount = sampleIndex / sampleCount;
      const weights = [0, 0, 0] as BarycentricWeights;

      weights[partyIndex] = 1 - amount;
      weights[nextPartyIndex] = amount;

      const point = getSurfacePoint(weights);

      return new THREE.Vector3(point.x, point.y + 0.016, point.z);
    });
    const outline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      outlineMaterial
    );

    outline.renderOrder = 2;
    group.add(outline);
  }

  group.renderOrder = 2;

  return group;
}

function createLabelSprite(THREE: ThreeModule, label: string) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = 256;
  canvas.height = 84;

  if (context) {
    context.font = '700 30px "Ubuntu Sans", system-ui, sans-serif';
    context.fillStyle = "rgba(17, 17, 17, 0.64)";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, canvas.width / 2, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    depthTest: false,
    map: texture,
    transparent: true
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.5, 0.16, 1);

  return { material, sprite, texture };
}

function updateSurfaceMarker(runtime: SurfaceRuntime, shares: number[]) {
  const THREE = runtime.THREE;
  const weights = getWeightsFromShares(shares);
  const surfacePoint = getSurfacePoint(weights);
  const basePoint = getSurfaceBasePoint(weights);

  runtime.marker.position.set(surfacePoint.x, surfacePoint.y + 0.055, surfacePoint.z);
  runtime.stem.geometry.dispose();
  runtime.stem.geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(basePoint.x, 0, basePoint.z),
    new THREE.Vector3(surfacePoint.x, surfacePoint.y + 0.045, surfacePoint.z)
  ]);
  runtime.render();
}

function updateSurfaceColourMode(runtime: SurfaceRuntime, isColourCoded: boolean) {
  runtime.surface.material.color.set(isColourCoded ? 0xffffff : 0xf2f2f1);
  runtime.surface.material.depthWrite = !isColourCoded;
  runtime.surface.material.opacity = isColourCoded ? HEATMAP_OPACITY : SURFACE_PLAIN_OPACITY;
  runtime.surface.material.vertexColors = isColourCoded;
  runtime.surface.material.needsUpdate = true;
  runtime.render();
}

function disposeObject3D(object: import("three").Object3D) {
  object.traverse((child) => {
    const mesh = child as import("three").Mesh;
    const line = child as import("three").Line;
    const materialSource = mesh.material ?? line.material;
    const geometry = mesh.geometry ?? line.geometry;

    geometry?.dispose();

    if (Array.isArray(materialSource)) {
      materialSource.forEach((material) => material.dispose());
    } else {
      materialSource?.dispose();
    }
  });
}

function formatShare(share: number) {
  return `${Math.round(share)}%`;
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
      {locked ? (
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      ) : (
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      )}
    </svg>
  );
}

function getSharesFromSurfaceWeights(weights: BarycentricWeights) {
  const clampedWeights = weights.map((weight) => Math.max(0, weight));
  const total = clampedWeights.reduce((sum, weight) => sum + weight, 0) || 1;

  return clampedWeights.map((weight) => (weight / total) * 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const FLAT_HEATMAP_CELLS = getFlatHeatmapCells();

function updateSurfaceCamera(runtime: SurfaceRuntime) {
  const { camera, cameraTarget, orbit } = runtime;
  const sinPhi = Math.sin(orbit.phi);

  camera.position.set(
    cameraTarget.x + orbit.radius * sinPhi * Math.sin(orbit.theta),
    cameraTarget.y + orbit.radius * Math.cos(orbit.phi),
    cameraTarget.z + orbit.radius * sinPhi * Math.cos(orbit.theta)
  );
  camera.lookAt(cameraTarget);
}

function BarycentresSurfaceView({
  displayShares,
  isColourCoded,
  onSharesChange,
  shares
}: {
  displayShares: number[];
  isColourCoded: boolean;
  onSharesChange: (shares: number[]) => void;
  shares: number[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<SurfaceRuntime | null>(null);
  const latestSharesRef = useRef(shares);
  const dragStateRef = useRef<SurfaceDragState | null>(null);
  const [isDraggingView, setIsDraggingView] = useState(false);

  useEffect(() => {
    latestSharesRef.current = shares;

    if (runtimeRef.current) {
      updateSurfaceMarker(runtimeRef.current, shares);
    }
  }, [shares]);

  useEffect(() => {
    if (runtimeRef.current) {
      updateSurfaceColourMode(runtimeRef.current, isColourCoded);
    }
  }, [isColourCoded]);

  useEffect(() => {
    let cancelled = false;

    async function initialiseSurface() {
      const THREE = await import("three");
      const container = containerRef.current;

      if (!container || cancelled) {
        return;
      }

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true
      });
      renderer.setClearColor(0xffffff, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.style.display = "block";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.width = "100%";
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
      const cameraTarget = new THREE.Vector3(
        SURFACE_ORBIT_TARGET.x,
        SURFACE_ORBIT_TARGET.y,
        SURFACE_ORBIT_TARGET.z
      );
      const orbit = { ...SURFACE_INITIAL_ORBIT };

      scene.add(new THREE.AmbientLight(0xffffff, 1.4));

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
      keyLight.position.set(1.6, 3.8, 2.4);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
      fillLight.position.set(-2.8, 2.4, -2);
      scene.add(fillLight);

      const surface = createSurfaceMesh(THREE, isColourCoded);
      const grid = createSurfaceGrid(THREE);
      surface.renderOrder = 1;
      scene.add(surface);
      scene.add(grid);

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 32, 18),
        new THREE.MeshPhongMaterial({
          color: ACCENT,
          emissive: 0x4f120c,
          shininess: 36
        })
      );
      marker.renderOrder = 4;
      scene.add(marker);

      const stem = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          color: ACCENT,
          opacity: 0.46,
          transparent: true
        })
      );
      stem.renderOrder = 3;
      scene.add(stem);

      const labelMaterials: import("three").SpriteMaterial[] = [];
      const labelTextures: import("three").CanvasTexture[] = [];
      PARTIES.forEach((party, index) => {
        const { material, sprite, texture } = createLabelSprite(THREE, party);
        const vertexPoint = getSurfacePoint(
          [0, 1, 2].map((partyIndex) => (partyIndex === index ? 1 : 0)) as BarycentricWeights
        );

        sprite.position.set(
          vertexPoint.x,
          vertexPoint.y + 0.12,
          vertexPoint.z
        );
        sprite.renderOrder = 5;
        scene.add(sprite);
        labelMaterials.push(material);
        labelTextures.push(texture);
      });

      const render = () => {
        renderer.render(scene, camera);
      };
      const resize = () => {
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);

        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        render();
      };

      const runtime: SurfaceRuntime = {
        THREE,
        camera,
        cameraTarget,
        labelMaterials,
        labelTextures,
        marker,
        orbit,
        pointer: new THREE.Vector2(),
        raycaster: new THREE.Raycaster(),
        renderer,
        render,
        resizeObserver: new ResizeObserver(resize),
        scene,
        stem,
        surface
      };

      runtime.resizeObserver.observe(container);
      runtimeRef.current = runtime;
      updateSurfaceCamera(runtime);
      resize();
      updateSurfaceMarker(runtime, latestSharesRef.current);
      render();
    }

    initialiseSurface();

    return () => {
      cancelled = true;

      const runtime = runtimeRef.current;

      if (!runtime) {
        return;
      }

      runtime.resizeObserver.disconnect();
      disposeObject3D(runtime.scene);
      runtime.labelTextures.forEach((texture) => texture.dispose());
      runtime.labelMaterials.forEach((material) => material.dispose());
      runtime.renderer.dispose();
      runtime.renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, []);

  function updateSharesFromSurface(event: PointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    const rect = runtime.renderer.domElement.getBoundingClientRect();

    runtime.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    runtime.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera);

    const [hit] = runtime.raycaster.intersectObject(runtime.surface, false);

    if (!hit) {
      return;
    }

    onSharesChange(
      getSharesFromSurfaceWeights(
        getSurfaceWeightsFromBasePoint({
          x: hit.point.x,
          z: hit.point.z
        })
      )
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    dragStateRef.current = {
      hasDragged: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPhi: runtime.orbit.phi,
      startTheta: runtime.orbit.theta
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    const dragState = dragStateRef.current;

    if (!runtime || !dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;

    if (
      !dragState.hasDragged &&
      Math.hypot(deltaX, deltaY) >= SURFACE_DRAG_THRESHOLD
    ) {
      dragState.hasDragged = true;
      setIsDraggingView(true);
    }

    if (!dragState.hasDragged) {
      return;
    }

    runtime.orbit.theta = dragState.startTheta - deltaX * SURFACE_ORBIT_DRAG_SPEED;
    runtime.orbit.phi = clamp(
      dragState.startPhi - deltaY * SURFACE_ORBIT_DRAG_SPEED,
      0.52,
      1.36
    );
    updateSurfaceCamera(runtime);
    runtime.render();
  }

  function stopPointer(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (!dragState.hasDragged) {
      updateSharesFromSurface(event);
    }

    dragStateRef.current = null;
    setIsDraggingView(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function cancelPointer(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsDraggingView(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-full min-h-[340px] w-full select-none touch-none ${
        isDraggingView ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{ touchAction: "none" }}
      role="img"
      aria-label={`3D ternary surface${
        isColourCoded ? " colour-coded by effective parties" : ""
      } showing Party 1 at ${displayShares[0]} percent, Party 2 at ${displayShares[1]} percent, Party 3 at ${displayShares[2]} percent, and height as the effective number of parties`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopPointer}
      onPointerCancel={cancelPointer}
    />
  );
}

export default function BarycentresInteractive() {
  const controlId = useId();
  const activePointerIdRef = useRef<number | null>(null);
  const [shares, setShares] = useState<number[]>(() => [...DEFAULT_SHARES]);
  const [lockedParties, setLockedParties] = useState<boolean[]>(() => PARTIES.map(() => false));
  const [viewMode, setViewMode] = useState<ViewMode>("flat");
  const [colourMode, setColourMode] = useState<ColourMode>("plain");
  const displayShares = roundToTotal(shares, 100);
  const effectiveParties = getEffectiveParties(shares);
  const point = getBarycentricPoint(shares);
  const controlIds = PARTIES.map((party) => `${controlId}-${party.toLowerCase().replace(" ", "-")}`);
  const isColourCoded = colourMode === "effective";

  function updateSharesWithLocks(targetShares: number[]) {
    setShares((currentShares) =>
      applyLockedShareTarget(currentShares, lockedParties, targetShares)
    );
  }

  function updateSharesFromPlot(chart: SVGSVGElement, clientX: number, clientY: number) {
    const svgPoint = getSvgPoint(chart, clientX, clientY);
    const result = getClosestPointOnTriangle(
      svgPoint,
      VERTICES[0],
      VERTICES[1],
      VERTICES[2]
    );

    updateSharesWithLocks(result.weights.map((weight) => weight * 100));
  }

  function handlePlotPointerDown(event: PointerEvent<SVGSVGElement>) {
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSharesFromPlot(event.currentTarget, event.clientX, event.clientY);
  }

  function handlePlotPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    updateSharesFromPlot(event.currentTarget, event.clientX, event.clientY);
  }

  function stopPlotPointer(event: PointerEvent<SVGSVGElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    activePointerIdRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function togglePartyLock(index: number) {
    setLockedParties((currentLockedParties) =>
      currentLockedParties.map((locked, partyIndex) =>
        partyIndex === index ? !locked : locked
      )
    );
  }

  return (
    <div className="not-prose my-10 w-full max-w-none sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-10 lg:w-[calc(100%+5rem)]">
      <section className="interactive-panel overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)]">
          <div className="border-b border-black/10 p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="eyebrow">Barycentric Coordinates</p>

            <div className="mt-6 space-y-5">
              <div className="border-b border-black/10 pb-5">
                <div
                  className="grid grid-cols-2 rounded-full border border-black/10 bg-black/[0.035] p-1"
                  role="group"
                  aria-label="View"
                >
                  {VIEW_MODES.map((mode) => {
                    const isSelected = viewMode === mode.id;

                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setViewMode(mode.id)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#F76F5C] focus:ring-offset-2 ${
                          isSelected
                            ? "bg-[#F76F5C] text-white"
                            : "text-black/60 hover:text-[#111111]"
                        }`}
                        aria-pressed={isSelected}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setColourMode((currentMode) =>
                      currentMode === "effective" ? "plain" : "effective"
                    )
                  }
                  className="mt-3 flex w-full items-center justify-between gap-3 rounded-full border border-black/10 bg-black/[0.025] px-3 py-2 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F76F5C] focus-visible:ring-offset-2"
                  role="switch"
                  aria-checked={isColourCoded}
                  aria-label="Colour plot by effective parties"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">
                    Colour by N<sub>2</sub>
                  </span>
                  <span
                    className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${
                      isColourCoded ? "bg-[#F76F5C]" : "bg-black/15"
                    }`}
                    aria-hidden="true"
                  >
                    <span
                      className={`absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                        isColourCoded ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </span>
                </button>
              </div>

              <div className="space-y-5">
                {shares.map((share, index) => {
                  const isLocked = lockedParties[index];
                  const lockLabel = isLocked ? `Unlock ${PARTIES[index]}` : `Lock ${PARTIES[index]}`;

                  return (
                    <div key={PARTIES[index]} className="space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <label
                          htmlFor={controlIds[index]}
                          className="block text-sm font-semibold text-[#111111]"
                        >
                          {PARTIES[index]}
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums text-[#111111]">
                            {formatShare(displayShares[index])}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePartyLock(index)}
                            className={`grid h-7 w-7 place-items-center rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#F76F5C] focus:ring-offset-2 ${
                              isLocked
                                ? "border-[#F76F5C]/40 bg-[#F76F5C]/10 text-[#F76F5C]"
                                : "border-black/10 bg-black/[0.025] text-black/50 hover:text-[#111111]"
                            }`}
                            aria-label={lockLabel}
                            aria-pressed={isLocked}
                            title={lockLabel}
                          >
                            <LockIcon locked={isLocked} />
                          </button>
                        </div>
                      </div>
                      <input
                        id={controlIds[index]}
                        type="range"
                        min="0"
                        max="100"
                        step={SHARE_STEP}
                        value={share}
                        disabled={isLocked}
                        onChange={(event) =>
                          setShares((currentShares) =>
                            rebalanceShares(
                              currentShares,
                              lockedParties,
                              index,
                              Number(event.target.value)
                            )
                          )
                        }
                        className={`difference-slider w-full ${isLocked ? "opacity-50" : ""}`}
                        style={
                          {
                            "--slider-color": ACCENT,
                            "--slider-position": `${share}%`
                          } as CSSProperties
                        }
                        aria-label={PARTIES[index]}
                        aria-valuetext={`${formatShare(displayShares[index])}${
                          isLocked ? ", locked" : ""
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-black/10 pt-5">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-sm font-semibold text-[#111111]">
                    Effective parties (N<sub>2</sub>)
                  </p>
                  <output
                    htmlFor={controlIds.join(" ")}
                    className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-[#111111]"
                    aria-live="polite"
                  >
                    {effectiveParties.toFixed(2)}
                  </output>
                </div>
                <div className="mt-4 h-2 rounded-full bg-black/8">
                  <div
                    className="h-2 rounded-full bg-[#F76F5C]"
                    style={{ width: `${(effectiveParties / 3) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center p-2 sm:p-4">
            {viewMode === "flat" ? (
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="block h-auto w-full cursor-crosshair select-none touch-none"
                style={{ touchAction: "none" }}
                role="img"
                aria-label={`Ternary plot${
                  isColourCoded ? " colour-coded by effective parties" : ""
                } showing Party 1 at ${displayShares[0]} percent, Party 2 at ${displayShares[1]} percent, and Party 3 at ${displayShares[2]} percent`}
                onPointerDown={handlePlotPointerDown}
                onPointerMove={handlePlotPointerMove}
                onPointerUp={stopPlotPointer}
                onPointerCancel={stopPlotPointer}
              >
                {isColourCoded ? (
                  <g aria-hidden="true" opacity={HEATMAP_OPACITY}>
                    {FLAT_HEATMAP_CELLS.map((cell) => (
                      <polygon
                        key={cell.id}
                        points={cell.points}
                        fill={cell.colour}
                        stroke={cell.colour}
                        strokeWidth="0.7"
                      />
                    ))}
                  </g>
                ) : (
                  <polygon
                    points={VERTICES.map((vertex) => `${vertex.x},${vertex.y}`).join(" ")}
                    fill="rgba(17,17,17,0.025)"
                  />
                )}

                {GRID_TICKS.map((tick) =>
                  PARTIES.map((_party, index) => {
                    const line = getConstantShareLine(index, tick);

                    return (
                      <line
                        key={`${index}-${tick}`}
                        x1={line.start.x}
                        y1={line.start.y}
                        x2={line.end.x}
                        y2={line.end.y}
                        stroke={
                          isColourCoded
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(17,17,17,0.09)"
                        }
                        strokeWidth="1.5"
                      />
                    );
                  })
                )}

                <polygon
                  points={VERTICES.map((vertex) => `${vertex.x},${vertex.y}`).join(" ")}
                  fill="none"
                  stroke="rgba(17,17,17,0.38)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />

                {VERTICES.map((vertex, index) => (
                  <circle
                    key={PARTIES[index]}
                    cx={vertex.x}
                    cy={vertex.y}
                    r="4.5"
                    fill={isColourCoded ? "#FFFFFF" : INK}
                    opacity={isColourCoded ? "0.72" : "0.42"}
                  />
                ))}

                <polygon
                  points={VERTICES.map((vertex) => `${vertex.x},${vertex.y}`).join(" ")}
                  fill="transparent"
                />

                <circle
                  cx={point.x}
                  cy={point.y}
                  r="22"
                  fill={isColourCoded ? "#FFFFFF" : ACCENT}
                  opacity={isColourCoded ? "0.2" : "0.18"}
                />
                {isColourCoded ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="14"
                    fill="none"
                    stroke="rgba(17,17,17,0.24)"
                    strokeWidth="2"
                  />
                ) : null}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="12"
                  fill={ACCENT}
                  stroke="#FFFFFF"
                  strokeWidth="4"
                />

                <text
                  x={VERTICES[0].x}
                  y={VERTICES[0].y - 22}
                  textAnchor="middle"
                  fontSize="21"
                  fontWeight="600"
                  fill={INK}
                  opacity="0.64"
                >
                  Party 1
                </text>
                <text
                  x={VERTICES[1].x + 14}
                  y={VERTICES[1].y + 34}
                  textAnchor="middle"
                  fontSize="21"
                  fontWeight="600"
                  fill={INK}
                  opacity="0.64"
                >
                  Party 2
                </text>
                <text
                  x={VERTICES[2].x - 14}
                  y={VERTICES[2].y + 34}
                  textAnchor="middle"
                  fontSize="21"
                  fontWeight="600"
                  fill={INK}
                  opacity="0.64"
                >
                  Party 3
                </text>
              </svg>
            ) : (
              <BarycentresSurfaceView
                displayShares={displayShares}
                isColourCoded={isColourCoded}
                onSharesChange={updateSharesWithLocks}
                shares={shares}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
