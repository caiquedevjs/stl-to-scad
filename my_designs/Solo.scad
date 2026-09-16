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
];
Make(data);
