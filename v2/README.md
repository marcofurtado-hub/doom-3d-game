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
- **World-space wall UVs**, so bricks keep the same size on every wall instead of stretching.

Still one hemisphere light and no post-processing, as in v1, so the performance profile is the same.

`?debug` exposes `window.__theme(n)` to preview a theme.

Checked in headless Chromium: loads, starts, all seven themes apply with no errors. Not checked on a phone
or a real GPU.
