#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_INCLUDE = "../lib/boardgame_insert_toolkit_lib.4.scad";
const DEFAULT_SCHEMA = path.join(__dirname, "BGSD-src", "schema", "bit.schema.json");

function usage(exitCode = 0) {
  const script = path.basename(process.argv[1] || "stl-to-bgsd.js");
  console.log(`Usage:
  node ${script} [options] <file-or-glob> [...]

Options:
  --out <dir>              Output directory. Default: my_designs
  --include <file>         BIT include file. Default: ${DEFAULT_INCLUDE}
  --combined <file>        Also write one SCAD containing all input STLs.
  --bit-config <file>      JSON overrides using every key supported by the BIT schema.
  --schema <file>          BIT schema used to validate --bit-config.
  --validate-fidelity     Render each SCAD and write a surface-comparison JSON report.
  --fidelity-tolerance <mm> Match tolerance for fidelity. Default: 0.5
  --fidelity-samples <n>  Surface samples per mesh. Default: 6000
  --openscad <file>       Explicit OpenSCAD executable for fidelity validation.
  --no-fidelity-preview  Do not create the side-by-side/overlay PNG.
  --clearance <mm>         Add clearance to generated compartment size. Default: 0
  --wall <mm>              Initial wall thickness for the editable box. Default: 2
  --bottom <mm>            Initial bottom thickness for the editable box. Default: 2
  --height-extra <mm>      Extra compartment height. Default: 0
  --scale <factor>         Scale STL coordinates before measuring. Default: 1
  --fit-container          Old mode: create a larger storage box around the STL bounds.
  --no-detect-components   Disable straight-wall compartment detection.
  --no-infer-geometry      Disable automatic shape and side-cutout inference.
  --box-label <text>       Add a box-level LABEL.
  --lid-label <text>       Add a LABEL inside BOX_LID. Use with --with-lid.
  --feature-labels         Add one LABEL per detected compartment.
  --label-placement <pos>  Label placement constant. Default: CENTER
  --label-size <value>     Label size number or AUTO. Default: AUTO
  --label-depth <mm>       Label cut/emboss depth. Default: 0.2
  --cutouts <mode>         none, all, front,back,left,right, or alternate-lr. Default: none
  --cutout-type <type>     INTERIOR, EXTERIOR, or BOTH. Default: BOTH
  --cutout-height <pct>    Cutout height percent. Default: 100
  --cutout-depth <pct>     Cutout depth percent. Default: 25
  --cutout-width <pct>     Cutout width percent. Default: 50
  --cutout-bottom          Add bottom push-out cutout.
  --no-feature             Create boxes only, without an initial BOX_FEATURE cavity.
  --no-lid                 Add BOX_NO_LID_B true. Default: true
  --with-lid               Do not add BOX_NO_LID_B.
  --flat                   Emit BGSD flat OBJECT_BOX syntax. Default: true
  --help                   Show this help.

Examples:
  node ${script} *.stl
  node ${script} --combined all-inserts.scad --clearance 1 *.stl
  node ${script} --with-lid --lid-label "Tiles" *.stl
  node ${script} --cutouts alternate-lr *.stl
  node ${script} --validate-fidelity --fidelity-tolerance 0.5 *.stl
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const opts = {
    outDir: "my_designs",
    includeFile: DEFAULT_INCLUDE,
    includeExplicit: false,
    combinedFile: null,
    bitConfigFile: null,
    schemaFile: DEFAULT_SCHEMA,
    validateFidelity: false,
    fidelityTolerance: 0.5,
    fidelitySamples: 6000,
    openScadPath: null,
    fidelityPreview: true,
    clearance: 0,
    wall: 2,
    bottom: 2,
    heightExtra: 0,
    scale: 1,
    feature: true,
    noLid: true,
    fitContainer: false,
    detectComponents: true,
    inferGeometry: true,
    boxLabelText: "",
    lidLabelText: "",
    featureLabels: false,
    labelPlacement: "CENTER",
    labelSize: "AUTO",
    labelDepth: 0.2,
    cutoutMode: "none",
    cutoutType: "BOTH",
    cutoutHeightPct: 100,
    cutoutDepthPct: 25,
    cutoutWidthPct: 50,
    cutoutBottom: false,
  };
  const inputs = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--out") {
      opts.outDir = requireValue(argv, ++i, arg);
    } else if (arg === "--include") {
      opts.includeFile = requireValue(argv, ++i, arg);
      opts.includeExplicit = true;
    } else if (arg === "--combined") {
      opts.combinedFile = requireValue(argv, ++i, arg);
    } else if (arg === "--bit-config") {
      opts.bitConfigFile = requireValue(argv, ++i, arg);
    } else if (arg === "--schema") {
      opts.schemaFile = requireValue(argv, ++i, arg);
    } else if (arg === "--validate-fidelity") {
      opts.validateFidelity = true;
    } else if (arg === "--fidelity-tolerance") {
      opts.fidelityTolerance = parsePositiveNumber(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--fidelity-samples") {
      opts.fidelitySamples = Math.floor(parsePositiveNumber(requireValue(argv, ++i, arg), arg));
      if (opts.fidelitySamples < 100) die(`${arg} must be at least 100.`);
    } else if (arg === "--openscad") {
      opts.openScadPath = requireValue(argv, ++i, arg);
    } else if (arg === "--no-fidelity-preview") {
      opts.fidelityPreview = false;
    } else if (arg === "--clearance") {
      opts.clearance = parseNumber(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--wall") {
      opts.wall = parseNumber(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--bottom") {
      opts.bottom = parseNumber(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--height-extra") {
      opts.heightExtra = parseNumber(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--scale") {
      opts.scale = parseNumber(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--fit-container") {
      opts.fitContainer = true;
    } else if (arg === "--no-detect-components") {
      opts.detectComponents = false;
    } else if (arg === "--no-infer-geometry") {
      opts.inferGeometry = false;
    } else if (arg === "--box-label") {
      opts.boxLabelText = requireValue(argv, ++i, arg);
    } else if (arg === "--lid-label") {
      opts.lidLabelText = requireValue(argv, ++i, arg);
    } else if (arg === "--feature-labels") {
      opts.featureLabels = true;
    } else if (arg === "--label-placement") {
      opts.labelPlacement = requireValue(argv, ++i, arg).toUpperCase();
    } else if (arg === "--label-size") {
      opts.labelSize = parseScadValue(requireValue(argv, ++i, arg));
    } else if (arg === "--label-depth") {
      opts.labelDepth = parseNumber(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--cutouts") {
      opts.cutoutMode = requireValue(argv, ++i, arg).toLowerCase();
    } else if (arg === "--cutout-type") {
      opts.cutoutType = requireValue(argv, ++i, arg).toUpperCase();
    } else if (arg === "--cutout-height") {
      opts.cutoutHeightPct = parseNumber(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--cutout-depth") {
      opts.cutoutDepthPct = parseNumber(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--cutout-width") {
      opts.cutoutWidthPct = parseNumber(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--cutout-bottom") {
      opts.cutoutBottom = true;
    } else if (arg === "--no-feature") {
      opts.feature = false;
    } else if (arg === "--no-lid") {
      opts.noLid = true;
    } else if (arg === "--with-lid") {
      opts.noLid = false;
    } else if (arg === "--flat") {
      // Kept for readability and future compatibility; flat syntax is always used.
    } else if (arg.startsWith("-")) {
      die(`Unknown option: ${arg}`);
    } else {
      inputs.push(arg);
    }
  }

  if (inputs.length === 0) usage(1);
  return { opts, inputs };
}

function requireValue(argv, index, opt) {
  if (index >= argv.length || argv[index].startsWith("--")) die(`${opt} requires a value.`);
  return argv[index];
}

function parseNumber(raw, opt) {
  const value = Number(raw);
  if (!Number.isFinite(value)) die(`${opt} must be a number.`);
  return value;
}

function parsePositiveNumber(raw, opt) {
  const value = parseNumber(raw, opt);
  if (value <= 0) die(`${opt} must be greater than zero.`);
  return value;
}

function parseScadValue(raw) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : String(raw || "").toUpperCase();
}

function die(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function expandInputs(patterns) {
  const files = [];
  for (const pattern of patterns) {
    if (!hasWildcard(pattern)) {
      files.push(pattern);
      continue;
    }

    const absolutePattern = path.resolve(pattern);
    const dir = path.dirname(absolutePattern);
    const basePattern = path.basename(absolutePattern);
    const regex = wildcardToRegex(basePattern);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (regex.test(entry)) files.push(path.join(dir, entry));
    }
  }
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

function hasWildcard(value) {
  return /[*?]/.test(value);
}

function wildcardToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");
}

function readStlBounds(filePath, scale) {
  const buffer = fs.readFileSync(filePath);
  const binaryFacetCount = buffer.length >= 84 ? buffer.readUInt32LE(80) : -1;
  const binarySize = 84 + binaryFacetCount * 50;
  const looksBinary = binaryFacetCount >= 0 && binarySize === buffer.length;

  if (looksBinary) return readBinaryStlBounds(buffer, scale);
  return readAsciiStlBounds(buffer.toString("utf8"), scale);
}

function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
    vertices: 0,
    triangles: 0,
    planes: { x: new Map(), y: new Map(), z: new Map() },
    facets: [],
  };
}

function includeVertex(bounds, x, y, z, scale) {
  const values = [x * scale, y * scale, z * scale];
  for (let axis = 0; axis < 3; axis++) {
    if (values[axis] < bounds.min[axis]) bounds.min[axis] = values[axis];
    if (values[axis] > bounds.max[axis]) bounds.max[axis] = values[axis];
  }
  bounds.vertices++;
}

function triangleArea(a, b, c) {
  const ax = b[0] - a[0];
  const ay = b[1] - a[1];
  const az = b[2] - a[2];
  const bx = c[0] - a[0];
  const by = c[1] - a[1];
  const bz = c[2] - a[2];
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  return Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
}

function addPlaneArea(bounds, axis, coord, area) {
  const key = roundTo(coord, 2);
  const planes = bounds.planes[axis];
  planes.set(key, (planes.get(key) || 0) + area);
}

function includeTriangle(bounds, pts) {
  const area = triangleArea(pts[0], pts[1], pts[2]);
  const normal = triangleNormal(pts[0], pts[1], pts[2]);
  bounds.facets.push({
    points: pts.map((point) => [...point]),
    normal,
    area,
    centroid: [0, 1, 2].map((axis) => (pts[0][axis] + pts[1][axis] + pts[2][axis]) / 3),
  });
  for (const [axis, index] of [["x", 0], ["y", 1], ["z", 2]]) {
    const values = pts.map((pt) => pt[index]);
    if (Math.max(...values) - Math.min(...values) < 0.02) {
      addPlaneArea(bounds, axis, (values[0] + values[1] + values[2]) / 3, area);
    }
  }
}

function triangleNormal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const length = Math.hypot(...cross);
  return length > 0 ? cross.map((value) => value / length) : [0, 0, 0];
}

function readBinaryStlBounds(buffer, scale) {
  const bounds = emptyBounds();
  const triangles = buffer.readUInt32LE(80);
  let offset = 84;

  for (let i = 0; i < triangles; i++) {
    offset += 12; // normal
    const pts = [];
    for (let vertex = 0; vertex < 3; vertex++) {
      const pt = [
        buffer.readFloatLE(offset) * scale,
        buffer.readFloatLE(offset + 4) * scale,
        buffer.readFloatLE(offset + 8) * scale,
      ];
      pts.push(pt);
      includeVertex(
        bounds,
        pt[0],
        pt[1],
        pt[2],
        1,
      );
      offset += 12;
    }
    includeTriangle(bounds, pts);
    offset += 2; // attribute byte count
  }

  bounds.triangles = triangles;
  return finalizeBounds(bounds);
}

function readAsciiStlBounds(text, scale) {
  const bounds = emptyBounds();
  const vertexRe = /^\s*vertex\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)/gim;
  let match;
  const pts = [];
  while ((match = vertexRe.exec(text))) {
    const pt = [Number(match[1]) * scale, Number(match[2]) * scale, Number(match[3]) * scale];
    includeVertex(bounds, pt[0], pt[1], pt[2], 1);
    pts.push(pt);
    if (pts.length === 3) {
      includeTriangle(bounds, pts.splice(0, 3));
    }
  }
  bounds.triangles = Math.floor(bounds.vertices / 3);
  return finalizeBounds(bounds);
}

function finalizeBounds(bounds) {
  if (bounds.vertices === 0) throw new Error("No STL vertices found.");
  bounds.size = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  return bounds;
}

function createModel(filePath, bounds, opts) {
  const sourceName = path.basename(filePath);
  const name = sanitizeScadString(path.basename(filePath, path.extname(filePath)));
  const detected = opts.detectComponents ? detectCompartments(bounds, opts.bottom) : null;
  const wallThickness = round(detected?.wallThickness || opts.wall);
  const bottomThickness = round(detected?.bottomThickness || opts.bottom);

  let boxSize;
  let features;

  if (opts.fitContainer) {
    boxSize = [
      round(bounds.size[0] + opts.wall * 2 + opts.clearance * 2),
      round(bounds.size[1] + opts.wall * 2 + opts.clearance * 2),
      round(bounds.size[2] + opts.bottom + opts.heightExtra),
    ];
    features = [{
      name: `${name} cavity`,
      size: [
        round(bounds.size[0] + opts.clearance * 2),
        round(bounds.size[1] + opts.clearance * 2),
        round(bounds.size[2] + opts.heightExtra),
      ],
      position: ["CENTER", "CENTER"],
      detected: false,
    }];
  } else {
    boxSize = bounds.size.map(round);
    features = buildDetectedFeatures(name, bounds, detected, wallThickness, opts);
  }

  return {
    sourcePath: filePath,
    sourceName,
    name,
    bounds,
    boxSize,
    wallThickness,
    bottomThickness,
    features,
    detected,
  };
}

function detectCompartments(bounds, fallbackBottom = 2) {
  const xBands = filterPartialInteriorBands(bounds, 0, detectWallBands(bounds.planes.x, bounds.min[0], bounds.max[0]));
  const yBands = filterPartialInteriorBands(bounds, 1, detectWallBands(bounds.planes.y, bounds.min[1], bounds.max[1]));
  const zBands = detectWallBands(bounds.planes.z);
  const wallThickness = median([...xBands, ...yBands].map((band) => band.width).filter((value) => value > 0)) || 2;
  const bottomBand = zBands.find((band) => Math.abs(band.low - bounds.min[2]) <= 0.1);
  const bottomThickness = bottomBand?.width || fallbackBottom;
  const xIntervals = intervalsBetweenBands(xBands, bounds.min[0], bounds.max[0], wallThickness);
  const yIntervals = intervalsBetweenBands(yBands, bounds.min[1], bounds.max[1], wallThickness);
  const componentCount = xIntervals.length * yIntervals.length;
  const cutouts = detectSideCutouts(bounds, wallThickness, bottomThickness);
  const profileCuts = detectExternalProfileCuts(bounds, wallThickness);

  return {
    wallThickness,
    bottomThickness,
    xBands,
    yBands,
    zBands,
    xIntervals,
    yIntervals,
    componentCount,
    cutouts,
    profileCuts,
    detected: componentCount > 1,
  };
}

function detectExternalProfileCuts(bounds, wallThickness = 2) {
  const edgeRange = (axis, edge, crossAxis) => {
    const points = bounds.facets
      .filter((facet) => Math.abs(facet.normal[axis]) >= 0.98 && Math.abs(facet.centroid[axis] - edge) <= 0.1)
      .flatMap((facet) => facet.points);
    if (!points.length) return null;
    const values = points.map((point) => point[crossAxis]);
    return { min: Math.min(...values), max: Math.max(...values) };
  };
  const xEdges = [bounds.min[0], bounds.max[0]].map((edge) => edgeRange(0, edge, 1));
  const yEdges = [bounds.min[1], bounds.max[1]].map((edge) => edgeRange(1, edge, 0));
  const minimumCut = Math.max(2, wallThickness * 2);
  const cuts = [];

  for (let xSide = 0; xSide <= 1; xSide++) {
    for (let ySide = 0; ySide <= 1; ySide++) {
      const xRange = xEdges[xSide];
      const yRange = yEdges[ySide];
      if (!xRange || !yRange) continue;
      const xInner = xSide === 0 ? yRange.min : yRange.max;
      const yInner = ySide === 0 ? xRange.min : xRange.max;
      const xOuter = bounds[xSide === 0 ? "min" : "max"][0];
      const yOuter = bounds[ySide === 0 ? "min" : "max"][1];
      const width = Math.abs(xOuter - xInner);
      const depth = Math.abs(yOuter - yInner);
      if (width < minimumCut || depth < minimumCut) continue;
      cuts.push({
        corner: `${ySide === 0 ? "front" : "back"}-${xSide === 0 ? "left" : "right"}`,
        min: [round(Math.min(xOuter, xInner) - bounds.min[0]), round(Math.min(yOuter, yInner) - bounds.min[1])],
        size: [round(width), round(depth)],
        confidence: "high",
      });
    }
  }
  return cuts;
}

function detectSideCutouts(bounds, wallThickness, bottomThickness) {
  const [sizeX, sizeY, sizeZ] = bounds.size;
  const topThreshold = bounds.min[2] + Math.max(bottomThickness, sizeZ * 0.2);
  const sideDefinitions = [
    { name: "front", axis: 1, crossAxis: 0, edge: bounds.min[1], direction: 1, depthLimit: Math.max(wallThickness * 4, sizeY * 0.3) },
    { name: "back", axis: 1, crossAxis: 0, edge: bounds.max[1], direction: -1, depthLimit: Math.max(wallThickness * 4, sizeY * 0.3) },
    { name: "left", axis: 0, crossAxis: 1, edge: bounds.min[0], direction: 1, depthLimit: Math.max(wallThickness * 4, sizeX * 0.3) },
    { name: "right", axis: 0, crossAxis: 1, edge: bounds.max[0], direction: -1, depthLimit: Math.max(wallThickness * 4, sizeX * 0.3) },
  ];

  return sideDefinitions.flatMap((side) => {
    const facets = bounds.facets.filter((facet) => {
      const normal = facet.normal.map(Math.abs);
      const alongDepth = (facet.centroid[side.axis] - side.edge) * side.direction;
      const axisNormal = normal[side.axis];
      const crossNormal = normal[side.crossAxis];
      const cylindricalCut = axisNormal >= 0.12 && normal[2] >= 0.12 && crossNormal <= 0.25;
      const planCut = axisNormal >= 0.08 && crossNormal >= 0.08 && normal[2] <= 0.15;
      return alongDepth >= -0.1 && alongDepth <= side.depthLimit &&
        facet.centroid[2] >= topThreshold && (cylindricalCut || planCut) && facet.area >= 0.01;
    });
    const area = facets.reduce((sum, facet) => sum + facet.area, 0);
    const points = facets.flatMap((facet) => facet.points);
    if (!points.length) {
      const planarOpenings = detectPlanarSideOpenings(bounds, side, wallThickness);
      if (planarOpenings.length) return planarOpenings;
      return [{ side: side.name, detected: false, confidence: "low", facets: 0, area: 0 }];
    }
    const crossValues = points.map((point) => point[side.crossAxis]);
    const depthValues = points.map((point) => (point[side.axis] - side.edge) * side.direction);
    const zValues = points.map((point) => point[2]);
    const crossSpan = Math.max(...crossValues) - Math.min(...crossValues);
    const confidence = facets.length >= 8 && area >= 20 && crossSpan >= wallThickness * 2
      ? "high"
      : facets.length >= 2 && area >= 8 && crossSpan >= wallThickness * 1.5 ? "medium" : "low";
    return [{
      side: side.name,
      detected: confidence !== "low",
      confidence,
      facets: facets.length,
      area: round(area),
      crossMin: Math.min(...crossValues),
      crossMax: Math.max(...crossValues),
      cutoutType: Math.min(...depthValues) <= Math.max(0.15, wallThickness * 0.5) ? "BOTH" : "INTERIOR",
      depth: Math.max(...depthValues) - Math.min(...depthValues),
      height: Math.max(...zValues) - Math.min(...zValues),
    }];
  });
}

function detectPlanarSideOpenings(bounds, side, wallThickness) {
  const planeFacets = bounds.facets.filter((facet) =>
    facet.points.every((point) => Math.abs(point[side.axis] - side.edge) <= 0.02));
  if (planeFacets.length < 2) return [];

  const crossMin = bounds.min[side.crossAxis];
  const crossMax = bounds.max[side.crossAxis];
  const zMin = bounds.min[2];
  const zMax = bounds.max[2];
  const samples = 31;
  const openings = [];

  for (let index = 0; index < samples; index++) {
    const z = zMin + (zMax - zMin) * ((index + 0.5) / samples);
    const intervals = planeFacets
      .map((facet) => triangleIntervalAtZ(facet.points, side.crossAxis, z))
      .filter(Boolean)
      .sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const interval of intervals) {
      const previous = merged.at(-1);
      if (previous && interval[0] <= previous[1] + 0.05) previous[1] = Math.max(previous[1], interval[1]);
      else merged.push([...interval]);
    }
    for (let gapIndex = 0; gapIndex < merged.length - 1; gapIndex++) {
      const start = Math.max(crossMin, merged[gapIndex][1]);
      const end = Math.min(crossMax, merged[gapIndex + 1][0]);
      if (end - start >= wallThickness * 2) openings.push({ start, end, z });
    }
  }

  if (!openings.length) return [];
  const groups = [];
  for (const opening of openings) {
    let group = groups.find((candidate) =>
      opening.end >= candidate.minStart - wallThickness && opening.start <= candidate.maxEnd + wallThickness);
    if (!group) {
      group = { values: [], minStart: opening.start, maxEnd: opening.end };
      groups.push(group);
    }
    group.values.push(opening);
    group.minStart = Math.min(group.minStart, opening.start);
    group.maxEnd = Math.max(group.maxEnd, opening.end);
  }

  return groups.filter((group) => group.values.length >= Math.ceil(samples * 0.3)).map((group) => {
    const starts = group.values.map((opening) => opening.start);
    const ends = group.values.map((opening) => opening.end);
    const zValues = group.values.map((opening) => opening.z);
    const width = median(ends) - median(starts);
    const sampleStep = (zMax - zMin) / samples;
    const height = Math.min(zMax - zMin, Math.max(...zValues) - Math.min(...zValues) + sampleStep);
    const confidence = group.values.length >= Math.ceil(samples * 0.7) && width >= wallThickness * 4 ? "high" : "medium";
    return {
      side: side.name,
      detected: true,
      confidence,
      facets: planeFacets.length,
      area: round(width * height),
      crossMin: round(median(starts)),
      crossMax: round(median(ends)),
      cutoutType: "BOTH",
      depth: wallThickness,
      height: round(height),
      planarOpening: true,
    };
  });
}

function triangleIntervalAtZ(points, crossAxis, z) {
  const values = [];
  for (let index = 0; index < 3; index++) {
    const a = points[index];
    const b = points[(index + 1) % 3];
    const low = Math.min(a[2], b[2]);
    const high = Math.max(a[2], b[2]);
    if (z < low - 1e-6 || z > high + 1e-6) continue;
    if (Math.abs(b[2] - a[2]) <= 1e-9) {
      if (Math.abs(z - a[2]) <= 1e-6) values.push(a[crossAxis], b[crossAxis]);
      continue;
    }
    const ratio = (z - a[2]) / (b[2] - a[2]);
    if (ratio >= -1e-6 && ratio <= 1 + 1e-6) values.push(a[crossAxis] + (b[crossAxis] - a[crossAxis]) * ratio);
  }
  if (values.length < 2) return null;
  return [Math.min(...values), Math.max(...values)];
}

function detectFeatureShape(bounds, xInterval, yInterval, bottomThickness) {
  const zMin = bounds.min[2] + bottomThickness + 0.1;
  let planarArea = 0;
  let curvedArea = 0;
  let curvedFacets = 0;
  const margin = 0.2;
  for (const facet of bounds.facets) {
    const [x, y, z] = facet.centroid;
    if (x < xInterval.start - margin || x > xInterval.end + margin ||
        y < yInterval.start - margin || y > yInterval.end + margin || z < zMin) continue;
    const [nx, ny, nz] = facet.normal.map(Math.abs);
    if (nz > 0.15) continue;
    const diagonal = nx > 0.08 && ny > 0.08;
    if (diagonal) {
      curvedArea += facet.area;
      curvedFacets++;
    } else if (nx > 0.9 || ny > 0.9) {
      planarArea += facet.area;
    }
  }
  const ratio = curvedArea / Math.max(1, curvedArea + planarArea);
  if (curvedFacets >= 12 && ratio >= 0.45) return { shape: "ROUND", confidence: "high", curvedRatio: round(ratio) };
  if (curvedFacets >= 6 && ratio >= 0.04) return { shape: "FILLET", confidence: ratio >= 0.12 ? "high" : "medium", curvedRatio: round(ratio) };
  return { shape: "SQUARE", confidence: planarArea > 20 ? "high" : "medium", curvedRatio: round(ratio) };
}

function detectWallBands(planeMap, minimum = null, maximum = null) {
  const entries = [...planeMap.entries()].sort((a, b) => a[0] - b[0]);
  if (entries.length < 2) return [];

  const maxArea = Math.max(...entries.map((entry) => entry[1]));
  const selected = new Map(entries.filter(([, area]) => area >= maxArea * 0.3));
  for (const [edge, direction] of [[minimum, 1], [maximum, -1]]) {
    if (!Number.isFinite(edge)) continue;
    const boundary = entries.find(([coordinate]) => Math.abs(coordinate - edge) <= 0.05);
    if (!boundary || boundary[1] < maxArea * 0.1) continue;
    const inward = entries.filter(([coordinate, area]) => {
      const distance = (coordinate - edge) * direction;
      return distance >= 0.35 && distance <= 4 && area >= maxArea * 0.1;
    }).sort((a, b) => Math.abs(a[0] - edge) - Math.abs(b[0] - edge))[0];
    if (inward) {
      selected.set(boundary[0], boundary[1]);
      selected.set(inward[0], inward[1]);
    }
  }
  const significant = [...selected.entries()].sort((a, b) => a[0] - b[0]);

  const bands = [];
  for (let i = 0; i < significant.length - 1; i++) {
    const low = significant[i][0];
    const high = significant[i + 1][0];
    const width = high - low;
    if (width >= 0.35 && width <= 4) {
      bands.push({ low, high, width: round(width), area: significant[i][1] + significant[i + 1][1] });
      i++;
    }
  }
  return bands;
}

function filterPartialInteriorBands(bounds, axis, bands) {
  if (bands.length <= 2) return bands;
  const crossAxis = axis === 0 ? 1 : 0;
  const requiredSpan = bounds.size[crossAxis] * 0.75;
  return bands.filter((band, index) => {
    if (index === 0 || index === bands.length - 1) return true;
    const points = bounds.facets
      .filter((facet) => Math.abs(facet.normal[axis]) >= 0.98 &&
        (Math.abs(facet.centroid[axis] - band.low) <= 0.1 || Math.abs(facet.centroid[axis] - band.high) <= 0.1))
      .flatMap((facet) => facet.points);
    if (!points.length) return false;
    const values = points.map((point) => point[crossAxis]);
    return Math.max(...values) - Math.min(...values) >= requiredSpan;
  });
}

function intervalsBetweenBands(bands, min, max, wallThickness) {
  if (bands.length < 2) {
    return [{
      start: round(min + wallThickness),
      end: round(max - wallThickness),
      size: round(max - min - wallThickness * 2),
    }];
  }

  const intervals = [];
  for (let i = 0; i < bands.length - 1; i++) {
    const start = bands[i].high;
    const end = bands[i + 1].low;
    const size = end - start;
    if (size > 5) intervals.push({ start: round(start), end: round(end), size: round(size) });
  }
  return intervals.length ? intervals : [{
    start: round(min + wallThickness),
    end: round(max - wallThickness),
    size: round(max - min - wallThickness * 2),
  }];
}

function buildDetectedFeatures(name, bounds, detected, wallThickness, opts) {
  const xIntervals = detected?.xIntervals?.length ? detected.xIntervals : intervalsBetweenBands([], bounds.min[0], bounds.max[0], wallThickness);
  const sourceYIntervals = detected?.yIntervals?.length ? detected.yIntervals : intervalsBetweenBands([], bounds.min[1], bounds.max[1], wallThickness);
  const partitioned = partitionIntervalsForProfileCuts(bounds, xIntervals, sourceYIntervals, detected?.profileCuts || [], wallThickness);
  const yIntervals = partitioned.yIntervals;
  const bottomThickness = detected?.bottomThickness || opts.bottom;
  // BIT uses BOX_WALL_THICKNESS for both side walls and the floor.
  const features = [];

  for (let yIndex = 0; yIndex < yIntervals.length; yIndex++) {
    for (let xIndex = 0; xIndex < xIntervals.length; xIndex++) {
      const x = xIntervals[xIndex];
      const y = yIntervals[yIndex];
      const suffix = xIntervals.length * yIntervals.length > 1 ? ` ${features.length + 1}` : "";
      const floor = inferCompartmentFloor(bounds, x, y, wallThickness);
      const floorHeight = Math.max(wallThickness, floor ? floor.z - bounds.min[2] : wallThickness);
      const compZ = Math.max(0.1, round(bounds.size[2] - floorHeight + opts.heightExtra));
      const shape = detectFeatureShape(bounds, x, y, bottomThickness);
      const cutoutInference = inferCutoutsForInterval(detected?.cutouts || [], x, y, compZ, bounds, wallThickness);
      features.push({
        name: `${name} cavity${suffix}`,
        size: [
          round(x.size + opts.clearance * 2),
          round(y.size + opts.clearance * 2),
          compZ,
        ],
        position: [
          roundPosition(x.start - bounds.min[0] - wallThickness - opts.clearance),
          roundPosition(y.start - bounds.min[1] - wallThickness - opts.clearance),
        ],
        sourceBounds: { x: [x.start, x.end], y: [y.start, y.end] },
        floorTopZ: floor?.z ?? null,
        shape,
        cutoutSides: cutoutInference.sides,
        cutoutInference,
        detected: Boolean(detected?.detected),
      });
    }
  }

  for (const extension of partitioned.extensions) {
    const floor = inferCompartmentFloor(bounds, extension.x, extension.y, wallThickness);
    const floorHeight = Math.max(wallThickness, floor ? floor.z - bounds.min[2] : wallThickness);
    const compZ = Math.max(0.1, round(bounds.size[2] - floorHeight + opts.heightExtra));
    const shape = detectFeatureShape(bounds, extension.x, extension.y, bottomThickness);
    const cutoutInference = inferCutoutsForInterval(detected?.cutouts || [], extension.x, extension.y, compZ, bounds, wallThickness);
    features.push({
      name: `${name} profile extension`,
      size: [
        round(extension.x.size + opts.clearance * 2),
        round(extension.y.size + opts.clearance * 2),
        compZ,
      ],
      position: [
        roundPosition(extension.x.start - bounds.min[0] - wallThickness - opts.clearance),
        roundPosition(extension.y.start - bounds.min[1] - wallThickness - opts.clearance),
      ],
      sourceBounds: { x: [extension.x.start, extension.x.end], y: [extension.y.start, extension.y.end] },
      floorTopZ: floor?.z ?? null,
      shape,
      cutoutSides: cutoutInference.sides,
      cutoutInference,
      detected: true,
      profileExtension: true,
    });
  }

  return features;
}

function inferCompartmentFloor(bounds, xInterval, yInterval, wallThickness) {
  const areas = new Map();
  const topLimit = bounds.max[2] - Math.max(0.5, wallThickness * 0.5);
  for (const facet of bounds.facets) {
    if (Math.abs(facet.normal[2]) < 0.98) continue;
    const zValues = facet.points.map((point) => point[2]);
    if (Math.max(...zValues) - Math.min(...zValues) > 0.02) continue;
    const [x, y, z] = facet.centroid;
    if (x < xInterval.start - 0.1 || x > xInterval.end + 0.1 ||
        y < yInterval.start - 0.1 || y > yInterval.end + 0.1 ||
        z < bounds.min[2] - 0.01 || z >= topLimit) continue;
    const level = roundTo(z, 2);
    areas.set(level, (areas.get(level) || 0) + facet.area);
  }
  const requiredArea = Math.max(4, xInterval.size * yInterval.size * 0.35);
  const candidate = [...areas.entries()].filter(([, area]) => area >= requiredArea)
    .sort((a, b) => b[0] - a[0])[0];
  return candidate ? { z: candidate[0] } : null;
}

function partitionIntervalsForProfileCuts(bounds, xIntervals, yIntervals, profileCuts, wallThickness) {
  const adjustedY = yIntervals.map((interval) => ({ ...interval }));
  const extensions = [];
  if (xIntervals.length !== 1) return { yIntervals: adjustedY, extensions };

  for (const cut of profileCuts) {
    const [ySide, xSide] = cut.corner.split("-");
    const yIndex = ySide === "front" ? 0 : adjustedY.length - 1;
    const target = adjustedY[yIndex];
    if (!target) continue;
    const cutMinX = cut.min[0];
    const cutMaxX = cut.min[0] + cut.size[0];
    const cutMinY = cut.min[1];
    const cutMaxY = cut.min[1] + cut.size[1];
    const xLocal = xSide === "right"
      ? [wallThickness, cutMinX - wallThickness]
      : [cutMaxX + wallThickness, bounds.size[0] - wallThickness];
    const yLocal = ySide === "back"
      ? [cutMinY - wallThickness, bounds.size[1] - wallThickness]
      : [wallThickness, cutMaxY + wallThickness];
    const mainBoundary = ySide === "back" ? yLocal[0] : yLocal[1];
    const sourceBoundary = bounds.min[1] + mainBoundary;
    if (ySide === "back") target.end = round(Math.min(target.end, sourceBoundary));
    else target.start = round(Math.max(target.start, sourceBoundary));
    target.size = round(target.end - target.start);

    const extension = {
      x: {
        start: round(bounds.min[0] + xLocal[0]),
        end: round(bounds.min[0] + xLocal[1]),
        size: round(xLocal[1] - xLocal[0]),
      },
      y: {
        start: round(bounds.min[1] + yLocal[0]),
        end: round(bounds.min[1] + yLocal[1]),
        size: round(yLocal[1] - yLocal[0]),
      },
    };
    if (extension.x.size > 5 && extension.y.size > 5 && target.size > 5) extensions.push(extension);
  }
  return { yIntervals: adjustedY, extensions };
}

function inferCutoutsForInterval(cutouts, xInterval, yInterval, featureHeight, bounds, wallThickness) {
  const overlaps = (cutout, interval) => cutout.crossMax >= interval.start && cutout.crossMin <= interval.end;
  const sideNames = ["front", "back", "left", "right"];
  const matches = sideNames.map((side) => cutouts.find((cutout) => {
    const interval = side === "front" || side === "back" ? xInterval : yInterval;
    const depthInterval = side === "front" || side === "back" ? yInterval : xInterval;
    const boundary = side === "front" || side === "left"
      ? bounds.min[side === "front" ? 1 : 0] + wallThickness
      : bounds.max[side === "back" ? 1 : 0] - wallThickness;
    const touchesBoundary = side === "front" || side === "left"
      ? depthInterval.start <= boundary + wallThickness
      : depthInterval.end >= boundary - wallThickness;
    return cutout.side === side && cutout.detected && overlaps(cutout, interval) && touchesBoundary;
  }));
  const active = matches.filter(Boolean);
  if (!active.length) return { sides: [false, false, false, false], confidence: "low" };
  const boxHeight = bounds.size[2];
  const baseHeight = boxHeight - featureHeight;
  const maximumHeightPct = Math.max(0, (1 - (wallThickness + baseHeight + 0.5) / boxHeight) * 100);
  const percentages = active.map((cutout) => {
    const crossInterval = cutout.side === "front" || cutout.side === "back" ? xInterval : yInterval;
    const depthInterval = cutout.side === "front" || cutout.side === "back" ? yInterval : xInterval;
    const overlapWidth = Math.max(0, Math.min(cutout.crossMax, crossInterval.end) - Math.max(cutout.crossMin, crossInterval.start));
    const printableWidthPct = Math.max(5, (crossInterval.size - 1) / crossInterval.size * 100);
    return {
      height: Math.min(clampPercent(cutout.height / featureHeight * 100), maximumHeightPct),
      depth: Math.max(clampPercent(cutout.depth / depthInterval.size * 100), clampPercent(6 / depthInterval.size * 100)),
      width: clampPercent(overlapWidth / crossInterval.size * 100, Math.min(95, printableWidthPct)),
    };
  });
  const broadCurvedSides = active.filter((cutout, index) =>
    !cutout.planarOpening && percentages[index].width >= 80 && percentages[index].height >= 60);
  if (active.length >= 3 && broadCurvedSides.length >= 3) {
    return {
      sides: [false, false, false, false],
      confidence: "low",
      suppressed: true,
      reason: "ambiguous broad curved surfaces on multiple sides",
    };
  }
  return {
    sides: matches.map(Boolean),
    confidence: active.every((cutout) => cutout.confidence === "high") ? "high" : "medium",
    type: active.some((cutout) => cutout.cutoutType === "BOTH") ? "BOTH" : "INTERIOR",
    heightPct: round(median(percentages.map((value) => value.height))),
    depthPct: round(median(percentages.map((value) => value.depth))),
    widthPct: round(median(percentages.map((value) => value.width))),
  };
}

function clampPercent(value, maximum = 100) {
  return Math.max(5, Math.min(maximum, value));
}

function sanitizeScadString(value) {
  return String(value).replace(/[\\"]/g, "_").trim() || "insert";
}

function slugFileName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function round(value) {
  return Number(value.toFixed(3));
}

function roundPosition(value) {
  const rounded = round(value);
  return Math.abs(rounded) <= 0.01 ? 0 : rounded;
}

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function vec(values) {
  return `[${values.map((value) => typeof value === "number" ? round(value) : value).join(", ")}]`;
}

function quoteScadString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function formatScadValue(value) {
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") return String(round(value));
  if (/^[A-Z][A-Z0-9_]*$/.test(String(value))) return String(value);
  return quoteScadString(value);
}

function cutoutSidesForFeature(index, mode) {
  const normalized = String(mode || "none").toLowerCase();
  if (normalized === "none" || normalized === "false") return [false, false, false, false];
  if (normalized === "all") return [true, true, true, true];
  if (normalized === "alternate-lr") {
    return index % 2 === 0 ? [false, false, true, false] : [false, false, false, true];
  }

  const selected = new Set(normalized.split(/[,+]/).map((part) => part.trim()).filter(Boolean));
  return [
    selected.has("front"),
    selected.has("back"),
    selected.has("left"),
    selected.has("right"),
  ];
}

function buildCutoutProperties(featureIndex, opts, feature = {}) {
  const properties = {};
  const inferredSides = opts.inferGeometry && opts.cutoutMode === "none" ? feature.cutoutSides : null;
  const sides = inferredSides?.some(Boolean) ? inferredSides : cutoutSidesForFeature(featureIndex, opts.cutoutMode);
  const inferred = inferredSides?.some(Boolean) ? feature.cutoutInference : null;
  if (sides.some(Boolean)) {
    properties.FTR_CUTOUT_SIDES_4B = sides;
    properties.FTR_CUTOUT_TYPE = inferred?.type || opts.cutoutType;
    properties.FTR_CUTOUT_HEIGHT_PCT = inferred?.heightPct ?? opts.cutoutHeightPct;
    properties.FTR_CUTOUT_DEPTH_PCT = inferred?.depthPct || opts.cutoutDepthPct;
    properties.FTR_CUTOUT_WIDTH_PCT = inferred?.widthPct || opts.cutoutWidthPct;
  }
  if (opts.cutoutBottom) properties.FTR_CUTOUT_BOTTOM_B = true;
  return properties;
}

function buildLabelProperties(text, opts, name) {
  if (!String(text || "").trim()) return null;
  return {
    NAME: name,
    LBL_TEXT: text,
    LBL_PLACEMENT: opts.labelPlacement,
    LBL_SIZE: opts.labelSize,
    LBL_DEPTH: opts.labelDepth,
  };
}

function buildObjectProperties(model, opts) {
  const properties = {
    NAME: model.name,
    BOX_SIZE_XYZ: model.boxSize,
    BOX_WALL_THICKNESS: model.wallThickness || opts.wall,
  };

  if (opts.noLid) {
    properties.BOX_NO_LID_B = true;
  } else {
    properties.BOX_LID = {
      NAME: "lid",
      LID_TYPE: "LID_CAP",
    };
    const lidLabel = buildLabelProperties(opts.lidLabelText, opts, "lid label");
    if (lidLabel) properties.BOX_LID.LABEL = lidLabel;
  }

  const boxLabel = buildLabelProperties(opts.boxLabelText, opts, `${model.name} label`);
  if (boxLabel) properties.LABEL = boxLabel;

  if (opts.feature) {
    properties.BOX_FEATURE = model.features.map((feature, featureIndex) => {
      const featureProperties = {
        NAME: feature.name,
        FTR_COMPARTMENT_SIZE_XYZ: feature.size,
        FTR_NUM_COMPARTMENTS_XY: [1, 1],
        FTR_SHAPE: opts.inferGeometry ? (feature.shape?.shape || "SQUARE") : "SQUARE",
        POSITION_XY: feature.position,
        ...buildCutoutProperties(featureIndex, opts, feature),
      };
      if (opts.featureLabels) {
        featureProperties.LABEL = buildLabelProperties(
          feature.name.replace(/\s+cavity/i, ""),
          opts,
          `${feature.name} label`,
        );
      }
      return featureProperties;
    });
  }
  return properties;
}

function readJsonFile(filePath, label) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) die(`${label} not found: ${absolute}`);
  try {
    return JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (error) {
    die(`Invalid ${label} JSON (${absolute}): ${error.message}`);
  }
}

function loadBitInputs(opts) {
  const schema = readJsonFile(opts.schemaFile, "BIT schema");
  const config = opts.bitConfigFile ? readJsonFile(opts.bitConfigFile, "BIT config") : {};
  validateBitConfig(config, schema);
  return { schema, config };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeProperties(base, overrides) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides || {})) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = mergeProperties(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function objectConfigForModel(config, model) {
  const objects = config.objects || {};
  return objects[model.name] || objects[model.sourceName] ||
    objects[path.basename(model.sourceName, path.extname(model.sourceName))] || {};
}

function normalizeElement(raw, fallbackType = "OBJECT_BOX") {
  if (!isPlainObject(raw)) return { type: "", properties: raw };
  const type = raw.type || fallbackType;
  const properties = raw.properties || Object.fromEntries(
    Object.entries(raw).filter(([key]) => key !== "type"),
  );
  return { type, properties };
}

function contextForObjectType(type) {
  if (type === "OBJECT_DIVIDERS") return "divider";
  if (type === "OBJECT_BOX" || type === "OBJECT_SPACER") return "element";
  return null;
}

function validateBitConfig(config, schema) {
  const errors = [];
  if (!isPlainObject(config)) {
    die("BIT config validation failed:\n  - config root must be a JSON object");
  }
  for (const key of Object.keys(config)) {
    if (!["globals", "objects", "elements"].includes(key)) errors.push(`${key} is not a supported top-level section`);
  }
  if (config.globals !== undefined) validateProperties(config.globals, "globals", schema, "globals", errors);
  if (config.objects !== undefined && !isPlainObject(config.objects)) {
    errors.push("objects must be an object keyed by STL name");
  }
  for (const [name, raw] of Object.entries(config.objects || {})) {
    const element = normalizeElement(raw);
    if (element.type === "OBJECT_DIVIDERS") {
      errors.push(`objects.${name}.type cannot be OBJECT_DIVIDERS; use elements for standalone dividers`);
    } else {
      validateElement(element, schema, `objects.${name}`, errors);
    }
  }
  if (config.elements !== undefined && !Array.isArray(config.elements)) {
    errors.push("elements must be an array");
  }
  for (const [index, raw] of (config.elements || []).entries()) {
    validateElement(normalizeElement(raw, ""), schema, `elements[${index}]`, errors);
  }
  if (errors.length) die(`BIT config validation failed:\n  - ${errors.join("\n  - ")}`);
}

function validateElement(element, schema, location, errors) {
  const context = contextForObjectType(element.type);
  if (!context) {
    errors.push(`${location}.type must be OBJECT_BOX, OBJECT_SPACER, or OBJECT_DIVIDERS`);
    return;
  }
  validateProperties(element.properties, context, schema, `${location}.properties`, errors);
  const elementFlavor = element.type === "OBJECT_BOX" ? "BOX" : element.type === "OBJECT_SPACER" ? "SPACER" : null;
  if (elementFlavor) {
    for (const key of Object.keys(element.properties || {})) {
      const descriptor = schema.contexts.element.keys[key];
      if (descriptor?.contexts && !descriptor.contexts.includes(elementFlavor)) {
        errors.push(`${location}.properties.${key} is not valid for ${element.type}`);
      }
    }
  }
}

function validateProperties(properties, contextName, schema, location, errors) {
  if (!isPlainObject(properties)) {
    errors.push(`${location} must be an object`);
    return;
  }
  const descriptors = contextName === "globals" ? schema.globals : schema.contexts?.[contextName]?.keys;
  if (!descriptors) {
    errors.push(`${location} uses unknown schema context ${contextName}`);
    return;
  }
  for (const [key, value] of Object.entries(properties)) {
    const descriptor = descriptors[key];
    if (!descriptor) {
      errors.push(`${location}.${key} is not valid in ${contextName}`);
      continue;
    }
    if (!descriptor.child_context) {
      validateLeafValue(value, descriptor, `${location}.${key}`, errors);
      continue;
    }
    if (descriptor.type === "shape" && typeof value === "string") {
      if (!descriptor.values.includes(value)) errors.push(`${location}.${key} must be one of ${descriptor.values.join(", ")}`);
      continue;
    }
    const children = descriptor.type === "table_list" ? value : [value];
    if (!Array.isArray(children)) {
      errors.push(`${location}.${key} must be an array`);
      continue;
    }
    for (const [index, child] of children.entries()) {
      const childLocation = descriptor.type === "table_list" ? `${location}.${key}[${index}]` : `${location}.${key}`;
      validateProperties(child, descriptor.child_context, schema, childLocation, errors);
    }
  }
}

function validateLeafValue(value, descriptor, location, errors) {
  const number = (item) => typeof item === "number" && Number.isFinite(item);
  const arrayOf = (length, predicate) => Array.isArray(value) && value.length === length && value.every(predicate);
  let valid = true;
  switch (descriptor.type) {
    case "bool": valid = typeof value === "boolean"; break;
    case "number": valid = number(value) || (typeof descriptor.default === "string" && value === descriptor.default); break;
    case "string": valid = typeof value === "string"; break;
    case "enum": valid = typeof value === "string" && descriptor.values.includes(value); break;
    case "xy": valid = arrayOf(2, number); break;
    case "xyz": valid = arrayOf(3, number); break;
    case "4bool": valid = arrayOf(4, (item) => typeof item === "boolean"); break;
    case "4num": valid = arrayOf(4, number); break;
    case "string_list": valid = typeof value === "string" || (Array.isArray(value) && value.every((item) => typeof item === "string")); break;
    case "number_or_false": valid = value === false || number(value); break;
    case "xyz_or_false": valid = value === false || arrayOf(3, (item) => number(item) || item === "MAX"); break;
    case "bool_string_list": valid = typeof value === "boolean" || typeof value === "string" ||
      (Array.isArray(value) && value.every((item) => typeof item === "string")); break;
    case "position_xy": valid = arrayOf(2, (item) => number(item) || item === "CENTER" || item === "MAX"); break;
    default: break;
  }
  if (!valid) errors.push(`${location} must match BIT type ${descriptor.type}`);
}

function formatTypedScadValue(value, descriptor = {}, key = "") {
  if (descriptor.type === "string") return quoteScadString(value);
  if (descriptor.type === "string_list") {
    const values = Array.isArray(value) ? value : [value];
    const formatted = values.map((item) => key === "G_PRINT_TYPES" && ["BOX", "LID", "DIVIDERS"].includes(item)
      ? item
      : quoteScadString(item));
    return Array.isArray(value) ? `[${formatted.join(", ")}]` : formatted[0];
  }
  if (descriptor.type === "bool_string_list") {
    if (typeof value === "boolean") return formatScadValue(value);
    const values = Array.isArray(value) ? value : [value];
    return Array.isArray(value)
      ? `[${values.map(quoteScadString).join(", ")}]`
      : quoteScadString(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => formatScadValue(item)).join(", ")}]`;
  return formatScadValue(value);
}

function renderProperties(lines, indent, properties, contextName, schema) {
  const descriptors = contextName === "globals" ? schema.globals : schema.contexts[contextName].keys;
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null) continue;
    const descriptor = descriptors[key];
    if (descriptor.child_context && !(descriptor.type === "shape" && typeof value === "string")) {
      const children = descriptor.type === "table_list" ? value : [value];
      for (const child of children) {
        const childToken = descriptor.type === "shape" ? "SVG" : key;
        if (descriptor.type === "shape") {
          lines.push(`${indent}[ ${key},`);
          lines.push(`${indent}    [ ${childToken},`);
          renderProperties(lines, `${indent}        `, child, descriptor.child_context, schema);
          lines.push(`${indent}    ],`);
          lines.push(`${indent}],`);
        } else {
          lines.push(`${indent}[ ${childToken},`);
          renderProperties(lines, `${indent}    `, child, descriptor.child_context, schema);
          lines.push(`${indent}],`);
        }
      }
    } else {
      lines.push(`${indent}[ ${key}, ${formatTypedScadValue(value, descriptor, key)} ],`);
    }
  }
}

function renderScad(models, opts, schema, config = {}) {
  const lines = [
    "// BGSD",
    `include <${opts.includeFile}>;`,
    "data = [",
  ];

  renderProperties(lines, "    ", config.globals || {}, "globals", schema);

  for (const model of models) {
    const configured = normalizeElement(objectConfigForModel(config, model));
    const overrides = configured.properties;
    const properties = mergeProperties(buildObjectProperties(model, opts), overrides);
    if (Object.hasOwn(overrides, "BOX_LID") && !Object.hasOwn(overrides, "BOX_NO_LID_B")) {
      delete properties.BOX_NO_LID_B;
    }
    if (overrides.BOX_NO_LID_B === true && !Object.hasOwn(overrides, "BOX_LID")) {
      delete properties.BOX_LID;
    }
    if (configured.type === "OBJECT_SPACER") {
      delete properties.BOX_NO_LID_B;
      delete properties.BOX_LID;
      delete properties.BOX_STACKABLE_B;
      delete properties.LABEL;
    }
    lines.push(`    // Source STL: ${model.sourceName}`);
    lines.push(`    // STL bbox min ${vec(model.bounds.min)} max ${vec(model.bounds.max)} size ${vec(model.bounds.size)}`);
    if (model.detected?.detected) {
      lines.push(`    // Detected compartments: ${model.detected.componentCount}; wall thickness: ${round(model.wallThickness)}mm`);
    }
    lines.push(`    // Estimated bottom thickness: ${round(model.bottomThickness)}mm`);
    const suppressedCutouts = (model.features || []).filter((feature) => feature.cutoutInference?.suppressed);
    const detectedCutouts = (model.detected?.cutouts || []).filter((cutout) => cutout.detected);
    if (suppressedCutouts.length) {
      lines.push("    // Ambiguous broad multi-side surfaces were not emitted as finger cutouts");
    } else if (detectedCutouts.length) {
      lines.push(`    // Inferred side cutouts: ${detectedCutouts.map((cutout) => `${cutout.side} (${cutout.confidence})`).join(", ")}`);
    }
    const profileCuts = model.detected?.profileCuts || [];
    if (profileCuts.length) {
      lines.push(`    // Inferred external profile cuts: ${profileCuts.map((cut) => `${cut.corner} ${vec(cut.size)}`).join(", ")}`);
    }
  for (const feature of model.features || []) {
    if (feature.floorTopZ != null) {
      lines.push(`    // ${feature.name}: measured floor ${round(feature.floorTopZ - model.bounds.min[2])}mm above STL base`);
    }
    if (feature.shape) lines.push(`    // ${feature.name}: ${feature.shape.shape} shape (${feature.shape.confidence}, curved ratio ${feature.shape.curvedRatio})`);
    }
    lines.push(`    [ ${configured.type},`);
    renderProperties(lines, "        ", properties, contextForObjectType(configured.type), schema);
    lines.push("    ],");
  }

  for (const raw of config.elements || []) {
    const element = normalizeElement(raw, "");
    lines.push(`    [ ${element.type},`);
    renderProperties(lines, "        ", element.properties, contextForObjectType(element.type), schema);
    lines.push("    ],");
  }

  lines.push("];");
  const profileCuts = models.length === 1 ? (models[0].detected?.profileCuts || []) : [];
  if (profileCuts.length) {
    lines.push("difference() {");
    lines.push("    Make(data);");
    for (const cut of profileCuts) {
      lines.push(`    // ${cut.corner} external step`);
      lines.push(`    translate([${round(cut.min[0])}, ${round(cut.min[1])}, -0.05]) cube([${round(cut.size[0] + 0.05)}, ${round(cut.size[1] + 0.05)}, ${round(models[0].boxSize[2] + 0.1)}]);`);
    }
    lines.push("}");
  } else {
    lines.push("Make(data);");
  }
  lines.push("");
  return lines.join("\n");
}

function includePathForOutput(opts, outputPath) {
  if (opts.includeExplicit) return opts.includeFile;
  const libraryPath = path.join(__dirname, "lib", "boardgame_insert_toolkit_lib.4.scad");
  let relative = path.relative(path.dirname(path.resolve(outputPath)), libraryPath).replace(/\\/g, "/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
}

function validateOutputFidelity(originalPath, scadPath, opts) {
  const { spawnSync } = require("child_process");
  const validatorPath = path.join(__dirname, "tools", "validate-fidelity.js");
  const reportPath = scadPath.replace(/\.scad$/i, ".fidelity.json");
  const previewPath = scadPath.replace(/\.scad$/i, ".fidelity.png");
  const args = [
    validatorPath,
    "--tolerance", String(opts.fidelityTolerance),
    "--samples", String(opts.fidelitySamples),
    "--report", reportPath,
  ];
  if (opts.fidelityPreview) args.push("--preview", previewPath);
  if (opts.openScadPath) args.push("--openscad", opts.openScadPath);
  args.push(originalPath, path.resolve(scadPath));
  const result = spawnSync(process.execPath, args, { encoding: "utf8", windowsHide: true });
  if (result.error) die(`Fidelity validator failed to start: ${result.error.message}`);
  if (result.status !== 0) die((result.stderr || result.stdout || "Fidelity validation failed.").trim());
  for (const line of result.stdout.trim().split(/\r?\n/)) console.log(`  ${line}`);
  console.log(`  report:    ${path.resolve(reportPath)}`);
  if (opts.fidelityPreview) console.log(`  preview:   ${path.resolve(previewPath)}`);
  return reportPath;
}

function main() {
  const { opts, inputs } = parseArgs(process.argv.slice(2));
  const { schema, config } = loadBitInputs(opts);
  const files = expandInputs(inputs);
  if (files.length === 0) die("No files matched.");

  fs.mkdirSync(opts.outDir, { recursive: true });

  const models = [];
  for (const file of files) {
    if (!fs.existsSync(file)) die(`File not found: ${file}`);
    const absolute = path.resolve(file);
    const bounds = readStlBounds(absolute, opts.scale);
    const model = createModel(absolute, bounds, opts);
    models.push(model);

    const outName = `${slugFileName(path.basename(file, path.extname(file)))}.scad`;
    const outPath = path.join(opts.outDir, outName);
    const outputOpts = { ...opts, includeFile: includePathForOutput(opts, outPath) };
    fs.writeFileSync(outPath, renderScad([model], outputOpts, schema, config), "utf8");
    printSummary(model, outPath);
    if (opts.validateFidelity) validateOutputFidelity(absolute, outPath, opts);
  }

  if (opts.combinedFile) {
    const combinedPath = path.resolve(opts.combinedFile);
    const outputOpts = { ...opts, includeFile: includePathForOutput(opts, combinedPath) };
    fs.writeFileSync(combinedPath, renderScad(models, outputOpts, schema, config), "utf8");
    console.log(`combined -> ${combinedPath}`);
  }
}

function printSummary(model, outPath) {
  console.log(`${model.sourceName}`);
  console.log(`  triangles: ${model.bounds.triangles}`);
  console.log(`  measured:  ${vec(model.bounds.size)} mm`);
  console.log(`  box:       ${vec(model.boxSize)} mm`);
  console.log(`  bottom:    ${round(model.bottomThickness)} mm`);
  console.log(`  scad:      ${path.resolve(outPath)}`);
}

if (require.main === module) main();

module.exports = {
  buildObjectProperties,
  contextForObjectType,
  createModel,
  detectExternalProfileCuts,
  detectFeatureShape,
  detectSideCutouts,
  inferCutoutsForInterval,
  loadBitInputs,
  includePathForOutput,
  mergeProperties,
  normalizeElement,
  readStlBounds,
  renderScad,
  validateBitConfig,
  validateOutputFidelity,
};
