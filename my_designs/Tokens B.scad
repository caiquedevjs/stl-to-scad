// BGSD
include <../lib/boardgame_insert_toolkit_lib.4.scad>;
data = [
    // Source STL: Tokens B.stl
    // STL bbox min [-66, -36, 0] max [-14, 119, 28] size [52, 155, 28]
    // Detected compartments: 3; wall thickness: 1.5mm
    // Estimated bottom thickness: 0.8mm
    // Inferred side cutouts: left (medium)
    // Inferred external profile cuts: back-right [19, 11]
    // Tokens B cavity 1: SQUARE shape (high, curved ratio 0)
    // Tokens B cavity 2: SQUARE shape (high, curved ratio 0)
    // Tokens B cavity 3: SQUARE shape (high, curved ratio 0)
    // Tokens B profile extension: SQUARE shape (high, curved ratio 0)
    [ OBJECT_BOX,
        [ NAME, "Tokens B" ],
        [ BOX_SIZE_XYZ, [52, 155, 28] ],
        [ BOX_WALL_THICKNESS, 1.5 ],
        [ BOX_NO_LID_B, true ],
        [ BOX_FEATURE,
            [ NAME, "Tokens B cavity 1" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 48, 26.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 0] ],
            [ FTR_CUTOUT_SIDES_4B, [false, false, true, false] ],
            [ FTR_CUTOUT_TYPE, INTERIOR ],
            [ FTR_CUTOUT_HEIGHT_PCT, 47.943 ],
            [ FTR_CUTOUT_DEPTH_PCT, 25.929 ],
            [ FTR_CUTOUT_WIDTH_PCT, 95 ],
        ],
        [ BOX_FEATURE,
            [ NAME, "Tokens B cavity 2" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 48, 26.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 49.5] ],
            [ FTR_CUTOUT_SIDES_4B, [false, false, true, false] ],
            [ FTR_CUTOUT_TYPE, INTERIOR ],
            [ FTR_CUTOUT_HEIGHT_PCT, 47.943 ],
            [ FTR_CUTOUT_DEPTH_PCT, 25.929 ],
            [ FTR_CUTOUT_WIDTH_PCT, 95 ],
        ],
        [ BOX_FEATURE,
            [ NAME, "Tokens B cavity 3" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 42, 26.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 99] ],
            [ FTR_CUTOUT_SIDES_4B, [false, false, true, false] ],
            [ FTR_CUTOUT_TYPE, INTERIOR ],
            [ FTR_CUTOUT_HEIGHT_PCT, 47.943 ],
            [ FTR_CUTOUT_DEPTH_PCT, 25.929 ],
            [ FTR_CUTOUT_WIDTH_PCT, 95 ],
        ],
        [ BOX_FEATURE,
            [ NAME, "Tokens B profile extension" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [30, 11, 26.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 141] ],
            [ FTR_CUTOUT_SIDES_4B, [false, false, true, false] ],
            [ FTR_CUTOUT_TYPE, INTERIOR ],
            [ FTR_CUTOUT_HEIGHT_PCT, 47.943 ],
            [ FTR_CUTOUT_DEPTH_PCT, 42.35 ],
            [ FTR_CUTOUT_WIDTH_PCT, 90.909 ],
        ],
    ],
];
difference() {
    Make(data);
    // back-right external step
    translate([33, 144, -0.05]) cube([19.05, 11.05, 28.1]);
}
