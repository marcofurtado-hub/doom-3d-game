# DOOMZINHO · INFERNAL EDITION (v2.0)

A ground-up rewrite of **doomzinho_fps** for 2026-era browser 3D. Same DOOM DNA, much better everywhere.

**Play live**: https://marcofurtado-hub.github.io/doom-3d-game/v2/

## Tech

- **Three.js r0.160** (CDN-pinned ESM via importmap)
- **Post-processing stack**: `EffectComposer` + `RenderPass` + `UnrealBloomPass` + custom **ChromaticAberration / Vignette / Film Grain / HurtTint** shader + `SMAAPass` (desktop) + `OutputPass`
- **ACES Filmic tone mapping** + sRGB output
- **PBR materials** (`MeshStandardMaterial`) with procedural canvas-baked diffuse per biome
- **InstancedMesh** GPU particle system (6 pools: sparks, blood, smoke, muzzle, shells, plasma) and biome embers
- **Shader sky dome** per biome (radial horizon glow, faint stars, color-shifting fog)
- **PointLight pool** for projectile/explosion glow (acquires/releases to cap active lights)
- **Web Audio**: layered biome ambient pad + dynamic normal/boss music tracker + procedural SFX + spatial `PannerNode` growls
- **Modular ESM**, split into 11 modules under `js/`

No npm, no build step — one `index.html` + a few ESM files loaded from a CDN.

## Biomes (one per wave, rotates)

Each wave enters a new biome. Full material/fog/sun/ambient swap with a cinematic card.

1. **INFERNAL KEEP** — brimstone floor, obsidian walls, rising embers, red fog
2. **TECH HELL** — metal grates with neon-green sigils, blue plasma pipes
3. **BLOOD CATHEDRAL** — stained marble, candlelight, chant pad
4. **VOID ARENA** — black panels, violet starlit sky, hex seams
5. **CRYO LAB** — frost-blue ice crystals, cyan rim light, long fog
6. **ASH WASTES** — cracked clay, cinder embers, orange hellsky
7. **BONE MIRE** — skull-pale walls, bog-green mist

## Gameplay

- **Waves** continuously escalate. Every 5th is a **boss** (11 unique boss patterns: charge, radial, stomp, spray, blink, summon, all).
- **Kill-heal** — each kill restores HP proportional to enemy strength. Boss = full heal.
- **Upgrade screen** between waves: 3 random cards (HP, speed, damage, fire rate, armor, ammo cap).
- **Ricochet** — most bullets bounce off walls/floor/ceiling (configured per weapon).
- **Weapons**: Pistol · Shotgun · Chaingun · Rocket · Plasma · Bomb · Molotov · Laser · **B.F.G.** — each with distinct 3D model, muzzle flash color, recoil shape, and firing feel (chaingun spins up, plasma coil glows, BFG orb pulses).
- **Enemies**: Imp · Skull · Demon · Cacodemon · Baron · Revenant (homing missiles) + 8 boss builds (Cyberdemon with shoulder launcher, Spider Mind, Pain Elem…).
- **Roguelike**: no checkpoints. Die → from the top.

## Feel

- Head bob when walking · land jolt on dash exit · weapon sway on mouselook · recoil kick · screen shake with falloff
- **Slow-mo pinch** on kill (longer on bosses)
- **Damage vignette** + **directional damage arc** showing where you were hit from
- **Combo meter** — combo multiplier builds as you chain kills
- **Animated HUD numbers** (HP/score/kills ease toward their target values)
- **DOOM face** redrawn every frame — reacts to hurt, HP phase, blood splatter at low HP

## Controls

**Desktop**: WASD move · mouse look · click fire · 1–9 / scroll wheel to pick weapon · Shift dash · R reload · Esc pause.

**Mobile**: left-side joystick for movement, right-side drag for look (both multi-touch, fingers on FIRE/DASH/etc also rotate camera). FIRE, DASH, RELOAD, weapon prev/next arrows on opposite sides, pause bottom-right. Forces landscape + fullscreen on start.

## Performance

- Desktop target: **60 fps** mid-tier at `setPixelRatio(min(dpr, 1.5))`.
- Mobile target: **50–60 fps** on 3-year-old Android at `setPixelRatio(1)` with shadows off by default and SMAA disabled.
- **PERF MODE** toggle in pause menu: drops bloom strength, grain, chromatic aberration; disables shadows/SMAA.
- `InstancedMesh` everywhere repeats: biome embers, every particle pool. Blood decals capped at 60 with LRU eviction.
- Materials/geometries disposed on biome change. Shared primitives (sphere/box) across particles.

## Known tradeoffs

- No Rapier/physics engine — projectiles are simple kinematic bounces. Enough for the arena-shooter feel; adds no WASM download.
- Line-of-sight checks for enemy AI are discrete (stepped) — cheap but can over-fire through razor-thin walls occasionally. Not noticeable in play.
- Volumetric fog is color-shifted `THREE.Fog` + shader sky-dome horizon glow, not a full volumetric pass — the stylistic cost beats a 3× perf hit.
- No ragdoll — death is a short scale/fall tween. Keeps mobile frame times honest.
- Decided on Three.js over Babylon 7: comparable visuals at this scale, smaller download, and better post-processing recipe for the DOOM aesthetic.

## File structure

```
v2/
├── index.html          # HTML shell, CSS, HUD, menus, importmap
├── js/
│   ├── main.js         # orchestrator, main loop, game flow
│   ├── renderer.js     # WebGL renderer + EffectComposer
│   ├── arena.js        # floor/ceiling/walls, maze, collision, embers
│   ├── biomes.js       # 7 biome definitions + shader sky dome
│   ├── textures.js     # procedural canvas-baked textures per biome
│   ├── player.js       # player state
│   ├── input.js        # keyboard + mouse + touch (v1 mobile contract preserved)
│   ├── weapons.js      # 9 weapon definitions + first-person meshes + bullet factory
│   ├── enemies.js      # 6 enemy types + 11 boss types + 8 build functions
│   ├── particles.js    # InstancedMesh particle pools
│   ├── fx.js           # screen shake, flash, damage vignette, slow-mo, camera feel
│   ├── audio.js        # procedural Web Audio + ambient pads + tracker music
│   └── hud.js          # DOM HUD updates + DOOM face canvas
└── README.md           # this file
```
