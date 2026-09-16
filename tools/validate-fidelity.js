#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { compareStlFiles } = require("./stl-fidelity.js");

function usage(exitCode = 0) {
  console.log(`Usage:
  node tools/validate-fidelity.js [options] <original.stl> <reconstructed.stl-or-scad>

Options:
  --tolerance <mm>    Surface match tolerance. Default: 0.5
  --samples <count>   Deterministic samples per surface. Default: 12000
  --report <file>     Write the complete JSON report.
  --preview <file>    Render original, reconstruction, and aligned overlay to PNG.
  --json              Print JSON instead of the summary.
  --openscad <file>   Explicit OpenSCAD executable.
  --keep-stl          Keep the STL rendered from a SCAD input.
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = { tolerance: 0.5, samples: 12000, report: null, preview: null, json: false, openscad: null, keepStl: false };
  const inputs = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--tolerance") options.tolerance = parsePositive(argv[++index], arg);
    else if (arg === "--samples") options.samples = Math.floor(parsePositive(argv[++index], arg));
    else if (arg === "--report") options.report = requireValue(argv, index++, arg);
    else if (arg === "--preview") options.preview = requireValue(argv, index++, arg);
    else if (arg === "--json") options.json = true;
    else if (arg === "--openscad") options.openscad = requireValue(argv, index++, arg);
    else if (arg === "--keep-stl") options.keepStl = true;
    else if (arg.startsWith("-")) fail(`Unknown option: ${arg}`);
    else inputs.push(arg);
  }
  if (inputs.length !== 2) usage(1);
  return { options, originalPath: path.resolve(inputs[0]), candidatePath: path.resolve(inputs[1]) };
}

function requireValue(argv, index, option) {
  if (index + 1 >= argv.length || argv[index + 1].startsWith("--")) fail(`${option} requires a value.`);
  return argv[index + 1];
}

function parsePositive(raw, option) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) fail(`${option} must be greater than zero.`);
  return value;
}

function findOpenScad(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.OPENSCAD_PATH,
    process.platform === "win32" ? "C:\\Program Files\\OpenSCAD\\openscad.exe" : null,
    "openscad",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate === "openscad" || fs.existsSync(candidate)) return candidate;
  }
  fail("OpenSCAD executable not found. Use --openscad or OPENSCAD_PATH.");
}

function renderScad(scadPath, outputPath, openscadPath, timeout) {
  const result = spawnSync(openscadPath, ["-o", outputPath, scadPath], { encoding: "utf8", windowsHide: true, timeout });
  if (result.error?.code === "ETIMEDOUT") fail("OpenSCAD render timed out.");
  if (result.error) fail(`OpenSCAD failed to start: ${result.error.message}`);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  if (result.status !== 0 || !fs.existsSync(outputPath)) fail(`OpenSCAD render failed.\n${output}`);
  const warnings = output.split(/\r?\n/).filter((line) => /WARNING|ERROR|BGSD_WARNING/.test(line));
  return warnings;
}

function renderComparisonPreview(originalPath, reconstructedPath, outputPath, report, openscadPath, timeout) {
  const previewPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  const scriptPath = path.join(os.tmpdir(), `bgsd-fidelity-preview-${process.pid}.scad`);
  const span = Math.max(report.original.size[0], report.reconstructed.size[0]) * 1.35;
  const originalCenter = report.original.center;
  const reconstructedCenter = report.reconstructed.center;
  const scad = [
    `$fn = 32;`,
    `color([0.90, 0.20, 0.12, 1]) translate([${-span}, 0, 0]) translate(${vector(originalCenter.map((value) => -value))}) import(${quoteScad(originalPath)});`,
    `color([0.10, 0.45, 0.90, 1]) translate([${span}, 0, 0]) translate(${vector(reconstructedCenter.map((value) => -value))}) import(${quoteScad(reconstructedPath)});`,
    `color([0.90, 0.20, 0.12, 0.45]) translate(${vector(originalCenter.map((value) => -value))}) import(${quoteScad(originalPath)});`,
    `color([0.10, 0.65, 0.90, 0.45]) translate(${vector(reconstructedCenter.map((value) => -value))}) import(${quoteScad(reconstructedPath)});`,
    "",
  ].join("\n");
  fs.writeFileSync(scriptPath, scad, "utf8");
  try {
    const result = spawnSync(openscadPath, [
      "--autocenter", "--viewall", "--imgsize=1400,700", "--projection=o",
      "-o", previewPath, scriptPath,
    ], { encoding: "utf8", windowsHide: true, timeout });
    if (result.error?.code === "ETIMEDOUT") fail("OpenSCAD preview timed out.");
    if (result.error) fail(`OpenSCAD preview failed to start: ${result.error.message}`);
    if (result.status !== 0 || !fs.existsSync(previewPath)) {
      fail(`OpenSCAD preview failed.\n${[result.stdout, result.stderr].filter(Boolean).join("\n")}`);
    }
  } finally {
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
  }
  return previewPath;
}

function validateCandidate(originalPath, candidatePath, options = {}) {
  if (!fs.existsSync(originalPath)) fail(`Original STL not found: ${originalPath}`);
  if (!fs.existsSync(candidatePath)) fail(`Candidate not found: ${candidatePath}`);
  const isScad = path.extname(candidatePath).toLowerCase() === ".scad";
  const temporaryStl = isScad
    ? path.join(os.tmpdir(), `bgsd-fidelity-${process.pid}-${path.basename(candidatePath, ".scad")}.stl`)
    : null;
  let reconstructedPath = candidatePath;
  let renderWarnings = [];
  try {
    const needsOpenScad = isScad || options.preview;
    const openscadPath = needsOpenScad ? findOpenScad(options.openscad) : null;
    if (isScad) {
      reconstructedPath = temporaryStl;
      renderWarnings = renderScad(candidatePath, reconstructedPath, openscadPath, options.timeoutMs);
    }
    const report = compareStlFiles(originalPath, reconstructedPath, options);
    report.files = { original: originalPath, candidate: candidatePath };
    report.renderWarnings = renderWarnings;
    if (options.preview) {
      report.preview = renderComparisonPreview(originalPath, reconstructedPath, options.preview, report, openscadPath, options.timeoutMs);
    }
    return report;
  } finally {
    if (temporaryStl && !options.keepStl && fs.existsSync(temporaryStl)) fs.unlinkSync(temporaryStl);
  }
}

function formatSummary(report) {
  const metrics = report.metrics;
  return [
    `Fidelity: ${metrics.fScorePct}% (${report.rating})`,
    `  precision / recall: ${metrics.precisionPct}% / ${metrics.recallPct}% at ${report.settings.toleranceMm}mm`,
    `  surface distance: mean ${metrics.meanSurfaceDistanceMm}mm, p95 ${metrics.p95SurfaceDistanceMm}mm, max ${metrics.maxSurfaceDistanceMm}mm`,
    `  dimension delta: [${metrics.dimensionsDeltaMm.join(", ")}]mm`,
    `  area / volume ratio: ${metrics.surfaceAreaRatio} / ${metrics.volumeRatio}`,
    `  watertight: original ${report.original.watertight}, reconstructed ${report.reconstructed.watertight}`,
    ...(report.renderWarnings || []).map((warning) => `  render: ${warning}`),
  ].join("\n");
}

function fail(message) {
  throw new Error(message);
}

function quoteScad(value) {
  return `"${path.resolve(value).replace(/\\/g, "/").replace(/"/g, '\\"')}"`;
}

function vector(values) {
  return `[${values.map((value) => Number(value.toFixed(6))).join(", ")}]`;
}

function main() {
  try {
    const { options, originalPath, candidatePath } = parseArgs(process.argv.slice(2));
    const report = validateCandidate(originalPath, candidatePath, options);
    if (options.report) {
      const reportPath = path.resolve(options.report);
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    }
    console.log(options.json ? JSON.stringify(report, null, 2) : formatSummary(report));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { findOpenScad, formatSummary, renderComparisonPreview, renderScad, validateCandidate };
