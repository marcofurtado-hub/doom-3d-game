import * as THREE from 'three';
import { RendererSystem } from './renderer.js';
import { Arena, ARENA } from './arena.js';
import { biomeForWave } from './biomes.js';
import { Particles } from './particles.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { WEAP, WC, WeaponView, makeBullet, makeBulletMesh, makeOrbMesh, buildWeaponModel, setWeaponEnvMap } from './weapons.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EDEF, BDEF, buildEnemyMesh, disposeEnemyMesh } from './enemies.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { HUD } from './hud.js';

// ================================================================
// DOOMZINHO v2 — orchestration: game flow, combat, AI, main loop
// ================================================================

const DEBUG = new URLSearchParams(location.search).has('debug');
const isMobile = matchMedia('(pointer: coarse)').matches || (('ontouchstart' in window) && !matchMedia('(pointer: fine)').matches);
if (isMobile) {
    document.body.classList.add('mobile');
    document.getElementById('start-desktop').style.display = 'none';
    document.getElementById('start-mobile').style.display = 'block';
    document.getElementById('start-btn').textContent = '[ TOQUE PRA COMEÇAR ]';
}

const $ = id => document.getElementById(id);
// Menu buttons get explicit click + touchend handlers so taps are never swallowed.
const tap = (el, fn) => {
    el.addEventListener('click', e => { e.stopPropagation(); fn(e); });
    el.addEventListener('touchend', e => { e.stopPropagation(); e.preventDefault(); fn(e); }, { passive: false });
};
const boot = (pct, txt) => { $('boot-bar').style.width = pct + '%'; if (txt) $('boot-txt').textContent = txt; };

// ---------------------------------------------------------------- setup
boot(10, 'INIT...');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.04, 220);
scene.add(camera);

let perf = localStorage.getItem('doom3dv2Perf') === '1';
const renderer = new RendererSystem(scene, camera, { isMobile, perf });
const arena = new Arena(scene);
const _dbs = new THREE.Vector2();
const particles = new Particles(scene, isMobile, () => renderer.renderer.getDrawingBufferSize(_dbs).y);
const audio = new Audio();
const player = new Player();
const hud = new HUD();
const fx = new FX({ camera, renderer });
// Small prefiltered environment, used only by the gun metals so they read as metal without lighting the whole scene with IBL
{
    const pmrem = new THREE.PMREMGenerator(renderer.renderer);
    setWeaponEnvMap(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
    pmrem.dispose();
}
const weaponView = new WeaponView(camera);
weaponView.setWeapon(1);
boot(60, 'WEAPONS...');

// ---------------------------------------------------------------- state
let state = 'menu';            // menu | play | dying | dead
let paused = false, upgrading = false;
let phase = 'idle';            // transition | wave | cleared
let waveNum = 0, score = 0, kills = 0, combo = 0, comboT = 0, gameTime = 0;
let toSpawn = 0, spawnT = 0, spawnRate = 1, isBossWave = false, boss = null, bossIdx = 0;
let dyingT = 0, scoreSaved = false, upgradeAt = 0;
let hiScore = parseInt(localStorage.getItem('doom3dv2Hi')) || 0;
let rankings = [];
try { rankings = JSON.parse(localStorage.getItem('doom3dv2Rank') || '[]'); } catch (e) {}

const enemies = [], bullets = [], ebullets = [], decals = [], pickups = [], zones = [], timers = [];
const MAX_ALIVE = isMobile ? 10 : 16;
const MAX_DECALS = isMobile ? 24 : 60;
const canPlay = () => state === 'play' && !paused && !upgrading;
const after = (sec, fn) => timers.push({ t: sec, fn });
const aliveCount = () => { let n = 0; for (const e of enemies) if (e.hp > 0) n++; return n; };
let sndHit = 0, sndRic = 0, sndSpawn = 0;

const input = new Input({
    player, isMobile, canPlay,
    onPause: () => togglePause(),
    onReload: () => startReload(),
    onWeapon: n => switchWeapon(n),
    onCycleWep: dir => cycleWeapon(dir),
    onStart: () => startGame(),
});

// ---------------------------------------------------------------- pooled dynamic lights
// Count never changes (intensity 0 when idle), so three.js never recompiles shaders mid-fight.
const lightPool = [];
for (let i = 0; i < (isMobile ? 3 : 6); i++) {
    const l = new THREE.PointLight(0xffffff, 0, 12, 2);
    scene.add(l);
    lightPool.push({ l, busy: false, t: 0, dur: 0, peak: 0 });
}
function takeLight(color, intensity, dist) {
    for (const p of lightPool) {
        if (!p.busy) {
            p.busy = true; p.dur = 0;
            p.l.color.set(color); p.l.intensity = intensity; p.l.distance = dist;
            return p;
        }
    }
    return null;
}
function freeLight(p) { if (p) { p.busy = false; p.dur = 0; p.l.intensity = 0; } }
function flashLight(x, y, z, color, intensity, dist, dur) {
    const p = takeLight(color, intensity, dist);
    if (!p) return;
    p.l.position.set(x, y, z);
    p.t = 0; p.dur = dur; p.peak = intensity;
}
function updateLights(dt) {
    for (const p of lightPool) {
        if (!p.busy || p.dur <= 0) continue;
        p.t += dt;
        if (p.t >= p.dur) freeLight(p); else p.l.intensity = p.peak * (1 - p.t / p.dur);
    }
}

// ---------------------------------------------------------------- title screen art
const titleCanvas = $('title-canvas'), tctx = titleCanvas.getContext('2d');
const sizeTitle = () => { titleCanvas.width = innerWidth; titleCanvas.height = innerHeight; };
sizeTitle();
const titleEmbers = Array.from({ length: 90 }, () => ({
    x: Math.random(), y: Math.random(), vy: 0.02 + Math.random() * 0.09, vx: (Math.random() - 0.5) * 0.02,
    s: 1 + Math.random() * 2.5, c: Math.random() > 0.5 ? '#ff6a28' : '#e03818', ph: Math.random() * 6,
}));
let titleT = 0;
function drawTitle(dt) {
    titleT += dt;
    const W = titleCanvas.width, H = titleCanvas.height;
    const g = tctx.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#3a0c08'); g.addColorStop(0.5, '#0e0304'); g.addColorStop(1, '#000');
    tctx.fillStyle = g; tctx.fillRect(0, 0, W, H);
    // rotating sigil
    tctx.save();
    tctx.translate(W / 2, H * 0.45);
    const R = Math.min(W, H) * 0.42;
    tctx.strokeStyle = `rgba(200,50,20,${0.16 + 0.07 * Math.sin(titleT * 0.7)})`;
    tctx.lineWidth = 2;
    tctx.beginPath(); tctx.arc(0, 0, R, 0, Math.PI * 2); tctx.stroke();
    tctx.beginPath(); tctx.arc(0, 0, R * 0.92, 0, Math.PI * 2); tctx.stroke();
    tctx.beginPath();
    for (let i = 0; i <= 5; i++) {
        const a = i * Math.PI * 4 / 5 - Math.PI / 2 + titleT * 0.06;
        tctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92);
    }
    tctx.stroke();
    tctx.restore();
    // heat haze at the bottom
    const hz = tctx.createLinearGradient(0, H, 0, H * 0.55);
    hz.addColorStop(0, `rgba(255,70,10,${0.28 + 0.06 * Math.sin(titleT * 1.7)})`); hz.addColorStop(1, 'rgba(255,70,10,0)');
    tctx.fillStyle = hz; tctx.fillRect(0, H * 0.55, W, H * 0.45);
    for (const e of titleEmbers) {
        e.y -= e.vy * dt; e.x += e.vx * dt + Math.sin(titleT + e.ph) * 0.0004;
        if (e.y < -0.02) { e.y = 1.02; e.x = Math.random(); }
        const x = e.x * W, y = e.y * H;
        tctx.fillStyle = e.c;
        tctx.globalAlpha = 0.14; tctx.beginPath(); tctx.arc(x, y, e.s * 4, 0, 6.3); tctx.fill();
        tctx.globalAlpha = 0.85; tctx.beginPath(); tctx.arc(x, y, e.s, 0, 6.3); tctx.fill();
    }
    tctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- world cleanup
function removeBulletAt(i) {
    const b = bullets[i];
    scene.remove(b.mesh);
    freeLight(b.light);
    bullets.splice(i, 1);
}
function removePickupAt(i) {
    const p = pickups[i];
    scene.remove(p.mesh);
    if (p.type === 'weapon') {
        p.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    }
    pickups.splice(i, 1);
}
function clearTransient() {
    while (bullets.length) removeBulletAt(bullets.length - 1);
    for (const b of ebullets) scene.remove(b.mesh);
    ebullets.length = 0;
    while (pickups.length) removePickupAt(pickups.length - 1);
    for (const z of zones) freeLight(z.light);
    zones.length = 0;
    for (const d of decals) scene.remove(d);
    decals.length = 0;
    particles.clear();
}
function clearWorld() {
    clearTransient();
    for (const e of enemies) { scene.remove(e.mesh); disposeEnemyMesh(e.mesh); }
    enemies.length = 0;
    timers.length = 0;
    for (const p of lightPool) freeLight(p);
    boss = null;
    hud.setBoss(null);
}

// ---------------------------------------------------------------- game flow
function startGame() {
    if (state !== 'menu') return;
    audio.init(); audio.resume(); audio.setMusicMode('normal'); audio.startMusic();
    clearWorld();
    player.reset();
    weaponView.setWeapon(1);
    waveNum = 0; score = 0; kills = 0; combo = 0; comboT = 0; gameTime = 0; bossIdx = 0;
    scoreSaved = false; paused = false; upgrading = false;
    $('start-screen').style.display = 'none';
    $('game-over').classList.remove('on');
    $('pause-screen').classList.remove('on');
    $('upgrade-screen').classList.remove('on');
    document.body.classList.remove('overlay');
    hud.show(true);
    hud.setCombo('');
    document.body.classList.add('playing');
    state = 'play';
    input.setState('play');
    input.releaseAll();
    input.lock();
    if (isMobile) {
        try { const p = document.documentElement.requestFullscreen?.(); p?.catch?.(() => {}); } catch (e) {}
        try { const p = screen.orientation?.lock?.('landscape'); p?.catch?.(() => {}); } catch (e) {}
    }
    beginWave(true);
}

function beginWave(first = false) {
    waveNum++;
    phase = 'transition';
    isBossWave = waveNum % 5 === 0;
    const swap = () => {
        clearTransient();
        const biome = biomeForWave(waveNum);
        arena.setBiome(biome, { low: isMobile, shadows: renderer.shadows });
        const hex = '#' + biome.accent.toString(16).padStart(6, '0');
        hud.setBiome(biome.name, hex);
        renderer.setAccent(biome.accent);
        audio.setAmbient(biome);
        player.x = 0; player.z = 0;
        after(0.08, () => { fx.fade(false); fx.showBiomeCard(biome.name, biome.sub, hex); });
        if (!isBossWave && waveNum >= 2) spawnWeaponPickup();
        after(2.6, startSpawning);
    };
    if (first) swap(); else { fx.fade(true); after(0.4, swap); }
}

function startSpawning() {
    phase = 'wave';
    spawnT = 0.4;
    if (isBossWave) {
        const def = BDEF[Math.min(bossIdx, BDEF.length - 1)];
        boss = spawnEnemy(def, true);
        bossIdx++;
        toSpawn = 3 + Math.floor(waveNum / 5) * 2;
        spawnRate = 3.2;
        audio.setMusicMode('boss'); audio.boss();
        fx.announce(def.name, 'BOSS · WAVE ' + waveNum, 2400);
        fx.addShake(0.5);
    } else {
        toSpawn = Math.min(5 + waveNum * 2, 36);
        spawnRate = Math.max(0.45, 1.5 - waveNum * 0.07);
        audio.setMusicMode('normal');
        fx.announce('WAVE ' + waveNum, '', 1300);
    }
}

function tickWave(dt) {
    if (phase !== 'wave') return;
    const alive = aliveCount();
    if (toSpawn > 0) {
        spawnT -= dt;
        if (spawnT <= 0 && alive < MAX_ALIVE) {
            spawnT = spawnRate;
            spawnEnemy(EDEF[pickEnemyType(waveNum)]);
            toSpawn--;
        }
    } else if (alive === 0) {
        phase = 'cleared';
        audio.waveClear();
        fx.announce(isBossWave ? 'BOSS DESTROYED' : 'WAVE CLEAR', '', 1200);
        after(1.4, waveCleared);
    }
}

function waveCleared() {
    for (let i = pickups.length - 1; i >= 0; i--) if (pickups[i].type === 'weapon') { grantWeapon(pickups[i].k); removePickupAt(i); }
    if (isBossWave) {
        player.hp = player.maxHp;
        const k = nextLockedWeapon();
        if (k) grantWeapon(k);
        audio.setMusicMode('normal');
    }
    showUpgrade();
}

function die() {
    state = 'dying';
    dyingT = 0;
    input.setState('dying');
    input.releaseAll();
    input.unlock();
    audio.death();
    fx.slowMo(1.3, 0.3);
    fx.addShake(0.8);
    hud.setCombo('');
}

function gameOver() {
    state = 'dead';
    input.setState('dead');
    audio.stopMusic(); audio.stopAmbient();
    hud.show(false);
    document.body.classList.remove('playing');
    if (score > hiScore) { hiScore = score; localStorage.setItem('doom3dv2Hi', String(hiScore)); }
    $('go-stats').innerHTML =
        `<div>WAVE <span class="hl">${waveNum}</span> &nbsp; SCORE <span class="hl">${score}</span></div>` +
        `<div>KILLS <span class="hl">${kills}</span> &nbsp; TEMPO <span class="hl">${Math.floor(gameTime / 60)}:${String(Math.floor(gameTime % 60)).padStart(2, '0')}</span></div>`;
    $('go-save').textContent = 'SALVAR';
    $('go-save').classList.remove('on');
    renderRankings();
    $('game-over').classList.add('on');
    document.body.classList.add('overlay');
}

function renderRankings() {
    const top = rankings.slice(0, 5);
    $('go-rank').innerHTML = '<div class="top">— RANKING —</div>' +
        (top.length ? top.map((r, i) => `<div>${i + 1}. ${r.name} — ${r.score} (wave ${r.wave})</div>`).join('') : '<div>sem recordes ainda</div>');
}

function saveScore() {
    if (scoreSaved || state !== 'dead') return;
    const name = ($('go-input').value.trim() || 'PLAYER').toUpperCase().replace(/[<>&]/g, '').slice(0, 12);
    rankings.push({ name, score, wave: waveNum, kills });
    rankings.sort((a, b) => b.score - a.score);
    rankings = rankings.slice(0, 10);
    localStorage.setItem('doom3dv2Rank', JSON.stringify(rankings));
    scoreSaved = true;
    $('go-save').textContent = 'SALVO ✓';
    $('go-save').classList.add('on');
    renderRankings();
}

function restart() {
    if (state !== 'dead') return;
    if ($('go-input').value.trim()) saveScore();
    state = 'menu';
    startGame();
}

function togglePause() {
    if (state !== 'play' || upgrading) return;
    paused = !paused;
    $('pause-screen').classList.toggle('on', paused);
    $('btn-pause').textContent = paused ? '▶' : 'II';
    if (paused) { input.releaseAll(); input.unlock(); } else input.lock();
}

function setPerf(on) {
    perf = on;
    renderer.setPerfMode(on);
    arena.setShadows(renderer.shadows);
    localStorage.setItem('doom3dv2Perf', on ? '1' : '0');
    $('start-perf').textContent = 'MODO LEVE: ' + (on ? 'ON' : 'OFF');
    $('start-perf').classList.toggle('on', on);
    $('opt-perf').classList.toggle('on', on);
}

// ---------------------------------------------------------------- upgrades
const UPGRADES = [
    { icon: '✚', name: 'VITALIDADE', desc: '+25 de vida máxima e cura 25', apply: p => { p.maxHp += 25; p.heal(25); } },
    { icon: '♥', name: 'MEDKIT', desc: 'Recupera 60 de vida agora', apply: p => p.heal(60) },
    { icon: '»', name: 'VELOCIDADE', desc: 'Anda 10% mais rápido', apply: p => { p.spd *= 1.1; } },
    { icon: '✸', name: 'DANO', desc: '+15% de dano em todas as armas', apply: p => { p.dmgM *= 1.15; } },
    { icon: '≡', name: 'CADÊNCIA', desc: 'Atira 12% mais rápido', apply: p => { p.rateM *= 0.88; } },
    { icon: '◆', name: 'ARMADURA', desc: '+50 de armadura (absorve metade do dano)', apply: p => { p.armor = Math.min(p.maxArmor, p.armor + 50); } },
    { icon: '▣', name: 'PENTE MAIOR', desc: '+40% de munição por recarga', apply: p => { for (const k of Object.keys(p.ammoMax)) { p.ammoMax[k] = Math.ceil(p.ammoMax[k] * 1.4); p.ammo[k] = p.ammoMax[k]; } } },
    { icon: '☠', name: 'VAMPIRO', desc: 'Kills curam 50% a mais', apply: p => { p.healM *= 1.5; } },
];

function showUpgrade() {
    upgrading = true;
    upgradeAt = performance.now();
    input.releaseAll();
    input.unlock();
    $('upg-title').textContent = isBossWave ? 'BOSS DESTRUÍDO' : `WAVE ${waveNum} COMPLETA`;
    const $choices = $('upgrade-choices');
    $choices.innerHTML = '';
    const pool = UPGRADES.filter(u => u.name !== 'MEDKIT' || player.hp < player.maxHp * 0.75);
    for (let i = 0; i < 3 && pool.length; i++) {
        const u = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        const d = document.createElement('div');
        d.className = 'upg-card';
        d.innerHTML = `<div class="icon">${u.icon}</div><div class="name">${u.name}</div><div class="desc">${u.desc}</div>`;
        tap(d, () => {
            if (!upgrading || performance.now() - upgradeAt < 350) return; // guard against a held click landing on a card
            u.apply(player);
            audio.upgrade();
            $('upgrade-screen').classList.remove('on');
            document.body.classList.remove('overlay');
            upgrading = false;
            input.lock();
            beginWave();
        });
        $choices.appendChild(d);
    }
    $('upgrade-screen').classList.add('on');
    document.body.classList.add('overlay');
}

// ---------------------------------------------------------------- weapons
function switchWeapon(n) {
    if (!canPlay() || !player.unlocked[n] || player.wep === n) return;
    player.wep = n;
    player.reloading = false;
    player.shotT = Math.max(player.shotT, 0.2);
    weaponView.setWeapon(n);
    audio.swap();
}
function cycleWeapon(dir) {
    const ks = Object.keys(player.unlocked).map(Number).sort((a, b) => a - b);
    const i = Math.max(0, ks.indexOf(player.wep));
    switchWeapon(ks[(i + dir + ks.length) % ks.length]);
}
function startReload() {
    const def = WEAP[player.wep];
    if (!canPlay() || !def.rTime || player.reloading || player.ammo[player.wep] >= player.ammoMax[player.wep]) return;
    player.reloading = true;
    player.reloadT = def.rTime;
    audio.reload();
}
function nextLockedWeapon() {
    for (let k = 2; k <= WC; k++) if (!player.unlocked[k]) return k;
    return 0;
}
function grantWeapon(k) {
    if (player.unlocked[k]) return;
    player.unlocked[k] = true;
    player.ammo[k] = player.ammoMax[k];
    player.wep = k;
    player.reloading = false;
    weaponView.setWeapon(k);
    audio.pickup();
    fx.announce(WEAP[k].name, 'NOVA ARMA · TECLA ' + k, 1800);
    fx.screenFlash('rgba(255,220,120,0.25)', 120);
}

const _muzzle = new THREE.Vector3(), _dir = new THREE.Vector3(), _aim = new THREE.Vector3(), _v = new THREE.Vector3();

function tryFire(dt) {
    player.shotT -= dt;
    if (!input.isFiring() || player.shotT > 0 || player.reloading) return;
    const key = player.wep, def = WEAP[key];
    if (def.maxAmmo !== Infinity && player.ammo[key] <= 0) { audio.empty(); startReload(); player.shotT = 0.2; return; }
    // Chaingun fires slowly until the barrels are up to speed
    player.shotT = def.rate * player.rateM * (def.spinup ? 1 + (1 - weaponView.spinup) * 2.5 : 1);
    if (def.maxAmmo !== Infinity) player.ammo[key]--;

    weaponView.getMuzzleWorld(_muzzle);
    camera.getWorldDirection(_dir);
    _aim.copy(camera.position).addScaledVector(_dir, 40);
    if (isMobile) { // light aim assist on touch: snap to an enemy within ~5° of the crosshair
        let best = Math.cos(0.09), target = null;
        for (const e of enemies) {
            if (e.hp <= 0) continue;
            _v.set(e.x, e.y + (e.hitLo + e.hitHi) / 2, e.z).sub(camera.position);
            const c = _v.dot(_dir) / _v.length();
            if (c > best && arena.hasLineOfSight(player, e)) { best = c; target = e; }
        }
        if (target) _aim.set(target.x, target.y + (target.hitLo + target.hitHi) / 2, target.z);
    }
    _v.copy(_aim).sub(_muzzle).normalize(); // bullets leave the gun tip but converge on the crosshair

    for (let i = 0; i < def.count; i++) {
        const b = makeBullet(key, _muzzle, _v, player.dmgM);
        b.mesh = makeBulletMesh(def);
        b.mesh.position.set(b.x, b.y, b.z);
        b.mesh.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz);
        scene.add(b.mesh);
        if (i === 0 && (def.expl || def.fire || def.trail === 'plasma')) b.light = takeLight(def.color, 5, 9);
        bullets.push(b);
    }
    weaponView.fire(def);
    particles.muzzle(_muzzle.x, _muzzle.y, _muzzle.z, _v.x, _v.y, _v.z, def.color, def.flash > 0.15 ? 9 : 4);
    if (def.shell) {
        const rx = -Math.sin(player.angle), rz = Math.cos(player.angle);
        particles.shell(_muzzle.x - _v.x * 0.2, _muzzle.y, _muzzle.z - _v.z * 0.2, rx, rz, def.shell);
    }
    fx.kickRecoil(def.recoil * 0.3);
    fx.addShake(def.shake * 0.45);
    audio[def.sfx]();
}

// ---------------------------------------------------------------- player bullets
function ricochetFx(b) {
    particles.hitSpark(b.x, b.y, b.z, 4, b.color, 0.7);
    if (sndRic <= 0) { audio.ricochet(); sndRic = 0.07; }
}

function updateBullets(dt) {
    const top = arena.openSky ? 16 : ARENA.WALL_H;
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.life -= dt;
        if (b.grav) b.vy -= b.grav * dt;
        const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy, b.vz) * dt / 0.3));
        const h = dt / steps;
        let dead = false, bounced = false;
        for (let s = 0; s < steps && !dead; s++) {
            b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
            const final = b.expl || b.fire || b.ricLeft <= 0;
            if (b.y < b.sz) {
                b.y = b.sz;
                if (final) { dead = true; surfaceImpact(b); break; }
                b.vy = Math.abs(b.vy) * 0.7; b.ricLeft--; bounced = true; ricochetFx(b);
            } else if (b.y > top - b.sz) {
                if (arena.openSky) { dead = true; break; }
                b.y = top - b.sz;
                if (final) { dead = true; surfaceImpact(b); break; }
                b.vy = -Math.abs(b.vy) * 0.7; b.ricLeft--; bounced = true; ricochetFx(b);
            }
            if (arena.bulletBounce(b)) {
                if (final) { dead = true; surfaceImpact(b); break; }
                b.ricLeft--; bounced = true; ricochetFx(b);
            }
            for (const e of enemies) {
                if (e.hp <= 0) continue;
                const dx = b.x - e.x, dz = b.z - e.z, rr = e.hr + b.sz;
                if (dx * dx + dz * dz < rr * rr && b.y > e.y + e.hitLo && b.y < e.y + e.hitHi) {
                    const sp = Math.hypot(b.vx, b.vz) || 1;
                    damageEnemy(e, b.dmg, b.x, b.y, b.z, b.vx / sp, b.vz / sp, b.knock, b.expl);
                    if (b.expl || b.fire) explode(b, e);
                    else particles.hitSpark(b.x, b.y, b.z, 3, b.color, 0.5);
                    dead = true;
                    break;
                }
            }
        }
        if (!dead && b.life <= 0) { dead = true; if (b.expl || b.fire) explode(b); }
        if (dead) { removeBulletAt(i); continue; }

        b.mesh.position.set(b.x, b.y, b.z);
        if (bounced || b.grav) b.mesh.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz);
        if (b.light) b.light.l.position.set(b.x, b.y, b.z);
        if (b.trail === 'rocket') { particles.smokePuff(b.x, b.y, b.z, 1, 0x6a645e, 0.5); particles.trail(b.x, b.y, b.z, 0xffa040, 0.12); }
        else if (b.trail === 'plasma') particles.trail(b.x, b.y, b.z, b.color, 0.09, 0.18);
        else if (b.trail === 'fire' || b.trail === 'bomb') particles.trail(b.x, b.y, b.z, b.color, 0.1, 0.3);
        else if (b.trail === 'bfg') { particles.trail(b.x, b.y, b.z, b.color, 0.3, 0.35); particles.trail(b.x, b.y, b.z, 0xffffff, 0.12, 0.25); }
    }
}

function surfaceImpact(b) {
    if (b.expl || b.fire) explode(b);
    else particles.hitSpark(b.x, b.y, b.z, 5, b.color, 0.8);
}

function explode(b, direct = null) {
    const blast = b.blast || 4;
    particles.explosion(b.x, Math.max(0.3, b.y), b.z, b.color, blast);
    flashLight(b.x, Math.max(0.8, b.y), b.z, b.color, 40 + blast * 8, blast * 3, 0.35);
    audio.explode();
    const dp = Math.hypot(player.x - b.x, player.z - b.z);
    fx.addShake(Math.max(0, 0.9 * (1 - dp / 22)) * (blast / 6));
    for (const e of enemies) {
        if (e.hp <= 0 || e === direct) continue;
        const dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz);
        if (d < blast + e.r) {
            const f = Math.max(0.15, 1 - d / (blast + e.r));
            damageEnemy(e, b.dmg * f, e.x, e.y + (e.hitLo + e.hitHi) / 2, e.z, dx / (d || 1), dz / (d || 1), b.knock * f, true);
        }
    }
    if (b.fire) zones.push({ x: b.x, z: b.z, r: blast, t: 4.5, tick: 0, light: takeLight(0xff7a20, 14, blast * 2.5) });
    if (b.key !== 9 && dp < blast * 0.6) damagePlayer(Math.min(22, b.dmg * 0.15) * (1 - dp / (blast * 0.6)), b.x, b.z);
}

function updateZones(dt) {
    for (let i = zones.length - 1; i >= 0; i--) {
        const z = zones[i];
        z.t -= dt; z.tick -= dt;
        for (let k = 0; k < (isMobile ? 1 : 3); k++) {
            const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * z.r;
            particles.fire(z.x + Math.cos(a) * r, 0.1, z.z + Math.sin(a) * r, Math.random() > 0.3 ? 0xff7a20 : 0xffd040);
        }
        if (z.light) { z.light.l.position.set(z.x, 1, z.z); z.light.l.intensity = 12 + Math.random() * 6; }
        if (z.tick <= 0) {
            z.tick = 0.25;
            for (const e of enemies) {
                if (e.hp > 0 && !e.flying && Math.hypot(e.x - z.x, e.z - z.z) < z.r + e.r) damageEnemy(e, 14 * player.dmgM, e.x, e.y + 0.8, e.z, 0, 0, 0, false);
            }
            if (Math.hypot(player.x - z.x, player.z - z.z) < z.r * 0.8) damagePlayer(3, z.x, z.z);
        }
        if (z.t <= 0) { freeLight(z.light); zones.splice(i, 1); }
    }
}

// ---------------------------------------------------------------- enemies
function pickEnemyType(wave) {
    const r = Math.random();
    if (wave < 3) return r < 0.7 ? 'imp' : 'skull';
    if (wave < 6) return r < 0.4 ? 'imp' : r < 0.62 ? 'skull' : r < 0.85 ? 'demon' : 'caco';
    if (wave < 10) return r < 0.25 ? 'imp' : r < 0.4 ? 'skull' : r < 0.62 ? 'demon' : r < 0.8 ? 'caco' : r < 0.92 ? 'baron' : 'revenant';
    return r < 0.15 ? 'imp' : r < 0.3 ? 'skull' : r < 0.5 ? 'demon' : r < 0.68 ? 'caco' : r < 0.84 ? 'baron' : 'revenant';
}

function spawnPosition(r) {
    for (let i = 0; i < 30; i++) {
        const edge = Math.floor(Math.random() * 4), t = (Math.random() - 0.5) * 0.9;
        const x = edge < 2 ? t * ARENA.W : (edge === 2 ? -1 : 1) * (ARENA.W / 2 - 2.5);
        const z = edge < 2 ? (edge === 0 ? -1 : 1) * (ARENA.H / 2 - 2.5) : t * ARENA.H;
        if (Math.hypot(x - player.x, z - player.z) > 11 && !arena.pointInWall(x, z, r)) return { x, z };
    }
    return arena.randomOpenSpot(player, 10);
}

function spawnEnemy(def, isBoss = false, at = null) {
    const scale = isBoss ? 1.15 : 1;
    const r = def.r * scale;
    const pos = at || spawnPosition(r);
    const mesh = buildEnemyMesh(def, isBoss);
    mesh.rotation.order = 'YXZ';
    const flying = !!def.flying;
    const baseY = flying ? r * 1.15 + 0.35 + Math.random() * 0.5 : 0;
    const hp = def.hp * (isBoss ? 2.2 + bossIdx * 0.2 : 1 + (waveNum - 1) * 0.06);
    const e = {
        def, mesh, isBoss, flying, x: pos.x, z: pos.z, y: baseY, baseY, r,
        hr: r * (def.build === 'caco' ? 1.3 : 1.05),
        hitLo: flying ? -r * 1.25 : 0, hitHi: flying ? r * 1.25 : mesh.userData.height * scale,
        hp, maxHp: hp, dmg: def.dmg * (1 + (waveNum - 1) * 0.03), spd: def.spd, sc: def.sc,
        ranged: !!def.ranged, charger: !!def.charger || def.pat === 'charge',
        fireT: (def.fRate || 1) * (0.5 + Math.random()), atkT: 0, hurtT: 0, flashed: false,
        deathT: -1, gib: false, t: Math.random() * 10, age: 0, kx: 0, kz: 0,
        growlT: 2 + Math.random() * 5, chargeT: 0, windT: 0, chargeCd: 2 + Math.random() * 3, cx: 0, cz: 0,
        strafe: Math.random() < 0.5 ? -1 : 1, patStep: 0, los: false, losT: 0, lunge: 0,
    };
    mesh.position.set(e.x, e.y, e.z);
    e.scale0 = mesh.scale.x;
    mesh.scale.setScalar(e.scale0 * 0.01);
    scene.add(mesh);
    enemies.push(e);
    particles.smokePuff(e.x, 0.8 + e.y, e.z, isBoss ? 14 : 5, 0x3a1410, isBoss ? 1.8 : 1.1);
    particles.ring(e.x, e.z, def.eye, r * 2.2, 0.45);
    if (sndSpawn <= 0) { audio.spawn(); sndSpawn = 0.25; }
    return e;
}

function damageEnemy(e, dmg, hx, hy, hz, dx, dz, knock, explosive) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.hurtT = 0.09;
    const k = knock * (e.isBoss ? 0.12 : 1) / (0.6 + e.r);
    e.kx += dx * k; e.kz += dz * k;
    particles.blood_(hx, hy, hz, -dx, -dz, 5);
    if (e.hp <= 0) killEnemy(e, explosive);
    else {
        hud.hitMarker(false);
        if (sndHit <= 0) { audio.hit(); sndHit = 0.05; }
    }
}

function killEnemy(e, explosive) {
    e.hp = 0;
    e.deathT = 0;
    e.gib = explosive && !e.isBoss;
    kills++;
    combo++; comboT = 2.5;
    const mult = 1 + Math.min(4, combo * 0.1);
    score += Math.round(e.sc * mult);
    player.heal(Math.round((2 + e.sc / 40) * player.healM));
    hud.hitMarker(true);
    audio.kill();
    const cy = e.y + (e.hitLo + e.hitHi) / 2;
    particles.blood_(e.x, cy, e.z, 0, 0, 14);
    if (!e.flying) addDecal(e.x, e.z, e.r);
    if (e.gib) particles.gibs(e.x, cy, e.z, e.def.col, 12);

    if (!e.isBoss) {
        const roll = Math.random();
        if (roll < 0.1) spawnDrop('health', e.x, e.z);
        else if (roll < 0.15) spawnDrop('armor', e.x, e.z);
    } else {
        particles.explosion(e.x, cy, e.z, e.def.eye, 9);
        particles.gibs(e.x, cy, e.z, e.def.col, 30);
        flashLight(e.x, cy, e.z, e.def.eye, 120, 30, 0.8);
        fx.slowMo(0.9, 0.2);
        fx.addShake(1.2);
        audio.explode(); audio.boss();
        for (let i = 0; i < 3; i++) spawnDrop(i ? 'health' : 'armor', e.x + (Math.random() - 0.5) * 2, e.z + (Math.random() - 0.5) * 2);
        if (e === boss) { boss = null; hud.setBoss(null); }
    }
    if (e.def.div && EDEF[e.def.dI]) {
        const n = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * 6.28;
            const p = { x: e.x + Math.cos(a) * 1.6, z: e.z + Math.sin(a) * 1.6 };
            if (!arena.pointInWall(p.x, p.z, 0.8)) spawnEnemy(EDEF[e.def.dI], false, p);
        }
    }
}

const decalGeo = new THREE.CircleGeometry(1, 12);
decalGeo.rotateX(-Math.PI / 2);
const decalMat = new THREE.MeshBasicMaterial({ color: 0x4a0606, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
function addDecal(x, z, r) {
    const m = new THREE.Mesh(decalGeo, decalMat);
    m.scale.set(r * (0.9 + Math.random() * 0.7), 1, r * (0.9 + Math.random() * 0.7));
    m.rotation.y = Math.random() * 6.28;
    m.position.set(x, 0.015, z);
    m.renderOrder = 1;
    scene.add(m);
    decals.push(m);
    if (decals.length > MAX_DECALS) scene.remove(decals.shift());
}

function shoot(e, ang, big, flat = false) {
    const spd = big ? 15 : 13, sz = big ? 0.26 : 0.18;
    const color = e.def.projColor || e.def.eye;
    const x = e.x + Math.cos(ang) * (e.r + 0.2), z = e.z + Math.sin(ang) * (e.r + 0.2);
    const y = flat ? 1.0 : e.flying ? e.y : Math.min(e.hitHi * 0.7, 2.4);
    const dist = Math.max(2, Math.hypot(player.x - x, player.z - z));
    const b = {
        x, y, z, vx: Math.cos(ang) * spd, vz: Math.sin(ang) * spd, vy: flat ? 0 : (1.0 - y) / (dist / spd),
        life: 4, dmg: e.dmg * (big ? 1.1 : 0.9), sz, color, tracking: !!e.def.tracking, sx: e.x, sz0: e.z,
        mesh: makeOrbMesh(color, sz),
    };
    b.mesh.position.set(x, y, z);
    scene.add(b.mesh);
    ebullets.push(b);
}

function bossAttack(e, ang, dist) {
    let pat = e.def.pat;
    if (pat === 'all') pat = ['radial', 'spray', 'summon', 'stomp'][e.patStep % 4];
    e.patStep++;
    if (pat === 'radial') {
        const n = 12, off = e.patStep * 0.26;
        for (let k = 0; k < n; k++) shoot(e, off + k / n * 6.283, true, true);
    } else if (pat === 'spray') {
        for (let k = -2; k <= 2; k++) shoot(e, ang + k * 0.16, true);
    } else if (pat === 'stomp' && dist < 10) {
        particles.ring(e.x, e.z, e.def.eye, 8, 0.5);
        particles.smokePuff(e.x, 0.3, e.z, 14, 0x3a302a, 1.6);
        audio.stomp(); fx.addShake(0.8);
        if (dist < 7.5) damagePlayer(e.dmg * 1.3, e.x, e.z);
    } else if (pat === 'blink') {
        particles.smokePuff(e.x, 1.2, e.z, 14, 0x6a2020, 1.4);
        for (let i = 0; i < 12; i++) {
            const a = Math.random() * 6.28, d = 6 + Math.random() * 4;
            const x = player.x + Math.cos(a) * d, z = player.z + Math.sin(a) * d;
            if (!arena.pointInWall(x, z, e.r + 0.3)) { e.x = x; e.z = z; break; }
        }
        particles.smokePuff(e.x, 1.2, e.z, 14, 0x6a2020, 1.4);
        particles.ring(e.x, e.z, e.def.eye, 4, 0.4);
        const a2 = Math.atan2(player.z - e.z, player.x - e.x);
        for (let k = -1; k <= 1; k++) shoot(e, a2 + k * 0.2, true);
    } else if (pat === 'summon' && aliveCount() < MAX_ALIVE - 2) {
        for (let i = 0; i < 2; i++) {
            const a = Math.random() * 6.28;
            const p = { x: e.x + Math.cos(a) * (e.r + 1.5), z: e.z + Math.sin(a) * (e.r + 1.5) };
            if (!arena.pointInWall(p.x, p.z, 0.8)) spawnEnemy(EDEF[e.def.dI] || EDEF.imp, false, p);
        }
    } else {
        for (let k = -1; k <= 1; k++) shoot(e, ang + k * 0.12, true);
    }
    audio.enemyShot(e.x, e.z, player);
}

function updateEnemies(dt) {
    // Separation so the horde does not stack into one blob
    for (let i = 0; i < enemies.length; i++) {
        const a = enemies[i];
        if (a.hp <= 0) continue;
        for (let j = i + 1; j < enemies.length; j++) {
            const b = enemies[j];
            if (b.hp <= 0 || a.flying !== b.flying) continue;
            const dx = b.x - a.x, dz = b.z - a.z, min = a.r + b.r, d2 = dx * dx + dz * dz;
            if (d2 < min * min && d2 > 0.0001) {
                const d = Math.sqrt(d2), push = (min - d) * 0.5;
                const wa = a.isBoss ? 0 : b.isBoss ? 1 : 0.5;
                a.x -= dx / d * push * wa * 2; a.z -= dz / d * push * wa * 2;
                b.x += dx / d * push * (1 - wa) * 2; b.z += dz / d * push * (1 - wa) * 2;
            }
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i], m = e.mesh;

        if (e.deathT >= 0) {
            e.deathT += dt;
            const t = e.deathT;
            if (e.gib || t > 1.1) {
                scene.remove(m); disposeEnemyMesh(m);
                enemies.splice(i, 1);
                continue;
            }
            if (e.flying) { e.y = Math.max(e.r * 0.6, e.y - 9 * t * dt * 3); m.rotation.z += dt * 6; }
            else m.rotation.x = -Math.min(1, t / 0.3) * 1.45;
            m.position.set(e.x, e.y - Math.max(0, t - 0.6) * 1.2, e.z);
            m.scale.setScalar(e.scale0 * (1 - Math.max(0, t - 0.7) / 0.4 * 0.6));
            continue;
        }

        e.t += dt; e.age += dt;
        if (e.age < 0.4) m.scale.setScalar(e.scale0 * Math.min(1, 0.05 + e.age / 0.4));
        else if (e.age < 0.6) m.scale.setScalar(e.scale0);

        // Hit flash: whole body goes white for a few frames
        if (e.hurtT > 0) {
            e.hurtT -= dt;
            if (!e.flashed) { e.flashed = true; for (const f of m.userData.flash) { f.m.emissive.setHex(0xffffff); f.m.emissiveIntensity = 0.9; } }
        } else if (e.flashed) {
            e.flashed = false;
            for (const f of m.userData.flash) { f.m.emissive.setHex(f.hex); f.m.emissiveIntensity = f.i; }
        }

        const dx = player.x - e.x, dz = player.z - e.z;
        const dist = Math.hypot(dx, dz) || 0.001;
        const ang = Math.atan2(dz, dx);
        let mx = dx / dist, mz = dz / dist, speed = e.spd;

        e.losT -= dt;
        if (e.losT <= 0) { e.losT = 0.2; e.los = arena.hasLineOfSight(e, player); }

        if (e.windT > 0) {            // charge telegraph
            e.windT -= dt; speed = 0;
            if (e.windT <= 0) e.chargeT = 0.75;
        } else if (e.chargeT > 0) {   // charging
            e.chargeT -= dt; mx = e.cx; mz = e.cz; speed = e.spd * 3.2;
        } else {
            if (e.charger) {
                e.chargeCd -= dt;
                if (e.chargeCd <= 0 && dist > 4 && dist < 15 && e.los) {
                    e.chargeCd = 3 + Math.random() * 2.5; e.windT = 0.4; e.cx = mx; e.cz = mz;
                    audio.growl(e.x, e.z, player);
                }
            }
            if (e.ranged && !e.isBoss && e.los) { // hold range and strafe instead of walking into the gun
                if (dist < 6) { mx = -mx; mz = -mz; speed *= 0.7; }
                else if (dist < 13) { const tx = -mz * e.strafe, tz = mx * e.strafe; mx = tx; mz = tz; speed *= 0.6; if (Math.random() < dt * 0.4) e.strafe = -e.strafe; }
            }
        }
        e.x += (mx * speed + e.kx) * dt;
        e.z += (mz * speed + e.kz) * dt;
        const damp = Math.exp(-7 * dt);
        e.kx *= damp; e.kz *= damp;

        const minD = e.r + player.r;
        const d2 = Math.hypot(player.x - e.x, player.z - e.z) || 0.001;
        if (d2 < minD && !e.flying) { e.x = player.x - (player.x - e.x) / d2 * minD; e.z = player.z - (player.z - e.z) / d2 * minD; }
        arena.collideCircle(e);

        if (e.flying) e.y = e.baseY + Math.sin(e.t * 2.2) * 0.18;
        e.lunge = Math.max(0, e.lunge - dt * 4);
        m.position.set(e.x + Math.cos(ang) * e.lunge * 0.5, e.y, e.z + Math.sin(ang) * e.lunge * 0.5);
        m.rotation.y = -ang + Math.PI / 2;
        m.rotation.x = e.windT > 0 ? -0.25 : e.chargeT > 0 ? 0.3 : e.lunge * 0.5;

        const legs = m.userData.legs, arms = m.userData.arms, gait = e.t * (5 + speed);
        if (speed > 0) for (let j = 0; j < legs.length; j++) legs[j].rotation.x = Math.sin(gait + j * Math.PI) * 0.5;
        for (let j = 0; j < arms.length; j++) arms[j].rotation.x = e.lunge > 0 ? -1.6 * e.lunge : e.windT > 0 ? 0.9 : Math.sin(gait + (j + 1) * Math.PI) * 0.35 - 0.15;
        const eye = m.userData.eyeMat;
        if (eye && !e.flashed) eye.emissiveIntensity = e.windT > 0 ? 7 : 2.6 + Math.sin(e.t * 5) * 0.6;

        // Melee: a real swing on a cooldown
        e.atkT -= dt;
        if (d2 < minD + 0.55 && e.atkT <= 0) {
            e.atkT = e.chargeT > 0 ? 1.2 : 0.85;
            e.lunge = 1;
            damagePlayer(e.dmg * (e.chargeT > 0 ? 1.5 : 1), e.x, e.z);
            e.chargeT = 0;
            if (state !== 'play') return;
        }

        if (e.isBoss) {
            e.fireT -= dt;
            if (e.fireT <= 0 && e.windT <= 0 && e.chargeT <= 0) { e.fireT = e.def.fRate * 1.6; bossAttack(e, ang, dist); }
        } else if (e.ranged && e.los && dist < 26 && dist > 2.5) {
            e.fireT -= dt;
            if (e.fireT <= 0) { e.fireT = e.def.fRate * (1.1 + Math.random() * 0.5); shoot(e, ang, false); audio.enemyShot(e.x, e.z, player); }
        }

        e.growlT -= dt;
        if (e.growlT <= 0) { e.growlT = 4 + Math.random() * 7; if (dist < 22) audio.growl(e.x, e.z, player); }
    }
    if (boss) hud.setBoss(boss.def.name, boss.hp / boss.maxHp);
}

function updateEBullets(dt) {
    for (let i = ebullets.length - 1; i >= 0; i--) {
        const b = ebullets[i];
        if (b.tracking) {
            const dx = player.x - b.x, dz = player.z - b.z, d = Math.hypot(dx, dz) || 1;
            b.vx += dx / d * 14 * dt; b.vz += dz / d * 14 * dt;
            const sp = Math.hypot(b.vx, b.vz);
            if (sp > 12) { b.vx *= 12 / sp; b.vz *= 12 / sp; }
        }
        if ((b.tick = (b.tick || 0) + 1) % 2 === 0) particles.trail(b.x, b.y, b.z, b.color, b.sz * 0.9, 0.22);
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        if (b.y < 1.0 && b.vy < 0) { b.y = 1.0; b.vy = 0; }
        b.life -= dt;
        b.mesh.position.set(b.x, b.y, b.z);
        let dead = b.life <= 0;
        if (!dead && arena.pointInWall(b.x, b.z, b.sz * 0.5)) { dead = true; particles.hitSpark(b.x, b.y, b.z, 4, b.color, 0.6); }
        if (!dead) {
            const dx = player.x - b.x, dz = player.z - b.z, rr = player.r + b.sz;
            if (dx * dx + dz * dz < rr * rr && Math.abs(b.y - 1.0) < 1.1) {
                dead = true;
                if (player.inv <= 0) { damagePlayer(b.dmg, b.sx, b.sz0); particles.hitSpark(b.x, b.y, b.z, 6, b.color, 0.8); }
                else dead = false; // dashing through a projectile
            }
        }
        if (dead) { scene.remove(b.mesh); ebullets.splice(i, 1); }
    }
}

// ---------------------------------------------------------------- pickups
function spawnWeaponPickup() {
    const k = nextLockedWeapon();
    if (!k) return;
    const pos = arena.randomOpenSpot(player, 9);
    const g = new THREE.Group();
    const model = buildWeaponModel(k);
    model.scale.setScalar(2.2);
    g.add(model);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.35, 7, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(WEAP[k].color).multiplyScalar(1.4), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 2.3;
    g.add(beam);
    g.position.set(pos.x, 1.1, pos.z);
    scene.add(g);
    pickups.push({ type: 'weapon', k, x: pos.x, z: pos.z, mesh: g, model, beam, t: 0, life: Infinity });
}
function spawnDrop(type, x, z) {
    const mesh = makeOrbMesh(type === 'health' ? 0xff3048 : 0x40a0ff, 0.2);
    mesh.position.set(x, 0.5, z);
    scene.add(mesh);
    pickups.push({ type, x, z, mesh, t: Math.random() * 6, life: 14 });
}
function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        p.t += dt; p.life -= dt;
        const dx = player.x - p.x, dz = player.z - p.z, d = Math.hypot(dx, dz) || 0.001;
        if (p.type === 'weapon') {
            p.model.rotation.y += dt * 2;
            p.mesh.position.y = 1.1 + Math.sin(p.t * 2.5) * 0.15;
            p.beam.material.opacity = 0.28 + Math.sin(p.t * 4) * 0.1;
        } else {
            if (d < 3.5) { p.x += dx / d * 9 * dt; p.z += dz / d * 9 * dt; } // magnet
            p.mesh.position.set(p.x, 0.5 + Math.sin(p.t * 4) * 0.12, p.z);
            p.mesh.scale.setScalar(p.life < 3 ? 0.2 * (0.5 + 0.5 * Math.sin(p.t * 20)) + 0.05 : 0.2);
        }
        if (d < 1.2) {
            if (p.type === 'weapon') grantWeapon(p.k);
            else if (p.type === 'health') { player.heal(15); audio.pickup(); fx.screenFlash('rgba(255,60,80,0.14)'); }
            else { player.armor = Math.min(player.maxArmor, player.armor + 20); audio.pickup(); fx.screenFlash('rgba(60,150,255,0.14)'); }
            removePickupAt(i);
        } else if (p.life <= 0) removePickupAt(i);
    }
}

// ---------------------------------------------------------------- player
function damagePlayer(amount, sx, sz) {
    if (state !== 'play' || player.inv > 0) return;
    const died = player.damage(amount);
    fx.damage(amount / 40);
    fx.addShake(Math.min(0.6, 0.15 + amount / 40));
    fx.damageArc(Math.atan2(sz - player.z, sx - player.x) - player.angle);
    audio.hurt();
    combo = 0;
    if (died) die();
}

function updatePlayer(dt) {
    const mv = input.getMove();
    player.strafe = mv.str;
    const ca = Math.cos(player.angle), sa = Math.sin(player.angle);
    player.dashCd -= dt;
    if (input.wantsDash() && player.dashCd <= 0 && player.dashT <= 0) {
        const f = mv.fwd || mv.str ? mv.fwd : 1, s = mv.str;
        const l = Math.hypot(f, s);
        player.dashX = (ca * f - sa * s) / l; player.dashZ = (sa * f + ca * s) / l;
        player.dashT = 0.16; player.dashCd = 0.9;
        player.inv = Math.max(player.inv, 0.24);
        audio.dash();
        particles.smokePuff(player.x, 0.3, player.z, 6, 0x807870, 0.8);
    }
    let vx, vz;
    if (player.dashT > 0) {
        player.dashT -= dt;
        vx = player.dashX * 30; vz = player.dashZ * 30;
        if (player.dashT <= 0) fx.addJolt(0.3);
    } else {
        vx = (ca * mv.fwd - sa * mv.str) * player.spd;
        vz = (sa * mv.fwd + ca * mv.str) * player.spd;
    }
    const steps = player.dashT > 0 ? 2 : 1;
    for (let i = 0; i < steps; i++) {
        player.x += vx * dt / steps; player.z += vz * dt / steps;
        arena.collideCircle(player);
    }
    if (player.inv > 0) player.inv -= dt;
    if (player.hurtT > 0) player.hurtT -= dt;
    if (player.reloading) {
        player.reloadT -= dt;
        if (player.reloadT <= 0) { player.reloading = false; player.ammo[player.wep] = player.ammoMax[player.wep]; audio.reload(); }
    }
    player.lookDx = input.lookDx; player.lookDy = input.lookDy;
    return Math.abs(mv.fwd) + Math.abs(mv.str) > 0.05;
}

function updateCombo(dt) {
    if (combo > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
    hud.setCombo(combo >= 3 ? `x${(1 + Math.min(4, combo * 0.1)).toFixed(1)} · ${combo} KILLS` : '');
}

// ---------------------------------------------------------------- UI wiring
tap($('start-btn'), () => startGame());
tap($('start-perf'), () => setPerf(!perf));
tap($('opt-perf'), () => setPerf(!perf));
tap($('resume-btn'), () => { if (paused) togglePause(); });
tap($('go-restart'), () => restart());
tap($('go-save'), () => saveScore());
const setVol = d => { audio.setVolume(Math.max(0, Math.min(1, audio.volume + d))); $('opt-vol').textContent = Math.round(audio.volume * 100) + '%'; };
tap($('opt-vol-down'), () => setVol(-0.1));
tap($('opt-vol-up'), () => setVol(0.1));
$('go-input').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') saveScore(); });
$('pause-controls').innerHTML = isMobile
    ? 'Esquerda: joystick · Direita: arrasta pra olhar<br>FIRE / DASH / ↻ recarregar / ◀ ▶ armas'
    : '<span class="hl">WASD</span> mover · <span class="hl">MOUSE</span> olhar · <span class="hl">CLICK</span> atirar<br><span class="hl">1-9</span> / <span class="hl">Q E</span> / <span class="hl">SCROLL</span> armas · <span class="hl">SHIFT</span> dash · <span class="hl">R</span> recarregar';
$('start-perf').textContent = 'MODO LEVE: ' + (perf ? 'ON' : 'OFF');
$('start-perf').classList.toggle('on', perf);
$('opt-perf').classList.toggle('on', perf);

addEventListener('resize', () => { renderer.onResize(); sizeTitle(); });
addEventListener('orientationchange', () => setTimeout(() => { renderer.onResize(); sizeTitle(); }, 250));
document.addEventListener('visibilitychange', () => { if (document.hidden && canPlay()) togglePause(); });

// ---------------------------------------------------------------- main loop
let last = performance.now(), fpsEma = 60, slowFor = 0, autoPerfDone = perf;
boot(100, 'READY');
setTimeout(() => { $('boot').style.display = 'none'; }, 250);

function tick(dt, raw, now) {
    const active = (state === 'play' || state === 'dying') && !paused && !upgrading;
    const sdt = dt * fx.timeScale;
    let moving = false;

    if (active) {
        if (state === 'play') { gameTime += dt; moving = updatePlayer(sdt); }
        else {
            dyingT += dt;
            player.cameraHeight += (0.35 - player.cameraHeight) * Math.min(1, dt * 3);
            player.deathRoll += (0.55 - player.deathRoll) * Math.min(1, dt * 3);
            if (dyingT > 1.5) gameOver();
        }
    }
    fx.update(dt, player, { moving, dashing: active && player.dashT > 0 });

    if (active) {
        sndHit -= dt; sndRic -= dt; sndSpawn -= dt;
        if (state === 'play') tryFire(sdt);
        updateBullets(sdt);
        updateEnemies(sdt);
        updateEBullets(sdt);
        updatePickups(sdt);
        updateZones(sdt);
        for (let i = timers.length - 1; i >= 0; i--) {
            timers[i].t -= dt;
            if (timers[i].t <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); }
        }
        tickWave(sdt);
        updateCombo(dt);
        hud.update(dt, { pl: player, wave: waveNum, score, kills, hi: hiScore, time: gameTime, left: toSpawn + aliveCount() });
        weaponView.update(sdt, { firing: input.isFiring() && !player.reloading, swayX: fx.swayX, swayY: fx.swayY, reloading: player.reloading });

        // Auto fallback: sustained low frame rate switches the light mode on once
        fpsEma += (1 / Math.max(raw, 0.001) - fpsEma) * 0.05;
        if (!autoPerfDone && !DEBUG && gameTime > 6) {
            slowFor = fpsEma < 34 ? slowFor + dt : 0;
            if (slowFor > 3) { autoPerfDone = true; setPerf(true); fx.announce('MODO LEVE ATIVADO', 'fps baixo detectado', 1800); }
        }
    }
    if (!paused && state !== 'menu') {
        arena.update(dt, now * 0.001);
        particles.update(active ? sdt : dt);
        updateLights(dt);
    }
    input.tick();
}

const NORENDER = DEBUG && new URLSearchParams(location.search).has('norender');
let simNow = 0;
function loop(now) {
    requestAnimationFrame(loop);
    const raw = (now - last) / 1000;
    last = now;
    if (NORENDER) return; // tests drive the simulation through __doom.step()
    tick(Math.min(0.05, raw), raw, now);
    if (state === 'menu') drawTitle(Math.min(0.05, raw)); else renderer.render(raw);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------- debug hooks (?debug)
if (DEBUG) {
    window.__doom = {
        player, enemies, bullets, ebullets, pickups, arena, renderer, fx, input,
        get info() { return { state, phase, paused, upgrading, waveNum, score, kills, toSpawn, alive: aliveCount(), hp: player.hp, fps: Math.round(fpsEma), boss: boss && boss.def.name, wep: player.wep }; },
        look(angle, pitch = 0) { player.angle = angle; player.pitch = pitch; },
        killAll() { for (const e of [...enemies]) if (e.hp > 0) damageEnemy(e, 1e6, e.x, e.y + 1, e.z, 0, 0, 0, false); toSpawn = 0; },
        setWave(n) { clearWorld(); waveNum = n - 1; upgrading = false; $('upgrade-screen').classList.remove('on'); beginWave(true); },
        give(k) { if (k) grantWeapon(k); else for (let i = 2; i <= WC; i++) { player.unlocked[i] = true; } },
        god(on = true) { player.maxHp = on ? 1e6 : 100; player.hp = player.maxHp; },
        spawn(type, x, z) { return spawnEnemy(EDEF[type], false, { x, z }); },
        hurt(n) { damagePlayer(n, player.x + 1, player.z); },
        setPerf,
        sandbox() { clearWorld(); if (arena.mazeMesh) arena.mazeMesh.visible = false; arena.trimMesh.visible = false; arena.innerWalls.length = 0; phase = 'sandbox'; toSpawn = 0; upgrading = false; $('upgrade-screen').classList.remove('on'); player.x = 0; player.z = 0; },
        step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { simNow += dt * 1000; tick(dt, dt, simNow); } },
        render() { renderer.render(0.016); },
    };
}
