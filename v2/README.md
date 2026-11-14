# doomzinho_fps 2.0

The v1 game (repo root) with a graphics layer on top. **Gameplay code is untouched**: same waves, enemies,
weapons, crates, pickups, bosses, ranking and controls as v1 (based on v66).

What v2 adds, visuals only:

- **A different place every wave**, six in rotation: Escritório (office cubicles), Açougue (butcher shop),
  Banco (bank), Pracinha (small-town square), Floresta (forest) and Calabouço (dungeon). Each has its own
  floor, wall and furniture textures (64px, nearest filtering, drawn procedurally in `js/textures.js`), its own
  wall layout, and voxel furniture built from the layout: desks with monitors, hanging carcasses, teller
  counters and vault doors, a fountain, bandstand, parked cars and lamp posts, trees, rocks and a cabin,
  barred cells and braziers. All the furniture of a wave is merged into two meshes (lit + glowing).
  This is the one change that touches play: the cover is different in each place.
- **End-of-the-world sky** over every place (the roofs are gone): a dome with a storm-cloud deck, red
  lightning veins and a glowing horizon, tinted per place, with lightning flashes every few seconds.
  Dark tendrils creep over every wall and pale spores drift in the air.
- **World-space wall UVs**, so bricks keep the same size on every wall instead of stretching.
- **Gun detail pass**: a 16px worn-metal texture over the vertex colours plus extra voxels (vents, rivets,
  hazard stripes, indicator lights). Still 2 draw calls per gun.
- **Enemy and boss detail pass**: each of the 5 enemies and 11 bosses gets one extra merged mesh of small
  voxels (teeth, horn tips, claws, spines, armour plates, belts). Geometry is cached per type, so it costs one
  draw call per monster. The v1 bodies and their animation are unchanged.

Still one hemisphere light and no post-processing, as in v1. Extra cost per frame: about 6 draw calls of scenery
(sky, furniture, wall lights, specks) and one draw call per monster.

`?debug` exposes `window.__theme(n)`, `__maze(n)`, `__wep(n)`, `__spawn(type,x,z)` and `__boss(i,x,z)` for previews.

Checked in headless Chromium: loads, starts, all six places, nine guns, five enemies and eleven bosses render
with no errors. Not checked on a phone
or a real GPU.
