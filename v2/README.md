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
- **Enemies walk round furniture.** v1 monsters chase in a straight line, which the new layouts turn into
  dead ends (a monster stuck behind a desk means the boss never arrives). When a wall is between a monster and
  the player it now heads for the free corner of that wall. Speeds, damage and everything else are unchanged.
- **End-of-the-world sky** over every place (the roofs are gone): a dome with a storm-cloud deck, red
  lightning veins and a glowing horizon, tinted per place, with lightning flashes every few seconds.
  Dark tendrils creep over every wall and pale spores drift in the air.
- **New weapon and impact sounds**, synthesised in layers instead of single beeps: a bright crack, a noise
  body that sweeps down, a pitch-dropping low thump for weight and a short room tail, then saturation.
  Pump and slide clicks on the shotguns and pistol; a launch whoosh for the rocket; a beam hum plus zaps for
  the lasers; a looping roar for the flamethrower; deep, long explosions and a much bigger nuke; meatier
  hits, kills and ricochets. Each sound has several variants with slight pitch jitter. Everything goes through
  a compressor and a small room reverb. The sounds are baked once when audio starts (the pistol and impacts
  first, the rest spread over the next second), so each shot is a single buffer playback.
- **Monster deaths sound different per type**: a synthesised cry (saw voice through vowel formants, falling
  pitch, rasp and growl) over wet gore (squelch bursts, a low splat, bone cracks). Imp screech, flaming-skull
  shriek and shatter, demon roar, cacodemon burst and gurgle, baron bellow with a body thud, and a double roar
  plus explosion for bosses.
- **Roofs indoors**: the office (drop ceiling with fluorescent panels, some dead), butcher shop (tiles, pipe,
  caged lamps), bank (wood coffers with gold trim and lit rosettes) and dungeon (vault stones and roots) have
  ceilings; the square and the forest stay open to the doomsday sky.
- **Collision follows the furniture**: every obstacle has a height. Shots and laser beams fly over low pieces
  (desks, counters, benches, car bonnets, fountain rim), the player can jump over them or stand on top, and
  pieces made of parts collide as parts (fountain rim + column, bandstand floor + posts, car body + cabin,
  desk + monitor, bench seat + backrest). Mirrored copies of a piece are flipped, so every desk's monitor faces
  away from its partition.
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
