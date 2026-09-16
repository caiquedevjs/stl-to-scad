"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const converter = require("../stl-to-bgsd.js");
const fidelity = require("../tools/stl-fidelity.js");
const { formatSummary } = require("../tools/validate-fidelity.js");

test("gives identical surfaces a perfect bidirectional score", () => {
  const soloPath = path.join(__dirname, "..", "Solo.stl");
  const mesh = converter.readStlBounds(soloPath, 1);
  const report = fidelity.compareMeshes(mesh, mesh, { samples: 800, tolerance: 0.01 });

  assert.equal(report.metrics.precisionPct, 100);
  assert.equal(report.metrics.recallPct, 100);
  assert.equal(report.metrics.fScorePct, 100);
  assert.equal(report.metrics.meanSurfaceDistanceMm, 0);
  assert.equal(report.rating, "excellent");
});

test("center alignment removes translation without hiding dimension changes", () => {
  const soloPath = path.join(__dirname, "..", "Solo.stl");
  const solo = converter.readStlBounds(soloPath, 1);
  const translated = transformMesh(solo, (point) => [point[0] + 20, point[1] - 15, point[2] + 7]);
  const aligned = fidelity.compareMeshes(solo, translated, { samples: 500, tolerance: 0.01 });
  assert.equal(aligned.metrics.fScorePct, 100);
  assert.deepEqual(aligned.alignment.translation, [20, -15, 7]);

  const stretched = transformMesh(solo, (point) => [point[0] * 1.1, point[1], point[2]]);
  const changed = fidelity.compareMeshes(solo, stretched, { samples: 500, tolerance: 0.1 });
  assert.ok(changed.metrics.fScorePct < 100);
  assert.ok(changed.metrics.maxDimensionsDeltaMm > 3);
});

test("summary exposes the score and diagnostic measurements", () => {
  const soloPath = path.join(__dirname, "..", "Solo.stl");
  const report = fidelity.compareStlFiles(soloPath, soloPath, { samples: 300, tolerance: 0.1 });
  const summary = formatSummary(report);
  assert.match(summary, /Fidelity: 100%/);
  assert.match(summary, /surface distance/);
  assert.match(summary, /watertight/);
});

function transformMesh(mesh, transform) {
  const facets = mesh.facets.map((facet) => {
    const points = facet.points.map(transform);
    return {
      ...facet,
      points,
      centroid: [0, 1, 2].map((axis) => (points[0][axis] + points[1][axis] + points[2][axis]) / 3),
    };
  });
  const allPoints = facets.flatMap((facet) => facet.points);
  const min = [0, 1, 2].map((axis) => Math.min(...allPoints.map((point) => point[axis])));
  const max = [0, 1, 2].map((axis) => Math.max(...allPoints.map((point) => point[axis])));
  return { ...mesh, facets, min, max, size: [0, 1, 2].map((axis) => max[axis] - min[axis]) };
}
