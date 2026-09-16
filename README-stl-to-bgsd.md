# STL to BGSD scaffold

This workspace contains a small no-dependency converter that reads STL files,
measures their bounding boxes, and generates BGSD/BIT-compatible OpenSCAD
starter files.

It is intentionally a scaffold generator, not a true reverse-parametric CAD
converter. STL files contain triangles, not the original OpenSCAD parameters,
so the reliable conversion is:

1. Measure the STL dimensions.
2. Detect major straight internal walls when possible.
3. Create an editable BGSD `OBJECT_BOX`.
4. Add one or more `BOX_FEATURE` cavities sized from detected compartments.
5. Let the user refine labels, lids, dividers, cutouts, and print groups in
   BGSD.

The converter now generates common customization hooks from the Boardgame
Insert Toolkit: `LABEL` blocks for box/lid/compartments and `FTR_CUTOUT_*`
blocks for finger openings. It still does not recover every original modeling
operation from the STL mesh; instead it creates an editable BIT/BGSD scaffold
with the measured dimensions and the most useful controls already wired in.

## Usage

Visual interface:

```text
STL-to-BGSD-GUI.exe
```

or:

```text
abrir-interface-stl-bgsd.cmd
```

This opens `stl-to-bgsd-gui.html` in your browser. You can upload STL files,
adjust BIT dimensions and options, preview the generated OpenSCAD, and download
one combined `.scad` or one `.scad` per STL.

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
