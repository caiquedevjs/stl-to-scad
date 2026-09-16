// BGSD
include <../lib/boardgame_insert_toolkit_lib.4.scad>;
data = [
    // Source STL: Tokens A.stl
    // STL bbox min [31, -36, 0] max [83, 119, 41] size [52, 155, 41]
    // Detected compartments: 3; wall thickness: 1.5mm
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
        ],
        [ BOX_FEATURE,
            [ NAME, "Tokens A cavity 2" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 44.5, 39.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 48.5] ],
        ],
        [ BOX_FEATURE,
            [ NAME, "Tokens A cavity 3" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 57.5, 39.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 94.5] ],
        ],
    ],
];
Make(data);
