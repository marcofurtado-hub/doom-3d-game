import * as THREE from 'three';
import { P, box, cone, cyl, ball, merge, both } from './geo.js';
import { asset, ATLAS } from './textures.js';

// Weapon definitions + first-person weapon meshes + firing mechanics.

export const WEAP = {
    1: { name: 'PISTOL', rate: 0.17, dmg: 22, spd: 36, spread: 0.012, count: 1, sz: 0.1, color: 0xffd040, sfx: 'shoot', maxAmmo: Infinity, ric: 3, recoil: 0.035, shake: 0.12, knock: 1.5, flash: 0.1 },
    2: { name: 'SHOTGUN', rate: 0.55, dmg: 13, spd: 32, spread: 0.085, count: 9, sz: 0.07, color: 0xffa040, sfx: 'shotgun', maxAmmo: 24, rTime: 1.0, ric: 1, recoil: 0.11, shake: 0.5, knock: 1.6, flash: 0.2, shell: 0xc03020 },
    3: { name: 'CHAINGUN', rate: 0.055, dmg: 13, spd: 40, spread: 0.035, count: 1, sz: 0.085, color: 0xffe060, sfx: 'chain', maxAmmo: 150, rTime: 1.2, ric: 2, recoil: 0.014, shake: 0.1, knock: 0.6, flash: 0.11, spinup: true, shell: 0xd0a040 },
    4: { name: 'ROCKET', rate: 0.8, dmg: 130, spd: 26, spread: 0.004, count: 1, sz: 0.16, color: 0xff5a20, sfx: 'rocket', maxAmmo: 12, rTime: 1.5, ric: 0, recoil: 0.14, shake: 0.5, expl: true, blast: 6.5, knock: 9, flash: 0.22, trail: 'rocket' },
    5: { name: 'PLASMA', rate: 0.085, dmg: 24, spd: 42, spread: 0.02, count: 1, sz: 0.13, color: 0x40d8ff, sfx: 'plasma', maxAmmo: 80, rTime: 1.1, ric: 4, recoil: 0.018, shake: 0.08, knock: 0.8, flash: 0.13, trail: 'plasma' },
    6: { name: 'BOMB', rate: 0.9, dmg: 220, spd: 19, spread: 0.01, count: 1, sz: 0.2, color: 0xffd040, sfx: 'bomb', maxAmmo: 6, rTime: 1.6, ric: 0, recoil: 0.15, shake: 0.4, expl: true, blast: 6, knock: 10, flash: 0.16, trail: 'bomb', grav: 14, loft: 4 },
    7: { name: 'MOLOTOV', rate: 0.8, dmg: 60, spd: 18, spread: 0.01, count: 1, sz: 0.15, color: 0xff7a20, sfx: 'molotov', maxAmmo: 8, rTime: 1.3, ric: 0, recoil: 0.1, shake: 0.2, fire: true, blast: 4, knock: 2, flash: 0, trail: 'fire', grav: 14, loft: 4.5 },
    8: { name: 'LASER', rate: 0.03, dmg: 9, spd: 60, spread: 0.004, count: 1, sz: 0.07, color: 0xff2030, sfx: 'laser', maxAmmo: 200, rTime: 0.9, ric: 6, recoil: 0.005, shake: 0.03, knock: 0.2, flash: 0.07, trail: 'laser' },
    9: { name: 'B.F.G.', rate: 1.8, dmg: 700, spd: 17, spread: 0.002, count: 1, sz: 0.45, color: 0x70ff40, sfx: 'bfg', maxAmmo: 3, rTime: 2.4, ric: 0, recoil: 0.25, shake: 0.9, expl: true, blast: 12, knock: 16, flash: 0.35, trail: 'bfg' },
};
export const WC = 9;

// ===== WEAPON MODELS =====
// Same kit as the enemies: primitives merged per material, so a gun is 3-5 draw calls.
// Guns point down -Z; userData.muzzle is the barrel tip in model space.

function mats(tint, glowColor) {
    return {
        metal: new THREE.MeshLambertMaterial({ color: tint, flatShading: true }),
        dark: new THREE.MeshLambertMaterial({ color: 0x3c3e46, flatShading: true }),
        wood: new THREE.MeshLambertMaterial({ color: 0x7a4a26, flatShading: true }),
        glow: new THREE.MeshLambertMaterial({ color: 0x000000, emissive: glowColor, emissiveIntensity: 1, flatShading: true }),
    };
}
function assemble(parts, tint, glowColor, muzzle, glowAnim = null) {
    const m = mats(tint, glowColor), g = new THREE.Group();
    for (const k of ['metal', 'dark', 'wood', 'glow']) {
        if (parts[k] && parts[k].length) g.add(new THREE.Mesh(merge(parts[k]), m[k])); else m[k].dispose();
    }
    g.userData.muzzle = new THREE.Vector3(...muzzle);
    if (glowAnim) { g.userData.glow = m.glow; g.userData.glowAnim = glowAnim; }
    g.userData.m = m;
    return g;
}
const H = Math.PI / 2;
const grip = (z = 0.08, y = -0.14) => P(box(0.075, 0.2, 0.095), 0, y, z, 0.28);

const WEAP_BUILDERS = {
    1: () => assemble({
        metal: [P(box(0.085, 0.08, 0.36), 0, 0.07, -0.03), P(box(0.02, 0.022, 0.02), 0, 0.12, -0.19), P(box(0.05, 0.02, 0.02), 0, 0.12, 0.12)],
        dark: [P(box(0.08, 0.07, 0.26), 0, 0.0, 0.02), P(cyl(0.024, 0.024, 0.05, 8), 0, 0.072, -0.22, H), P(box(0.02, 0.02, 0.1), 0, -0.055, -0.03), P(box(0.02, 0.06, 0.02), 0, -0.04, 0.0)],
        wood: [grip(0.1, -0.13)],
    }, 0x6a6e78, 0xffd040, [0, 0.072, -0.25]),

    2: () => assemble({
        metal: [P(box(0.1, 0.13, 0.36), 0, 0.0, 0.04), P(box(0.02, 0.016, 0.62), 0, 0.085, -0.42)],
        dark: [...both(s => P(cyl(0.036, 0.036, 0.64, 8), s * 0.037, 0.035, -0.44, H)), P(box(0.02, 0.07, 0.02), 0, -0.07, 0.02), P(box(0.02, 0.02, 0.12), 0, -0.1, 0.0)],
        wood: [P(box(0.13, 0.075, 0.22), 0, -0.035, -0.34), P(box(0.08, 0.13, 0.34), 0, -0.05, 0.36, -0.16), grip(0.14, -0.13)],
    }, 0x70747c, 0xffa040, [0, 0.035, -0.77]),

    3: () => {
        const g = assemble({
            metal: [P(box(0.17, 0.17, 0.32), 0, 0, 0.06), P(cyl(0.1, 0.1, 0.06, 10), 0, 0, -0.12, H), P(box(0.035, 0.05, 0.22), 0, 0.14, 0.02), P(box(0.035, 0.07, 0.035), 0, 0.11, -0.07), P(box(0.035, 0.07, 0.035), 0, 0.11, 0.11)],
            dark: [P(cyl(0.11, 0.11, 0.14, 10), -0.15, -0.05, 0.08, 0, 0, H), grip(0.12, -0.17)],
            glow: [P(box(0.03, 0.012, 0.08), 0.087, 0.04, 0.05)],
        }, 0x7c7468, 0xffe060, [0, 0, -0.72]);
        const barrels = [];
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; barrels.push(P(cyl(0.021, 0.021, 0.54, 6), Math.cos(a) * 0.06, Math.sin(a) * 0.06, -0.27, H)); }
        barrels.push(P(cyl(0.088, 0.088, 0.03, 10), 0, 0, -0.5, H), P(cyl(0.088, 0.088, 0.03, 10), 0, 0, -0.2, H), P(cyl(0.03, 0.03, 0.54, 6), 0, 0, -0.27, H));
        const cluster = new THREE.Mesh(merge(barrels), g.userData.m.dark);
        cluster.position.z = -0.16;
        g.add(cluster);
        g.userData.cluster = cluster;
        return g;
    },

    4: () => assemble({
        metal: [P(cyl(0.085, 0.085, 0.84, 10), 0, 0, -0.2, H), P(cyl(0.085, 0.115, 0.1, 10), 0, 0, -0.66, H), P(cyl(0.11, 0.085, 0.1, 10), 0, 0, 0.25, H)],
        dark: [P(box(0.04, 0.05, 0.2), 0.075, 0.115, -0.12), P(box(0.07, 0.05, 0.3), 0, -0.1, -0.1), grip(0.02, -0.19), grip(-0.26, -0.19), P(cyl(0.09, 0.09, 0.04, 10), 0, 0, -0.4, H)],
        glow: [P(cone(0.055, 0.14, 8), 0, 0, -0.68, -H), P(box(0.012, 0.012, 0.1), 0.075, 0.145, -0.12)],
    }, 0x66704a, 0xff5a20, [0, 0, -0.74]),

    5: () => assemble({
        metal: [P(box(0.12, 0.15, 0.42), 0, 0, 0.02), P(box(0.14, 0.04, 0.2), 0, 0.09, 0.06)],
        dark: [P(cyl(0.04, 0.04, 0.42, 8), 0, 0.01, -0.36, H), P(cone(0.06, 0.1, 8), 0, 0.01, -0.6, H), grip(0.1, -0.16), ...both(s => P(box(0.012, 0.08, 0.3), s * 0.066, 0, 0.0))],
        glow: [-0.24, -0.34, -0.44].map(z => P(cyl(0.07, 0.07, 0.03, 10), 0, 0.01, z, H)).concat([P(box(0.06, 0.012, 0.14), 0, 0.112, 0.06)]),
    }, 0x48607a, 0x40d8ff, [0, 0.01, -0.64], { base: 0.8, amp: 0.2, speed: 0.01, fire: 0.4 }),

    6: () => assemble({
        metal: [P(cyl(0.12, 0.12, 0.2, 8), 0, 0, -0.02, H), P(box(0.07, 0.1, 0.24), 0, 0, 0.2)],
        dark: [P(cyl(0.065, 0.075, 0.4, 8), 0, 0.02, -0.3, H), P(cyl(0.085, 0.085, 0.04, 8), 0, 0.02, -0.5, H), grip(0.2, -0.15), grip(-0.2, -0.14)],
        wood: [P(box(0.07, 0.12, 0.26), 0, -0.03, 0.42, -0.14)],
        glow: [0, 1, 2, 3].map(i => P(ball(0.014, 0), Math.cos(i * 1.57 + 0.78) * 0.123, Math.sin(i * 1.57 + 0.78) * 0.123, -0.02)),
    }, 0x7a6a44, 0xffd040, [0, 0.02, -0.54]),

    7: () => {
        const g = assemble({
            wood: [P(box(0.1, 0.1, 0.13), 0, -0.1, -0.06), P(cyl(0.045, 0.05, 0.3, 6), 0, -0.2, 0.1, 0.9)],
            dark: [P(cyl(0.024, 0.03, 0.08, 8), 0, 0.2, -0.1)],
            glow: [P(cone(0.035, 0.13, 5), 0, 0.3, -0.1), P(cone(0.02, 0.08, 4), 0.02, 0.33, -0.08, 0, 0, -0.3)],
        }, 0x808080, 0xff7a20, [0, 0.28, -0.14], { base: 0.8, amp: 0.2, speed: 0.03, fire: 0 });
        const bottle = new THREE.Mesh(merge([P(cyl(0.055, 0.062, 0.24, 8), 0, 0.05, -0.1), P(cone(0.055, 0.05, 8), 0, 0.19, -0.1)]),
            new THREE.MeshLambertMaterial({ color: 0x4a9a50, emissive: 0x7a3a08, emissiveIntensity: 0.5, flatShading: true }));
        g.add(bottle);
        return g;
    },

    8: () => assemble({
        metal: [P(box(0.075, 0.1, 0.38), 0, 0, 0.02), P(box(0.05, 0.03, 0.12), 0, 0.075, 0.12)],
        dark: [...both(s => P(box(0.014, 0.03, 0.52), s * 0.048, 0.02, -0.22)), P(cyl(0.03, 0.03, 0.1, 8), 0, 0.0, -0.22, H), grip(0.1, -0.13), P(box(0.1, 0.014, 0.03), 0, 0.02, -0.46)],
        glow: [P(ball(0.028, 1), 0, 0.02, -0.44), P(box(0.02, 0.012, 0.3), 0, 0.058, -0.05), P(box(0.012, 0.012, 0.36), 0, 0.02, -0.26)],
    }, 0x7a4048, 0xff2030, [0, 0.02, -0.5], { base: 0.8, amp: 0.2, speed: 0.02, fire: 0.4 }),

    9: () => assemble({
        metal: [P(cyl(0.15, 0.19, 0.42, 8), 0, 0, 0.08, H), P(cyl(0.17, 0.15, 0.08, 8), 0, 0, -0.16, H), P(box(0.1, 0.06, 0.3), 0, 0.17, 0.08)],
        dark: [
            ...[0.52, 2.62, 4.71].map(a => P(box(0.045, 0.055, 0.42), Math.cos(a) * 0.15, Math.sin(a) * 0.15, -0.34, 0, 0, a)),
            P(cyl(0.2, 0.2, 0.05, 8), 0, 0, 0.3, H), grip(0.12, -0.24), grip(-0.14, -0.22),
        ],
        glow: [P(ball(0.105, 1), 0, 0, -0.3), P(box(0.05, 0.014, 0.2), 0, 0.203, 0.08), ...[0.52, 2.62, 4.71].map(a => P(box(0.016, 0.016, 0.36), Math.cos(a) * 0.118, Math.sin(a) * 0.118, -0.34))],
    }, 0x4a7a4a, 0x70ff40, [0, 0, -0.58], { base: 0.8, amp: 0.2, speed: 0.006, fire: 0.4 }),
};

export function buildWeaponModel(k) { return WEAP_BUILDERS[k](); }

// ===== WEAPON VIEW (first-person) =====
// Child of the camera at half scale and half distance: same on-screen size, but it no longer pokes through walls.
const BASE_LIGHT = 0.5;

export class WeaponView {
    constructor(camera) {
        this.root = new THREE.Group();
        this.root.scale.setScalar(0.5);
        camera.add(this.root);
        this.basePos = new THREE.Vector3(0, -0.125, -0.36);
        // Marine's arms, shared by every gun: gloves on the grip, sleeves running off the bottom of the screen
        const glove = [P(box(0.13, 0.13, 0.15), 0.03, -0.13, 0.12), P(box(0.13, 0.11, 0.14), -0.08, -0.17, 0.06, 0, 0.3, 0)];
        const sleeve = [P(box(0.13, 0.13, 0.7), 0.2, -0.3, 0.44, 0.45, 0.45, 0), P(box(0.13, 0.13, 0.7), -0.25, -0.34, 0.38, 0.45, -0.45, 0)];
        this.root.add(new THREE.Mesh(merge(glove), new THREE.MeshLambertMaterial({ color: 0x5a4630, flatShading: true })));
        this.root.add(new THREE.Mesh(merge(sleeve), new THREE.MeshLambertMaterial({ color: 0x4a7a3a, flatShading: true })));
        this.cache = {};
        this.current = null;
        this.currentKey = 0;
        this.kick = 0; this.raise = 0; this.dip = 0;
        this.spin = 0; this.spinup = 0;
        this.flashT = 0; this.flashSize = 0.1;

        this.flash = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0),
            new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.flash.visible = false;

        // Fill light (PBR gun needs a direct light in dark biomes); doubles as the muzzle flash light.
        this.light = new THREE.PointLight(0xfff0d8, BASE_LIGHT, 9, 2);
        this.light.position.set(0.2, 0.35, 0.25);
        camera.add(this.light);
        this._base = new THREE.Color(0xfff0d8);

        // Painted first-person sprites (currently the pistol): a flat card in front of the camera, drawn last
        this.card = new THREE.Group();
        this.cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, depthTest: false, depthWrite: false, fog: false }));
        this.cardMesh.renderOrder = 999;
        this.cardMuzzle = new THREE.Object3D();
        this.card.add(this.cardMesh, this.cardMuzzle);
        this.card.visible = false;
        camera.add(this.card);
        this.cardOn = false;
        this._flashCol = new THREE.Color();
    }

    setWeapon(k) {
        if (this.currentKey === k) return;
        if (this.current) this.root.remove(this.current);
        if (!this.cache[k]) this.cache[k] = WEAP_BUILDERS[k]();
        this.current = this.cache[k];
        this.root.add(this.current);
        this.current.add(this.flash);
        this.flash.position.copy(this.current.userData.muzzle);
        this.flash.visible = false;
        this.currentKey = k;
        this.spin = 0; this.spinup = 0; this.raise = 1; this.kick = 0;
        const tex = asset('wep' + k);
        this.cardOn = !!tex;
        this.card.visible = this.cardOn;
        this.root.visible = !this.cardOn;
        if (tex) {
            const info = ATLAS['wep' + k], H = 0.4 * (info.h / 160);
            tex.repeat.set(1 / info.frames, 1);
            this.cardMesh.material.map = tex;
            this.cardMesh.material.needsUpdate = true;
            this.cardMesh.scale.set(H * info.w / info.h, H, 1);
            this.cardMuzzle.position.set(0, H * 0.3, 0);
            this.cardY = -0.45 + H / 2;
            this.cardFrames = info.frames;
        }
    }

    fire(def) {
        this.kick = Math.min(1, this.kick + def.recoil * 4);
        if (def.flash > 0) {
            this.flashT = this.cardOn ? 0.08 : 0.055;
            this.flashSize = def.flash;
            this.flash.material.color.set(def.color);
            this.flash.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
            this._flashCol.set(def.color);
        }
    }

    update(dt, { firing, swayX, swayY, reloading }) {
        if (!this.current) return;
        this.kick += (0 - this.kick) * Math.min(1, dt * 11);
        this.raise = Math.max(0, this.raise - dt * 5);
        this.dip += ((reloading ? 1 : 0) - this.dip) * Math.min(1, dt * 9);

        this.root.position.set(
            this.basePos.x + swayX,
            this.basePos.y + swayY - this.raise * 0.25 - this.dip * 0.1,
            this.basePos.z + this.kick * 0.07);
        this.root.rotation.set(0.2 + swayY * 1.5 + this.kick * 0.3 - this.raise * 0.9 - this.dip * 0.5, -swayX * 1.5, this.dip * 0.5);

        if (this.cardOn) {
            // bottom edge sits just under the view; same sway, kick, raise and reload dip as the 3D guns
            this.card.position.set(swayX * 2.2, this.cardY + swayY * 2.2 + this.kick * 0.04 - this.raise * 0.35 - this.dip * 0.16, -0.5);
            this.cardMesh.material.map.offset.x = this.flashT > 0 ? 1 / this.cardFrames : 0;
        }
        if (this.flashT > 0) {
            this.flashT -= dt;
            const f = Math.max(0, this.flashT / 0.055);
            this.flash.visible = true;
            this.flash.scale.setScalar(this.flashSize * (1.5 - 0.6 * f));
            this.flash.material.opacity = f;
            this.light.color.copy(this._flashCol);
            this.light.intensity = BASE_LIGHT + 2.2 * f * (0.5 + this.flashSize * 4);
        } else {
            this.flash.visible = false;
            this.light.color.copy(this._base);
            this.light.intensity = BASE_LIGHT;
        }

        const u = this.current.userData, now = performance.now();
        if (this.currentKey === 3) {
            this.spinup += ((firing ? 1 : 0) - this.spinup) * Math.min(1, dt * 5);
            this.spin += this.spinup * 26 * dt;
            u.cluster.rotation.z = this.spin;
        }
        if (u.glow) { const a = u.glowAnim; u.glow.emissiveIntensity = a.base + Math.sin(now * a.speed) * a.amp + (firing ? a.fire : 0); }
    }

    getMuzzleWorld(out) {
        if (this.cardOn) { this.card.updateWorldMatrix(true, true); return this.cardMuzzle.getWorldPosition(out); }
        this.root.updateWorldMatrix(true, true);
        return this.current.localToWorld(out.copy(this.current.userData.muzzle));
    }
}

// ===== PROJECTILES =====
const _ball = new THREE.SphereGeometry(1, 8, 6);
const _mats = new Map();
export function glowMaterial(color, boost = 2.2) {
    const key = color + ':' + boost;
    if (!_mats.has(key)) _mats.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.25) }));
    return _mats.get(key);
}

// Shared geometry + cached material: nothing to dispose per bullet.
export function makeBulletMesh(def) {
    const m = new THREE.Mesh(_ball, glowMaterial(def.color));
    const s = def.sz;
    if (def.trail === 'laser') m.scale.set(s * 0.6, s * 0.6, s * 6);
    else m.scale.setScalar(s);
    return m;
}
export function makeOrbMesh(color, r) {
    const m = new THREE.Mesh(_ball, glowMaterial(color, 1.5));
    m.scale.setScalar(r);
    return m;
}

export function makeBullet(key, origin, dir, dmgMul = 1) {
    const def = WEAP[key], sp = def.spread;
    let dx = dir.x + (Math.random() - 0.5) * 2 * sp;
    let dy = dir.y + (Math.random() - 0.5) * 1.2 * sp;
    let dz = dir.z + (Math.random() - 0.5) * 2 * sp;
    const l = Math.hypot(dx, dy, dz);
    dx /= l; dy /= l; dz /= l;
    return {
        key, x: origin.x, y: origin.y, z: origin.z,
        vx: dx * def.spd, vy: dy * def.spd + (def.loft || 0), vz: dz * def.spd,
        dmg: def.dmg * dmgMul, sz: def.sz, color: def.color,
        ricLeft: def.ric, life: 2.5,
        expl: !!def.expl, fire: !!def.fire, blast: def.blast || 0,
        trail: def.trail || null, grav: def.grav || 0, knock: def.knock || 0,
        mesh: null, light: null,
    };
}
