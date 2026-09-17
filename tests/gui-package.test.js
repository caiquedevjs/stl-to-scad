"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.join(__dirname, "..");

test("embedded GUI library matches the distributed BIT library", () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, "lib", "bit-library.embedded.js"), "utf8"), context);
  const embedded = zlib.gunzipSync(Buffer.from(context.window.BIT_LIBRARY_GZIP_BASE64, "base64"));
  const source = fs.readFileSync(path.join(root, "lib", "boardgame_insert_toolkit_lib.4.scad"));
  assert.deepEqual(embedded, source);
});

test("GUI package creates a readable store-only ZIP", async () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  const start = html.indexOf("    function createZip(entries)");
  const end = html.indexOf("    function setStatus(text)", start);
  assert.ok(start >= 0 && end > start);

  const context = { Blob, DataView, TextEncoder, Uint8Array };
  vm.runInNewContext(`${html.slice(start, end)}\nglobalThis.createZip = createZip;`, context);
  const encoder = new TextEncoder();
  const expected = [
    { name: "modelo.scad", data: encoder.encode("include <boardgame_insert_toolkit_lib.4.scad>;\n") },
    { name: "boardgame_insert_toolkit_lib.4.scad", data: encoder.encode("module Make(data) {}\n") },
  ];
  const bytes = new Uint8Array(await context.createZip(expected).arrayBuffer());
  const view = new DataView(bytes.buffer);
  let offset = 0;

  for (const entry of expected) {
    assert.equal(view.getUint32(offset, true), 0x04034b50);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength;
    assert.equal(Buffer.from(bytes.slice(nameStart, dataStart)).toString(), entry.name);
    assert.deepEqual(bytes.slice(dataStart, dataStart + size), entry.data);
    offset = dataStart + size;
  }

  assert.equal(view.getUint32(offset, true), 0x02014b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 12, true), expected.length);
});

test("GUI emits horizontal or vertical rotation for the lid name", () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  assert.match(html, /id="lidLabelOrientation"/);
  assert.match(html, /value="HORIZONTAL">Horizontal/);
  assert.match(html, /value="VERTICAL">Vertical/);
  assert.match(html, /lidLabelOrientation === "VERTICAL" \? 90 : 0/);
  assert.match(html, /\[ ROTATION, \$\{formatScadValue\(rotation\)\} \]/);
});

test("GUI keeps a separate lid name and orientation for every imported model", () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  assert.match(html, /<th>Nome da tampa<\/th>/);
  assert.match(html, /function lidLabelNode\(model\)/);
  assert.match(html, /model\.lidLabelTextCustomized = true/);
  assert.match(html, /model\.lidLabelOrientationCustomized = true/);
  assert.match(html, /const lidLabelText = model\.lidLabelText \?\? state\.settings\.lidLabelText/);
  assert.match(html, /const lidLabelOrientation = model\.lidLabelOrientation \?\? state\.settings\.lidLabelOrientation/);
});

test("GUI can disable the lid fitting underneath each box", () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  assert.match(html, /checkboxNode\("Encaixar tampa sob a caixa", model\.lidFitUnder !== false/);
  assert.match(html, /model\.lidFitUnder = checked/);
  assert.match(html, /\[ LID_FIT_UNDER_B, \$\{model\.lidFitUnder !== false\} \]/);
});

test("local server can listen on a container network interface", () => {
  const server = fs.readFileSync(path.join(root, "tools", "gui-server.js"), "utf8");
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  const compose = fs.readFileSync(path.join(root, "docker-compose.yml"), "utf8");
  assert.match(server, /process\.env\.STL_BGSD_GUI_HOST \|\| "127\.0\.0\.1"/);
  assert.match(dockerfile, /OPENSCAD_PATH=\/usr\/local\/bin\/openscad-headless/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(compose, /127\.0\.0\.1:43721:43721/);
  assert.match(compose, /STL_BGSD_GUI_HOST: 0\.0\.0\.0/);
});

test("GUI shows render progress, elapsed time, and a learned estimate", () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  assert.match(html, /id="renderDialog"/);
  assert.match(html, /id="renderElapsed"/);
  assert.match(html, /id="renderRemaining"/);
  assert.match(html, /id="renderEta"/);
  assert.match(html, /stl-bgsd-render-history/);
  assert.match(html, /startRenderModal\(`\$\{baseName\}\.stl`, models\)/);
  assert.match(html, /finishRenderModal\(true, "Arquivo pronto\. Download iniciado\."\)/);
});

test("GUI can validate fidelity from the STL already loaded", () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  assert.match(html, /id="verifyFidelity"/);
  assert.match(html, /model\.sourceStl = new Uint8Array\(buffer\.slice\(0\)\)/);
  assert.match(html, /fetch\("\/api\/validate-fidelity"/);
  assert.match(html, /originalStlBase64: bytesToBase64\(model\.sourceStl\)/);
  assert.match(html, /displayFidelity\(result\.report, `data:image\/png;base64,/);
});

test("GUI exposes game-piece inventory and editable planned cavities", () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  for (const id of ["pick3mf", "exportGamePieces", "addGamePiece", "createGameInsert", "gamePieceRows",
    "gameCompartmentRows", "gameBoxX", "gameBoxY", "gameBoxZ", "gameOuterClearance"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /fetch\("\/api\/import-3mf"/);
  assert.match(html, /fetch\("\/api\/export-3mf-stl"/);
  assert.match(html, /fetch\("\/api\/plan-insert"/);
  assert.match(html, /id="gameFillBox" type="checkbox"/);
  assert.match(html, /compact: !els\.gameFillBox\.checked/);
  assert.match(html, /if \(!model\.plannedInsert\) renderCutoutLines/);
  assert.match(html, /updatePlannedModelValidity\(model\)/);
});

test("3MF import explains when the GUI is running without its local API", async () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  const localStart = html.indexOf("    async function localApiAvailable()");
  const localEnd = html.indexOf("    localApiAvailable();", localStart);
  const gameStart = html.indexOf("    async function ensureGameApi()");
  const gameEnd = html.indexOf("    async function importGame3mf(file)", gameStart);
  assert.ok(localStart >= 0 && localEnd > localStart && gameStart >= 0 && gameEnd > gameStart);
  assert.match(html, /id="gameServerLink" href="http:\/\/127\.0\.0\.1:43721\/"/);

  const link = { hidden: true };
  const notice = { hidden: true };
  const context = { els: { gameServerLink: link, serverNotice: notice },
    fetch: async () => ({ ok: false }) };
  vm.runInNewContext(`${html.slice(localStart, localEnd)}\n${html.slice(gameStart, gameEnd)}\nglobalThis.ensureGameApi = ensureGameApi;`, context);
  await assert.rejects(context.ensureGameApi(), /servidor local/);
  assert.equal(link.hidden, false);
  assert.equal(notice.hidden, false);

  link.hidden = true;
  context.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  await context.ensureGameApi();
  assert.equal(link.hidden, true);
  assert.equal(notice.hidden, true);
});

test("static GUI warns before opening render and fidelity modals", () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  assert.match(html, /id="serverNotice" class="server-notice" role="alert" hidden/);
  for (const [start, end] of [["    async function generateStl()", "    async function downloadEach()"],
    ["    async function verifyFidelity()", "    async function generateStl()"]]) {
    const section = html.slice(html.indexOf(start), html.indexOf(end));
    const check = section.indexOf("if (!(await localApiAvailable()))");
    const modal = section.indexOf("startRenderModal(");
    assert.ok(check >= 0 && modal > check);
  }
});

test("geometry inference keeps two side openings on separate cavities", () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
  const source = section("    function detectSideCutouts(", "    function detectFeatureShape(")
    + section("    function inferCutoutsForInterval(", "    function detectWallBands(")
    + section("    function round(value)", "    function formatInteger(");
  const bounds = { min: [0, 8, 0], max: [142, 103, 49], size: [142, 95, 49], facets: [] };
  for (const [left, right] of [[0, 20], [50, 90], [120, 142]]) {
    const a = [left, 8, 0], b = [right, 8, 0], c = [right, 8, 49], d = [left, 8, 49];
    for (const points of [[a, b, c], [a, c, d]]) {
      bounds.facets.push({ points, normal: [0, -1, 0],
        centroid: points[0].map((_, axis) => points.reduce((sum, point) => sum + point[axis], 0) / 3),
        area: (right - left) * 49 / 2 });
    }
  }
  const context = { bounds };
  vm.runInNewContext(`${source}\nglobalThis.detect = () => {
    const cutouts = detectSideCutouts(bounds, 1.5, 0.8);
    const y = { start: 9.5, end: 101.5, size: 92 };
    return { cutouts, features: [
      inferCutoutsForInterval(cutouts, { start: 1.5, end: 70.5, size: 69 }, y, 47.5, bounds, 1.5),
      inferCutoutsForInterval(cutouts, { start: 72, end: 141, size: 69 }, y, 47.5, bounds, 1.5),
    ] };
  };`, context);
  const result = context.detect();
  assert.equal(result.cutouts.filter((cutout) => cutout.side === "front" && cutout.detected).length, 2);
  assert.equal(result.features[0].sides[0], true);
  assert.equal(result.features[1].sides[0], true);
  for (const feature of result.features) {
    const lowerEdge = bounds.size[2] * (1 - feature.heightPct / 100) - 1.5;
    assert.ok(lowerEdge > bounds.size[2] - 47.5);
    assert.ok(feature.heightPct < 100);
  }
});

test("GUI suppresses ambiguous broad curved surfaces on multiple sides", () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  assert.match(html, /broadCurvedSides\.length >= 3/);
  assert.match(html, /Ambiguous broad multi-side surfaces were not emitted as finger cutouts/);
});

test("GUI assigns separate floor levels to adjacent compartments", () => {
  const html = fs.readFileSync(path.join(root, "stl-to-bgsd-gui.html"), "utf8");
  const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
  const source = section("    function inferCompartmentFloor(", "    function partitionIntervalsForProfileCuts(")
    + section("    function round(value)", "    function formatInteger(");
  const bounds = { min: [0, 0, 0], max: [50, 30, 20], size: [50, 30, 20], facets: [] };
  function floor(left, right, front, back, z) {
    const a = [left, front, z], b = [right, front, z];
    const c = [right, back, z], d = [left, back, z];
    for (const points of [[a, b, c], [a, c, d]]) {
      bounds.facets.push({ points, normal: [0, 0, 1], area: (right - left) * (back - front) / 2,
        centroid: points[0].map((_, axis) => points.reduce((sum, point) => sum + point[axis], 0) / 3) });
    }
  }
  floor(2, 24, 2, 28, 2);
  floor(26, 48, 2, 28, 8);
  floor(26, 35, 2, 20, 14);
  floor(26, 48, 2, 28, 20);
  const context = { bounds };
  vm.runInNewContext(`${source}\nglobalThis.detect = (x, y) => inferCompartmentFloor(bounds, x, y, 2);`, context);
  const y = { start: 2, end: 28, size: 26 };
  assert.equal(context.detect({ start: 2, end: 24, size: 22 }, y).z, 2);
  assert.equal(context.detect({ start: 26, end: 48, size: 22 }, y).z, 8);
  assert.equal(context.detect({ start: 0, end: 1, size: 1 }, y), null);
  assert.match(html, /id="stlCompartments"/);
  assert.match(html, /model\.compartmentSize = \[\.\.\.model\.features\[0\]\.size\]/);
});
