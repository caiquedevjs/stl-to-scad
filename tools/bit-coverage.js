#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const schemaPath = path.join(root, "BGSD-src", "schema", "bit.schema.json");
const libraryPath = path.join(root, "lib", "boardgame_insert_toolkit_lib.4.scad");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const library = fs.readFileSync(libraryPath, "utf8");

const AUTO_KEYS = new Set([
  "element.NAME", "element.BOX_SIZE_XYZ", "element.BOX_WALL_THICKNESS",
  "element.BOX_FEATURE", "feature.NAME", "feature.FTR_COMPARTMENT_SIZE_XYZ",
  "feature.POSITION_XY", "feature.FTR_SHAPE", "feature.FTR_CUTOUT_SIDES_4B",
  "feature.FTR_CUTOUT_HEIGHT_PCT", "feature.FTR_CUTOUT_DEPTH_PCT",
  "feature.FTR_CUTOUT_WIDTH_PCT",
]);

const GUIDED_KEYS = new Set([
  "element.BOX_NO_LID_B", "element.BOX_LID", "element.LABEL",
  "feature.FTR_NUM_COMPARTMENTS_XY",
  "feature.FTR_CUTOUT_BOTTOM_B", "feature.FTR_CUTOUT_TYPE", "feature.LABEL",
  "lid.LID_TYPE", "lid.LABEL", "label.NAME", "label.LBL_TEXT",
  "label.LBL_SIZE", "label.LBL_PLACEMENT", "label.LBL_DEPTH",
]);

const rows = [];
for (const key of Object.keys(schema.globals)) addRow("globals", key, schema.globals[key]);
for (const [context, definition] of Object.entries(schema.contexts)) {
  for (const [key, descriptor] of Object.entries(definition.keys)) addRow(context, key, descriptor);
}

function addRow(context, key, descriptor) {
  const id = `${context}.${key}`;
  rows.push({
    context,
    key,
    type: descriptor.type,
    emission: "schema",
    acquisition: AUTO_KEYS.has(id) ? "automatic" : GUIDED_KEYS.has(id) ? "guided" : "bit-config",
  });
}

const enumAndObjectTokens = new Set([
  "VERSION", "COPYRIGHT_INFO", "TYPE", "BOX", "DIVIDERS", "SPACER", "LID",
  "OBJECT_BOX", "OBJECT_DIVIDERS", "OBJECT_SPACER",
  "X", "Y", "FRONT", "BACK", "LEFT", "RIGHT", "CENTER", "BOTTOM", "AUTO", "MAX",
  "SQUARE", "HEX", "HEX2", "OCT", "OCT2", "ROUND", "FILLET", "SVG",
  "INTERIOR", "EXTERIOR", "BOTH",
  "LID_CAP", "LID_INSET", "LID_SLIDING",
  "FRONT_WALL", "BACK_WALL", "LEFT_WALL", "RIGHT_WALL",
]);
const libraryKeys = new Set(
  [...library.matchAll(/^([A-Z][A-Z0-9_]+)\s*=\s*"/gm)]
    .map((match) => match[1])
    .filter((key) => !enumAndObjectTokens.has(key)),
);
const schemaKeys = new Set(rows.map((row) => row.key));
const missingFromSchema = [...libraryKeys].filter((key) => !schemaKeys.has(key)).sort();

const report = {
  bitVersion: schema.version,
  parameterCount: schemaKeys.size,
  contextEntryCount: rows.length,
  missingFromSchema,
  acquisition: {
    automatic: rows.filter((row) => row.acquisition === "automatic").length,
    guided: rows.filter((row) => row.acquisition === "guided").length,
    bitConfig: rows.filter((row) => row.acquisition === "bit-config").length,
  },
  rows,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`BIT ${report.bitVersion}: ${report.parameterCount} unique parameters, ${report.contextEntryCount} context entries`);
  console.log(`Acquisition entries: ${report.acquisition.automatic} automatic, ${report.acquisition.guided} guided, ${report.acquisition.bitConfig} config-only`);
  console.log(`Library parameters missing from schema: ${missingFromSchema.length ? missingFromSchema.join(", ") : "none"}`);
  console.log("");
  console.log("| Context | Key | Type | Acquisition |");
  console.log("| --- | --- | --- | --- |");
  for (const row of rows) console.log(`| ${row.context} | ${row.key} | ${row.type} | ${row.acquisition} |`);
}

if (process.argv.includes("--check") && missingFromSchema.length) process.exitCode = 1;
