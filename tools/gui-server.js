#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const fidelity = require("./validate-fidelity.js");
const { read3mfInventory, export3mfStl, planInsert } = require("./game-insert.js");

const root = path.join(__dirname, "..");
const host = process.env.STL_BGSD_GUI_HOST || "127.0.0.1";
const defaultPort = 43721;
const maxRequestBytes = 64 * 1024 * 1024;
const configuredRenderTimeout = Number(process.env.STL_BGSD_RENDER_TIMEOUT_MS || 600000);
const renderTimeoutMs = Number.isFinite(configuredRenderTimeout) && configuredRenderTimeout > 0
  ? configuredRenderTimeout
  : 600000;

function findOpenScad() {
  const candidates = [
    process.env.OPENSCAD_PATH,
    process.platform === "win32" ? "C:\\Program Files\\OpenSCAD\\openscad.exe" : null,
    "openscad",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate === "openscad" || fs.existsSync(candidate)) return candidate;
  }
  throw new Error("OpenSCAD nao encontrado. Instale-o ou configure OPENSCAD_PATH.");
}

function renderStl(scad, fileName = "insert.scad") {
  if (typeof scad !== "string" || !scad.trim()) throw new Error("SCAD vazio.");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stl-bgsd-gui-"));
  const safeBase = path.basename(fileName, path.extname(fileName)).replace(/[^A-Za-z0-9._ -]/g, "_") || "insert";
  const scadPath = path.join(tempDir, `${safeBase}.scad`);
  const stlPath = path.join(tempDir, `${safeBase}.stl`);
  try {
    fs.writeFileSync(scadPath, scad, "utf8");
    fs.copyFileSync(
      path.join(root, "lib", "boardgame_insert_toolkit_lib.4.scad"),
      path.join(tempDir, "boardgame_insert_toolkit_lib.4.scad"),
    );
    const result = spawnSync(findOpenScad(), ["-o", stlPath, scadPath], {
      encoding: "utf8",
      windowsHide: true,
      timeout: renderTimeoutMs,
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error?.code === "ETIMEDOUT") {
      throw new Error(`OpenSCAD excedeu o limite de ${Math.round(renderTimeoutMs / 60000)} minutos. Selecione BOX em Saida BIT para renderizar apenas a caixa, ou aumente STL_BGSD_RENDER_TIMEOUT_MS.`);
    }
    if (result.error) throw new Error(`OpenSCAD falhou: ${result.error.message}`);
    if (result.status !== 0 || !fs.existsSync(stlPath)) {
      const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      throw new Error(`OpenSCAD nao conseguiu renderizar.${details ? `\n${details}` : ""}`);
    }
    return { fileName: `${safeBase}.stl`, data: fs.readFileSync(stlPath) };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function validateFidelity(body) {
  if (typeof body.scad !== "string" || !body.scad.trim()) throw new Error("SCAD vazio.");
  if (typeof body.originalStlBase64 !== "string" || !body.originalStlBase64.trim()) throw new Error("STL original ausente.");
  const originalData = Buffer.from(body.originalStlBase64, "base64");
  if (originalData.length < 84) throw new Error("STL original invalido.");
  const tolerance = Number(body.tolerance ?? 0.5);
  const samples = Math.floor(Number(body.samples ?? 6000));
  const scale = Number(body.scale ?? 1);
  if (!Number.isFinite(tolerance) || tolerance <= 0) throw new Error("Tolerancia de fidelidade invalida.");
  if (!Number.isFinite(samples) || samples < 100 || samples > 50000) throw new Error("Amostragem de fidelidade invalida.");
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Escala STL invalida.");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stl-bgsd-fidelity-"));
  const safeBase = path.basename(body.fileName || "insert", path.extname(body.fileName || "insert"))
    .replace(/[^A-Za-z0-9._ -]/g, "_") || "insert";
  const sourcePath = path.join(tempDir, `${safeBase}-original.stl`);
  const scadPath = path.join(tempDir, `${safeBase}.scad`);
  const previewPath = path.join(tempDir, `${safeBase}.fidelity.png`);
  let comparisonSourcePath = sourcePath;
  try {
    fs.writeFileSync(sourcePath, originalData);
    fs.writeFileSync(scadPath, body.scad, "utf8");
    fs.copyFileSync(
      path.join(root, "lib", "boardgame_insert_toolkit_lib.4.scad"),
      path.join(tempDir, "boardgame_insert_toolkit_lib.4.scad"),
    );
    if (Math.abs(scale - 1) > 1e-9) {
      const scaledScadPath = path.join(tempDir, `${safeBase}-original-scaled.scad`);
      comparisonSourcePath = path.join(tempDir, `${safeBase}-original-scaled.stl`);
      const imported = sourcePath.replace(/\\/g, "/").replace(/"/g, '\\"');
      fs.writeFileSync(scaledScadPath, `scale([${scale}, ${scale}, ${scale}]) import("${imported}");\n`, "utf8");
      fidelity.renderScad(scaledScadPath, comparisonSourcePath, findOpenScad(), renderTimeoutMs);
    }
    const report = fidelity.validateCandidate(comparisonSourcePath, scadPath, {
      tolerance,
      samples,
      preview: previewPath,
      openscad: findOpenScad(),
      timeoutMs: renderTimeoutMs,
    });
    report.files = { original: `${safeBase}-original.stl`, candidate: `${safeBase}.scad` };
    delete report.preview;
    return { report, previewBase64: fs.readFileSync(previewPath).toString("base64") };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxRequestBytes) {
        reject(new Error("Requisicao excede o limite de 64 MB."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Requisicao JSON invalida."));
      }
    });
    request.on("error", reject);
  });
}

function sendFile(response, filePath, contentType) {
  const data = fs.readFileSync(filePath);
  response.writeHead(200, { "Content-Type": contentType, "Content-Length": data.length, "Cache-Control": "no-store" });
  response.end(data);
}

function createGuiServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${host}`);
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/stl-to-bgsd-gui.html")) {
        sendFile(response, path.join(root, "stl-to-bgsd-gui.html"), "text/html; charset=utf-8");
        return;
      }
      if (request.method === "GET" && url.pathname === "/lib/bit-library.embedded.js") {
        sendFile(response, path.join(root, "lib", "bit-library.embedded.js"), "text/javascript; charset=utf-8");
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: true, openscad: findOpenScad(), renderTimeoutMs }));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/render-stl") {
        const body = await readJson(request);
        const rendered = renderStl(body.scad, body.fileName);
        response.writeHead(200, {
          "Content-Type": "model/stl",
          "Content-Length": rendered.data.length,
          "Content-Disposition": `attachment; filename="${rendered.fileName.replace(/"/g, "")}"`,
          "Cache-Control": "no-store",
        });
        response.end(rendered.data);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/validate-fidelity") {
        const body = await readJson(request);
        const result = validateFidelity(body);
        const data = Buffer.from(JSON.stringify(result));
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": data.length,
          "Cache-Control": "no-store",
        });
        response.end(data);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/import-3mf") {
        const body = await readJson(request);
        if (typeof body.dataBase64 !== "string") throw new Error("Arquivo 3MF ausente.");
        const data = Buffer.from(body.dataBase64, "base64");
        if (data.length < 100 || data.length > 32 * 1024 * 1024) throw new Error("3MF invalido ou maior que 32 MB.");
        const pieces = await read3mfInventory(data);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        response.end(JSON.stringify({ pieces }));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/export-3mf-stl") {
        const body = await readJson(request);
        if (typeof body.dataBase64 !== "string") throw new Error("Arquivo 3MF ausente.");
        const data = Buffer.from(body.dataBase64, "base64");
        if (data.length < 100 || data.length > 32 * 1024 * 1024) throw new Error("3MF invalido ou maior que 32 MB.");
        const stl = await export3mfStl(data);
        response.writeHead(200, {
          "Content-Type": "model/stl",
          "Content-Length": stl.length,
          "Content-Disposition": "attachment; filename=\"pecas-originais.stl\"",
          "Cache-Control": "no-store",
        });
        response.end(stl);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/plan-insert") {
        const body = await readJson(request);
        const plan = planInsert(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        response.end(JSON.stringify(plan));
        return;
      }
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Nao encontrado.");
    } catch (error) {
      if (!response.headersSent) response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.message);
    }
  });
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } else {
    spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

function main() {
  const portArg = process.argv.find((arg) => /^--port=\d+$/.test(arg));
  const port = portArg ? Number(portArg.split("=")[1]) : Number(process.env.STL_BGSD_GUI_PORT || defaultPort);
  const shouldOpen = process.argv.includes("--open");
  const url = `http://${host}:${port}/`;
  const server = createGuiServer();
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && shouldOpen) {
      openBrowser(url);
      process.exit(0);
    }
    console.error(error.message);
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log(`STL to BGSD GUI: ${url}`);
    if (shouldOpen) openBrowser(url);
  });
}

if (require.main === module) main();

module.exports = { createGuiServer, findOpenScad, renderStl, validateFidelity };
