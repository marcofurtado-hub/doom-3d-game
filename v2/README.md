# DOOMZINHO 2.0

Rewrite of **doomzinho_fps** as a modular, browser-first arena shooter. Same DNA (waves, bosses, ricochet,
kill-heal, roguelike), new renderer, new art, a different biome every wave.

Entry point: `v2/index.html` (static, no build step). v1 at the repo root is untouched.

## Look: retro on purpose

The whole frame is rendered into a ~240-line buffer and stretched with nearest-neighbour, then quantised with
ordered (Bayer) dithering. No bloom, no antialiasing, no shadow maps. Textures are 64px pixel art with nearest
filtering, lighting is plain Lambert, transparency is stippled, the gun is centred with the marine's hands on it,
and the HUD is a classic status bar with the face in the middle.

**Only wave 1 (Infernal Keep) has been art-directed in this style so far**: brick and flagstone pixel textures,
a lava moat that burns, wall torches with animated flame sprites, carved demon plaques, a floor sigil and a
painted hell-sky strip. The other six biomes run through the same low-res pipeline but still use the earlier
texture designs; they are placeholders until the wave-1 look is approved.

## Tech

- **Three.js r160**, ESM from a pinned CDN import map. WebGL2. No npm, no bundler.
- **Post**: RenderPass → Output (sRGB) → one retro pass (palette quantise + dither, pain palette shift, dash squeeze).
- **Procedural pixel art** (`textures.js`): every texture, sprite and the sky strip is drawn in code, pixel by pixel.
- **Merged low-poly models** (`geo.js`): enemies and guns are primitives merged per material, flat shaded.
  An enemy is ~6 draw calls and shares its geometry with every other enemy of that type; all walls are 3 draw calls.
- **Particles**: square point sprites with stipple transparency, instanced debris, flash polyhedra and ground rings.
- **Fixed light count**: a small pool of point lights reused for muzzle flashes, projectiles and explosions.
- **Audio**: Web Audio only. Step-sequenced music (normal/boss), per-biome drone, procedural SFX, panned enemy sounds.

## Biomes (one per wave, in rotation)

Infernal Keep · Tech Hell · Blood Cathedral · Void Arena · Cryo Lab · Ash Wastes · Bone Mire.
Transitions fade to black, swap, and show a title card.

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

The 3D view is at most a few hundred pixels tall, so fill cost is tiny. A busy wave is roughly 100 draw calls.
The start screen and pause menu have a `PIXELS: 240p / 480p` switch for a sharper (still pixelated) image.

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
