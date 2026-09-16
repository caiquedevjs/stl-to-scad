#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_INCLUDE = "../lib/boardgame_insert_toolkit_lib.4.scad";

function usage(exitCode = 0) {
  const script = path.basename(process.argv[1] || "stl-to-bgsd.js");
  console.log(`Usage:
  node ${script} [options] <file-or-glob> [...]

Options:
  --out <dir>              Output directory. Default: my_designs
  --include <file>         BIT include file. Default: ${DEFAULT_INCLUDE}
  --combined <file>        Also write one SCAD containing all input STLs.
  --clearance <mm>         Add clearance to generated compartment size. Default: 0
  --wall <mm>              Initial wall thickness for the editable box. Default: 2
  --bottom <mm>            Initial bottom thickness for the editable box. Default: 2
  --height-extra <mm>      Extra compartment height. Default: 0
  --scale <factor>         Scale STL coordinates before measuring. Default: 1
  --fit-container          Old mode: create a larger storage box around the STL bounds.
  --no-detect-components   Disable straight-wall compartment detection.
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
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const opts = {
    outDir: "my_designs",
    includeFile: DEFAULT_INCLUDE,
    combinedFile: null,
    clearance: 0,
    wall: 2,
    bottom: 2,
    heightExtra: 0,
    scale: 1,
    feature: true,
    noLid: true,
    fitContainer: false,
    detectComponents: true,
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
    } else if (arg === "--combined") {
      opts.combinedFile = requireValue(argv, ++i, arg);
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
  for (const [axis, index] of [["x", 0], ["y", 1], ["z", 2]]) {
    const values = pts.map((pt) => pt[index]);
    if (Math.max(...values) - Math.min(...values) < 0.02) {
      addPlaneArea(bounds, axis, (values[0] + values[1] + values[2]) / 3, area);
    }
  }
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
  const detected = opts.detectComponents ? detectCompartments(bounds) : null;
  const wallThickness = round(detected?.wallThickness || opts.wall);

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
    features,
    detected,
  };
}

function detectCompartments(bounds) {
  const xBands = detectWallBands(bounds.planes.x);
  const yBands = detectWallBands(bounds.planes.y);
  const wallThickness = median([...xBands, ...yBands].map((band) => band.width).filter((value) => value > 0)) || 2;
  const xIntervals = intervalsBetweenBands(xBands, bounds.min[0], bounds.max[0], wallThickness);
  const yIntervals = intervalsBetweenBands(yBands, bounds.min[1], bounds.max[1], wallThickness);
  const componentCount = xIntervals.length * yIntervals.length;

  return {
    wallThickness,
    xBands,
    yBands,
    xIntervals,
    yIntervals,
    componentCount,
    detected: componentCount > 1,
  };
}

function detectWallBands(planeMap) {
  const entries = [...planeMap.entries()].sort((a, b) => a[0] - b[0]);
  if (entries.length < 2) return [];

  const maxArea = Math.max(...entries.map((entry) => entry[1]));
  const significant = entries
    .filter(([, area]) => area >= maxArea * 0.3)
    .sort((a, b) => a[0] - b[0]);

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
  const yIntervals = detected?.yIntervals?.length ? detected.yIntervals : intervalsBetweenBands([], bounds.min[1], bounds.max[1], wallThickness);
  const compZ = Math.max(0.1, round(bounds.size[2] - wallThickness + opts.heightExtra));
  const features = [];

  for (let yIndex = 0; yIndex < yIntervals.length; yIndex++) {
    for (let xIndex = 0; xIndex < xIntervals.length; xIndex++) {
      const x = xIntervals[xIndex];
      const y = yIntervals[yIndex];
      const suffix = xIntervals.length * yIntervals.length > 1 ? ` ${features.length + 1}` : "";
      features.push({
        name: `${name} cavity${suffix}`,
        size: [
          round(x.size + opts.clearance * 2),
          round(y.size + opts.clearance * 2),
          compZ,
        ],
        position: [
          round(x.start - bounds.min[0] - wallThickness - opts.clearance),
          round(y.start - bounds.min[1] - wallThickness - opts.clearance),
        ],
        detected: Boolean(detected?.detected),
      });
    }
  }

  return features;
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

function renderLabelLines(lines, indent, text, opts, name) {
  if (!String(text || "").trim()) return;
  lines.push(`${indent}[ LABEL,`);
  lines.push(`${indent}    [ NAME, ${quoteScadString(name)} ],`);
  lines.push(`${indent}    [ LBL_TEXT, ${quoteScadString(text)} ],`);
  lines.push(`${indent}    [ LBL_PLACEMENT, ${formatScadValue(opts.labelPlacement)} ],`);
  lines.push(`${indent}    [ LBL_SIZE, ${formatScadValue(opts.labelSize)} ],`);
  lines.push(`${indent}    [ LBL_DEPTH, ${formatScadValue(opts.labelDepth)} ],`);
  lines.push(`${indent}],`);
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

function renderCutoutLines(lines, indent, featureIndex, opts) {
  const sides = cutoutSidesForFeature(featureIndex, opts.cutoutMode);
  if (!sides.some(Boolean) && !opts.cutoutBottom) return;
  if (sides.some(Boolean)) {
    lines.push(`${indent}[ FTR_CUTOUT_SIDES_4B, ${vec(sides)} ],`);
    lines.push(`${indent}[ FTR_CUTOUT_TYPE, ${formatScadValue(opts.cutoutType)} ],`);
    lines.push(`${indent}[ FTR_CUTOUT_HEIGHT_PCT, ${formatScadValue(opts.cutoutHeightPct)} ],`);
    lines.push(`${indent}[ FTR_CUTOUT_DEPTH_PCT, ${formatScadValue(opts.cutoutDepthPct)} ],`);
    lines.push(`${indent}[ FTR_CUTOUT_WIDTH_PCT, ${formatScadValue(opts.cutoutWidthPct)} ],`);
  }
  if (opts.cutoutBottom) {
    lines.push(`${indent}[ FTR_CUTOUT_BOTTOM_B, true ],`);
  }
}

function renderScad(models, opts) {
  const lines = [
    "// BGSD",
    `include <${opts.includeFile}>;`,
    "data = [",
  ];

  for (const model of models) {
    lines.push(`    // Source STL: ${model.sourceName}`);
    lines.push(`    // STL bbox min ${vec(model.bounds.min)} max ${vec(model.bounds.max)} size ${vec(model.bounds.size)}`);
    if (model.detected?.detected) {
      lines.push(`    // Detected compartments: ${model.detected.componentCount}; wall thickness: ${round(model.wallThickness)}mm`);
    }
    lines.push("    [ OBJECT_BOX,");
    lines.push(`        [ NAME, "${model.name}" ],`);
    lines.push(`        [ BOX_SIZE_XYZ, ${vec(model.boxSize)} ],`);
    lines.push(`        [ BOX_WALL_THICKNESS, ${round(model.wallThickness || opts.wall)} ],`);
    if (opts.noLid) {
      lines.push("        [ BOX_NO_LID_B, true ],");
    } else {
      lines.push("        [ BOX_LID,");
      lines.push("            [ NAME, \"lid\" ],");
      lines.push("            [ LID_TYPE, LID_CAP ],");
      renderLabelLines(lines, "            ", opts.lidLabelText, opts, "lid label");
      lines.push("        ],");
    }
    renderLabelLines(lines, "        ", opts.boxLabelText, opts, `${model.name} label`);
    if (opts.feature) {
      for (let featureIndex = 0; featureIndex < model.features.length; featureIndex++) {
        const feature = model.features[featureIndex];
        lines.push("        [ BOX_FEATURE,");
        lines.push(`            [ NAME, "${feature.name}" ],`);
        lines.push(`            [ FTR_COMPARTMENT_SIZE_XYZ, ${vec(feature.size)} ],`);
        lines.push("            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],");
        lines.push("            [ FTR_SHAPE, SQUARE ],");
        lines.push(`            [ POSITION_XY, ${vec(feature.position)} ],`);
        renderCutoutLines(lines, "            ", featureIndex, opts);
        if (opts.featureLabels) {
          renderLabelLines(lines, "            ", feature.name.replace(/\s+cavity/i, ""), opts, `${feature.name} label`);
        }
        lines.push("        ],");
      }
    }
    lines.push("    ],");
  }

  lines.push("];");
  lines.push("Make(data);");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const { opts, inputs } = parseArgs(process.argv.slice(2));
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
    fs.writeFileSync(outPath, renderScad([model], opts), "utf8");
    printSummary(model, outPath);
  }

  if (opts.combinedFile) {
    const combinedPath = path.resolve(opts.combinedFile);
    fs.writeFileSync(combinedPath, renderScad(models, opts), "utf8");
    console.log(`combined -> ${combinedPath}`);
  }
}

function printSummary(model, outPath) {
  console.log(`${model.sourceName}`);
  console.log(`  triangles: ${model.bounds.triangles}`);
  console.log(`  measured:  ${vec(model.bounds.size)} mm`);
  console.log(`  box:       ${vec(model.boxSize)} mm`);
  console.log(`  scad:      ${path.resolve(outPath)}`);
}

main();
