# DOOMZINHO 2.0

Rewrite of **doomzinho_fps** as a modular, browser-first arena shooter. Same DNA (waves, bosses, ricochet,
kill-heal, roguelike), new renderer, new art, a different biome every wave.

Entry point: `v2/index.html` (static, no build step). v1 at the repo root is untouched.

## Tech

- **Three.js r160**, ESM from a pinned CDN import map. WebGL2. No npm, no bundler.
- **Post stack**: RenderPass → UnrealBloom → one combined pass (chromatic aberration, dash radial blur, biome-tinted
  vignette, hurt tint, luminance-scaled grain) → Output (ACES) → SMAA (desktop).
- **Procedural textures** (`textures.js`): tileable value-noise baked once per biome into albedo + emissive + normal maps.
  The emissive map is what makes lava cracks, neon sigils and stained glass bloom.
- **Merged low-poly models** (`geo.js`): enemies and guns are built from primitives and merged per material.
  An enemy is ~6 draw calls and shares its geometry with every other enemy of that type; all arena walls are 3 draw calls.
- **Particles**: soft point sprites (one draw call for all sparks/fire, one for smoke), instanced debris, pooled flash
  spheres and shockwave rings.
- **Fixed light count**: a pool of point lights (6 desktop / 3 mobile) reused for muzzle flashes, projectiles and
  explosions, so shaders never recompile mid-fight.
- **Audio**: Web Audio only. Step-sequenced music (normal/boss), per-biome drone, procedural SFX, panned enemy sounds.

## Biomes (one per wave, in rotation)

Infernal Keep · Tech Hell · Blood Cathedral · Void Arena · Cryo Lab · Ash Wastes · Bone Mire.
Each has its own textures, fog, lights, sky, glowing props, embers, maze layout and ambient tone. Void, Ash and Bone
are open to the sky; the others have a beamed ceiling. Transitions fade to black, swap, and show a title card.

## Gameplay

- Waves escalate; every 5th is a boss (10 bosses, patterns: charge, radial, spray, stomp, blink, summon).
- 9 weapons: pistol, shotgun, chaingun (spin-up), rocket, plasma, bomb, molotov (burning ground), laser, B.F.G.
  Weapons appear as glowing pickups in the arena; bosses also drop one.
- 6 enemy types: imp, lost soul, demon (charges), cacodemon, baron, revenant (homing shots).
- Upgrade card after every wave. Kills heal. Enemies drop health/armor. Local high score + ranking.

## Controls

Desktop: WASD, mouse, click, 1–9 / Q E / wheel, Shift dash, R reload, Esc or P pause.
Mobile: left-half joystick, right-half drag to look (fingers on buttons also look), FIRE / DASH / reload / weapon arrows,
pause bottom-right, light aim assist.

## Performance

- Measured in a busy wave (16 enemies, shadows on): ~180 draw calls, ~20k triangles per frame; ~65 calls in light mode.
- **Modo leve** (start screen and pause menu, remembered): no bloom, no SMAA, no shadows, lower resolution.
  It switches on by itself if the frame rate stays under ~34 fps for 3 seconds.
- Mobile defaults: pixel ratio 1, no shadows, half-size textures without normal maps, fewer lights and particles.

## How it was tested, and what was not

Automated in headless Chromium (desktop and touch emulation): start, pointer lock, movement vs camera direction, aim,
every weapon, every enemy attack, wave clear → upgrade → next biome, all 10 bosses, death, ranking, restart, pause,
joystick / look / fire / buttons. `?debug` exposes `window.__doom` for this.

Not verified: frame rate on real GPUs or phones (the test machine renders in software), behaviour on iOS Safari,
and how the audio actually sounds.

## Known trade-offs

- No physics engine: projectiles are kinematic with sub-stepped collision.
- Enemies walk straight at the player and slide along walls; no pathfinding.
- Blood decals are floor-only. No ragdolls; deaths are a fall-over tween or gibs.
- Fog is standard depth fog plus the sky dome's horizon glow, not a volumetric pass.

## Files

```
index.html      shell, CSS, HUD, menus, import map
js/main.js      game flow, combat, AI, main loop, debug hooks
js/renderer.js  renderer + post-processing
js/arena.js     arena geometry, lights, props, collision
js/biomes.js    biome definitions, sky shader
js/textures.js  procedural texture baking
js/geo.js       primitive-merging model kit
js/enemies.js   enemy + boss definitions and models
js/weapons.js   weapon table, view model, projectiles
js/particles.js particle pools
js/fx.js        camera feel, screen effects
js/audio.js     music, ambience, SFX
js/input.js     keyboard, mouse, touch
js/player.js    player state
js/hud.js       HUD
```
