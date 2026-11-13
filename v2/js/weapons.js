import * as THREE from 'three';

// Weapon definitions + first-person weapon meshes + firing mechanics.

export const WEAP = {
    1: { name: 'PISTOL', rate: 0.17, dmg: 22, spd: 32, spread: 0.025, count: 1, sz: 0.1, color: 0xe8c020, sfx: 'shoot', maxAmmo: Infinity, ric: 3, recoil: 0.04, shake: 0.08, light: true },
    2: { name: 'SHOTGUN', rate: 0.5, dmg: 15, spd: 28, spread: 0.18, count: 8, sz: 0.09, color: 0xd06020, sfx: 'shotgun', maxAmmo: 28, rTime: 0.9, ric: 1, recoil: 0.14, shake: 0.35, light: true },
    3: { name: 'CHAINGUN', rate: 0.06, dmg: 14, spd: 36, spread: 0.06, count: 1, sz: 0.08, color: 0xe8d040, sfx: 'chain', maxAmmo: 150, rTime: 1.0, ric: 2, recoil: 0.025, shake: 0.06, light: true, spinup: true },
    4: { name: 'ROCKET', rate: 0.75, dmg: 120, spd: 20, spread: 0.01, count: 1, sz: 0.2, color: 0xe03818, sfx: 'rocket', maxAmmo: 12, rTime: 1.4, ric: 0, recoil: 0.2, shake: 0.4, expl: true, blast: 8, light: true, trail: 'rocket' },
    5: { name: 'PLASMA', rate: 0.08, dmg: 24, spd: 38, spread: 0.04, count: 1, sz: 0.14, color: 0x40e8ff, sfx: 'plasma', maxAmmo: 80, rTime: 1.0, ric: 4, recoil: 0.03, shake: 0.08, light: true, trail: 'plasma' },
    6: { name: 'BOMB', rate: 1.0, dmg: 240, spd: 14, spread: 0.02, count: 1, sz: 0.26, color: 0xe8d040, sfx: 'bomb', maxAmmo: 6, rTime: 1.6, ric: 0, recoil: 0.22, shake: 0.4, expl: true, blast: 5.5, light: true, trail: 'bomb' },
    7: { name: 'MOLOTOV', rate: 0.9, dmg: 120, spd: 16, spread: 0.03, count: 1, sz: 0.2, color: 0xff6a20, sfx: 'molotov', maxAmmo: 8, rTime: 1.3, ric: 0, recoil: 0.18, shake: 0.3, fire: true, blast: 3.5, light: true, trail: 'fire' },
    8: { name: 'LASER', rate: 0.025, dmg: 10, spd: 65, spread: 0.008, count: 1, sz: 0.07, color: 0xff2020, sfx: 'laser', maxAmmo: 200, rTime: 0.8, ric: 6, recoil: 0.015, shake: 0.05, light: true, trail: 'laser' },
    9: { name: 'B.F.G.', rate: 2.0, dmg: 650, spd: 14, spread: 0.01, count: 1, sz: 0.5, color: 0x80ff40, sfx: 'bfg', maxAmmo: 3, rTime: 2.4, ric: 0, recoil: 0.3, shake: 0.6, expl: true, blast: 11, light: true, trail: 'bfg' },
};
export const WC = 9;

// ===== WEAPON MESHES =====
// Each builds a Group positioned at camera front with a muzzle tip.

function makeMetal(color = 0x3a3a3a, emissive = 0x000000) {
    // Metalness lowered + emissive bump so weapon reads in dark biomes without env map
    const em = emissive || color;
    return new THREE.MeshStandardMaterial({ color, emissive: em, emissiveIntensity: 0.15, roughness: 0.55, metalness: 0.4 });
}
function makeGrip(color = 0x2a1810) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.1, roughness: 0.85, metalness: 0.0 });
}

function makePistol() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.26), makeMetal(0x383a40));
    body.position.set(0, 0, 0);
    g.add(body);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.3), makeMetal(0x2a2c30));
    slide.position.set(0, 0.07, 0);
    g.add(slide);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.08), makeGrip());
    grip.position.set(0, -0.14, 0.07);
    g.add(grip);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), makeMetal(0x1a1c1e));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.18);
    g.add(barrel);
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.26);
    return g;
}

function makeShotgun() {
    const g = new THREE.Group();
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.3), makeGrip(0x3a2812));
    stock.position.set(0, 0, 0.18);
    g.add(stock);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.42), makeMetal(0x4a3020));
    body.position.set(0, 0, -0.05);
    g.add(body);
    // Barrel over + under
    const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 10), makeMetal(0x1a1a1a));
    bt.rotation.x = Math.PI / 2;
    bt.position.set(0, 0.07, -0.26);
    g.add(bt);
    const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 10), makeMetal(0x1a1a1a));
    bb.rotation.x = Math.PI / 2;
    bb.position.set(0, -0.02, -0.26);
    g.add(bb);
    // Pump
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.12), makeGrip(0x2a1a0a));
    pump.position.set(0, -0.06, -0.14);
    g.add(pump);
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.52);
    g.userData.pump = pump;
    return g;
}

function makeChaingun() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.3), makeMetal(0x4a3030));
    g.add(body);
    // Barrel cluster
    const cluster = new THREE.Group();
    const barrelMat = makeMetal(0x1a1a1a);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.5, 8), barrelMat);
        b.position.set(Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0);
        b.rotation.x = Math.PI / 2;
        cluster.add(b);
    }
    cluster.position.set(0, 0.02, -0.4);
    g.add(cluster);
    g.userData.cluster = cluster;
    // Ammo box
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), makeMetal(0x3a3a3a));
    box.position.set(0, -0.14, 0.05);
    g.add(box);
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.7);
    return g;
}

function makeRocket() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 12), makeMetal(0x5a2010));
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0, -0.15);
    g.add(body);
    // Front widening
    const front = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.08, 12), makeMetal(0x3a1010));
    front.rotation.x = Math.PI / 2;
    front.position.set(0, 0, -0.5);
    g.add(front);
    // Handle
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), makeGrip());
    grip.position.set(0, -0.14, 0);
    g.add(grip);
    g.userData.muzzle = new THREE.Vector3(0, 0, -0.56);
    return g;
}

function makePlasma() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.34), makeMetal(0x204050, 0x001020));
    body.position.set(0, 0, -0.04);
    g.add(body);
    // Glowing coil
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8),
        new THREE.MeshStandardMaterial({ color: 0x40e8ff, emissive: 0x40e8ff, emissiveIntensity: 2, roughness: 0.3 }));
    coil.rotation.x = Math.PI / 2;
    coil.position.set(0, 0.04, -0.18);
    g.add(coil);
    g.userData.coil = coil;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.14, 8), makeMetal(0x2a4a60));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.32);
    g.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.08), makeGrip());
    grip.position.set(0, -0.14, 0.05);
    g.add(grip);
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.4);
    return g;
}

function makeBomb() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.28), makeMetal(0x5a4020));
    g.add(body);
    const launcher = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.3, 10), makeMetal(0x3a2010));
    launcher.rotation.x = Math.PI / 2;
    launcher.position.set(0, 0.03, -0.22);
    g.add(launcher);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.08), makeGrip());
    grip.position.set(0, -0.13, 0.08);
    g.add(grip);
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.38);
    return g;
}

function makeMolotov() {
    const g = new THREE.Group();
    // Bottle
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.26, 8),
        new THREE.MeshStandardMaterial({ color: 0x60a060, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.8, emissive: 0x2a4a20 }));
    bottle.rotation.x = Math.PI / 2;
    bottle.position.set(0, 0, -0.12);
    g.add(bottle);
    // Wick
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6),
        new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff6a20, emissiveIntensity: 2 }));
    wick.rotation.x = Math.PI / 2;
    wick.position.set(0, 0.04, -0.28);
    g.add(wick);
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.28);
    return g;
}

function makeLaser() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.26), makeMetal(0x301418, 0x400810));
    g.add(body);
    // Lens
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.015, 0.14, 8),
        new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 3, roughness: 0.2 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, -0.22);
    g.add(lens);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.08), makeGrip());
    grip.position.set(0, -0.12, 0.07);
    g.add(grip);
    g.userData.muzzle = new THREE.Vector3(0, 0, -0.3);
    g.userData.lens = lens;
    return g;
}

function makeBFG() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.42), makeMetal(0x204020, 0x104010));
    g.add(body);
    // Central glowing orb
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x80ff40, emissive: 0x80ff40, emissiveIntensity: 2.5, roughness: 0.2 }));
    orb.position.set(0, 0, -0.08);
    g.add(orb);
    g.userData.orb = orb;
    // Prongs
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), makeMetal(0x4a8a4a));
        p.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, -0.24);
        g.add(p);
    }
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.1), makeGrip());
    grip.position.set(0, -0.2, 0.1);
    g.add(grip);
    g.userData.muzzle = new THREE.Vector3(0, 0, -0.42);
    return g;
}

const WEAP_BUILDERS = {
    1: makePistol, 2: makeShotgun, 3: makeChaingun, 4: makeRocket,
    5: makePlasma, 6: makeBomb, 7: makeMolotov, 8: makeLaser, 9: makeBFG,
};

// ===== WEAPON VIEW (first-person) =====
// Attached to camera; swings/sways/kicks.
export class WeaponView {
    constructor(camera) {
        this.camera = camera;
        this.cache = {};
        this.current = null;
        this.currentKey = 0;
        this.basePos = new THREE.Vector3(0.28, -0.25, -0.55);
        this.kick = 0;
        this.spin = 0; // chaingun spin
        this.spinup = 0;
    }

    _get(k) {
        if (!this.cache[k]) this.cache[k] = WEAP_BUILDERS[k]();
        return this.cache[k];
    }

    setWeapon(k) {
        if (this.currentKey === k && this.current) return;
        if (this.current) this.camera.remove(this.current);
        const g = this._get(k);
        this.camera.add(g);
        this.current = g;
        this.currentKey = k;
        this.spin = 0; this.spinup = 0;
    }

    update(dt, { firing, swayX, swayY }) {
        if (!this.current) return;
        // Base position with sway + kick
        const sx = THREE.MathUtils.clamp(swayX, -0.08, 0.08);
        const sy = THREE.MathUtils.clamp(swayY, -0.08, 0.08);
        this.current.position.set(
            this.basePos.x + sx,
            this.basePos.y + sy - this.kick * 0.4,
            this.basePos.z - this.kick * 0.5
        );
        this.current.rotation.set(sy * 0.6, -sx * 0.6 - 0.05, -this.kick * 0.6);
        this.kick = Math.max(0, this.kick - dt * 4);

        // Chaingun spin
        if (this.currentKey === 3) {
            const target = firing ? 1 : 0;
            this.spinup += (target - this.spinup) * Math.min(1, dt * 4);
            this.spin += this.spinup * 24 * dt;
            if (this.current.userData.cluster) this.current.userData.cluster.rotation.z = this.spin;
        }
        // Plasma coil glow
        if (this.currentKey === 5 && this.current.userData.coil) {
            const e = 1.5 + Math.sin(performance.now() * 0.01) * 0.6;
            this.current.userData.coil.material.emissiveIntensity = e;
        }
        // BFG pulsing orb
        if (this.currentKey === 9 && this.current.userData.orb) {
            const e = 2.5 + Math.sin(performance.now() * 0.006) * 1.2;
            this.current.userData.orb.material.emissiveIntensity = e;
        }
        // Laser lens pulse
        if (this.currentKey === 8 && this.current.userData.lens) {
            const e = firing ? 5 : 2.5;
            this.current.userData.lens.material.emissiveIntensity = e;
        }
    }

    kickBack(a) { this.kick = Math.min(1, this.kick + a); }

    getMuzzleWorld(outVec) {
        if (!this.current) return outVec.set(0, 0, 0);
        const local = this.current.userData.muzzle;
        outVec.copy(local);
        this.current.localToWorld(outVec);
        return outVec;
    }
}

// ===== BULLET / PROJECTILE =====
// Factory returns a bullet descriptor consumed by game loop.
export function makeBullet(pl, def, muzzleWorld, dirX, dirZ, dirY = 0, overrides = {}) {
    const spread = def.spread;
    const a = Math.atan2(dirZ, dirX);
    const spreadA = a + (Math.random() - 0.5) * spread * 2;
    const vx = Math.cos(spreadA) * def.spd;
    const vz = Math.sin(spreadA) * def.spd;
    const vy = dirY * def.spd + (Math.random() - 0.5) * spread * def.spd;
    return {
        x: muzzleWorld.x, y: muzzleWorld.y, z: muzzleWorld.z,
        vx, vy, vz,
        dmg: def.dmg * (pl?.dmgM || 1),
        sz: def.sz,
        color: def.color,
        ric: def.ric,
        ricLeft: def.ric,
        lifetime: 2.5,
        expl: def.expl || false,
        blast: def.blast || 0,
        fire: def.fire || false,
        trail: def.trail || null,
        light: def.light || false,
        weapKey: def._key,
        ...overrides,
    };
}
