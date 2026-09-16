// BGSD
include <../lib/boardgame_insert_toolkit_lib.4.scad>;
data = [
    // Source STL: Tiles.stl
    // STL bbox min [-191, -62.5, 0] max [-113, 101, 69] size [78, 163.5, 69]
    // Detected compartments: 2; wall thickness: 1.5mm
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
];
Make(data);
