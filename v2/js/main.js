import * as THREE from 'three';
import { RendererSystem } from './renderer.js';
import { Arena, ARENA } from './arena.js';
import { biomeForWave, BIOMES } from './biomes.js';
import { Particles } from './particles.js';
import { FX, flashDamageArc } from './fx.js';
import { Audio } from './audio.js';
import { WEAP, WC, WeaponView, makeBullet } from './weapons.js';
import { EDEF, BDEF, buildEnemyMesh } from './enemies.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { HUD } from './hud.js';

// ================================================================
// DOOMZINHO v2 — main orchestration
// ================================================================

// Mobile detection
const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches);
if (isMobile) document.body.classList.add('mobile');

// Boot progress
const $boot = document.getElementById('boot');
const $bootBar = document.getElementById('boot-bar');
const $bootTxt = document.getElementById('boot-txt');
function boot(pct, txt) { $bootBar.style.width = pct + '%'; if (txt) $bootTxt.textContent = txt; }

// ================================================================
// SETUP
// ================================================================
boot(5, 'INIT SCENE...');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 200);
camera.position.set(0, 1.45, 0);

const renderer = new RendererSystem(scene, camera, { isMobile });
boot(15, 'ARENA...');

const arena = new Arena(scene);
boot(25, 'PARTICLES...');

const particles = new Particles(scene);
boot(35, 'AUDIO...');

const audio = new Audio();

const player = new Player();
const hud = new HUD();
const fx = new FX({ camera, renderer, hud });
const weaponView = new WeaponView(camera);

// Input callbacks declared below
let paused = false, state = 'menu';

const inputHandler = new Input({
    player, isMobile,
    onPause: () => togglePause(),
    onFire: () => {},
    onReload: () => startReload(),
    onWeapon: (n) => switchWeapon(n),
    onCycleWep: (dir) => cycleWeapon(dir),
    onStart: () => startGame(),
});
boot(50, 'WEAPONS...');

// Weapon view initial
scene.add(camera); // ensure camera is in scene so weaponView meshes render
// Fill light attached to camera — PBR weapon materials need direct light to read
const weaponLight = new THREE.PointLight(0xfff0d0, 1.0, 3.5, 2);
weaponLight.position.set(0.3, -0.1, -0.2);
camera.add(weaponLight);
weaponView.setWeapon(1);

// Bullet / enemy / crate arrays
const bullets = [];
const enemyBullets = [];
const enemies = [];
const crates = [];
const decals = []; // blood decals on floor

// Game state
let waveNum = 0, score = 0, kills = 0;
let combo = 0, comboT = 0, comboX = 1;
let gameTime = 0;
let hiScore = parseInt(localStorage.getItem('doom3dv2Hi')) || 0;
let rankings = JSON.parse(localStorage.getItem('doom3dv2Rank') || '[]');
let phase = 'idle'; // idle | wave | intermission | upgrade | boss
let phaseT = 0;
let toSpawn = 0, spawnT = 0, spawnRate = 1.6;
let currentBiome = BIOMES[0];
let bossIdx = 0;
let performanceMode = false;
let bulletLights = [];
let maxBulletLights = isMobile ? 4 : 8;

// Point lights for projectile glow
for (let i = 0; i < maxBulletLights; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 10, 2);
    l.visible = false;
    scene.add(l);
    bulletLights.push({ light: l, inUse: false, owner: null });
}

function acquireLight(color, intensity = 1.5, dist = 10) {
    for (const bl of bulletLights) {
        if (!bl.inUse) {
            bl.inUse = true;
            bl.light.color.setHex(color);
            bl.light.intensity = intensity;
            bl.light.distance = dist;
            bl.light.visible = true;
            return bl;
        }
    }
    return null;
}
function releaseLight(bl) {
    if (!bl) return;
    bl.inUse = false;
    bl.light.visible = false;
    bl.light.intensity = 0;
    bl.owner = null;
}

// ================================================================
// TITLE SCREEN ANIMATED CANVAS
// ================================================================
const titleCanvas = document.getElementById('title-canvas');
const titleCtx = titleCanvas.getContext('2d');
function sizeTitle() {
    titleCanvas.width = innerWidth;
    titleCanvas.height = innerHeight;
}
sizeTitle();
addEventListener('resize', sizeTitle);

const titleEmbers = [];
for (let i = 0; i < 80; i++) {
    titleEmbers.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, vy: -(0.3 + Math.random() * 1.2), vx: (Math.random() - 0.5) * 0.3, s: 1 + Math.random() * 2.5, c: Math.random() > 0.5 ? '#ff6a28' : '#e03818' });
}
let titleT = 0;
function drawTitle(dt) {
    if (state !== 'menu') return;
    titleT += dt;
    const W = titleCanvas.width, H = titleCanvas.height;
    // Radial dark gradient
    const grad = titleCtx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, Math.max(W, H) * 0.7);
    grad.addColorStop(0, '#2a0808');
    grad.addColorStop(0.5, '#0a0204');
    grad.addColorStop(1, '#000');
    titleCtx.fillStyle = grad;
    titleCtx.fillRect(0, 0, W, H);

    // Pulsing dark red glow bands
    const bands = 8;
    for (let i = 0; i < bands; i++) {
        const y = (i * 180 + titleT * 30) % (H + 200) - 100;
        titleCtx.fillStyle = `rgba(180,40,10,${0.03 + 0.05 * Math.sin(titleT * 0.6 + i)})`;
        titleCtx.fillRect(0, y, W, 60);
    }

    // Embers
    for (const e of titleEmbers) {
        e.y += e.vy; e.x += e.vx;
        if (e.y < -10) { e.y = H + 10; e.x = Math.random() * W; }
        if (e.x < -10 || e.x > W + 10) e.x = Math.random() * W;
        titleCtx.fillStyle = e.c;
        titleCtx.globalAlpha = 0.7;
        titleCtx.beginPath();
        titleCtx.arc(e.x, e.y, e.s, 0, Math.PI * 2);
        titleCtx.fill();
        titleCtx.globalAlpha = 0.15;
        titleCtx.beginPath();
        titleCtx.arc(e.x, e.y, e.s * 4, 0, Math.PI * 2);
        titleCtx.fill();
    }
    titleCtx.globalAlpha = 1;

    // Faint pentagram
    titleCtx.save();
    titleCtx.translate(W / 2, H / 2);
    titleCtx.scale(1, 1);
    titleCtx.strokeStyle = `rgba(80,20,10,${0.15 + 0.08 * Math.sin(titleT * 0.4)})`;
    titleCtx.lineWidth = 2;
    titleCtx.beginPath();
    const R = Math.min(W, H) * 0.35;
    for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 * 2 / 5 - Math.PI / 2 + titleT * 0.05;
        if (i === 0) titleCtx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
        else titleCtx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    titleCtx.closePath();
    titleCtx.stroke();
    titleCtx.restore();
}

// ================================================================
// GAME FLOW
// ================================================================
function startGame() {
    if (state !== 'menu') return;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over').classList.remove('on');
    hud.show();

    audio.init();
    audio.startMusic();

    player.reset();
    bullets.length = 0;
    enemyBullets.length = 0;
    enemies.forEach(e => scene.remove(e.mesh));
    enemies.length = 0;
    crates.length = 0;
    decals.forEach(d => scene.remove(d));
    decals.length = 0;

    waveNum = 0; score = 0; kills = 0; combo = 0; comboT = 0; comboX = 1; gameTime = 0;
    bossIdx = 0;
    document.body.classList.add('playing');

    state = 'play';
    inputHandler.setState('play');
    // Try fullscreen + landscape lock on mobile
    if (isMobile) {
        try { document.documentElement.requestFullscreen?.(); } catch (e) {}
        try { screen.orientation?.lock?.('landscape'); } catch (e) {}
    }

    // Start wave 1
    nextWave();
}

function gameOver() {
    state = 'dead';
    inputHandler.setState('dead');
    audio.stopMusic();
    audio.stopAmbient();
    hud.hide();
    document.body.classList.remove('playing');

    const $go = document.getElementById('game-over');
    $go.classList.add('on');
    document.getElementById('go-stats').innerHTML = `
        <div>WAVE <span class="hl">${waveNum}</span> &nbsp; SCORE <span class="hl">${score}</span></div>
        <div>KILLS <span class="hl">${kills}</span> &nbsp; TIME <span class="hl">${Math.floor(gameTime/60)}:${String(Math.floor(gameTime%60)).padStart(2,'0')}</span></div>
    `;

    // Update hi score
    if (score > hiScore) {
        hiScore = score;
        localStorage.setItem('doom3dv2Hi', String(hiScore));
    }

    // Show rankings
    renderRankings();
}

function renderRankings() {
    const $r = document.getElementById('go-rank');
    rankings.sort((a, b) => b.score - a.score);
    const top = rankings.slice(0, 5);
    $r.innerHTML = '<div class="top">— TOP SCORES —</div>' +
        top.map((r, i) => `<div>${i+1}. ${r.name} — ${r.score} (W${r.wave})</div>`).join('') +
        (top.length === 0 ? '<div>no records yet</div>' : '');
}

// Setup game-over buttons
document.getElementById('go-restart').addEventListener('click', e => { e.stopPropagation(); doRestart(); });
document.getElementById('go-restart').addEventListener('touchend', e => { e.stopPropagation(); e.preventDefault(); doRestart(); });
const $goInput = document.getElementById('go-input');
$goInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveScore();
});
$goInput.addEventListener('click', e => e.stopPropagation());
$goInput.addEventListener('touchstart', e => e.stopPropagation());

function saveScore() {
    const name = ($goInput.value || 'PLAYER').toUpperCase().slice(0, 12);
    rankings.push({ name, score, wave: waveNum, kills });
    rankings.sort((a, b) => b.score - a.score);
    rankings = rankings.slice(0, 10);
    localStorage.setItem('doom3dv2Rank', JSON.stringify(rankings));
    renderRankings();
    $goInput.value = '';
}

function doRestart() {
    saveScore();
    document.getElementById('game-over').classList.remove('on');
    state = 'menu';
    inputHandler.setState('menu');
    document.getElementById('start-screen').style.display = 'flex';
}

function togglePause() {
    if (state !== 'play') return;
    paused = !paused;
    inputHandler.setPaused(paused);
    document.getElementById('pause-screen').classList.toggle('on', paused);
    const bp = document.getElementById('btn-pause');
    if (bp) bp.textContent = paused ? '▶' : 'II';
    if (paused && document.pointerLockElement) document.exitPointerLock();
    // Build pause controls text
    const controls = isMobile ?
        'Joystick esquerdo: mover<br>Arrasta direita: olhar<br>FIRE / DASH / ↻ RELOAD<br>◀ ▶: ciclar armas' :
        '<span class="hl">WASD</span> mover · <span class="hl">MOUSE</span> olhar<br><span class="hl">1-9</span> / <span class="hl">SCROLL</span> armas · <span class="hl">SHIFT</span> dash · <span class="hl">R</span> reload<br><span class="hl">ESC</span> pausar';
    document.getElementById('pause-controls').innerHTML = controls;
}

// ================================================================
// BIOMES & WAVES
// ================================================================
function nextWave() {
    waveNum++;
    phase = 'intermission';
    phaseT = 0;

    // Pick biome
    const biome = biomeForWave(waveNum);
    currentBiome = biome;
    arena.setBiome(biome);
    hud.setBiome(biome.name);
    renderer.setAccent(biome.accent);
    audio.setAmbient(biome);
    fx.showBiomeCard(biome.name, biome.sub);

    // Place player at center
    player.x = 0; player.z = 0;

    const isBossWave = waveNum % 5 === 0;

    setTimeout(() => {
        if (isBossWave) {
            spawnBoss();
            audio.setMusicMode('boss');
            fx.announce(`BOSS WAVE`, 'KILL IT', 1800);
            audio.boss();
        } else {
            toSpawn = Math.min(4 + waveNum * 2, 30);
            spawnRate = Math.max(0.7, 1.8 - waveNum * 0.08);
            spawnT = 0;
            audio.setMusicMode('normal');
            fx.announce(`WAVE ${waveNum}`, biome.name, 1500);
        }
        phase = 'wave';
    }, 2200);
}

function spawnBoss() {
    const def = BDEF[Math.min(bossIdx, BDEF.length - 1)];
    bossIdx++;
    const pos = getSpawnPosition();
    const e = createEnemy(def, pos, true);
    enemies.push(e);
}

function getSpawnPosition() {
    // Spawn on edge, away from player
    for (let tries = 0; tries < 20; tries++) {
        const edge = Math.floor(Math.random() * 4);
        let x, z;
        if (edge === 0) { x = (Math.random() - 0.5) * ARENA.W * 0.9; z = -ARENA.H * 0.45; }
        else if (edge === 1) { x = (Math.random() - 0.5) * ARENA.W * 0.9; z = ARENA.H * 0.45; }
        else if (edge === 2) { x = -ARENA.W * 0.45; z = (Math.random() - 0.5) * ARENA.H * 0.9; }
        else { x = ARENA.W * 0.45; z = (Math.random() - 0.5) * ARENA.H * 0.9; }
        const dx = x - player.x, dz = z - player.z;
        if (dx * dx + dz * dz > 100) return { x, z };
    }
    return { x: -ARENA.W * 0.4, z: -ARENA.H * 0.4 };
}

function createEnemy(def, pos, isBoss = false) {
    const mesh = buildEnemyMesh(def, isBoss);
    mesh.position.set(pos.x, 0, pos.z);
    scene.add(mesh);
    const e = {
        def, mesh, x: pos.x, z: pos.z, y: 0,
        r: def.r, hp: def.hp, maxHp: def.hp, dmg: def.dmg,
        spd: def.spd, sc: def.sc,
        fRate: def.fRate || 0, fireT: def.fRate ? (def.fRate * 0.5) : 0,
        pat: def.pat || 'approach',
        ranged: def.ranged || false,
        flying: def.flying || false,
        tracking: def.tracking || false,
        hurtT: 0,
        deathT: -1,
        isBoss,
        div: def.div, dI: def.dI,
        patT: 0,
        baseY: def.flying ? 1.8 + Math.random() * 1.0 : 0,
        growlT: 2 + Math.random() * 4,
    };
    return e;
}

function pickEnemyType(wave) {
    const roll = Math.random();
    if (wave < 3) {
        return roll < 0.7 ? 'imp' : 'skull';
    } else if (wave < 6) {
        if (roll < 0.4) return 'imp';
        if (roll < 0.65) return 'skull';
        if (roll < 0.85) return 'demon';
        return 'caco';
    } else if (wave < 10) {
        if (roll < 0.25) return 'imp';
        if (roll < 0.4) return 'skull';
        if (roll < 0.65) return 'demon';
        if (roll < 0.82) return 'caco';
        return 'baron';
    } else {
        if (roll < 0.15) return 'imp';
        if (roll < 0.3) return 'skull';
        if (roll < 0.5) return 'demon';
        if (roll < 0.7) return 'caco';
        if (roll < 0.85) return 'baron';
        return 'revenant';
    }
}

function spawnOneEnemy() {
    const type = pickEnemyType(waveNum);
    const def = EDEF[type];
    const pos = getSpawnPosition();
    const e = createEnemy(def, pos);
    enemies.push(e);
}

// ================================================================
// WEAPONS & FIRING
// ================================================================
function switchWeapon(n) {
    if (!player.unlocked[n]) return;
    if (player.wep === n) return;
    player.wep = n;
    player.reloading = false; player.reloadT = 0;
    player.shotT = 0;
    weaponView.setWeapon(n);
}

function cycleWeapon(dir) {
    const ks = Object.keys(player.unlocked).map(Number).sort((a, b) => a - b);
    if (!ks.length) return;
    const i = Math.max(0, ks.indexOf(player.wep));
    const next = ks[(i + dir + ks.length) % ks.length];
    switchWeapon(next);
}

function startReload() {
    const def = WEAP[player.wep];
    if (!def.rTime || player.reloading) return;
    if (def.maxAmmo === Infinity) return;
    if (player.ammo[player.wep] >= def.maxAmmo) return;
    player.reloading = true;
    player.reloadT = def.rTime;
}

const _tmpV = new THREE.Vector3();
const _tmpV2 = new THREE.Vector3();

function tryFire(dt) {
    const def = WEAP[player.wep];
    player.shotT -= dt;
    if (!inputHandler.isFiring() || player.shotT > 0 || player.reloading) return;
    if (def.maxAmmo !== Infinity) {
        if ((player.ammo[player.wep] || 0) <= 0) {
            startReload();
            return;
        }
    }
    player.shotT = def.rate * player.rateM;
    if (def.maxAmmo !== Infinity) player.ammo[player.wep]--;

    // Muzzle world position
    weaponView.getMuzzleWorld(_tmpV);
    // Fire direction (from camera forward)
    camera.getWorldDirection(_tmpV2);

    // Spawn count projectiles
    for (let i = 0; i < def.count; i++) {
        // Horizontal direction only for spread calc
        const dirX = _tmpV2.x, dirY = _tmpV2.y, dirZ = _tmpV2.z;
        const b = makeBullet(player, { ...def, _key: player.wep }, _tmpV, dirX, dirZ, dirY);
        // Add mesh
        if (def.laser || def.trail === 'laser') {
            // Laser beams are thin boxes
            const mat = new THREE.MeshBasicMaterial({ color: def.color });
            const geo = new THREE.BoxGeometry(def.sz * 0.5, def.sz * 0.5, def.sz * 2.5);
            b.mesh = new THREE.Mesh(geo, mat);
        } else if (def.trail === 'plasma' || def.trail === 'bfg') {
            const mat = new THREE.MeshBasicMaterial({ color: def.color });
            const geo = new THREE.SphereGeometry(def.sz, 7, 6);
            b.mesh = new THREE.Mesh(geo, mat);
        } else if (def.expl) {
            const mat = new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 1 });
            const geo = new THREE.SphereGeometry(def.sz, 7, 6);
            b.mesh = new THREE.Mesh(geo, mat);
        } else {
            const mat = new THREE.MeshBasicMaterial({ color: def.color });
            const geo = new THREE.SphereGeometry(def.sz, 6, 5);
            b.mesh = new THREE.Mesh(geo, mat);
        }
        b.mesh.position.set(b.x, b.y, b.z);
        scene.add(b.mesh);
        // Attach light for bright bullets
        if (def.light && bullets.length < 20) {
            const bl = acquireLight(def.color, 1.5, 7);
            if (bl) { b.lightRef = bl; bl.owner = b; }
        }
        bullets.push(b);
    }
    // FX
    particles.muzzleFlash(_tmpV.x, _tmpV.y, _tmpV.z, _tmpV2.x, _tmpV2.z, def.color);
    if (player.wep === 2 || player.wep === 3) {
        particles.shell(_tmpV.x, _tmpV.y, _tmpV.z, _tmpV2.x, _tmpV2.z);
    }
    weaponView.kickBack(def.recoil);
    fx.kickRecoil(def.recoil * 0.4);
    fx.addShake(def.shake);
    // Audio
    audio[def.sfx]?.();
}

// ================================================================
// COMBAT UPDATE
// ================================================================
function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.lifetime -= dt;
        // Gravity for lobbed grenades/molotov
        if (b.weapKey === 6 || b.weapKey === 7) b.vy -= 9 * dt;
        // Mesh position
        if (b.mesh) {
            b.mesh.position.set(b.x, b.y, b.z);
            if (b.mesh.geometry.type.includes('Box') && Math.abs(b.vx) + Math.abs(b.vz) > 0.1) {
                b.mesh.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz);
            }
        }
        // Light follow
        if (b.lightRef) {
            b.lightRef.light.position.set(b.x, b.y, b.z);
        }
        // Trail
        if (b.trail === 'rocket') {
            particles.smokePuff(b.x, b.y, b.z, 1, 0x777777);
            particles.sparks.spawn(b.x + (Math.random() - 0.5) * 0.1, b.y, b.z + (Math.random() - 0.5) * 0.1, 0, 0, 0, 0.2, 0.08, 0.02);
        } else if (b.trail === 'plasma') {
            particles.plasmaBurst(b.x, b.y, b.z, b.color);
        } else if (b.trail === 'fire') {
            particles.sparks.spawn(b.x, b.y, b.z, 0, 0.4, 0, 0.3, 0.1, 0.02);
        } else if (b.trail === 'bfg') {
            particles.plasmaBurst(b.x, b.y, b.z, b.color);
            particles.sparks.spawn(b.x, b.y, b.z, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), 0.3, 0.3, 0.05);
        }

        // Ceiling / floor check
        if (b.y > ARENA.WALL_H - 0.1) {
            if (b.ricLeft > 0) { b.vy = -Math.abs(b.vy) * 0.7; b.y = ARENA.WALL_H - 0.1; b.ricLeft--; audio.ricochet(); particles.hitSpark(b.x, b.y, b.z, 4, b.color, 0.6); }
            else { killBullet(b, i, true); continue; }
        }
        if (b.y < 0.02) {
            if (b.expl || b.fire) {
                explode(b);
                killBullet(b, i, false);
                continue;
            }
            if (b.ricLeft > 0) { b.vy = Math.abs(b.vy) * 0.6; b.y = 0.02; b.ricLeft--; audio.ricochet(); particles.hitSpark(b.x, b.y, b.z, 4, b.color, 0.6); }
            else { killBullet(b, i, true); continue; }
        }

        // Wall ricochet
        if (arena.bulletBounceInnerWall(b)) {
            if (b.ricLeft > 0) {
                b.ricLeft--;
                audio.ricochet();
                particles.hitSpark(b.x, b.y, b.z, 5, b.color, 0.8);
            } else {
                if (b.expl || b.fire) explode(b);
                killBullet(b, i, false);
                continue;
            }
        }

        // Enemy hit
        let hit = false;
        for (const e of enemies) {
            if (e.hp <= 0) continue;
            const dx = b.x - e.x, dz = b.z - e.z, dy = b.y - (e.y + e.r * 0.8);
            const horizR = e.r;
            if (dx * dx + dz * dz < horizR * horizR && Math.abs(dy) < e.r * 2.5) {
                damageEnemy(e, b.dmg, b.x, b.y, b.z);
                if (b.expl || b.fire) explode(b);
                killBullet(b, i, false);
                hit = true;
                break;
            }
        }
        if (hit) continue;

        if (b.lifetime <= 0) {
            if (b.expl || b.fire) explode(b);
            killBullet(b, i, false);
        }
    }
}

function explode(b) {
    const blast = b.blast || 4;
    particles.explosion(b.x, b.y, b.z, b.color, blast / 5);
    // Big flash
    const bl = acquireLight(b.fire ? 0xff8040 : (b.color || 0xffaa40), 4, blast * 2);
    if (bl) { setTimeout(() => releaseLight(bl), 150); bl.light.position.set(b.x, b.y, b.z); }
    audio.explode();
    fx.addShake(0.4);
    // Damage enemies in blast
    for (const e of enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - b.x, dz = e.z - b.z;
        const dist = Math.hypot(dx, dz);
        if (dist < blast) {
            const dmg = b.dmg * (1 - dist / blast);
            damageEnemy(e, dmg, b.x, b.y, b.z);
        }
    }
    // Damage self (self-splash halved)
    const dp = Math.hypot(player.x - b.x, player.z - b.z);
    if (dp < blast * 0.7) {
        const dmg = (b.dmg * 0.3) * (1 - dp / (blast * 0.7));
        damagePlayer(dmg, Math.atan2(b.z - player.z, b.x - player.x));
    }
}

function killBullet(b, i, didRicochetExit) {
    if (b.mesh) {
        scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        if (!b.mesh.material.cached) b.mesh.material.dispose();
    }
    if (b.lightRef) releaseLight(b.lightRef);
    bullets.splice(i, 1);
}

function damageEnemy(e, dmg, hx, hy, hz) {
    e.hp -= dmg;
    e.hurtT = 0.15;
    particles.bloodSpray(hx, hy, hz, (hx - e.x) || 0.01, (hz - e.z) || 0.01, 8);
    if (e.hp <= 0 && e.deathT < 0) killEnemy(e);
    else audio.hit();
}

function killEnemy(e) {
    e.hp = 0;
    e.deathT = 0;
    kills++;
    score += Math.floor(e.sc * comboX);
    combo++;
    comboT = 1.2;
    comboX = 1 + Math.min(4, combo * 0.1);
    audio.kill();

    // Player heals on kill
    const healAmount = Math.max(1, Math.floor(e.def.hp / 10));
    player.heal(healAmount);

    // Blood pool decal
    addBloodDecal(e.x, e.z);
    // Big blood spray
    particles.bloodSpray(e.x, e.y + e.r, e.z, 0, 0, 24);

    // Boss death — upgrade + weapon
    if (e.isBoss) {
        setTimeout(() => endBossWave(), 1800);
    }

    // Division: spawn children
    if (e.div && e.dI) {
        const childDef = EDEF[e.dI];
        if (childDef) {
            const n = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2;
                const child = createEnemy(childDef, { x: e.x + Math.cos(a) * 1.5, z: e.z + Math.sin(a) * 1.5 });
                enemies.push(child);
            }
        }
    }

    // Slow-mo on kill
    if (e.isBoss || Math.random() < 0.25) {
        fx.slowMo(e.isBoss ? 0.5 : 0.18, e.isBoss ? 0.25 : 0.4);
    }

    // Enemy auras off
    if (e.mesh.userData.aura) e.mesh.userData.aura.intensity = 0;
}

function addBloodDecal(x, z) {
    const geo = new THREE.CircleGeometry(0.6 + Math.random() * 0.4, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x3a0404, transparent: true, opacity: 0.85 });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02 + Math.random() * 0.01, z);
    scene.add(m);
    decals.push(m);
    if (decals.length > 60) {
        const old = decals.shift();
        scene.remove(old);
        old.geometry.dispose();
        old.material.dispose();
    }
}

// ================================================================
// ENEMY AI
// ================================================================
function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        if (e.deathT >= 0) {
            e.deathT += dt;
            // Collapse animation: scale down + fall
            const t = Math.min(1, e.deathT / 0.5);
            e.mesh.scale.setScalar((1 - t * 0.5));
            e.mesh.position.y = Math.max(0, (e.baseY || 0) - t * 0.4);
            e.mesh.rotation.z = t * (Math.random() > 0.5 ? 1 : -1) * 0.8;
            if (e.deathT > 1.5) {
                scene.remove(e.mesh);
                e.mesh.traverse(o => {
                    if (o.geometry) o.geometry.dispose();
                    if (o.material) o.material.dispose();
                });
                enemies.splice(i, 1);
            }
            continue;
        }

        if (e.hurtT > 0) e.hurtT -= dt;

        // Target player
        const dx = player.x - e.x, dz = player.z - e.z;
        const distToPlayer = Math.hypot(dx, dz);
        const angleToPlayer = Math.atan2(dz, dx);

        // Pattern
        let desiredDx = dx / distToPlayer, desiredDz = dz / distToPlayer;
        if (e.pat === 'blink' && Math.random() < 0.002) {
            // Teleport
            const pos = getSpawnPosition();
            e.x = pos.x; e.z = pos.z;
            particles.smokePuff(e.x, 1, e.z, 12, 0x6a2020);
        }
        if (e.pat === 'stomp') {
            // Charges closer, briefly pauses
            e.patT += dt;
            if (e.patT > 2.5) { e.patT = 0; fx.addShake(0.2); }
        }
        if (e.ranged && distToPlayer < 20) {
            // Keep slight distance
            if (distToPlayer < 6) { desiredDx *= -0.4; desiredDz *= -0.4; }
            else if (distToPlayer < 10) { desiredDx *= 0.1; desiredDz *= 0.1; }
        }

        const spd = e.spd * (e.isBoss ? 1 : 1);
        e.x += desiredDx * spd * dt;
        e.z += desiredDz * spd * dt;

        // Y (height) — flyers hover with bob, grounded idle
        if (e.flying) {
            e.y = e.baseY + Math.sin(e.patT * 2 + e.x) * 0.15;
        } else {
            e.y = 0;
        }
        e.patT += dt;

        // Collide with walls
        arena.collideCircle(e);
        e.mesh.position.set(e.x, e.y, e.z);
        // Face player (yaw)
        e.mesh.rotation.y = -angleToPlayer + Math.PI / 2;

        // Leg animation
        if (e.mesh.userData.legs && !e.flying) {
            const bob = Math.sin(e.patT * 8) * 0.1;
            for (let j = 0; j < e.mesh.userData.legs.length; j++) {
                e.mesh.userData.legs[j].rotation.x = Math.sin(e.patT * 8 + j * Math.PI) * 0.3;
            }
        }

        // Eye glow flicker
        if (e.mesh.userData.eyeMat && e.hurtT > 0) {
            e.mesh.userData.eyeMat.emissiveIntensity = 1;
        } else if (e.mesh.userData.eyeMat) {
            e.mesh.userData.eyeMat.emissiveIntensity = 2.5 + Math.sin(e.patT * 5 + e.x) * 0.5;
        }

        // Contact damage
        if (distToPlayer < e.r + player.r + 0.1) {
            if (damagePlayer(e.dmg * dt * 3, angleToPlayer + Math.PI)) return; // player died
        }

        // Ranged attack
        if (e.ranged && distToPlayer < 20 && distToPlayer > 2 && arena.hasLineOfSight(e, player)) {
            e.fireT -= dt;
            if (e.fireT <= 0) {
                e.fireT = e.fRate;
                spawnEnemyProjectile(e, angleToPlayer);
            }
        }

        // Boss patterns extra
        if (e.isBoss) {
            e.fireT -= dt;
            if (e.fireT <= 0) {
                e.fireT = e.fRate;
                if (e.pat === 'radial') {
                    for (let k = 0; k < 8; k++) {
                        const a = (k / 8) * Math.PI * 2;
                        spawnEnemyProjectile(e, a, true);
                    }
                } else if (e.pat === 'spray') {
                    for (let k = -2; k <= 2; k++) {
                        spawnEnemyProjectile(e, angleToPlayer + k * 0.2, true);
                    }
                } else if (e.pat === 'summon' || e.pat === 'all') {
                    // Summon minions
                    const type = pickEnemyType(waveNum - 2);
                    const child = createEnemy(EDEF[type], { x: e.x + (Math.random() - 0.5) * 3, z: e.z + (Math.random() - 0.5) * 3 });
                    enemies.push(child);
                    particles.smokePuff(child.x, 1, child.z, 10, 0x6a2020);
                } else {
                    spawnEnemyProjectile(e, angleToPlayer, true);
                }
            }
        }

        // Growl
        e.growlT -= dt;
        if (e.growlT <= 0) {
            e.growlT = 3 + Math.random() * 5;
            if (distToPlayer < 20) audio.growl(e.x, e.z, player);
        }

        // HP bar for boss (floats above)
        if (e.isBoss && !e._hpBar) {
            buildBossHP(e);
        }
        if (e._hpBar) {
            const pct = Math.max(0, e.hp / e.maxHp);
            e._hpBar.scale.x = Math.max(0.01, pct);
        }
    }
}

function buildBossHP(e) {
    const group = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.14),
        new THREE.MeshBasicMaterial({ color: 0x400000, transparent: true, opacity: 0.8 }));
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.14),
        new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    bar.position.z = 0.01;
    bar.scale.x = 1;
    bar.position.x = 0;
    group.add(bg);
    group.add(bar);
    group.position.y = e.r * 3.6;
    e.mesh.add(group);
    e._hpBar = bar;
    // Make bar always face camera via onBeforeRender
    group.onBeforeRender = () => { group.lookAt(camera.position); };
}

function spawnEnemyProjectile(e, angle, big = false) {
    const spd = big ? 14 : 12;
    const sz = big ? 0.22 : 0.16;
    const color = e.def.projColor || e.def.eye || 0xff6600;
    const b = {
        x: e.x + Math.cos(angle) * (e.r + 0.3),
        y: e.y + e.r * 1.4,
        z: e.z + Math.sin(angle) * (e.r + 0.3),
        vx: Math.cos(angle) * spd,
        vy: 0,
        vz: Math.sin(angle) * spd,
        lifetime: 3.0,
        dmg: e.dmg * (big ? 1.2 : 1.0) * 0.7,
        sz,
        color,
        tracking: e.tracking,
    };
    const mat = new THREE.MeshBasicMaterial({ color });
    const geo = new THREE.SphereGeometry(sz, 7, 6);
    b.mesh = new THREE.Mesh(geo, mat);
    b.mesh.position.set(b.x, b.y, b.z);
    scene.add(b.mesh);
    enemyBullets.push(b);
    // SFX
    audio._tone(500 + Math.random() * 200, 0.06, 'sawtooth', 0.04);
}

function updateEnemyBullets(dt) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        // Tracking (slight homing)
        if (b.tracking) {
            const dx = player.x - b.x, dz = player.z - b.z;
            const d = Math.hypot(dx, dz);
            if (d > 0.1) {
                b.vx += (dx / d) * 10 * dt;
                b.vz += (dz / d) * 10 * dt;
                const sp = Math.hypot(b.vx, b.vz);
                const maxSp = 16;
                if (sp > maxSp) { b.vx = b.vx / sp * maxSp; b.vz = b.vz / sp * maxSp; }
            }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.lifetime -= dt;
        b.mesh.position.set(b.x, b.y, b.z);

        // Wall collision
        if (arena.bulletBounceInnerWall(b)) {
            scene.remove(b.mesh);
            b.mesh.geometry.dispose(); b.mesh.material.dispose();
            enemyBullets.splice(i, 1);
            continue;
        }

        // Player hit
        const dx = player.x - b.x, dz = player.z - b.z;
        if (dx * dx + dz * dz < (player.r + b.sz) * (player.r + b.sz) && b.y > 0.3 && b.y < 2.5) {
            damagePlayer(b.dmg, Math.atan2(b.z - player.z, b.x - player.x));
            scene.remove(b.mesh);
            b.mesh.geometry.dispose(); b.mesh.material.dispose();
            enemyBullets.splice(i, 1);
            continue;
        }

        if (b.lifetime <= 0) {
            scene.remove(b.mesh);
            b.mesh.geometry.dispose(); b.mesh.material.dispose();
            enemyBullets.splice(i, 1);
        }
    }
}

// ================================================================
// PLAYER DAMAGE
// ================================================================
function damagePlayer(amount, fromAngle) {
    if (!player.alive) return true;
    const died = player.damage(amount, fromAngle);
    fx.damageVignette(Math.min(1, amount / 30));
    fx.addShake(Math.min(0.4, amount / 50));
    flashDamageArc(fromAngle - player.angle);
    if (died) {
        gameOver();
        return true;
    }
    return false;
}

// ================================================================
// WAVE / BOSS END
// ================================================================
function endBossWave() {
    if (state !== 'play') return;
    player.hp = player.maxHp; // full heal
    player.armor = Math.min(player.maxArmor, player.armor + 30);

    // Unlock a new weapon if available
    const next = Object.keys(player.unlocked).length + 1;
    if (next <= WC) {
        player.unlocked[next] = true;
        if (next === 2) player.ammo[2] = WEAP[2].maxAmmo;
        else if (next === 3) player.ammo[3] = WEAP[3].maxAmmo;
        else if (next === 4) player.ammo[4] = WEAP[4].maxAmmo;
        else if (next === 5) player.ammo[5] = WEAP[5].maxAmmo;
        else if (next === 6) player.ammo[6] = WEAP[6].maxAmmo;
        else if (next === 7) player.ammo[7] = WEAP[7].maxAmmo;
        else if (next === 8) player.ammo[8] = WEAP[8].maxAmmo;
        else if (next === 9) player.ammo[9] = WEAP[9].maxAmmo;
        fx.announce(`NEW WEAPON: ${WEAP[next].name}`, '', 2200);
    }

    // Show upgrade screen
    showUpgradeScreen();
}

const UPGRADES = [
    { icon: '❤️', name: '+MAX HP', desc: '+25 max HP, full heal', apply: p => { p.maxHp += 25; p.hp = p.maxHp; } },
    { icon: '⚡', name: '+SPEED', desc: 'Move 15% faster', apply: p => { p.spd *= 1.15; } },
    { icon: '💥', name: '+DAMAGE', desc: 'Deal 20% more damage', apply: p => { p.dmgM *= 1.2; } },
    { icon: '🔥', name: '+FIRE RATE', desc: '15% faster shooting', apply: p => { p.rateM *= 0.85; } },
    { icon: '🛡', name: '+ARMOR', desc: '+50 armor (50% dmg reduction)', apply: p => { p.armor = Math.min(p.maxArmor, p.armor + 50); } },
    { icon: '💀', name: '+AMMO CAP', desc: 'All ammo caps +50%', apply: p => {
        for (const k of Object.keys(p.ammo)) {
            const def = WEAP[+k];
            if (def && def.maxAmmo !== Infinity) {
                def.maxAmmo = Math.floor(def.maxAmmo * 1.5);
                p.ammo[k] = def.maxAmmo;
            }
        }
    } },
];

function showUpgradeScreen() {
    paused = true;
    inputHandler.setPaused(true);
    const $up = document.getElementById('upgrade-screen');
    const $choices = document.getElementById('upgrade-choices');
    $choices.innerHTML = '';
    // Pick 3 random
    const pool = UPGRADES.slice();
    const picks = [];
    for (let i = 0; i < 3 && pool.length; i++) {
        picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    for (const u of picks) {
        const d = document.createElement('div');
        d.className = 'upg-card';
        d.innerHTML = `<div class="icon">${u.icon}</div><div class="name">${u.name}</div><div class="desc">${u.desc}</div>`;
        const choose = (e) => {
            e?.stopPropagation(); e?.preventDefault();
            u.apply(player);
            $up.classList.remove('on');
            paused = false;
            inputHandler.setPaused(false);
            // Advance wave
            nextWave();
        };
        d.addEventListener('click', choose);
        d.addEventListener('touchend', choose);
        $choices.appendChild(d);
    }
    $up.classList.add('on');
}

// ================================================================
// WAVE SPAWN TICK
// ================================================================
function tickWave(dt) {
    if (phase !== 'wave') return;
    // Check if wave clear
    const aliveCount = enemies.filter(e => e.hp > 0).length;
    if (aliveCount === 0 && toSpawn === 0) {
        phase = 'idle';
        setTimeout(() => {
            if (state !== 'play') return;
            // Between-wave moment
            showUpgradeScreen();
        }, 1500);
        return;
    }
    // Spawn drip
    if (toSpawn > 0) {
        spawnT -= dt;
        if (spawnT <= 0) {
            spawnT = spawnRate;
            spawnOneEnemy();
            toSpawn--;
        }
    }
}

// ================================================================
// PLAYER MOVEMENT
// ================================================================
function updatePlayer(dt) {
    const move = inputHandler.getMove();
    const dashing = inputHandler.isDashing() && player.dashCd <= 0 && player.dashT <= 0 && (Math.abs(move.fwd) + Math.abs(move.str)) > 0.05;
    if (dashing) {
        player.dashT = 0.18;
        player.dashCd = 0.8;
        audio.dash();
        particles.smokePuff(player.x, 0.2, player.z, 10);
    }
    player.dashT = Math.max(0, player.dashT - dt);
    player.dashCd = Math.max(0, player.dashCd - dt);
    const speedMul = player.dashT > 0 ? 2.8 : 1.0;

    const a = player.angle;
    const fx2 = Math.cos(a) * move.fwd + Math.cos(a + Math.PI / 2) * move.str;
    const fz2 = Math.sin(a) * move.fwd + Math.sin(a + Math.PI / 2) * move.str;

    player.x += fx2 * player.spd * speedMul * dt;
    player.z += fz2 * player.spd * speedMul * dt;
    arena.collideCircle(player);

    // Mercy frames
    if (player.inv > 0) player.inv -= dt;
    if (player.hurtT > 0) player.hurtT -= dt;

    // Reload
    if (player.reloading) {
        player.reloadT -= dt;
        if (player.reloadT <= 0) {
            player.reloading = false;
            const def = WEAP[player.wep];
            player.ammo[player.wep] = def.maxAmmo;
            audio.pickup();
        }
    }

    // Save look deltas to player object for weapon sway
    player.lookDx = inputHandler.lookDx;
    player.lookDy = inputHandler.lookDy;
}

// ================================================================
// COMBO DECAY
// ================================================================
function updateCombo(dt) {
    if (combo === 0) { hud.setCombo(''); return; }
    comboT -= dt;
    if (comboT <= 0) { combo = 0; comboX = 1; hud.setCombo(''); return; }
    if (combo >= 2) hud.setCombo(`x${comboX.toFixed(1)}  ·  ${combo}`);
}

// ================================================================
// PAUSE OPTIONS
// ================================================================
document.getElementById('opt-vol-down').addEventListener('click', () => { audio.setVolume(Math.max(0, audio.volume - 0.1)); document.getElementById('opt-vol').textContent = Math.round(audio.volume * 100) + '%'; });
document.getElementById('opt-vol-up').addEventListener('click', () => { audio.setVolume(Math.min(1, audio.volume + 0.1)); document.getElementById('opt-vol').textContent = Math.round(audio.volume * 100) + '%'; });
document.getElementById('opt-perf').addEventListener('click', e => {
    performanceMode = !performanceMode;
    renderer.togglePerfMode(performanceMode);
    e.target.classList.toggle('on', performanceMode);
});

// ================================================================
// START BUTTONS
// ================================================================
document.getElementById('start-btn').addEventListener('click', e => { e.stopPropagation(); startGame(); });
document.getElementById('start-btn').addEventListener('touchend', e => { e.stopPropagation(); e.preventDefault(); startGame(); });

addEventListener('resize', () => { renderer.onResize(); });
addEventListener('orientationchange', () => setTimeout(() => renderer.onResize(), 200));

// ================================================================
// MAIN LOOP
// ================================================================
let lastTime = performance.now();
let frameTime = 0, frameCount = 0;

boot(90, 'READY');
setTimeout(() => $boot.style.display = 'none', 300);

function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.1) dt = 0.1; // cap

    // Time-scale for slow-mo
    const scaledDt = dt * fx.timeScale;

    const moving = (Math.abs(inputHandler.getMove().fwd) + Math.abs(inputHandler.getMove().str)) > 0.05;
    const dashing = player.dashT > 0;

    fx.update(dt, { pl: { ...player, cameraHeight: player.cameraHeight }, moving, dashing });

    if (state === 'play' && !paused) {
        gameTime += dt;
        updatePlayer(scaledDt);
        tryFire(scaledDt);
        updateBullets(scaledDt);
        updateEnemies(scaledDt);
        updateEnemyBullets(scaledDt);
        tickWave(scaledDt);
        updateCombo(dt);

        // Combo HUD
        document.body.classList.toggle('crosshair-hit', player.hurtT > 0);

        hud.update(dt, { pl: player, wave: waveNum, score, kills, hi: hiScore, time: gameTime });
        weaponView.update(scaledDt, { firing: inputHandler.isFiring(), swayX: fx.swayX, swayY: fx.swayY });
    }

    // Always update ambient visuals
    arena.updateEmbers(dt, now * 0.001);
    particles.update(dt);
    if (arena.sky?.userData.uniforms) arena.sky.userData.uniforms.time.value += dt;

    inputHandler.tick();

    // Title screen art
    if (state === 'menu') drawTitle(dt);

    renderer.render(dt);
}

requestAnimationFrame(loop);
