# doomzinho_fps 2.0

The v1 game (repo root) with a graphics layer on top. **Gameplay code is untouched**: same waves, enemies,
weapons, crates, pickups, bosses, ranking and controls as v1 (based on v66).

What v2 adds, visuals only:

- **A new scenery theme every wave**, in rotation: Infernal Keep, Tech Hell, Blood Cathedral, Void Arena,
  Cryo Lab, Ash Wastes, Bone Mire. Each swaps wall and floor textures, fog colour, light tint and ceiling tint.
  The theme name shows in the wave announcement.
- **Richer low-res textures** instead of the 8x8 noise tiles: 64–128px pixel textures with nearest filtering.
  Six themes are drawn procedurally in `js/textures.js` (some with self-lit details such as neon strips and
  stained glass); the Infernal Keep wall and floor are painted images reduced to 64px (`assets/`).
- **A different wall layout every wave** (seven layouts in rotation). This is the one change that touches play:
  the cover changes between waves. The first wave uses the original v1 layout.
- **New voxel gun models** for all nine weapons, same blocky style with more detail. Each gun is merged into
  one lit mesh plus one glow mesh and cached, so it costs 2 draw calls and switching guns allocates nothing.
- **World-space wall UVs**, so bricks keep the same size on every wall instead of stretching.

- **Scenery that differs in shape, not just colour**: layouts range from a pillar forest to a nave with low
  pews, big slabs, long lanes, asymmetric ruins and a dense maze, with walls of different heights. Three themes
  are open to the sky. Each theme has its own glowing props along the walls (torches, neon tubes, candles,
  floating cubes, crystals, braziers) and drifting specks (embers, snow, ash, spores, stars).
- **Gun detail pass**: a 16px worn-metal texture over the vertex colours plus extra voxels (vents, rivets,
  hazard stripes, indicator lights). Still 2 draw calls per gun.
- **Enemy and boss detail pass**: each of the 5 enemies and 11 bosses gets one extra merged mesh of small
  voxels (teeth, horn tips, claws, spines, armour plates, belts). Geometry is cached per type, so it costs one
  draw call per monster. The v1 bodies and their animation are unchanged.

Still one hemisphere light and no post-processing, as in v1. Extra cost per frame: 2–3 draw calls of scenery
props, 150 specks, and one draw call per monster.

`?debug` exposes `window.__theme(n)`, `__maze(n)`, `__wep(n)`, `__spawn(type,x,z)` and `__boss(i,x,z)` for previews.

Checked in headless Chromium: loads, starts, all seven themes, nine guns, five enemies and eleven bosses render
with no errors. Not checked on a phone
or a real GPU.
