// BGSD
include <../../lib/boardgame_insert_toolkit_lib.4.scad>;
data = [
    // Source STL: player_tray_x4.stl
    // STL bbox min [-39, -48.375, 0] max [39, 48.375, 45] size [78, 96.75, 45]
    // Estimated bottom thickness: 2mm
    // Ambiguous broad multi-side surfaces were not emitted as finger cutouts
    // player_tray_x4 cavity: measured floor 2mm above STL base
    // player_tray_x4 cavity: FILLET shape (medium, curved ratio 0.089)
    [ OBJECT_BOX,
        [ NAME, "player_tray_x4" ],
        [ BOX_SIZE_XYZ, [78, 96.75, 45] ],
        [ BOX_WALL_THICKNESS, 4 ],
        [ BOX_NO_LID_B, true ],
        [ BOX_FEATURE,
            [ NAME, "player_tray_x4 cavity" ],
            [ FTR_COMPARTMENT_SIZE_XYZ, [70, 88.75, 41] ],
            [ FTR_NUM_COMPARTMENTS_XY, [1, 1] ],
            [ FTR_SHAPE, FILLET ],
            [ POSITION_XY, [0, 0] ],
        ],
    ],
];
Make(data);
