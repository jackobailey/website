import {
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent
} from "react";

const ACCENT = "#CB1B12";
const BLOCS_COLOUR = "#3B0F70";
const PARTY_POSITION_COLOURS = [BLOCS_COLOUR, "#B5367A", ACCENT] as const;
const INK = "#111111";
const DEFAULT_SHARES = [50, 25, 25] as const;
const DEFAULT_POSITIONS = [-3.5, 0, 3.5] as const;
const PARTIES = ["Party 1", "Party 2", "Party 3"] as const;
const SHARE_STEP = 0.1;
const POSITION_MIN = -5;
const POSITION_MAX = 5;
const POSITION_STEP = 0.01;
const EFFECTIVE_PARTIES_MIN = 1;
const EFFECTIVE_PARTIES_MAX = 3;
const EFFECTIVE_BLOCS_MAX = 3;
const EFFECTIVE_QUANTITY_STEP = 0.01;
const SIMILARITY_LAMBDA = 0.2242922;
const SIMILARITY_K = 1.307394;
const EFFECTIVE_CONTOUR_SAMPLES = 720;
const BLOCS_CONTOUR_RESOLUTION = 96;
const CHART_WIDTH = 640;
const CHART_HEIGHT = 510;
const TRIANGLE_SIDE = 448;
const TRIANGLE_HEIGHT = (Math.sqrt(3) / 2) * TRIANGLE_SIDE;
const TRIANGLE_CENTER_X = CHART_WIDTH / 2;
const TRIANGLE_TOP_Y = 64;
const TRIANGLE_BOTTOM_Y = TRIANGLE_TOP_Y + TRIANGLE_HEIGHT;
const VERTICES = [
  { x: TRIANGLE_CENTER_X, y: TRIANGLE_TOP_Y },
  { x: TRIANGLE_CENTER_X - TRIANGLE_SIDE / 2, y: TRIANGLE_BOTTOM_Y },
  { x: TRIANGLE_CENTER_X + TRIANGLE_SIDE / 2, y: TRIANGLE_BOTTOM_Y }
] as const;
const GRID_TICKS = [20, 40, 60, 80] as const;

type Point = {
  x: number;
  y: number;
};

type BarycentricWeights = [number, number, number];
type WeightedBlocsVertex = {
  point: Point;
  value: number;
  weights: BarycentricWeights;
};

const EQUAL_WEIGHTS: BarycentricWeights = [1 / 3, 1 / 3, 1 / 3];
const EFFECTIVE_CONTOUR_BASIS = [
  [1 / Math.sqrt(2), -1 / Math.sqrt(2), 0],
  [1 / Math.sqrt(6), 1 / Math.sqrt(6), -2 / Math.sqrt(6)]
] as const;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function getEffectiveParties(shares: number[]) {
  return getEffectivePartiesFromWeights(shares.map((share) => share / 100));
}

function getEffectivePartiesFromWeights(weights: number[]) {
  const concentration = weights.reduce((total, weight) => total + weight * weight, 0);

  return 1 / concentration;
}

function getNormalisedPosition(position: number) {
  return (position - POSITION_MIN) / (POSITION_MAX - POSITION_MIN);
}

function getSimilarity(distance: number) {
  const raw = Math.exp(-Math.pow(distance / SIMILARITY_LAMBDA, SIMILARITY_K));
  const rawAtMaximumDistance = Math.exp(
    -Math.pow(1 / SIMILARITY_LAMBDA, SIMILARITY_K)
  );

  return clamp((raw - rawAtMaximumDistance) / (1 - rawAtMaximumDistance), 0, 1);
}

function getSimilarityMatrix(positions: number[]) {
  const normalisedPositions = positions.map(getNormalisedPosition);

  return normalisedPositions.map((position) =>
    normalisedPositions.map((otherPosition) =>
      getSimilarity(Math.abs(position - otherPosition))
    )
  );
}

function getEffectiveBlocs(shares: number[], positions: number[]) {
  return getEffectiveBlocsFromWeights(
    shares.map((share) => share / 100),
    positions
  );
}

function getEffectiveBlocsFromWeights(weights: number[], positions: number[]) {
  const similarity = getSimilarityMatrix(positions);
  const typicality = similarity.map((row) =>
    row.reduce((sum, amount, index) => sum + amount * weights[index], 0)
  );
  const weightedTypicality = weights.reduce(
    (sum, weight, index) => sum + weight * typicality[index],
    0
  );

  return 1 / weightedTypicality;
}

function getNormalisedWeights(weights: number[]): BarycentricWeights {
  const clampedWeights = weights.map((weight) => Math.max(0, weight));
  const total = clampedWeights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) {
    return [...EQUAL_WEIGHTS];
  }

  return clampedWeights.map((weight) => weight / total) as BarycentricWeights;
}

function isInSimplex(weights: number[], tolerance = 0.000001) {
  return weights.every((weight) => weight >= -tolerance && weight <= 1 + tolerance);
}

function getEffectiveContourRadius(effectiveParties: number) {
  const clampedParties = clamp(
    effectiveParties,
    EFFECTIVE_PARTIES_MIN,
    EFFECTIVE_PARTIES_MAX
  );

  return Math.sqrt(Math.max(0, 1 / clampedParties - 1 / EFFECTIVE_PARTIES_MAX));
}

function getWeightsOnEffectiveContour(
  effectiveParties: number,
  angle: number
): BarycentricWeights {
  const radius = getEffectiveContourRadius(effectiveParties);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [0, 1, 2].map((index) => {
    return (
      EQUAL_WEIGHTS[index] +
      radius *
        (cos * EFFECTIVE_CONTOUR_BASIS[0][index] +
          sin * EFFECTIVE_CONTOUR_BASIS[1][index])
    );
  }) as BarycentricWeights;
}

function getEffectivePartiesContourPath(effectiveParties: number) {
  const clampedParties = clamp(
    effectiveParties,
    EFFECTIVE_PARTIES_MIN,
    EFFECTIVE_PARTIES_MAX
  );

  if (clampedParties >= EFFECTIVE_PARTIES_MAX - 0.000001) {
    return "";
  }

  const segments: Point[][] = [];
  let currentSegment: Point[] = [];
  const isFirstPointValid = isInSimplex(getWeightsOnEffectiveContour(clampedParties, 0), 0.001);

  for (let index = 0; index <= EFFECTIVE_CONTOUR_SAMPLES; index += 1) {
    const weights = getWeightsOnEffectiveContour(
      clampedParties,
      (index / EFFECTIVE_CONTOUR_SAMPLES) * Math.PI * 2
    );

    if (isInSimplex(weights, 0.001)) {
      currentSegment.push(getBarycentricPointFromWeights(getNormalisedWeights(weights)));
    } else if (currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = [];
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  if (isFirstPointValid && segments.length > 1) {
    const firstSegment = segments.shift();
    const lastSegment = segments.pop();

    if (firstSegment && lastSegment) {
      segments.unshift(lastSegment.concat(firstSegment));
    }
  }

  return segments
    .filter((segment) => segment.length > 1)
    .map((segment) => {
      const [start, ...rest] = segment;
      const lineCommands = rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`);

      return [`M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`, ...lineCommands].join(" ");
    })
    .join(" ");
}

function getWeightDeviation(weights: number[]) {
  return weights.map((weight, index) => weight - EQUAL_WEIGHTS[index]);
}

function getDeviationLength(deviation: number[]) {
  return Math.sqrt(
    deviation.reduce((sum, amount) => {
      return sum + amount * amount;
    }, 0)
  );
}

function getBoundaryWeightsForEffectiveParties(effectiveParties: number) {
  const clampedParties = clamp(
    effectiveParties,
    EFFECTIVE_PARTIES_MIN,
    EFFECTIVE_PARTIES_MAX
  );
  const concentration = 1 / clampedParties;

  if (concentration < 0.5 - 0.000001) {
    return [];
  }

  const spread = Math.sqrt(Math.max(0, 2 * concentration - 1));
  const boundaryWeights: BarycentricWeights[] = [];

  for (let zeroIndex = 0; zeroIndex < 3; zeroIndex += 1) {
    const [firstIndex, secondIndex] = [0, 1, 2].filter((index) => index !== zeroIndex);
    const firstWeight = (1 + spread) / 2;
    const secondWeight = (1 - spread) / 2;
    const weights = [0, 0, 0] as BarycentricWeights;

    weights[zeroIndex] = 0;
    weights[firstIndex] = firstWeight;
    weights[secondIndex] = secondWeight;
    boundaryWeights.push(weights);

    if (spread > 0.000001) {
      const reversedWeights = [0, 0, 0] as BarycentricWeights;

      reversedWeights[zeroIndex] = 0;
      reversedWeights[firstIndex] = secondWeight;
      reversedWeights[secondIndex] = firstWeight;
      boundaryWeights.push(reversedWeights);
    }
  }

  return boundaryWeights;
}

function getEffectiveContourWeights(effectiveParties: number) {
  const clampedParties = clamp(
    effectiveParties,
    EFFECTIVE_PARTIES_MIN,
    EFFECTIVE_PARTIES_MAX
  );

  if (clampedParties >= EFFECTIVE_PARTIES_MAX - 0.000001) {
    return [[...EQUAL_WEIGHTS] as BarycentricWeights];
  }

  const weights: BarycentricWeights[] = [];

  for (let index = 0; index < EFFECTIVE_CONTOUR_SAMPLES; index += 1) {
    const candidateWeights = getWeightsOnEffectiveContour(
      clampedParties,
      (index / EFFECTIVE_CONTOUR_SAMPLES) * Math.PI * 2
    );

    if (isInSimplex(candidateWeights)) {
      weights.push(getNormalisedWeights(candidateWeights));
    }
  }

  return weights.concat(getBoundaryWeightsForEffectiveParties(clampedParties));
}

function getClosestWeightsAtEffectiveParties(
  targetWeights: BarycentricWeights,
  effectiveParties: number
) {
  const targetPoint = getBarycentricPointFromWeights(targetWeights);
  const contourWeights = getEffectiveContourWeights(effectiveParties);
  let closestWeights: BarycentricWeights | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  contourWeights.forEach((weights) => {
    const point = getBarycentricPointFromWeights(weights);
    const distance = Math.hypot(point.x - targetPoint.x, point.y - targetPoint.y);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestWeights = weights;
    }
  });

  return closestWeights ?? ([...EQUAL_WEIGHTS] as BarycentricWeights);
}

function getProjectedWeightsAtEffectiveParties(
  targetWeights: BarycentricWeights,
  effectiveParties: number,
  fallbackWeights: BarycentricWeights = targetWeights
) {
  const clampedParties = clamp(
    effectiveParties,
    EFFECTIVE_PARTIES_MIN,
    EFFECTIVE_PARTIES_MAX
  );

  if (clampedParties >= EFFECTIVE_PARTIES_MAX - 0.000001) {
    return [...EQUAL_WEIGHTS] as BarycentricWeights;
  }

  const targetDeviation = getWeightDeviation(targetWeights);
  const fallbackDeviation = getWeightDeviation(fallbackWeights);
  const defaultDeviation = getWeightDeviation([1, 0, 0]);
  const targetDeviationLength = getDeviationLength(targetDeviation);
  const fallbackDeviationLength = getDeviationLength(fallbackDeviation);
  const defaultDeviationLength = getDeviationLength(defaultDeviation);
  const sourceDeviation =
    targetDeviationLength > 0.000001
      ? targetDeviation
      : fallbackDeviationLength > 0.000001
        ? fallbackDeviation
        : defaultDeviation;
  const sourceDeviationLength =
    targetDeviationLength > 0.000001
      ? targetDeviationLength
      : fallbackDeviationLength > 0.000001
        ? fallbackDeviationLength
        : defaultDeviationLength;

  if (sourceDeviationLength > 0.000001) {
    const radius = getEffectiveContourRadius(clampedParties);
    const projectedWeights = sourceDeviation.map((amount, index) => {
      return EQUAL_WEIGHTS[index] + (amount / sourceDeviationLength) * radius;
    }) as BarycentricWeights;

    if (isInSimplex(projectedWeights)) {
      return getNormalisedWeights(projectedWeights);
    }
  }

  return getClosestWeightsAtEffectiveParties(targetWeights, clampedParties);
}

function getWeightsFromShares(shares: number[]): BarycentricWeights {
  const total = shares.reduce((sum, share) => sum + share, 0) || 100;

  return [shares[0] / total, shares[1] / total, shares[2] / total];
}

function getSharesAtEffectivePartiesNearTarget(
  targetShares: number[],
  effectiveParties: number,
  fallbackShares: number[] = targetShares
) {
  const weights = getProjectedWeightsAtEffectiveParties(
    getWeightsFromShares(targetShares),
    effectiveParties,
    getWeightsFromShares(fallbackShares)
  );

  return weights.map((weight) => weight * 100);
}

function getBlocsContourPath(effectiveBlocs: number, positions: number[]) {
  const pathSegments: string[] = [];

  for (let party1 = 0; party1 < BLOCS_CONTOUR_RESOLUTION; party1 += 1) {
    for (let party2 = 0; party2 < BLOCS_CONTOUR_RESOLUTION - party1; party2 += 1) {
      const party3 = BLOCS_CONTOUR_RESOLUTION - party1 - party2;
      const first: BarycentricWeights = [
        party1 / BLOCS_CONTOUR_RESOLUTION,
        party2 / BLOCS_CONTOUR_RESOLUTION,
        party3 / BLOCS_CONTOUR_RESOLUTION
      ];
      const second: BarycentricWeights = [
        (party1 + 1) / BLOCS_CONTOUR_RESOLUTION,
        party2 / BLOCS_CONTOUR_RESOLUTION,
        (party3 - 1) / BLOCS_CONTOUR_RESOLUTION
      ];
      const third: BarycentricWeights = [
        party1 / BLOCS_CONTOUR_RESOLUTION,
        (party2 + 1) / BLOCS_CONTOUR_RESOLUTION,
        (party3 - 1) / BLOCS_CONTOUR_RESOLUTION
      ];

      appendBlocsContourSegment(pathSegments, [first, second, third], effectiveBlocs, positions);

      if (party1 + party2 < BLOCS_CONTOUR_RESOLUTION - 1) {
        const fourth: BarycentricWeights = [
          (party1 + 1) / BLOCS_CONTOUR_RESOLUTION,
          (party2 + 1) / BLOCS_CONTOUR_RESOLUTION,
          (party3 - 2) / BLOCS_CONTOUR_RESOLUTION
        ];

        appendBlocsContourSegment(
          pathSegments,
          [second, fourth, third],
          effectiveBlocs,
          positions
        );
      }
    }
  }

  return pathSegments.join(" ");
}

function getBlocsContourIntersections(
  weights: BarycentricWeights[],
  effectiveBlocs: number,
  positions: number[]
) {
  const vertices: WeightedBlocsVertex[] = weights.map((vertexWeights) => ({
    point: getBarycentricPointFromWeights(vertexWeights),
    value: getEffectiveBlocsFromWeights(vertexWeights, positions),
    weights: vertexWeights
  }));
  const intersections: WeightedBlocsVertex[] = [];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 0]
  ] as const;

  edges.forEach(([startIndex, endIndex]) => {
    const start = vertices[startIndex];
    const end = vertices[endIndex];
    const startDifference = start.value - effectiveBlocs;
    const endDifference = end.value - effectiveBlocs;

    if (Math.abs(startDifference) < 0.000001 && Math.abs(endDifference) < 0.000001) {
      return;
    }

    if (Math.abs(startDifference) < 0.000001) {
      intersections.push(start);
      return;
    }

    if (Math.abs(endDifference) < 0.000001) {
      intersections.push(end);
      return;
    }

    if (startDifference * endDifference < 0) {
      const amount = (effectiveBlocs - start.value) / (end.value - start.value);

      intersections.push({
        point: interpolate(start.point, end.point, amount),
        value: effectiveBlocs,
        weights: [
          start.weights[0] + (end.weights[0] - start.weights[0]) * amount,
          start.weights[1] + (end.weights[1] - start.weights[1]) * amount,
          start.weights[2] + (end.weights[2] - start.weights[2]) * amount
        ]
      });
    }
  });

  return intersections.filter((vertex, index) => {
    return !intersections.some((otherVertex, otherIndex) => {
      return (
        otherIndex < index &&
        Math.hypot(vertex.point.x - otherVertex.point.x, vertex.point.y - otherVertex.point.y) <
          0.001
      );
    });
  });
}

function appendBlocsContourSegment(
  pathSegments: string[],
  weights: BarycentricWeights[],
  effectiveBlocs: number,
  positions: number[]
) {
  const uniqueIntersections = getBlocsContourIntersections(
    weights,
    effectiveBlocs,
    positions
  );

  if (uniqueIntersections.length !== 2) {
    return;
  }

  const [start, end] = uniqueIntersections;

  pathSegments.push(
    `M ${start.point.x.toFixed(2)} ${start.point.y.toFixed(2)} L ${end.point.x.toFixed(
      2
    )} ${end.point.y.toFixed(2)}`
  );
}

function solveLinearSystem(matrix: number[][], rightHandSide: number[]) {
  const augmented = matrix.map((row, rowIndex) => [...row, rightHandSide[rowIndex]]);
  const size = matrix.length;

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let pivotRow = pivotIndex;

    for (let rowIndex = pivotIndex + 1; rowIndex < size; rowIndex += 1) {
      if (Math.abs(augmented[rowIndex][pivotIndex]) > Math.abs(augmented[pivotRow][pivotIndex])) {
        pivotRow = rowIndex;
      }
    }

    if (Math.abs(augmented[pivotRow][pivotIndex]) < 0.0000001) {
      return null;
    }

    if (pivotRow !== pivotIndex) {
      const currentRow = augmented[pivotIndex];

      augmented[pivotIndex] = augmented[pivotRow];
      augmented[pivotRow] = currentRow;
    }

    const pivot = augmented[pivotIndex][pivotIndex];

    for (let columnIndex = pivotIndex; columnIndex <= size; columnIndex += 1) {
      augmented[pivotIndex][columnIndex] /= pivot;
    }

    for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
      if (rowIndex === pivotIndex) {
        continue;
      }

      const factor = augmented[rowIndex][pivotIndex];

      for (let columnIndex = pivotIndex; columnIndex <= size; columnIndex += 1) {
        augmented[rowIndex][columnIndex] -= factor * augmented[pivotIndex][columnIndex];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function getMaximumEffectiveBlocsWeights(positions: number[]) {
  const similarity = getSimilarityMatrix(positions);
  const subsets = [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]] as const;
  let bestWeights: BarycentricWeights = [1, 0, 0];
  let bestTypicality = Number.POSITIVE_INFINITY;

  subsets.forEach((subset) => {
    const subsetMatrix = subset.map((rowIndex) =>
      subset.map((columnIndex) => similarity[rowIndex][columnIndex])
    );
    const solution = solveLinearSystem(
      subsetMatrix,
      subset.map(() => 1)
    );

    if (!solution) {
      return;
    }

    const total = solution.reduce((sum, value) => sum + value, 0);

    if (total <= 0) {
      return;
    }

    const subsetWeights = solution.map((value) => value / total);

    if (subsetWeights.some((weight) => weight < -0.000001)) {
      return;
    }

    const candidateWeights = [0, 0, 0] as BarycentricWeights;

    subset.forEach((partyIndex, index) => {
      candidateWeights[partyIndex] = subsetWeights[index];
    });

    const typicality = 1 / getEffectiveBlocsFromWeights(candidateWeights, positions);

    if (typicality < bestTypicality) {
      bestTypicality = typicality;
      bestWeights = candidateWeights;
    }
  });

  return getNormalisedWeights(bestWeights);
}

function getMaximumEffectiveBlocs(positions: number[]) {
  return getEffectiveBlocsFromWeights(getMaximumEffectiveBlocsWeights(positions), positions);
}

function getClosestWeightsAtEffectiveBlocs(
  targetWeights: BarycentricWeights,
  effectiveBlocs: number,
  positions: number[]
) {
  const maximumWeights = getMaximumEffectiveBlocsWeights(positions);
  const maximumBlocs = getEffectiveBlocsFromWeights(maximumWeights, positions);
  const clampedBlocs = clamp(effectiveBlocs, 1, maximumBlocs);

  if (Math.abs(clampedBlocs - maximumBlocs) < 0.000001) {
    return maximumWeights;
  }

  const targetPoint = getBarycentricPointFromWeights(targetWeights);
  let closestWeights: BarycentricWeights | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let party1 = 0; party1 < BLOCS_CONTOUR_RESOLUTION; party1 += 1) {
    for (let party2 = 0; party2 < BLOCS_CONTOUR_RESOLUTION - party1; party2 += 1) {
      const party3 = BLOCS_CONTOUR_RESOLUTION - party1 - party2;
      const first: BarycentricWeights = [
        party1 / BLOCS_CONTOUR_RESOLUTION,
        party2 / BLOCS_CONTOUR_RESOLUTION,
        party3 / BLOCS_CONTOUR_RESOLUTION
      ];
      const second: BarycentricWeights = [
        (party1 + 1) / BLOCS_CONTOUR_RESOLUTION,
        party2 / BLOCS_CONTOUR_RESOLUTION,
        (party3 - 1) / BLOCS_CONTOUR_RESOLUTION
      ];
      const third: BarycentricWeights = [
        party1 / BLOCS_CONTOUR_RESOLUTION,
        (party2 + 1) / BLOCS_CONTOUR_RESOLUTION,
        (party3 - 1) / BLOCS_CONTOUR_RESOLUTION
      ];
      const triangles = [[first, second, third]] as BarycentricWeights[][];

      if (party1 + party2 < BLOCS_CONTOUR_RESOLUTION - 1) {
        const fourth: BarycentricWeights = [
          (party1 + 1) / BLOCS_CONTOUR_RESOLUTION,
          (party2 + 1) / BLOCS_CONTOUR_RESOLUTION,
          (party3 - 2) / BLOCS_CONTOUR_RESOLUTION
        ];

        triangles.push([second, fourth, third]);
      }

      triangles.forEach((triangle) => {
        getBlocsContourIntersections(triangle, clampedBlocs, positions).forEach((vertex) => {
          const distance = Math.hypot(
            vertex.point.x - targetPoint.x,
            vertex.point.y - targetPoint.y
          );

          if (distance < closestDistance) {
            closestDistance = distance;
            closestWeights = getNormalisedWeights(vertex.weights);
          }
        });
      });
    }
  }

  if (closestWeights) {
    return closestWeights;
  }

  return clampedBlocs <= 1 + 0.000001
    ? getClosestWeightsAtEffectiveBlocsBoundary(targetWeights)
    : targetWeights;
}

function getClosestWeightsAtEffectiveBlocsBoundary(targetWeights: BarycentricWeights) {
  const targetPoint = getBarycentricPointFromWeights(targetWeights);
  const vertices = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ] as BarycentricWeights[];
  let closestWeights = vertices[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  vertices.forEach((weights) => {
    const point = getBarycentricPointFromWeights(weights);
    const distance = Math.hypot(point.x - targetPoint.x, point.y - targetPoint.y);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestWeights = weights;
    }
  });

  return closestWeights;
}

function getSharesAtEffectiveBlocsNearTarget(
  targetShares: number[],
  effectiveBlocs: number,
  positions: number[]
) {
  const weights = getClosestWeightsAtEffectiveBlocs(
    getWeightsFromShares(targetShares),
    effectiveBlocs,
    positions
  );

  return weights.map((weight) => weight * 100);
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

function formatShare(share: number) {
  if (share > 0 && share < 1) {
    return "<1%";
  }

  return `${Math.round(share)}%`;
}

function formatPosition(position: number) {
  return position > 0 ? `+${position.toFixed(2)}` : position.toFixed(2);
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

type PartySliderProps = {
  ariaLabel: string;
  ariaValueText: string;
  colour: string;
  formattedValue: string;
  id: string;
  isLocked: boolean;
  lockLabel: string;
  max: number;
  min: number;
  number: number;
  onChange: (value: number) => void;
  onToggleLock: () => void;
  step: number;
  value: number;
};

function PartySlider({
  ariaLabel,
  ariaValueText,
  colour,
  formattedValue,
  id,
  isLocked,
  lockLabel,
  max,
  min,
  number,
  onChange,
  onToggleLock,
  step,
  value
}: PartySliderProps) {
  const sliderPosition = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_auto] items-center gap-2">
      <div className="relative h-8 px-3.5">
        <div className="relative h-full">
          <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-black/10" />
          <div
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
            style={{
              backgroundColor: isLocked
                ? `color-mix(in srgb, ${colour} 60%, white)`
                : colour,
              width: `${sliderPosition}%`
            }}
          />
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={isLocked}
            onChange={(event) => onChange(Number(event.target.value))}
            className={`peer party-slider absolute inset-0 z-20 h-full w-full ${
              isLocked ? "cursor-not-allowed" : ""
            }`}
            aria-label={ariaLabel}
            aria-valuetext={ariaValueText}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-xs font-bold leading-none text-white shadow-[0_0_0_1px_rgba(17,17,17,0.08),0_8px_18px_rgba(17,17,17,0.18)] transition-shadow duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[#CB1B12] peer-focus-visible:ring-offset-2"
            style={{
              backgroundColor: isLocked
                ? `color-mix(in srgb, ${colour} 60%, white)`
                : colour,
              left: `${sliderPosition}%`
            }}
          >
            {number}
          </span>
        </div>
      </div>
      <span className="text-right text-sm font-semibold tabular-nums text-[#111111]">
        {formattedValue}
      </span>
      <button
        type="button"
        onClick={onToggleLock}
        className={`grid h-7 w-7 place-items-center rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#CB1B12] focus:ring-offset-2 ${
          isLocked
            ? "border-[#CB1B12]/40 bg-[#CB1B12]/10 text-[#CB1B12]"
            : "border-black/10 bg-black/[0.025] text-black/50 hover:text-[#111111]"
        }`}
        aria-label={lockLabel}
        aria-pressed={isLocked}
        title={lockLabel}
      >
        <LockIcon locked={isLocked} />
      </button>
    </div>
  );
}

export default function BarycentresAndBlocsInteractive() {
  const controlId = useId();
  const activePointerIdRef = useRef<number | null>(null);
  const [shares, setShares] = useState<number[]>(() => [...DEFAULT_SHARES]);
  const [positions, setPositions] = useState<number[]>(() => [...DEFAULT_POSITIONS]);
  const [lockedShareParties, setLockedShareParties] = useState<boolean[]>(() =>
    PARTIES.map(() => false)
  );
  const [lockedPositionParties, setLockedPositionParties] = useState<boolean[]>(() =>
    PARTIES.map(() => false)
  );
  const [areContoursLocked, setAreContoursLocked] = useState(false);
  const effectiveParties = getEffectiveParties(shares);
  const effectiveBlocs = getEffectiveBlocs(shares, positions);
  const maximumEffectiveBlocs = getMaximumEffectiveBlocs(positions);
  const point = getBarycentricPoint(shares);
  const shareControlIds = PARTIES.map(
    (party) => `${controlId}-${party.toLowerCase().replace(" ", "-")}-share`
  );
  const positionControlIds = PARTIES.map(
    (party) => `${controlId}-${party.toLowerCase().replace(" ", "-")}-position`
  );
  const effectivePartiesControlId = `${controlId}-effective-parties`;
  const effectiveBlocsControlId = `${controlId}-effective-blocs`;
  const contourLockLabel = areContoursLocked
    ? "Unlock current contours"
    : "Lock current effective parties and blocs contours";
  const currentEffectivePartiesContourPath = useMemo(
    () => getEffectivePartiesContourPath(effectiveParties),
    [effectiveParties]
  );
  const currentBlocsContourPath = useMemo(
    () => getBlocsContourPath(effectiveBlocs, positions),
    [effectiveBlocs, positions]
  );
  const effectivePartiesSliderPosition = clamp(
    ((effectiveParties - EFFECTIVE_PARTIES_MIN) /
      (EFFECTIVE_PARTIES_MAX - EFFECTIVE_PARTIES_MIN)) *
      100,
    0,
    100
  );
  const effectiveBlocsSliderPosition = clamp(
    ((effectiveBlocs - 1) / (EFFECTIVE_BLOCS_MAX - 1)) * 100,
    0,
    100
  );

  function updateSharesWithConstraints(targetShares: number[]) {
    setShares((currentShares) => {
      if (areContoursLocked) {
        return getSharesAtEffectivePartiesNearTarget(
          targetShares,
          getEffectiveParties(currentShares),
          currentShares
        );
      }

      return applyLockedShareTarget(currentShares, lockedShareParties, targetShares);
    });
  }

  function updateSharesFromPlot(chart: SVGSVGElement, clientX: number, clientY: number) {
    const svgPoint = getSvgPoint(chart, clientX, clientY);
    const result = getClosestPointOnTriangle(
      svgPoint,
      VERTICES[0],
      VERTICES[1],
      VERTICES[2]
    );

    updateSharesWithConstraints(result.weights.map((weight) => weight * 100));
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

  function toggleShareLock(index: number) {
    setLockedShareParties((currentLockedParties) =>
      currentLockedParties.map((locked, partyIndex) =>
        partyIndex === index ? !locked : locked
      )
    );
  }

  function togglePositionLock(index: number) {
    setLockedPositionParties((currentLockedParties) =>
      currentLockedParties.map((locked, partyIndex) =>
        partyIndex === index ? !locked : locked
      )
    );
  }

  function toggleContourLock() {
    setAreContoursLocked((currentLockedState) => {
      const nextLockedState = !currentLockedState;

      if (nextLockedState) {
        setLockedShareParties(PARTIES.map(() => false));
      }

      return nextLockedState;
    });
  }

  function handleShareChange(index: number, nextShare: number) {
    setShares((currentShares) =>
      rebalanceShares(currentShares, lockedShareParties, index, nextShare)
    );
  }

  function handlePositionChange(index: number, nextPosition: number) {
    if (lockedPositionParties[index]) {
      return;
    }

    setPositions((currentPositions) =>
      currentPositions.map((position, partyIndex) =>
        partyIndex === index ? clamp(nextPosition, POSITION_MIN, POSITION_MAX) : position
      )
    );
  }

  function handleEffectivePartiesChange(nextEffectiveParties: number) {
    setLockedShareParties(PARTIES.map(() => false));
    setShares((currentShares) =>
      getSharesAtEffectivePartiesNearTarget(
        currentShares,
        nextEffectiveParties,
        currentShares
      )
    );
  }

  function handleEffectiveBlocsChange(nextEffectiveBlocs: number) {
    setLockedShareParties(PARTIES.map(() => false));
    setShares((currentShares) =>
      getSharesAtEffectiveBlocsNearTarget(currentShares, nextEffectiveBlocs, positions)
    );
  }

  return (
    <div className="not-prose my-10 w-full max-w-none sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-10 lg:w-[calc(100%+5rem)]">
      <section className="interactive-panel overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(290px,0.92fr)_minmax(0,1.08fr)]">
          <div className="border-b border-black/10 p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="eyebrow">Barycentres &amp; Blocs</p>

            <div className="mt-6 space-y-6">
              <div className="space-y-5">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                      Vote Share
                    </p>
                    {shares.map((share, index) => {
                      const isShareLocked = lockedShareParties[index];
                      const shareLockLabel = isShareLocked
                        ? `Unlock ${PARTIES[index]} vote share`
                        : `Lock ${PARTIES[index]} vote share`;

                      return (
                        <PartySlider
                          key={`${PARTIES[index]}-share`}
                          id={shareControlIds[index]}
                          min={0}
                          max={100}
                          step={SHARE_STEP}
                          value={share}
                          number={index + 1}
                          colour={PARTY_POSITION_COLOURS[index]}
                          formattedValue={formatShare(share)}
                          isLocked={isShareLocked}
                          lockLabel={shareLockLabel}
                          ariaLabel={`${PARTIES[index]} vote share`}
                          ariaValueText={`${formatShare(share)}${
                            isShareLocked ? ", locked" : ""
                          }`}
                          onChange={(nextShare) => handleShareChange(index, nextShare)}
                          onToggleLock={() => toggleShareLock(index)}
                        />
                      );
                    })}
                  </div>

                  <div className="space-y-3 border-t border-black/10 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                      Ideological Position
                    </p>
                    {positions.map((position, index) => {
                      const isPositionLocked = lockedPositionParties[index];
                      const positionLockLabel = isPositionLocked
                        ? `Unlock ${PARTIES[index]} ideological position`
                        : `Lock ${PARTIES[index]} ideological position`;

                      return (
                        <PartySlider
                          key={`${PARTIES[index]}-position`}
                          id={positionControlIds[index]}
                          min={POSITION_MIN}
                          max={POSITION_MAX}
                          step={POSITION_STEP}
                          value={position}
                          number={index + 1}
                          colour={PARTY_POSITION_COLOURS[index]}
                          formattedValue={formatPosition(position)}
                          isLocked={isPositionLocked}
                          lockLabel={positionLockLabel}
                          ariaLabel={`${PARTIES[index]} ideological position`}
                          ariaValueText={`${formatPosition(position)}${
                            isPositionLocked ? ", locked" : ""
                          }`}
                          onChange={(nextPosition) =>
                            handlePositionChange(index, nextPosition)
                          }
                          onToggleLock={() => togglePositionLock(index)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="border-t border-black/10 pt-5">
                <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_auto] items-center gap-x-2 gap-y-3">
                  <div className="relative h-8 px-3.5">
                    <label
                      htmlFor={effectivePartiesControlId}
                      className="absolute -left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#111111]"
                    >
                      N<sub>2</sub>
                    </label>
                    <div className="relative h-full">
                      <input
                        id={effectivePartiesControlId}
                        type="range"
                        min={EFFECTIVE_PARTIES_MIN}
                        max={EFFECTIVE_PARTIES_MAX}
                        step={EFFECTIVE_QUANTITY_STEP}
                        value={effectiveParties}
                        onChange={(event) =>
                          handleEffectivePartiesChange(Number(event.target.value))
                        }
                        className="difference-slider metric-slider absolute inset-0 h-full w-full"
                        style={
                          {
                            "--slider-color": ACCENT,
                            "--slider-position": `${effectivePartiesSliderPosition}%`
                          } as CSSProperties
                        }
                        aria-label="Effective parties"
                        aria-valuetext={effectiveParties.toFixed(2)}
                      />
                    </div>
                  </div>
                  <output
                    htmlFor={`${shareControlIds.join(" ")} ${effectivePartiesControlId}`}
                    className="text-right text-sm font-semibold tabular-nums text-[#111111]"
                    aria-live="polite"
                  >
                    {effectiveParties.toFixed(2)}
                  </output>
                  <button
                    type="button"
                    onClick={toggleContourLock}
                    className={`row-span-2 grid h-7 w-7 shrink-0 place-items-center self-center rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#CB1B12] focus:ring-offset-2 ${
                      areContoursLocked
                        ? "border-[#CB1B12]/40 bg-[#CB1B12]/10 text-[#CB1B12]"
                        : "border-black/10 bg-black/[0.025] text-black/50 hover:text-[#111111]"
                    }`}
                    aria-label={contourLockLabel}
                    aria-pressed={areContoursLocked}
                    title={contourLockLabel}
                  >
                    <LockIcon locked={areContoursLocked} />
                  </button>

                  <div className="relative h-8 px-3.5">
                    <label
                      htmlFor={effectiveBlocsControlId}
                      className="absolute -left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#111111]"
                    >
                      B<sub>2</sub>
                    </label>
                    <div className="relative h-full">
                      <input
                        id={effectiveBlocsControlId}
                        type="range"
                        min="1"
                        max={EFFECTIVE_BLOCS_MAX}
                        step={EFFECTIVE_QUANTITY_STEP}
                        value={effectiveBlocs}
                        disabled={maximumEffectiveBlocs <= 1 + 0.000001}
                        onChange={(event) =>
                          handleEffectiveBlocsChange(Number(event.target.value))
                        }
                        className={`difference-slider metric-slider absolute inset-0 h-full w-full ${
                          maximumEffectiveBlocs <= 1 + 0.000001 ? "opacity-50" : ""
                        }`}
                        style={
                          {
                            "--slider-color": BLOCS_COLOUR,
                            "--slider-position": `${effectiveBlocsSliderPosition}%`
                          } as CSSProperties
                        }
                        aria-label="Effective blocs"
                        aria-valuetext={effectiveBlocs.toFixed(2)}
                      />
                    </div>
                  </div>
                  <output
                    htmlFor={`${shareControlIds.join(" ")} ${positionControlIds.join(
                      " "
                    )} ${effectiveBlocsControlId}`}
                    className="text-right text-sm font-semibold tabular-nums text-[#111111]"
                    aria-live="polite"
                  >
                    {effectiveBlocs.toFixed(2)}
                  </output>
                </div>

              </div>
            </div>
          </div>

          <div className="flex items-center p-2 sm:p-4">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="block h-auto w-full cursor-crosshair select-none touch-none"
              style={{ touchAction: "none" }}
              role="img"
              aria-label={`Ternary plot showing Party 1 at ${formatShare(
                shares[0]
              )}, Party 2 at ${formatShare(shares[1])}, Party 3 at ${formatShare(
                shares[2]
              )}, N2 at ${effectiveParties.toFixed(
                2
              )}, and B2 at ${effectiveBlocs.toFixed(2)}`}
              onPointerDown={handlePlotPointerDown}
              onPointerMove={handlePlotPointerMove}
              onPointerUp={stopPlotPointer}
              onPointerCancel={stopPlotPointer}
            >
              <polygon
                points={VERTICES.map((vertex) => `${vertex.x},${vertex.y}`).join(" ")}
                fill="rgba(17,17,17,0.025)"
              />

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
                      stroke="rgba(17,17,17,0.09)"
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
                  fill={INK}
                  opacity="0.42"
                />
              ))}

              <polygon
                points={VERTICES.map((vertex) => `${vertex.x},${vertex.y}`).join(" ")}
                fill="transparent"
              />

              {currentEffectivePartiesContourPath ? (
                <path
                  d={currentEffectivePartiesContourPath}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="3"
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                  opacity="0.72"
                  pointerEvents="none"
                />
              ) : null}

              {currentBlocsContourPath ? (
                <path
                  d={currentBlocsContourPath}
                  fill="none"
                  stroke={BLOCS_COLOUR}
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.72"
                  pointerEvents="none"
                />
              ) : null}

              <g transform="translate(438 78)" pointerEvents="none" aria-hidden="true">
                <rect
                  width="144"
                  height="58"
                  rx="18"
                  fill="rgba(255,255,255,0.82)"
                  stroke="rgba(17,17,17,0.08)"
                />
                <line
                  x1="18"
                  x2="46"
                  y1="20"
                  y2="20"
                  stroke={ACCENT}
                  strokeWidth="3"
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                />
                <text x="58" y="25" fontSize="16" fontWeight="600" fill={INK}>
                  N₂
                </text>
                <line
                  x1="18"
                  x2="46"
                  y1="40"
                  y2="40"
                  stroke={BLOCS_COLOUR}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <text x="58" y="45" fontSize="16" fontWeight="600" fill={INK}>
                  B₂
                </text>
              </g>

              <circle cx={point.x} cy={point.y} r="22" fill={ACCENT} opacity="0.18" />
              <circle cx={point.x} cy={point.y} r="12" fill={ACCENT} stroke="#FFFFFF" strokeWidth="4" />

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
          </div>
        </div>
      </section>
    </div>
  );
}
