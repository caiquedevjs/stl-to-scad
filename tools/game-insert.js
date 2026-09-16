"use strict";

const JSZip = require("jszip");
const { DOMParser } = require("@xmldom/xmldom");

const unitScale = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

function children(element, name) {
  return Array.from(element?.childNodes || []).filter((node) => node.nodeType === 1 && node.localName === name);
}

function transform(raw) {
  const values = raw ? raw.trim().split(/\s+/).map(Number) : [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  if (values.length !== 12 || values.some((value) => !Number.isFinite(value))) throw new Error("Transformacao 3MF invalida.");
  return values;
}

function applyTransform(point, matrix) {
  const [x, y, z] = point;
  return [
    x * matrix[0] + y * matrix[3] + z * matrix[6] + matrix[9],
    x * matrix[1] + y * matrix[4] + z * matrix[7] + matrix[10],
    x * matrix[2] + y * matrix[5] + z * matrix[8] + matrix[11],
  ];
}

function mergeBounds(bounds) {
  if (!bounds.length) throw new Error("Objeto 3MF sem geometria.");
  return {
    min: [0, 1, 2].map((axis) => Math.min(...bounds.map((entry) => entry.min[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...bounds.map((entry) => entry.max[axis]))),
  };
}

function transformedBounds(bounds, matrix) {
  const corners = [];
  for (const x of [bounds.min[0], bounds.max[0]])
    for (const y of [bounds.min[1], bounds.max[1]])
      for (const z of [bounds.min[2], bounds.max[2]]) corners.push(applyTransform([x, y, z], matrix));
  return {
    min: [0, 1, 2].map((axis) => Math.min(...corners.map((point) => point[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...corners.map((point) => point[axis]))),
  };
}

function round(value) { return Math.round(value * 1000) / 1000; }

async function read3mfInventory(data) {
  const zip = await JSZip.loadAsync(data);
  const modelFiles = Object.keys(zip.files).filter((name) => /^3D\/.*\.model$/i.test(name));
  if (!modelFiles.length) throw new Error("3MF sem arquivo de modelo.");
  if (modelFiles.length > 20) throw new Error("3MF com modelos demais para este importador.");
  const pieces = [];

  for (const name of modelFiles) {
    if (zip.file(name)._data.uncompressedSize > 16 * 1024 * 1024)
      throw new Error("XML do 3MF excede 16 MB.");
    const xml = await zip.file(name).async("string");
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const root = document.documentElement;
    if (root.localName !== "model") throw new Error("XML do 3MF invalido.");
    const scale = unitScale[root.getAttribute("unit") || "millimeter"];
    if (!scale) throw new Error("Unidade 3MF nao reconhecida.");
    const resources = children(root, "resources")[0];
    const objects = new Map(children(resources, "object").map((object) => [object.getAttribute("id"), object]));
    const cache = new Map();

    function objectBounds(id, visiting = new Set()) {
      if (cache.has(id)) return cache.get(id);
      if (visiting.has(id)) throw new Error("Referencias ciclicas no 3MF.");
      const object = objects.get(id);
      if (!object) throw new Error(`Objeto 3MF ${id} nao encontrado.`);
      visiting.add(id);
      const mesh = children(object, "mesh")[0];
      let bounds;
      if (mesh) {
        const vertices = children(children(mesh, "vertices")[0], "vertex").map((vertex) =>
          ["x", "y", "z"].map((axis) => Number(vertex.getAttribute(axis))));
        if (!vertices.length || vertices.some((point) => point.some((value) => !Number.isFinite(value))))
          throw new Error("Vertices 3MF invalidos.");
        const triangles = children(children(mesh, "triangles")[0], "triangle");
        const referenced = new Set(triangles.flatMap((triangle) => ["v1", "v2", "v3"]
          .map((attribute) => Number(triangle.getAttribute(attribute)))));
        if (!triangles.length || [...referenced].some((index) => !Number.isInteger(index) || index < 0 || index >= vertices.length))
          throw new Error("Triangulos 3MF invalidos.");
        const usedVertices = [...referenced].map((index) => vertices[index]);
        bounds = {
          min: [0, 1, 2].map((axis) => Math.min(...usedVertices.map((point) => point[axis]))),
          max: [0, 1, 2].map((axis) => Math.max(...usedVertices.map((point) => point[axis]))),
        };
      } else {
        const components = children(children(object, "components")[0], "component");
        bounds = mergeBounds(components.map((component) => transformedBounds(
          objectBounds(component.getAttribute("objectid"), visiting), transform(component.getAttribute("transform")))));
      }
      visiting.delete(id);
      cache.set(id, bounds);
      return bounds;
    }

    const build = children(root, "build")[0];
    for (const [index, item] of children(build, "item").entries()) {
      const id = item.getAttribute("objectid");
      const object = objects.get(id);
      if (!object || object.getAttribute("type") === "support" || object.getAttribute("type") === "solidsupport") continue;
      const matrix = transform(item.getAttribute("transform"));
      matrix[9] = matrix[10] = matrix[11] = 0;
      const bounds = transformedBounds(objectBounds(id), matrix);
      const size = [0, 1, 2].map((axis) => round((bounds.max[axis] - bounds.min[axis]) * scale));
      if (size.some((value) => value <= 0)) continue;
      pieces.push({ id: `${name}:${id}:${index}`, objectId: id, name: object.getAttribute("name") || `Peca ${id}`, size, quantity: 1, source: name });
    }
  }

  if (!pieces.length) throw new Error("3MF sem pecas de modelo na montagem.");
  const grouped = new Map();
  for (const piece of pieces) {
    const key = `${piece.source}:${piece.objectId}:${piece.size.join(",")}`;
    const existing = grouped.get(key);
    if (existing) existing.quantity++;
    else grouped.set(key, { ...piece });
  }
  return [...grouped.values()];
}

function transformTriangle(triangle, matrix) {
  const points = triangle.map((point) => applyTransform(point, matrix));
  const determinant = matrix[0] * (matrix[4] * matrix[8] - matrix[7] * matrix[5])
    - matrix[3] * (matrix[1] * matrix[8] - matrix[7] * matrix[2])
    + matrix[6] * (matrix[1] * matrix[5] - matrix[4] * matrix[2]);
  if (Math.abs(determinant) < 1e-10) throw new Error("Transformacao 3MF degenerada.");
  if (determinant < 0) [points[1], points[2]] = [points[2], points[1]];
  return points;
}

async function export3mfStl(data) {
  const zip = await JSZip.loadAsync(data);
  const modelFiles = Object.keys(zip.files).filter((name) => /^3D\/.*\.model$/i.test(name));
  if (!modelFiles.length || modelFiles.length > 20) throw new Error("3MF sem modelo valido para exportacao.");
  const facets = [];
  for (const name of modelFiles) {
    if (zip.file(name)._data.uncompressedSize > 16 * 1024 * 1024)
      throw new Error("XML do 3MF excede 16 MB.");
    const document = new DOMParser().parseFromString(await zip.file(name).async("string"), "application/xml");
    const root = document.documentElement;
    if (root.localName !== "model") throw new Error("XML do 3MF invalido.");
    const scale = unitScale[root.getAttribute("unit") || "millimeter"];
    if (!scale) throw new Error("Unidade 3MF nao reconhecida.");
    const objects = new Map(children(children(root, "resources")[0], "object")
      .map((object) => [object.getAttribute("id"), object]));
    const cache = new Map();

    function trianglesForObject(id, visiting = new Set()) {
      if (cache.has(id)) return cache.get(id);
      if (visiting.has(id)) throw new Error("Referencias ciclicas no 3MF.");
      const object = objects.get(id);
      if (!object) throw new Error(`Objeto 3MF ${id} nao encontrado.`);
      visiting.add(id);
      const mesh = children(object, "mesh")[0];
      let triangles;
      if (mesh) {
        const vertices = children(children(mesh, "vertices")[0], "vertex").map((vertex) =>
          ["x", "y", "z"].map((axis) => Number(vertex.getAttribute(axis))));
        if (!vertices.length || vertices.some((point) => point.some((value) => !Number.isFinite(value))))
          throw new Error("Vertices 3MF invalidos.");
        triangles = children(children(mesh, "triangles")[0], "triangle").map((triangle) => {
          const indices = ["v1", "v2", "v3"].map((axis) => Number(triangle.getAttribute(axis)));
          if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= vertices.length))
            throw new Error("Triangulos 3MF invalidos.");
          return indices.map((index) => vertices[index]);
        });
      } else {
        triangles = children(children(object, "components")[0], "component").flatMap((component) =>
          trianglesForObject(component.getAttribute("objectid"), visiting)
            .map((triangle) => transformTriangle(triangle, transform(component.getAttribute("transform")))));
      }
      visiting.delete(id);
      cache.set(id, triangles);
      return triangles;
    }

    for (const item of children(children(root, "build")[0], "item")) {
      const id = item.getAttribute("objectid");
      const object = objects.get(id);
      if (!object || object.getAttribute("type") === "support" || object.getAttribute("type") === "solidsupport") continue;
      const matrix = transform(item.getAttribute("transform"));
      for (const triangle of trianglesForObject(id)) {
        facets.push(transformTriangle(triangle, matrix).map((point) => point.map((value) => value * scale)));
        if (facets.length > 250000) throw new Error("3MF excede 250 mil triangulos para exportacao STL.");
      }
    }
  }
  if (!facets.length) throw new Error("3MF sem triangulos de pecas na montagem.");
  const stl = Buffer.alloc(84 + facets.length * 50);
  stl.write("3MF original - malhas e posicoes preservadas", 0, "ascii");
  stl.writeUInt32LE(facets.length, 80);
  for (let index = 0; index < facets.length; index++) {
    const [a, b, c] = facets[index];
    const u = b.map((value, axis) => value - a[axis]);
    const v = c.map((value, axis) => value - a[axis]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const magnitude = Math.hypot(...normal);
    if (magnitude > 0) normal.forEach((value, axis) => { normal[axis] = value / magnitude; });
    const values = [...normal, ...a, ...b, ...c];
    values.forEach((value, offset) => stl.writeFloatLE(value, 84 + index * 50 + offset * 4));
  }
  return stl;
}

function planInsert(input) {
  const box = input.box.map(Number);
  const wall = Number(input.wall);
  const floor = Number(input.floor);
  const clearance = Number(input.clearance);
  if (box.length !== 3 || box.some((value) => !Number.isFinite(value) || value <= 0) ||
      !Number.isFinite(wall) || wall < 0.8 || !Number.isFinite(floor) || floor < 0.8 ||
      !Number.isFinite(clearance) || clearance < 0) throw new Error("Dimensoes da caixa, parede, fundo ou folga invalidas.");
  const pieces = input.pieces.filter((piece) => Number(piece.quantity) > 0);
  if (!pieces.length) throw new Error("Informe pelo menos uma peca com quantidade maior que zero.");
  const requests = pieces.map((piece) => {
    const size = piece.size.map(Number);
    const quantity = Math.floor(Number(piece.quantity));
    if (size.length !== 3 || size.some((value) => !Number.isFinite(value) || value <= 0) || quantity < 1)
      throw new Error(`Dimensoes ou quantidade invalidas para ${piece.name}.`);
    return { name: String(piece.name || "Peca"), quantity, size: [size[0] + 2 * clearance, size[1] + 2 * clearance, size[2] * quantity + 2 * clearance] };
  }).sort((a, b) => b.size[1] - a.size[1]);

  const innerWidth = box[0] - 2 * wall;
  const innerDepth = box[1] - 2 * wall;
  const innerHeight = box[2] - floor;
  function pack(rowWidth) {
    let x = 0;
    let y = 0;
    let rowDepth = 0;
    const features = [];
    const errors = [];
    for (const request of requests) {
      let [width, depth, height] = request.size;
      if ((width > rowWidth || (x > 0 && x + width > rowWidth && x + depth <= rowWidth)) && depth <= rowWidth)
        [width, depth] = [depth, width];
      if (x + width > rowWidth && x > 0) { x = 0; y += rowDepth + wall; rowDepth = 0; }
      if ((width > rowWidth || y + depth > innerDepth) &&
          depth <= rowWidth && y + width <= innerDepth) [width, depth] = [depth, width];
      if (height > innerHeight || width > rowWidth || y + depth > innerDepth) {
        errors.push(`${request.name} (${request.quantity}x): precisa de ${round(width)} x ${round(depth)} x ${round(height)} mm`);
        continue;
      }
      features.push({ name: `${request.name} (${request.quantity}x)`, size: [round(width), round(depth), round(innerHeight)], position: [round(x), round(y)], requiredHeight: round(height) });
      x += width + wall;
      rowDepth = Math.max(rowDepth, depth);
    }
    return { features, errors };
  }
  const footprint = requests.reduce((area, request) => area + (request.size[0] + wall) * (request.size[1] + wall), 0);
  const compactWidth = Math.min(innerWidth, Math.max(...requests.map((request) => Math.min(request.size[0], request.size[1])), Math.sqrt(footprint) * 1.35));
  let result = pack(input.compact ? compactWidth : innerWidth);
  if (input.compact && result.errors.length) result = pack(innerWidth);
  let plannedBox = box.map(round);
  if (input.compact && !result.errors.length) {
    plannedBox = [
      round(Math.max(...result.features.map((feature) => feature.position[0] + feature.size[0])) + wall),
      round(Math.max(...result.features.map((feature) => feature.position[1] + feature.size[1])) + wall),
      round(Math.max(10, floor + Math.max(...result.features.map((feature) => feature.requiredHeight)))),
    ];
    for (const feature of result.features) feature.size[2] = round(plannedBox[2] - floor);
  }
  return { box: plannedBox, wall: round(wall), floor: round(floor), clearance: round(clearance), features: result.features, errors: result.errors, fits: result.errors.length === 0, pieceCount: requests.reduce((sum, request) => sum + request.quantity, 0) };
}

module.exports = { read3mfInventory, export3mfStl, planInsert };
