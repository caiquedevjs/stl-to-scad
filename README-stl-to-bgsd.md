# STL to BGSD scaffold

This workspace contains a small no-dependency converter that reads STL files,
measures their bounding boxes, and generates BGSD/BIT-compatible OpenSCAD
starter files.

It is intentionally a scaffold generator, not a true reverse-parametric CAD
converter. STL files contain triangles, not the original OpenSCAD parameters,
so the reliable conversion is:

1. Measure the STL dimensions.
2. Detect major straight internal walls when possible.
3. Inspect facet normals to classify square, round, and filleted cavities.
4. Infer side openings and their approximate height, depth, and width.
5. Create an editable BGSD `OBJECT_BOX` with confidence comments.
6. Add one or more `BOX_FEATURE` cavities sized from detected compartments.
7. Let the user refine labels, lids, dividers, cutouts, and print groups in
   BGSD.

The converter now generates common customization hooks from the Boardgame
Insert Toolkit: `LABEL` blocks for box/lid/compartments and `FTR_CUTOUT_*`
blocks for finger openings. It still does not recover every original modeling
operation from the STL mesh; instead it creates an editable BIT/BGSD scaffold
with the measured dimensions and the most useful controls already wired in.

## Full BIT emission

The command-line converter has a schema-driven output layer for BIT 4.12.0.
Pass `--bit-config <json>` to use any public Insert Toolkit parameter in its
valid context. See `bit-config.example.json` and `BIT-COVERAGE.md`.

Automatic reconstruction remains evidence-based: the STL supplies geometry but
does not preserve CAD intent. The JSON file records or confirms semantic details
such as lid behavior, labels, feature groups/copies, SVG profiles, generated
dividers, print groups, and visualization placement.

Generate the complete per-key coverage matrix with:

```powershell
node .\tools\bit-coverage.js --check
```

In `objects`, use the STL name with or without its extension. Scalar and nested
properties augment the detected object. Lists such as `BOX_FEATURE` replace the
inferred list so BIT ordering and feature references remain deterministic.
`elements` adds independent objects such as `OBJECT_DIVIDERS`.

Automatic shape/cutout inference is enabled by default in both the CLI and the
visual interface. Use `--no-infer-geometry` in the CLI, or turn off
`Inferir formas e aberturas` in the interface, to keep only dimensional and
straight-wall detection. Explicit `--cutouts` settings take precedence over an
inferred opening. Detected values are labeled `high`, `medium`, or `low`; low
confidence geometry is reported internally but is not emitted.

Axis-aligned stepped corners are also inferred from the coverage of opposing
outer STL faces. The generated design keeps its BIT `data` array and wraps
`Make(data)` in a small OpenSCAD `difference()` only when the external profile
cannot be represented by a native rectangular `OBJECT_BOX`. Profile cuts are
emitted for single-model SCAD files; combined multi-model files retain the
portable BIT data without applying one model's cut to the others.
When the corner borders a compartment, the cavity is partitioned into a main
rectangle and a narrower extension so the detected wall thickness remains
around the stepped edge instead of being removed by the cavity.

## Fidelity validation

Add `--validate-fidelity` to render every generated SCAD with OpenSCAD and
compare it with its source STL:

```powershell
node .\stl-to-bgsd.js --validate-fidelity --fidelity-tolerance 0.5 .\*.stl
```

Each design receives two companion files:

- `<name>.fidelity.json`: dimensions, area, volume, watertightness, precision,
  recall, bidirectional F-score, surface distances, and OpenSCAD/BIT warnings.
- `<name>.fidelity.png`: original in red, reconstruction in blue, and an aligned
  transparent overlay in the center.

In the visual interface, select an individual model and click
`Verificar fidelidade`. The local server uses the STL already loaded, renders
the current SCAD, compares both surfaces, and displays the metrics and preview
automatically. `Importar relatorio` remains available for opening JSON and PNG
files generated previously by the command line.

The comparison aligns AABB centers without scaling either object. Surface
distance is measured from deterministic samples to the exact triangles of the
other mesh, in both directions. `--fidelity-samples` controls sampling density;
`--no-fidelity-preview` skips the PNG. Select OpenSCAD with `--openscad <file>`
or `OPENSCAD_PATH`.

The validator can also be used independently:

```powershell
node .\tools\validate-fidelity.js --report report.json --preview comparison.png original.stl reconstructed.scad
```

## Usage

The HTML interface downloads ZIP packages instead of isolated SCAD files. Each
package contains the generated design and `boardgame_insert_toolkit_lib.4.scad`
in the same directory, with a portable `include` ready for OpenSCAD or BGSD.

Visual interface:

```text
STL-to-BGSD-GUI.exe
```

or:

```text
abrir-interface-stl-bgsd.cmd
```

This starts a local-only server at `127.0.0.1` and opens the interface in your
browser. You can upload STL files, adjust BIT dimensions and options, preview
the generated OpenSCAD, and download portable ZIP packages. The `Gerar STL`
button sends the currently selected SCAD to the installed OpenSCAD and downloads
its rendered STL. Opening the HTML directly still supports conversion and ZIP
downloads, but STL rendering requires the launcher.
The local renderer allows ten minutes by default because large patterned lids
can make OpenSCAD's exact render slow. Set `STL_BGSD_RENDER_TIMEOUT_MS` before
starting the launcher to change that limit, or choose `BOX` in `Saida BIT` to
render only the insert body.

## Design an insert from game pieces

Install the local ZIP/XML dependencies once with `npm install`. In the GUI,
under `Projeto de jogo`, import a `.3mf`, set the internal dimensions of the
game box, correct piece dimensions or quantities in the inventory, and click
`Criar insert`. The generated `OBJECT_BOX` and `BOX_FEATURE` compartments can
be adjusted individually before downloading the SCAD package or rendering STL.
`Folga externa por lado` reduces the insert's outer X/Y dimensions on both
sides and its Z height at the top; its default is 1 mm.
Use `Adicionar peca` for cards, tokens, or other game components that are not
present in the imported 3MF.

The importer reads 3MF units, named mesh objects, component assemblies, and
build copies, grouping equal copies by quantity. The first planner uses
axis-aligned piece bounds and assumes copies of one piece can be stacked
vertically in one compartment. It checks cavity height, box boundaries, and
wall spacing; it does not infer a contour-matched recess or prove real-world
fit. Verify component orientation and clearance before printing. The
`Verificar fidelidade` button applies only to reconstructed inserts with an
original STL, not to a new game-piece design.

The visual controls include clearance, wall thickness, bottom thickness, extra
height, STL scale, `G_TOLERANCE`, `G_PRINT_TYPES`, `G_COLORIZE_B`, cavity shape,
box lid mode, straight-wall component detection, labels for box/lid/features,
finger cutouts, and per-file `BOX_SIZE_XYZ` / `FTR_COMPARTMENT_SIZE_XYZ`.

Batch converter:

```text
STL-to-BGSD.exe
```

or:

```text
converter-stl-bgsd.cmd
```

Both launchers convert all `.stl` files in this folder and write the generated
BGSD/OpenSCAD files to `my_designs`.

`STL-to-BGSD-GUI.exe` opens the browser interface. `STL-to-BGSD.exe` is a small
Windows wrapper around `stl-to-bgsd.js`, so Node.js must be installed and
available in `PATH` for the batch converter.

Command-line usage:

```powershell
node stl-to-bgsd.js --combined my_designs\all-inserts.scad "*.stl"
```

Generated files are written to `my_designs` by default. The SCAD files include
`../lib/boardgame_insert_toolkit_lib.4.scad`, so keep the `my_designs` and `lib`
folders side by side when opening them directly in OpenSCAD.

Useful options:

```powershell
node stl-to-bgsd.js --clearance 1 --wall 2 --bottom 2 "*.stl"
node stl-to-bgsd.js --no-feature "*.stl"
node stl-to-bgsd.js --with-lid "*.stl"
node stl-to-bgsd.js --with-lid --lid-label "Tiles" "*.stl"
node stl-to-bgsd.js --box-label "Tiles" --feature-labels "*.stl"
node stl-to-bgsd.js --cutouts alternate-lr "*.stl"
node stl-to-bgsd.js --cutouts left,right --cutout-width 60 "*.stl"
node stl-to-bgsd.js --scale 0.1 "*.stl"
node stl-to-bgsd.js --no-detect-components "*.stl"
node stl-to-bgsd.js --fit-container "*.stl"
```

## Output

For each STL, the generated SCAD uses the BGSD marker and BIT syntax:

```openscad
// BGSD
include <../lib/boardgame_insert_toolkit_lib.4.scad>;
data = [
    [ OBJECT_BOX,
        [ NAME, "Solo" ],
        [ BOX_SIZE_XYZ, [37, 130, 56] ],
        [ BOX_WALL_THICKNESS, 1.5 ],
        [ BOX_LID,
            [ LID_TYPE, LID_CAP ],
            [ LABEL,
                [ LBL_TEXT, "Tiles" ],
                [ LBL_PLACEMENT, CENTER ],
                [ LBL_SIZE, AUTO ],
                [ LBL_DEPTH, 0.2 ],
            ],
        ],
        [ BOX_FEATURE,
            [ FTR_COMPARTMENT_SIZE_XYZ, [34, 55, 54.5] ],
            [ POSITION_XY, [0, 0] ],
            [ FTR_CUTOUT_SIDES_4B, [false, false, true, false] ],
            [ FTR_CUTOUT_TYPE, BOTH ],
            [ FTR_CUTOUT_HEIGHT_PCT, 100 ],
            [ FTR_CUTOUT_DEPTH_PCT, 25 ],
            [ FTR_CUTOUT_WIDTH_PCT, 50 ],
        ],
        [ BOX_FEATURE,
            [ FTR_COMPARTMENT_SIZE_XYZ, [34, 70, 54.5] ],
            [ POSITION_XY, [0, 56.5] ],
            [ FTR_CUTOUT_SIDES_4B, [false, false, false, true] ],
            [ FTR_CUTOUT_TYPE, BOTH ],
            [ FTR_CUTOUT_HEIGHT_PCT, 100 ],
            [ FTR_CUTOUT_DEPTH_PCT, 25 ],
            [ FTR_CUTOUT_WIDTH_PCT, 50 ],
        ],
    ],
];
Make(data);
```

BGSD should recognize these rows as editable controls, because the generated
file uses schema keys such as `OBJECT_BOX`, `BOX_SIZE_XYZ`, `BOX_FEATURE`,
`FTR_COMPARTMENT_SIZE_XYZ`, `LABEL`, and `FTR_CUTOUT_SIDES_4B`.
