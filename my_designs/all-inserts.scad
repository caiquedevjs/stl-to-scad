// BGSD
include <../lib/boardgame_insert_toolkit_lib.4.scad>;
data = [
    // Source STL: Solo.stl
    // STL bbox min [10, -62, 0] max [47, 68, 56] size [37, 130, 56]
    // Detected compartments: 2; wall thickness: 1.5mm
    // Estimated bottom thickness: 0.8mm
    // Inferred side cutouts: right (medium)
    // Solo cavity 1: SQUARE shape (high, curved ratio 0)
    // Solo cavity 2: SQUARE shape (high, curved ratio 0.002)
    [ OBJECT_BOX,
        [ NAME, "Solo" ],
        [ BOX_SIZE_XYZ, [37, 130, 56] ],
        [ BOX_WALL_THICKNESS, 1.5 ],
        [ BOX_NO_LID_B, true ],
        [ BOX_FEATURE,
            [ NAME, "Solo cavity 1" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [34, 55.5, 54.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 0] ],
        ],
        [ BOX_FEATURE,
            [ NAME, "Solo cavity 2" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [34, 70, 54.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 57] ],
            [ FTR_CUTOUT_SIDES_4B, [false, false, false, true] ],
            [ FTR_CUTOUT_TYPE, INTERIOR ],
            [ FTR_CUTOUT_HEIGHT_PCT, 100 ],
            [ FTR_CUTOUT_DEPTH_PCT, 17.647 ],
            [ FTR_CUTOUT_WIDTH_PCT, 32.706 ],
        ],
    ],
    // Source STL: Tiles.stl
    // STL bbox min [-191, -62.5, 0] max [-113, 101, 69] size [78, 163.5, 69]
    // Detected compartments: 2; wall thickness: 1.5mm
    // Estimated bottom thickness: 0.8mm
    // Tiles cavity 1: SQUARE shape (high, curved ratio 0)
    // Tiles cavity 2: SQUARE shape (high, curved ratio 0)
    [ OBJECT_BOX,
        [ NAME, "Tiles" ],
        [ BOX_SIZE_XYZ, [78, 163.5, 69] ],
        [ BOX_WALL_THICKNESS, 1.5 ],
        [ BOX_NO_LID_B, true ],
        [ BOX_FEATURE,
            [ NAME, "Tiles cavity 1" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [75, 84, 67.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 0] ],
        ],
        [ BOX_FEATURE,
            [ NAME, "Tiles cavity 2" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [75, 75, 67.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 85.5] ],
        ],
    ],
    // Source STL: Tokens A.stl
    // STL bbox min [31, -36, 0] max [83, 119, 41] size [52, 155, 41]
    // Detected compartments: 3; wall thickness: 1.5mm
    // Estimated bottom thickness: 0.8mm
    // Inferred side cutouts: left (medium)
    // Inferred external profile cuts: back-right [19, 11]
    // Tokens A cavity 1: SQUARE shape (high, curved ratio 0)
    // Tokens A cavity 2: SQUARE shape (high, curved ratio 0)
    // Tokens A cavity 3: SQUARE shape (high, curved ratio 0)
    [ OBJECT_BOX,
        [ NAME, "Tokens A" ],
        [ BOX_SIZE_XYZ, [52, 155, 41] ],
        [ BOX_WALL_THICKNESS, 1.5 ],
        [ BOX_NO_LID_B, true ],
        [ BOX_FEATURE,
            [ NAME, "Tokens A cavity 1" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 47, 39.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 0] ],
            [ FTR_CUTOUT_SIDES_4B, [false, false, true, false] ],
            [ FTR_CUTOUT_TYPE, INTERIOR ],
            [ FTR_CUTOUT_HEIGHT_PCT, 32.162 ],
            [ FTR_CUTOUT_DEPTH_PCT, 25.927 ],
            [ FTR_CUTOUT_WIDTH_PCT, 95 ],
        ],
        [ BOX_FEATURE,
            [ NAME, "Tokens A cavity 2" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 44.5, 39.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 48.5] ],
            [ FTR_CUTOUT_SIDES_4B, [false, false, true, false] ],
            [ FTR_CUTOUT_TYPE, INTERIOR ],
            [ FTR_CUTOUT_HEIGHT_PCT, 32.162 ],
            [ FTR_CUTOUT_DEPTH_PCT, 25.927 ],
            [ FTR_CUTOUT_WIDTH_PCT, 95 ],
        ],
        [ BOX_FEATURE,
            [ NAME, "Tokens A cavity 3" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 57.5, 39.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 94.5] ],
            [ FTR_CUTOUT_SIDES_4B, [false, false, true, false] ],
            [ FTR_CUTOUT_TYPE, INTERIOR ],
            [ FTR_CUTOUT_HEIGHT_PCT, 32.162 ],
            [ FTR_CUTOUT_DEPTH_PCT, 25.927 ],
            [ FTR_CUTOUT_WIDTH_PCT, 95 ],
        ],
    ],
    // Source STL: Tokens B.stl
    // STL bbox min [-66, -36, 0] max [-14, 119, 28] size [52, 155, 28]
    // Detected compartments: 3; wall thickness: 1.5mm
    // Estimated bottom thickness: 0.8mm
    // Inferred side cutouts: left (medium)
    // Inferred external profile cuts: back-right [19, 11]
    // Tokens B cavity 1: SQUARE shape (high, curved ratio 0)
    // Tokens B cavity 2: SQUARE shape (high, curved ratio 0)
    // Tokens B cavity 3: SQUARE shape (high, curved ratio 0)
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
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 53, 26.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 99] ],
            [ FTR_CUTOUT_SIDES_4B, [false, false, true, false] ],
            [ FTR_CUTOUT_TYPE, INTERIOR ],
            [ FTR_CUTOUT_HEIGHT_PCT, 47.943 ],
            [ FTR_CUTOUT_DEPTH_PCT, 25.929 ],
            [ FTR_CUTOUT_WIDTH_PCT, 95 ],
        ],
    ],
];
Make(data);
