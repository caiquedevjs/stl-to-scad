"use strict";

const { readStlBounds } = require("../stl-to-bgsd.js");

function compareStlFiles(originalPath, reconstructedPath, options = {}) {
  const original = readStlBounds(originalPath, 1);
  const reconstructed = readStlBounds(reconstructedPath, 1);
  return compareMeshes(original, reconstructed, options);
}

function compareMeshes(original, reconstructed, options = {}) {
  const tolerance = positiveNumber(options.tolerance, 0.5);
  const requestedSamples = Math.max(100, Math.floor(positiveNumber(options.samples, 12000)));
  const originalSummary = summarizeMesh(original);
  const reconstructedSummary = summarizeMesh(reconstructed);
  const translation = [0, 1, 2].map((axis) =>
    reconstructedSummary.center[axis] - originalSummary.center[axis]);

  const originalSamples = sampleSurface(original.facets, requestedSamples)
    .map((point) => point.map((value, axis) => value + translation[axis]));
  const reconstructedSamples = sampleSurface(reconstructed.facets, requestedSamples);
  const originalBvh = buildTriangleBvh(original.facets);
  const reconstructedBvh = buildTriangleBvh(reconstructed.facets);
  const originalToReconstructed = nearestSurfaceDistances(originalSamples, reconstructedBvh);
  const reconstructedInOriginalSpace = reconstructedSamples
    .map((point) => point.map((value, axis) => value - translation[axis]));
  const reconstructedToOriginal = nearestSurfaceDistances(reconstructedInOriginalSpace, originalBvh);
  const recall = fractionWithin(originalToReconstructed, tolerance);
  const precision = fractionWithin(reconstructedToOriginal, tolerance);
  const fScore = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  const allDistances = [...originalToReconstructed, ...reconstructedToOriginal];
  const dimensionsDelta = [0, 1, 2].map((axis) =>
    Math.abs(originalSummary.size[axis] - reconstructedSummary.size[axis]));

  return {
    version: 1,
    alignment: {
      method: "aabb-center-translation",
      translation: translation.map(round6),
    },
    settings: {
      toleranceMm: tolerance,
      samplesPerMesh: requestedSamples,
    },
    original: originalSummary,
    reconstructed: reconstructedSummary,
    metrics: {
      precisionPct: round3(precision * 100),
      recallPct: round3(recall * 100),
      fScorePct: round3(fScore * 100),
      meanSurfaceDistanceMm: round6(mean(allDistances)),
      rmsSurfaceDistanceMm: round6(Math.sqrt(mean(allDistances.map((value) => value * value)))),
      p95SurfaceDistanceMm: round6(percentile(allDistances, 0.95)),
      maxSurfaceDistanceMm: round6(Math.max(...allDistances)),
      dimensionsDeltaMm: dimensionsDelta.map(round6),
      maxDimensionsDeltaMm: round6(Math.max(...dimensionsDelta)),
      surfaceAreaRatio: ratio(reconstructedSummary.surfaceAreaMm2, originalSummary.surfaceAreaMm2),
      volumeRatio: ratio(reconstructedSummary.volumeMm3, originalSummary.volumeMm3),
    },
    rating: fidelityRating(fScore * 100),
    notes: buildNotes(originalSummary, reconstructedSummary),
  };
}

function summarizeMesh(mesh) {
  const surfaceArea = mesh.facets.reduce((sum, facet) => sum + facet.area, 0);
  const signedVolume = mesh.facets.reduce((sum, facet) => {
    const [a, b, c] = facet.points;
    return sum + dot(a, cross(b, c)) / 6;
  }, 0);
  const edgeCounts = new Map();
  for (const facet of mesh.facets) {
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const first = pointKey(facet.points[a]);
      const second = pointKey(facet.points[b]);
      const key = first < second ? `${first}|${second}` : `${second}|${first}`;
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    }
  }
  const boundaryEdges = [...edgeCounts.values()].filter((count) => count !== 2).length;
  return {
    triangles: mesh.facets.length,
    size: mesh.size.map(round6),
    center: [0, 1, 2].map((axis) => round6((mesh.min[axis] + mesh.max[axis]) / 2)),
    surfaceAreaMm2: round3(surfaceArea),
    volumeMm3: round3(Math.abs(signedVolume)),
    boundaryEdges,
    watertight: boundaryEdges === 0,
  };
}

function sampleSurface(facets, count) {
  const totalArea = facets.reduce((sum, facet) => sum + facet.area, 0);
  if (!facets.length || totalArea <= 0) throw new Error("Mesh has no measurable surface.");
  const cumulative = [];
  let area = 0;
  for (const facet of facets) {
    area += facet.area;
    cumulative.push(area);
  }
  const points = [];
  let facetIndex = 0;
  for (let index = 0; index < count; index++) {
    const target = (index + 0.5) / count * totalArea;
    while (facetIndex < cumulative.length - 1 && cumulative[facetIndex] < target) facetIndex++;
    let u = halton(index + 1, 2);
    let v = halton(index + 1, 3);
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const [a, b, c] = facets[facetIndex].points;
    points.push([0, 1, 2].map((axis) => a[axis] + u * (b[axis] - a[axis]) + v * (c[axis] - a[axis])));
  }
  return points;
}

function buildKdTree(points, depth = 0) {
  if (!points.length) return null;
  const axis = depth % 3;
  const sorted = [...points].sort((a, b) => a[axis] - b[axis]);
  const middle = Math.floor(sorted.length / 2);
  return {
    point: sorted[middle],
    axis,
    left: buildKdTree(sorted.slice(0, middle), depth + 1),
    right: buildKdTree(sorted.slice(middle + 1), depth + 1),
  };
}

function nearestDistances(points, tree) {
  return points.map((point) => Math.sqrt(nearestDistanceSquared(point, tree, Infinity)));
}

function nearestDistanceSquared(point, node, best) {
  if (!node) return best;
  const distance = squaredDistance(point, node.point);
  let closest = Math.min(best, distance);
  const difference = point[node.axis] - node.point[node.axis];
  const near = difference <= 0 ? node.left : node.right;
  const far = difference <= 0 ? node.right : node.left;
  closest = nearestDistanceSquared(point, near, closest);
  if (difference * difference < closest) closest = nearestDistanceSquared(point, far, closest);
  return closest;
}

function buildTriangleBvh(facets, leafSize = 8) {
  if (!facets.length) return null;
  const bounds = facetBounds(facets);
  if (facets.length <= leafSize) return { bounds, facets };
  const extents = [0, 1, 2].map((axis) => bounds.max[axis] - bounds.min[axis]);
  const axis = extents.indexOf(Math.max(...extents));
  const sorted = [...facets].sort((a, b) => a.centroid[axis] - b.centroid[axis]);
  const middle = Math.floor(sorted.length / 2);
  return {
    bounds,
    left: buildTriangleBvh(sorted.slice(0, middle), leafSize),
    right: buildTriangleBvh(sorted.slice(middle), leafSize),
  };
}

function nearestSurfaceDistances(points, bvh) {
  return points.map((point) => Math.sqrt(nearestSurfaceDistanceSquared(point, bvh, Infinity)));
}

function nearestSurfaceDistanceSquared(point, node, best) {
  if (!node || distanceToBoundsSquared(point, node.bounds) >= best) return best;
  if (node.facets) {
    let closest = best;
    for (const facet of node.facets) closest = Math.min(closest, pointTriangleDistanceSquared(point, ...facet.points));
    return closest;
  }
  const leftDistance = node.left ? distanceToBoundsSquared(point, node.left.bounds) : Infinity;
  const rightDistance = node.right ? distanceToBoundsSquared(point, node.right.bounds) : Infinity;
  const first = leftDistance <= rightDistance ? node.left : node.right;
  const second = leftDistance <= rightDistance ? node.right : node.left;
  let closest = nearestSurfaceDistanceSquared(point, first, best);
  closest = nearestSurfaceDistanceSquared(point, second, closest);
  return closest;
}

function pointTriangleDistanceSquared(point, a, b, c) {
  const ab = subtract(b, a);
  const ac = subtract(c, a);
  const ap = subtract(point, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return squaredDistance(point, a);

  const bp = subtract(point, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return squaredDistance(point, b);

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return squaredDistance(point, addScaled(a, ab, v));
  }

  const cp = subtract(point, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return squaredDistance(point, c);

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return squaredDistance(point, addScaled(a, ac, w));
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return squaredDistance(point, addScaled(b, subtract(c, b), w));
  }

  const denominator = 1 / (va + vb + vc);
  const v = vb * denominator;
  const w = vc * denominator;
  return squaredDistance(point, [0, 1, 2].map((axis) => a[axis] + ab[axis] * v + ac[axis] * w));
}

function facetBounds(facets) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const facet of facets) {
    for (const point of facet.points) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], point[axis]);
        max[axis] = Math.max(max[axis], point[axis]);
      }
    }
  }
  return { min, max };
}

function distanceToBoundsSquared(point, bounds) {
  let distance = 0;
  for (let axis = 0; axis < 3; axis++) {
    const delta = point[axis] < bounds.min[axis]
      ? bounds.min[axis] - point[axis]
      : point[axis] > bounds.max[axis] ? point[axis] - bounds.max[axis] : 0;
    distance += delta * delta;
  }
  return distance;
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function addScaled(origin, direction, scale) {
  return [0, 1, 2].map((axis) => origin[axis] + direction[axis] * scale);
}

function fidelityRating(score) {
  if (score >= 95) return "excellent";
  if (score >= 85) return "good";
  if (score >= 70) return "partial";
  return "low";
}

function buildNotes(original, reconstructed) {
  const notes = [];
  if (!original.watertight) notes.push("Original STL is not watertight; its volume may be unreliable.");
  if (!reconstructed.watertight) notes.push("Reconstructed STL is not watertight; its volume may be unreliable.");
  return notes;
}

function fractionWithin(values, tolerance) {
  return values.filter((value) => value <= tolerance).length / values.length;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * (sorted.length - 1)))];
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function ratio(value, reference) {
  return reference > 0 ? round6(value / reference) : null;
}

function positiveNumber(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}

function halton(index, base) {
  let result = 0;
  let fraction = 1 / base;
  let current = index;
  while (current > 0) {
    result += fraction * (current % base);
    current = Math.floor(current / base);
    fraction /= base;
  }
  return result;
}

function pointKey(point) {
  return point.map((value) => Math.round(value * 10000)).join(",");
}

function squaredDistance(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function round3(value) {
  return Number(value.toFixed(3));
}

function round6(value) {
  return Number(value.toFixed(6));
}

module.exports = {
  buildKdTree,
  buildTriangleBvh,
  compareMeshes,
  compareStlFiles,
  nearestDistanceSquared,
  nearestSurfaceDistanceSquared,
  pointTriangleDistanceSquared,
  sampleSurface,
  summarizeMesh,
};
