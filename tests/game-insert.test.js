"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const JSZip = require("jszip");
const { read3mfInventory, export3mfStl, planInsert } = require("../tools/game-insert.js");
const { createGuiServer, findOpenScad, renderStl } = require("../tools/gui-server.js");

test("imports 3MF units, named objects, and separate build copies", async () => {
  const zip = new JSZip();
  zip.file("3D/3dmodel.model", `<?xml version="1.0"?>
<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" unit="centimeter">
  <resources>
    <object id="1" name="Smile">
      <mesh><vertices>
        <vertex x="0" y="0" z="0"/><vertex x="2" y="0" z="0"/>
        <vertex x="0" y="1" z="0"/><vertex x="0" y="0" z="0.2"/>
      </vertices><triangles><triangle v1="0" v2="1" v3="2"/><triangle v1="0" v2="2" v3="3"/></triangles></mesh>
    </object>
  </resources>
  <build><item objectid="1"/><item objectid="1" transform="1 0 0 0 1 0 0 0 1 30 0 0"/></build>
</model>`);
  const pieces = await read3mfInventory(await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].name, "Smile");
  assert.equal(pieces[0].quantity, 2);
  assert.deepEqual(pieces[0].size, [20, 10, 2]);
});

test("imports 3MF component assemblies with transforms", async () => {
  const zip = new JSZip();
  zip.file("3D/3dmodel.model", `<?xml version="1.0"?>
<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" unit="millimeter">
  <resources>
    <object id="1" name="Part"><mesh><vertices>
      <vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/>
      <vertex x="0" y="5" z="0"/><vertex x="0" y="0" z="2"/>
    </vertices><triangles><triangle v1="0" v2="1" v3="2"/>
      <triangle v1="0" v2="2" v3="3"/></triangles></mesh></object>
    <object id="2" name="Assembly"><components>
      <component objectid="1" transform="0 1 0 -1 0 0 0 0 1 0 10 0"/>
    </components></object>
  </resources><build><item objectid="2"/></build>
</model>`);
  const pieces = await read3mfInventory(await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(pieces[0].name, "Assembly");
  assert.deepEqual(pieces[0].size, [5, 10, 2]);
});

test("exports original 3MF triangles with build placements to binary STL", async () => {
  const zip = new JSZip();
  zip.file("3D/3dmodel.model", `<?xml version="1.0"?>
<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" unit="centimeter">
  <resources><object id="1" name="Token"><mesh><vertices>
    <vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/>
    <vertex x="0" y="1" z="0"/>
  </vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources>
  <build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 2 3 0"/>
    <item objectid="1" transform="1 0 0 0 1 0 0 0 1 5 6 0"/></build>
</model>`);
  const stl = await export3mfStl(await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(stl.readUInt32LE(80), 2);
  assert.equal(stl.length, 184);
  assert.deepEqual([stl.readFloatLE(96), stl.readFloatLE(100), stl.readFloatLE(104)], [20, 30, 0]);
  assert.deepEqual([stl.readFloatLE(146), stl.readFloatLE(150), stl.readFloatLE(154)], [50, 60, 0]);
});

test("planner creates stackable cavities and rejects pieces that do not fit", () => {
  const input = { box: [100, 80, 30], wall: 2, floor: 2, clearance: 1,
    pieces: [{ name: "Smile", size: [20, 10, 2], quantity: 5 }] };
  const plan = planInsert(input);
  assert.equal(plan.fits, true);
  assert.equal(plan.pieceCount, 5);
  assert.deepEqual(plan.features[0].size, [22, 12, 28]);
  assert.equal(plan.features[0].requiredHeight, 12);
  const tooSmall = planInsert({ ...input, box: [20, 20, 8] });
  assert.equal(tooSmall.fits, false);
  assert.equal(tooSmall.features.length, 0);
  assert.match(tooSmall.errors[0], /Smile/);
});

test("compact planner sizes a tray around the imported smileys", () => {
  const input = { box: [198, 198, 49], wall: 2, floor: 2, clearance: 0,
    pieces: Array.from({ length: 10 }, (_, index) => ({ name: `Smile ${index + 1}`,
      size: [15, 15, 4.95], quantity: 1 })) };
  const full = planInsert(input);
  const compact = planInsert({ ...input, compact: true });
  assert.deepEqual(full.box, [198, 198, 49]);
  assert.equal(compact.fits, true);
  assert.equal(compact.features.length, 10);
  assert.ok(compact.box[0] < 100 && compact.box[1] < 100);
  assert.equal(compact.box[2], 10);
  for (const feature of compact.features) {
    assert.ok(feature.position[0] + feature.size[0] + compact.wall <= compact.box[0]);
    assert.ok(feature.position[1] + feature.size[1] + compact.wall <= compact.box[1]);
    assert.equal(feature.size[2], 8);
  }
});

test("planned game insert emits valid BGSD SCAD and renders as STL", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "stl-to-bgsd-gui.html"), "utf8");
  const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
  const source = section("    function quoteScadString(", "    async function downloadCombined()") +
    section("    function sanitizeScadString(", "    function normalizedScadName(") +
    section("    function round(value)", "    function formatInteger(");
  const plan = planInsert({ box: [100, 80, 30], wall: 2, floor: 2, clearance: 1,
    pieces: [{ name: "Smile", size: [20, 10, 2], quantity: 5 }] });
  const model = { fileName: "game.3mf", name: "Game", plannedInsert: true,
    bounds: { min: [0, 0, 0], max: plan.box, size: plan.box }, boxSize: plan.box,
    wallThickness: plan.wall, bottomThickness: plan.floor, noLid: true,
    featureEnabled: true, features: plan.features, shape: "SQUARE", detected: null };
  const context = { model, state: { settings: { printTypes: "BOX", tolerance: 0.1,
    colorize: true, wall: 2, bottom: 2, lidLabelOrientation: "HORIZONTAL",
    lidLabelText: "", boxLabelText: "", labelPlacement: "CENTER", labelSize: "AUTO",
    labelDepth: 0.2, inferGeometry: false, featureLabels: false } } };
  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.scad = renderScad([model], "boardgame_insert_toolkit_lib.4.scad");`, context);
  assert.match(context.scad, /Game inventory source: game\.3mf/);
  assert.match(context.scad, /\[ FTR_COMPARTMENT_SIZE_XYZ, \[22, 12, 28\] \]/);
  assert.doesNotMatch(context.scad, /Source STL:/);
  const executable = findOpenScad();
  if (fs.existsSync(executable)) {
    const stl = renderStl(context.scad, "game.scad");
    assert.ok(stl.data.length > 84);
  }
});

test("local GUI API imports a 3MF and plans an insert", async () => {
  const zip = new JSZip();
  zip.file("3D/3dmodel.model", `<?xml version="1.0"?>
<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" unit="millimeter">
  <resources><object id="1" name="Token"><mesh><vertices>
    <vertex x="0" y="0" z="0"/><vertex x="20" y="0" z="0"/>
    <vertex x="0" y="10" z="0"/><vertex x="0" y="0" z="2"/>
  </vertices><triangles><triangle v1="0" v2="1" v3="2"/><triangle v1="0" v2="2" v3="3"/></triangles></mesh></object></resources>
  <build><item objectid="1"/><item objectid="1"/></build>
</model>`);
  const data = await zip.generateAsync({ type: "nodebuffer" });
  const server = createGuiServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const imported = await fetch(`${url}/api/import-3mf`, { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataBase64: data.toString("base64") }) });
    assert.equal(imported.status, 200);
    const { pieces } = await imported.json();
    assert.equal(pieces[0].quantity, 2);
    const planned = await fetch(`${url}/api/plan-insert`, { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ box: [100, 80, 30], wall: 2, floor: 2,
        clearance: 1, pieces }) });
    assert.equal(planned.status, 200);
    const plan = await planned.json();
    assert.equal(plan.fits, true);
    assert.equal(plan.pieceCount, 2);
    assert.equal(plan.features.length, 1);
    const compactResponse = await fetch(`${url}/api/plan-insert`, { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ box: [100, 80, 30], wall: 2, floor: 2,
        clearance: 1, compact: true, pieces }) });
    assert.equal(compactResponse.status, 200);
    const compactPlan = await compactResponse.json();
    assert.deepEqual(compactPlan.box, [24, 14, 10]);
    const exported = await fetch(`${url}/api/export-3mf-stl`, { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataBase64: data.toString("base64") }) });
    assert.equal(exported.status, 200);
    const stl = Buffer.from(await exported.arrayBuffer());
    assert.equal(stl.readUInt32LE(80), 4);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
