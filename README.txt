STL to BGSD - pacote completo

Abra my_designs/all-inserts.scad no BGSD ou no OpenSCAD.

A pasta lib/ precisa ficar ao lado de my_designs/, porque os arquivos SCAD usam:
include <../lib/boardgame_insert_toolkit_lib.4.scad>;

Se mover os arquivos SCAD para outra pasta, mantenha a biblioteca no caminho relativo esperado ou ajuste o include.
