// BGSD
include <../lib/boardgame_insert_toolkit_lib.4.scad>;
data = [
    // Source STL: Tokens B.stl
    // STL bbox min [-66, -36, 0] max [-14, 119, 28] size [52, 155, 28]
    // Detected compartments: 4; wall thickness: 1.5mm
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
        ],
        [ BOX_FEATURE,
            [ NAME, "Tokens B cavity 2" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 48, 26.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 49.5] ],
        ],
        [ BOX_FEATURE,
            [ NAME, "Tokens B cavity 3" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 42, 26.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 99] ],
        ],
        [ BOX_FEATURE,
            [ NAME, "Tokens B cavity 4" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [49, 9.5, 26.5] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, SQUARE ],
            [ POSITION_XY, [0, 142.5] ],
        ],
    ],
];
Make(data);
