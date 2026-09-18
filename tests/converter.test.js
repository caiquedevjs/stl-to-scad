"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const converter = require("../stl-to-bgsd.js");
const { renderStl, findOpenScad } = require("../tools/gui-server.js");
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "BGSD-src", "schema", "bit.schema.json"), "utf8"));
const exampleConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "bit-config.example.json"), "utf8"));

const opts = {
  includeFile: "../lib/boardgame_insert_toolkit_lib.4.scad",
  wall: 2,
  noLid: true,
  feature: true,
  lidLabelText: "",
  boxLabelText: "",
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

const model = {
  name: "Solo",
  sourceName: "Solo.stl",
  boxSize: [37, 130, 56],
  wallThickness: 1.5,
  bottomThickness: 0.8,
  bounds: { min: [10, -62, 0], max: [47, 68, 56], size: [37, 130, 56] },
  features: [{ name: "Detected cavity", size: [34, 120, 54.5], position: [0, 0] }],
  detected: { detected: true, componentCount: 1 },
};

test("validates and renders the documented full-BIT configuration", () => {
  converter.validateBitConfig(exampleConfig, schema);
  const scad = converter.renderScad([model], opts, schema, exampleConfig);

  assert.match(scad, /\[ G_TOLERANCE, 0\.15 \]/);
  assert.match(scad, /\[ LID_TYPE, LID_CAP \]/);
  assert.match(scad, /\[ FTR_DIVIDERS,/);
  assert.match(scad, /\[ OBJECT_DIVIDERS,/);
  assert.match(scad, /\[ DIV_TAB_TEXT, \["A", "B"\] \]/);
  assert.doesNotMatch(scad, /\[ BOX_NO_LID_B, true \]/);
});

test("renders every nested schema context, including SVG, groups, copies, and spacers", () => {
  const config = {
    globals: { G_PRINT_TYPES: ["BOX", "LID", "DIVIDERS"] },
    objects: {
      Solo: {
        properties: {
          BOX_VISUALIZATION: { POSITION_XY: [5, 6], ROTATION: 90 },
          FEATURE_GROUP: [{
            NAME: "pieces",
            POSITION_XY: [0, 0],
            BOX_FEATURE: [{
              NAME: "meeple",
              FTR_COMPARTMENT_SIZE_XYZ: [12, 12, 8],
              FTR_SHAPE: { SVG_FILE: "meeple.svg", SVG_WIDTH_MM: 11, SVG_CLEARANCE_MM: 0.3 },
              POSITION_XY: [2, 3],
            }],
            FEATURE_COPY: [{ NAME: "meeple copy", FEATURE_REFERENCE: "meeple", POSITION_XY: [15, 0] }],
          }],
        },
      },
    },
    elements: [{
      type: "OBJECT_SPACER",
      properties: { NAME: "spacer", BOX_SIZE_XYZ: [10, 20, 3], BOX_WALL_THICKNESS: 1 },
    }],
  };

  converter.validateBitConfig(config, schema);
  const scad = converter.renderScad([model], opts, schema, config);
  assert.match(scad, /\[ G_PRINT_TYPES, \[BOX, LID, DIVIDERS\] \]/);
  assert.match(scad, /\[ FEATURE_GROUP,/);
  assert.match(scad, /\[ FEATURE_COPY,/);
  assert.match(scad, /\[ FTR_SHAPE,\s+\[ SVG,/);
  assert.match(scad, /\[ SVG_FILE, "meeple\.svg" \]/);
  assert.match(scad, /\[ BOX_VISUALIZATION,/);
  assert.match(scad, /\[ OBJECT_SPACER,/);
});

test("CLI detects both front openings in a two-compartment tray", () => {
  const bounds = { min: [0, 8, 0], max: [142, 103, 49], size: [142, 95, 49], facets: [] };
  for (const [left, right] of [[0, 20], [50, 90], [120, 142]]) {
    const a = [left, 8, 0], b = [right, 8, 0], c = [right, 8, 49], d = [left, 8, 49];
    for (const points of [[a, b, c], [a, c, d]]) {
      bounds.facets.push({ points, normal: [0, -1, 0],
        centroid: points[0].map((_, axis) => points.reduce((sum, point) => sum + point[axis], 0) / 3),
        area: (right - left) * 49 / 2 });
    }
  }
  const cutouts = converter.detectSideCutouts(bounds, 1.5, 0.8);
  assert.equal(cutouts.filter((cutout) => cutout.side === "front" && cutout.detected).length, 2);
});

test("infers floor thickness from horizontal STL planes", () => {
  const bounds = converter.readStlBounds(path.join(__dirname, "..", "Solo.stl"), 1);
  const detectedModel = converter.createModel(path.join(__dirname, "..", "Solo.stl"), bounds, {
    ...opts,
    bottom: 2,
    clearance: 0,
    heightExtra: 0,
    fitContainer: false,
    detectComponents: true,
  });

  assert.equal(detectedModel.bottomThickness, 0.8);
  assert.equal(detectedModel.features[0].size[2], 54.5);
});

test("recovers distinct compartment depths from a rendered STL", () => {
  if (!fs.existsSync(findOpenScad())) return;
  const sourceScad = `include <boardgame_insert_toolkit_lib.4.scad>;
data = [[ OBJECT_BOX,
  [ NAME, "Two levels" ], [ BOX_SIZE_XYZ, [50, 30, 20] ],
  [ BOX_WALL_THICKNESS, 2 ], [ BOX_NO_LID_B, true ],
  [ BOX_FEATURE, [ NAME, "deep" ], [ FTR_COMPARTMENT_SIZE_XYZ, [22, 26, 18] ], [ POSITION_XY, [0, 0] ] ],
  [ BOX_FEATURE, [ NAME, "shallow" ], [ FTR_COMPARTMENT_SIZE_XYZ, [22, 26, 12] ], [ POSITION_XY, [24, 0] ] ],
]];
Make(data);`;
  const source = renderStl(sourceScad, "two-levels.scad");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bgsd-depth-test-"));
  try {
    const sourcePath = path.join(tempDir, "two-levels.stl");
    fs.writeFileSync(sourcePath, source.data);
    const bounds = converter.readStlBounds(sourcePath, 1);
    const inferred = converter.createModel(sourcePath, bounds, {
      ...opts, bottom: 2, clearance: 0, heightExtra: 0,
      fitContainer: false, detectComponents: true, inferGeometry: true,
    });
    assert.equal(inferred.features.length, 2);
    assert.deepEqual(inferred.features.map((feature) => feature.size[2]), [18, 12]);
    assert.deepEqual(inferred.features.map((feature) => feature.floorTopZ), [2, 8]);
    const scad = converter.renderScad([inferred], {
      ...opts, includeFile: "boardgame_insert_toolkit_lib.4.scad", inferGeometry: true,
    }, schema);
    assert.match(scad, /measured floor 8mm above STL base/);
    assert.match(scad, /FTR_COMPARTMENT_SIZE_XYZ, \[22, 26, 12\]/);
    const reconstructed = renderStl(scad, "two-levels-reconstructed.scad");
    const reconstructedPath = path.join(tempDir, "two-levels-reconstructed.stl");
    fs.writeFileSync(reconstructedPath, reconstructed.data);
    const roundtrip = converter.createModel(reconstructedPath,
      converter.readStlBounds(reconstructedPath, 1), {
        ...opts, bottom: 2, clearance: 0, heightExtra: 0,
        fitContainer: false, detectComponents: true, inferGeometry: true,
      });
    assert.deepEqual(roundtrip.features.map((feature) => feature.size[2]), [18, 12]);
  } finally {
    const resolved = path.resolve(tempDir);
    if (resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`))
      fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test("keeps a partial divider local to the row it crosses", () => {
  const sourceScad = `union() {
    cube([100, 137, 0.8]);
    cube([1.5, 137, 39]);
    translate([98.5, 0, 0]) cube([1.5, 137, 39]);
    cube([100, 1.5, 39]);
    translate([0, 135.5, 0]) cube([100, 1.5, 39]);
    translate([0, 67.75, 0]) cube([100, 1.5, 22]);
    translate([49.25, 25, 0]) cube([1.5, 42.75, 22]);
  }`;
  const source = renderStl(sourceScad, "partial-divider.scad");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bgsd-partial-divider-test-"));
  try {
    const sourcePath = path.join(tempDir, "partial-divider.stl");
    fs.writeFileSync(sourcePath, source.data);
    const inferred = converter.createModel(sourcePath, converter.readStlBounds(sourcePath, 1), {
      ...opts, bottom: 2, clearance: 0, heightExtra: 0,
      fitContainer: false, detectComponents: true, inferGeometry: true,
    });

    assert.equal(inferred.detected.componentCount, 3);
    assert.deepEqual(inferred.features.map((feature) => feature.size.slice(0, 2)), [
      [47.75, 66.25],
      [47.75, 66.25],
      [97, 66.25],
    ]);
  } finally {
    const resolved = path.resolve(tempDir);
    if (resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`))
      fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test("detects thick channels and a one-sided sloped partial divider", () => {
  const sourceScad = `union() {
    cube([118, 208, 1.2]);
    translate([0, 0, 1.1]) cube([2, 208, 40.9]);
    translate([116, 0, 1.1]) cube([2, 208, 40.9]);
    for (y = [0, 33.8, 67.6, 101.4, 135.2, 169, 202.8])
      translate([0, y, 1.1]) cube([118, y == 202.8 ? 5.2 : 5, 40.9]);
    polyhedron(
      points=[
        [59,174,1.1], [59,202.8,1.1], [59,202.8,42], [59,174,42],
        [70,174,1.1], [70,202.8,1.1], [64,202.8,42], [64,174,42]
      ],
      faces=[[0,3,2,1], [4,5,6,7], [0,4,7,3], [1,2,6,5], [0,1,5,4], [3,7,6,2]]
    );
  }`;
  const source = renderStl(sourceScad, "thick-channels.scad");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bgsd-thick-channels-test-"));
  try {
    const sourcePath = path.join(tempDir, "thick-channels.stl");
    fs.writeFileSync(sourcePath, source.data);
    const inferred = converter.createModel(sourcePath, converter.readStlBounds(sourcePath, 1), {
      ...opts, bottom: 2, clearance: 0, heightExtra: 0,
      fitContainer: false, detectComponents: true, inferGeometry: true,
    });

    assert.equal(inferred.wallThickness, 2);
    assert.equal(inferred.detected.componentCount, 7);
    assert.deepEqual(inferred.features.map((feature) => feature.size.slice(0, 2)), [
      [114, 28.8], [114, 28.8], [114, 28.8], [114, 28.8], [114, 28.8],
      [57, 28.8], [52, 28.8],
    ]);
    assert.ok(inferred.detected.xBands.some((band) => band.oneSided));
  } finally {
    const resolved = path.resolve(tempDir);
    if (resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`))
      fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test("detects and reproduces circular holes through a compartment floor", () => {
  const centers = [
    [22.45, 16.75], [61.75, 16.75], [101.05, 16.75],
    [22.45, 46.75], [61.75, 46.75], [101.05, 46.75],
  ];
  const sourceScad = `difference() {
    union() {
      cube([123.5, 63.5, 1.2]);
      translate([0, 0, 1.1]) cube([1.2, 63.5, 4.9]);
      translate([122.3, 0, 1.1]) cube([1.2, 63.5, 4.9]);
      translate([0, 0, 1.1]) cube([123.5, 1.2, 4.9]);
      translate([0, 62.3, 1.1]) cube([123.5, 1.2, 4.9]);
      translate([40.7, 0, 1.1]) cube([2.8, 63.5, 4.9]);
      translate([80, 0, 1.1]) cube([2.8, 63.5, 4.9]);
      translate([0, 29.75, 1.1]) cube([123.5, 4, 4.9]);
    }
    for (center = ${JSON.stringify(centers)})
      translate([center[0], center[1], -0.1]) cylinder(h=1.4, d=20, $fn=64);
  }`;
  const source = renderStl(sourceScad, "bottom-holes.scad");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bgsd-bottom-holes-test-"));
  try {
    const sourcePath = path.join(tempDir, "bottom-holes.stl");
    fs.writeFileSync(sourcePath, source.data);
    const bounds = converter.readStlBounds(sourcePath, 1);
    const holes = converter.detectBottomThroughHoles(bounds, 1.2, 2.8);
    assert.equal(holes.length, 6);
    assert.deepEqual(holes.map((hole) => hole.center), centers);
    assert.ok(holes.every((hole) => Math.abs(hole.diameter - 20) <= 0.01));

    const inferred = converter.createModel(sourcePath, bounds, {
      ...opts, bottom: 2, clearance: 0, heightExtra: 0,
      fitContainer: false, detectComponents: true, inferGeometry: true,
    });
    const scad = converter.renderScad([inferred], {
      ...opts, includeFile: "boardgame_insert_toolkit_lib.4.scad", inferGeometry: true,
    }, schema);
    assert.equal((scad.match(/\/\/ 20mm circular bottom hole/g) || []).length, 6);
    assert.equal((scad.match(/cylinder\(h=/g) || []).length, 6);
  } finally {
    const resolved = path.resolve(tempDir);
    if (resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`))
      fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test("infers side cutouts and their dimensions from facet normals", () => {
  const geometryOpts = {
    ...opts,
    bottom: 2,
    clearance: 0,
    heightExtra: 0,
    fitContainer: false,
    detectComponents: true,
    inferGeometry: true,
  };
  const soloPath = path.join(__dirname, "..", "Solo.stl");
  const solo = converter.createModel(soloPath, converter.readStlBounds(soloPath, 1), geometryOpts);
  assert.equal(solo.detected.cutouts.find((cutout) => cutout.side === "right").confidence, "medium");
  assert.ok(solo.features.some((feature) => feature.cutoutSides[3]));

  const tokensPath = path.join(__dirname, "..", "Tokens A.stl");
  const tokens = converter.createModel(tokensPath, converter.readStlBounds(tokensPath, 1), geometryOpts);
  assert.equal(tokens.detected.cutouts.find((cutout) => cutout.side === "left").confidence, "medium");
  assert.ok(tokens.features.every((feature) => feature.cutoutInference.heightPct > 25));
  assert.ok(tokens.features.every((feature) => feature.cutoutInference.depthPct > 20));
  assert.ok(tokens.features.every((feature) => feature.cutoutInference.widthPct <= 95));

  const tokensBPath = path.join(__dirname, "..", "Tokens B.stl");
  const tokensB = converter.createModel(tokensBPath, converter.readStlBounds(tokensBPath, 1), geometryOpts);
  assert.equal(tokensB.features.length, 4);
  assert.ok(tokensB.features.every((feature) => feature.cutoutInference.type === "INTERIOR"));
  assert.deepEqual(tokensB.features.map((feature) => feature.size), [
    [49, 48, 26.5],
    [49, 48, 26.5],
    [49, 42, 26.5],
    [30, 11, 26.5],
  ]);
  assert.deepEqual(tokensB.features.at(-1).position, [0, 141]);
  assert.equal(tokensB.features.at(-1).profileExtension, true);
  assert.deepEqual(tokensB.detected.profileCuts, [{
    corner: "back-right",
    min: [33, 144],
    size: [19, 11],
    confidence: "high",
  }]);
  const tokensBScad = converter.renderScad([tokensB], geometryOpts, schema);
  assert.equal((tokensBScad.match(/\[ FTR_CUTOUT_TYPE, INTERIOR \]/g) || []).length, 4);
  assert.match(tokensBScad, /difference\(\) \{[\s\S]*back-right external step[\s\S]*cube\(\[19\.05, 11\.05, 28\.1\]\)/);
});

test("suppresses broad curved surfaces misidentified as cutouts on every side", () => {
  const bounds = { min: [0, 0, 0], max: [78, 96.75, 45], size: [78, 96.75, 45] };
  const x = { start: 4, end: 74, size: 70 };
  const y = { start: 4, end: 92.75, size: 88.75 };
  const cutouts = [
    { side: "front", detected: true, confidence: "high", crossMin: 4, crossMax: 74, depth: 9, height: 36, cutoutType: "BOTH" },
    { side: "back", detected: true, confidence: "high", crossMin: 4, crossMax: 74, depth: 9, height: 36, cutoutType: "BOTH" },
    { side: "left", detected: true, confidence: "high", crossMin: 4, crossMax: 92.75, depth: 9, height: 36, cutoutType: "BOTH" },
    { side: "right", detected: true, confidence: "high", crossMin: 4, crossMax: 92.75, depth: 9, height: 36, cutoutType: "BOTH" },
  ];
  const inferred = converter.inferCutoutsForInterval(cutouts, x, y, 41, bounds, 4);
  assert.deepEqual(inferred.sides, [false, false, false, false]);
  assert.equal(inferred.suppressed, true);
  assert.match(inferred.reason, /broad curved surfaces/);
});

test("separates tall interior ramps from opposite BIT cutouts", () => {
  const bounds = { min: [0, 0, 0], max: [118, 208, 42], size: [118, 208, 42] };
  const x = { start: 2, end: 116, size: 114 };
  const y = { start: 3, end: 31.8, size: 28.8 };
  const cutouts = [
    { side: "left", detected: true, confidence: "high", crossMin: 3, crossMax: 31.8, depth: 5.6, height: 39.8, cutoutType: "INTERIOR" },
    { side: "right", detected: true, confidence: "high", crossMin: 7, crossMax: 27, depth: 2.9, height: 21, cutoutType: "BOTH" },
  ];

  const inferred = converter.inferCutoutsForInterval(cutouts, x, y, 40, bounds, 2);
  assert.deepEqual(inferred.sides, [false, false, false, true]);
  assert.equal(inferred.type, "BOTH");
  assert.deepEqual(inferred.ramps, [{
    side: "left", depth: 5.6, height: 39.8, crossMin: 3, crossMax: 31.8,
  }]);
});

test("infers full-height side openings from gaps in planar wall faces", () => {
  const tilesPath = path.join(__dirname, "..", "Tiles.stl");
  const bounds = converter.readStlBounds(tilesPath, 1);
  const model = converter.createModel(tilesPath, bounds, {
    ...opts,
    bottom: 2,
    clearance: 0,
    heightExtra: 0,
    fitContainer: false,
    detectComponents: true,
    inferGeometry: true,
  });

  assert.deepEqual(model.features.map((feature) => feature.cutoutSides), [
    [true, false, false, false],
    [false, true, false, false],
  ]);
  assert.equal(model.detected.cutouts.find((cutout) => cutout.side === "front").planarOpening, true);
  assert.equal(model.detected.cutouts.find((cutout) => cutout.side === "back").planarOpening, true);
  const scad = converter.renderScad([model], { ...opts, inferGeometry: true }, schema);
  assert.equal((scad.match(/\[ FTR_CUTOUT_TYPE, BOTH \]/g) || []).length, 2);
});

test("does not infer profile steps from complete rectangular boundaries", () => {
  for (const fileName of ["Solo.stl", "Tiles.stl"]) {
    const filePath = path.join(__dirname, "..", fileName);
    const bounds = converter.readStlBounds(filePath, 1);
    assert.deepEqual(converter.detectExternalProfileCuts(bounds, 2), []);
  }
});

test("classifies round and filleted cavity walls", () => {
  const interval = { start: 1, end: 19, size: 18 };
  const facet = (normal, area = 1) => ({ normal, area, centroid: [10, 10, 5] });
  const bounds = { min: [0, 0, 0], facets: [] };

  bounds.facets = Array.from({ length: 12 }, () => facet([0.7, 0.7, 0]));
  assert.deepEqual(converter.detectFeatureShape(bounds, interval, interval, 1), {
    shape: "ROUND", confidence: "high", curvedRatio: 1,
  });

  bounds.facets = [
    ...Array.from({ length: 6 }, () => facet([0.7, 0.7, 0], 1)),
    ...Array.from({ length: 20 }, () => facet([1, 0, 0], 5)),
  ];
  assert.deepEqual(converter.detectFeatureShape(bounds, interval, interval, 1), {
    shape: "FILLET", confidence: "medium", curvedRatio: 0.057,
  });
});

test("classifies both vertical hexagon orientations and emits BIT vertical shape", () => {
  const interval = { start: 1, end: 19, size: 18 };
  const facet = (angle) => {
    const radians = angle * Math.PI / 180;
    return {
      normal: [Math.cos(radians), Math.sin(radians), 0],
      area: 10,
      centroid: [10, 10, 5],
    };
  };
  const bounds = { min: [0, 0, 0], facets: [] };

  bounds.facets = [0, 60, 120].map(facet);
  assert.deepEqual(converter.detectFeatureShape(bounds, interval, interval, 1), {
    shape: "HEX",
    confidence: "high",
    curvedRatio: 0.667,
    angularFit: 1,
    vertical: true,
  });

  bounds.facets = [30, 90, 150].map(facet);
  const detected = converter.detectFeatureShape(bounds, interval, interval, 1);
  assert.deepEqual(detected, {
    shape: "HEX2",
    confidence: "high",
    curvedRatio: 0.667,
    angularFit: 1,
    vertical: true,
  });

  const properties = converter.buildObjectProperties({
    ...model,
    features: [{ ...model.features[0], shape: detected }],
  }, { ...opts, inferGeometry: true });
  assert.equal(properties.BOX_FEATURE[0].FTR_SHAPE, "HEX2");
  assert.equal(properties.BOX_FEATURE[0].FTR_SHAPE_VERTICAL_B, true);
});

test("resolves the default BIT include relative to nested output folders", () => {
  const output = path.join(__dirname, "..", ".verification-output", "nested", "Solo.scad");
  assert.equal(converter.includePathForOutput({ includeFile: "../lib/example.scad", includeExplicit: false }, output), "../../lib/boardgame_insert_toolkit_lib.4.scad");
  assert.equal(converter.includePathForOutput({ includeFile: "custom.scad", includeExplicit: true }, output), "custom.scad");
});
