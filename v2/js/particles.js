import * as THREE from 'three';

// GPU particles via InstancedMesh pools, one pool per visual type.
// Types: spark (small bright), blood (darker, short-lived), smoke (gray puff),
//        ember (long-lived upward), muzzle (bright flash puff), shell (casing).

const POOL_SIZE = 400; // per pool

class Pool {
    constructor(scene, geo, mat, size = POOL_SIZE, gravity = -4, fade = true) {
        this.mesh = new THREE.InstancedMesh(geo, mat, size);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        scene.add(this.mesh);
        this.data = new Array(size).fill(null).map(() => ({
            alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, s0: 1, s1: 0, rot: 0, vrot: 0,
        }));
        this.size = size;
        this.gravity = gravity;
        this.fade = fade;
        this._color = new THREE.Color();
        this._m = new THREE.Matrix4();
        this._q = new THREE.Quaternion();
        this._s = new THREE.Vector3();
        this._p = new THREE.Vector3();

        if (mat.transparent) mat.depthWrite = false;
    }

    spawn(x, y, z, vx, vy, vz, life, s0 = 0.14, s1 = 0.02, rotVel = 0) {
        for (let i = 0; i < this.size; i++) {
            const d = this.data[i];
            if (!d.alive) {
                d.alive = true;
                d.x = x; d.y = y; d.z = z;
                d.vx = vx; d.vy = vy; d.vz = vz;
                d.life = 0; d.maxLife = life;
                d.s0 = s0; d.s1 = s1;
                d.rot = Math.random() * Math.PI * 2;
                d.vrot = rotVel;
                return;
            }
        }
    }

    update(dt) {
        let n = 0;
        for (let i = 0; i < this.size; i++) {
            const d = this.data[i];
            if (!d.alive) continue;
            d.life += dt;
            if (d.life >= d.maxLife) { d.alive = false; continue; }
            d.vy += this.gravity * dt;
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.z += d.vz * dt;
            d.rot += d.vrot * dt;
            if (d.y < 0.02) { d.y = 0.02; d.vy = -d.vy * 0.3; d.vx *= 0.7; d.vz *= 0.7; if (Math.abs(d.vy) < 0.5) d.vy = 0; }
            const t = d.life / d.maxLife;
            const s = d.s0 + (d.s1 - d.s0) * t;
            this._p.set(d.x, d.y, d.z);
            this._s.set(s, s, s);
            this._q.setFromAxisAngle(_UP, d.rot);
            this._m.compose(this._p, this._q, this._s);
            this.mesh.setMatrixAt(n, this._m);
            n++;
        }
        this.mesh.count = n;
        this.mesh.instanceMatrix.needsUpdate = n > 0;
    }

    dispose() {
        this.mesh.parent?.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

const _UP = new THREE.Vector3(0, 1, 0);

export class Particles {
    constructor(scene) {
        this.scene = scene;
        const sphereGeo = new THREE.SphereGeometry(1, 5, 4);
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);

        this.sparks = new Pool(scene, sphereGeo,
            new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.95 }),
            500, -3, true);

        this.blood = new Pool(scene, sphereGeo,
            new THREE.MeshBasicMaterial({ color: 0x8a1010, transparent: true, opacity: 0.85 }),
            400, -8, true);

        this.smoke = new Pool(scene, sphereGeo,
            new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.45 }),
            200, 0.6, true);

        this.muzzle = new Pool(scene, sphereGeo,
            new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.9 }),
            100, 0, true);

        this.shells = new Pool(scene, boxGeo,
            new THREE.MeshBasicMaterial({ color: 0xd0a040 }),
            80, -9, false);

        this.plasma = new Pool(scene, sphereGeo,
            new THREE.MeshBasicMaterial({ color: 0x40e8ff, transparent: true, opacity: 0.9 }),
            200, 0.5, true);

        this.pools = [this.sparks, this.blood, this.smoke, this.muzzle, this.shells, this.plasma];
    }

    // ---- EFFECTS ----

    hitSpark(x, y, z, count = 6, color = 0xffd060, strength = 1.0) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const p = Math.random() * Math.PI - Math.PI / 2;
            const s = (2 + Math.random() * 3) * strength;
            const vx = Math.cos(a) * Math.cos(p) * s;
            const vz = Math.sin(a) * Math.cos(p) * s;
            const vy = Math.sin(p) * s + 1.5;
            this.sparks.spawn(x, y, z, vx, vy, vz, 0.4 + Math.random() * 0.3, 0.12 + Math.random() * 0.06, 0.01);
        }
    }

    bloodSpray(x, y, z, dirX, dirZ, count = 10) {
        for (let i = 0; i < count; i++) {
            const spread = 1.5;
            const vx = dirX * (3 + Math.random() * 3) + (Math.random() - 0.5) * spread;
            const vz = dirZ * (3 + Math.random() * 3) + (Math.random() - 0.5) * spread;
            const vy = 2 + Math.random() * 3;
            this.blood.spawn(x, y, z, vx, vy, vz, 0.5 + Math.random() * 0.3, 0.14, 0.03);
        }
    }

    smokePuff(x, y, z, count = 6, color = 0x555555) {
        for (let i = 0; i < count; i++) {
            const vx = (Math.random() - 0.5) * 1.4;
            const vz = (Math.random() - 0.5) * 1.4;
            const vy = 0.5 + Math.random();
            this.smoke.spawn(x, y, z, vx, vy, vz, 0.9 + Math.random() * 0.5, 0.3, 0.9);
        }
    }

    muzzleFlash(x, y, z, dirX, dirZ, color = 0xffd060) {
        this.muzzle.mesh.material.color.setHex(color);
        for (let i = 0; i < 5; i++) {
            const vx = dirX * (3 + Math.random() * 3) + (Math.random() - 0.5) * 1;
            const vz = dirZ * (3 + Math.random() * 3) + (Math.random() - 0.5) * 1;
            const vy = (Math.random() - 0.5) * 1;
            this.muzzle.spawn(x, y, z, vx, vy, vz, 0.08 + Math.random() * 0.05, 0.25, 0.05);
        }
    }

    shell(x, y, z, dirX, dirZ) {
        const vx = -dirZ * 3 + (Math.random() - 0.5);
        const vz = dirX * 3 + (Math.random() - 0.5);
        const vy = 2 + Math.random();
        this.shells.spawn(x, y, z, vx, vy, vz, 2.0, 0.07, 0.07, 8);
    }

    explosion(x, y, z, color = 0xff6a20, radius = 1.0) {
        for (let i = 0; i < 24; i++) {
            const a = Math.random() * Math.PI * 2;
            const p = Math.random() * Math.PI - Math.PI / 2;
            const s = 4 + Math.random() * 6;
            const vx = Math.cos(a) * Math.cos(p) * s;
            const vz = Math.sin(a) * Math.cos(p) * s;
            const vy = Math.sin(p) * s + 3;
            this.sparks.spawn(x, y, z, vx, vy, vz, 0.6 + Math.random() * 0.4, 0.2 * radius, 0.02);
        }
        this.smokePuff(x, y, z, 16);
    }

    plasmaBurst(x, y, z, color = 0x40e8ff) {
        this.plasma.mesh.material.color.setHex(color);
        for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2;
            const p = Math.random() * Math.PI - Math.PI / 2;
            const s = 2 + Math.random() * 2;
            const vx = Math.cos(a) * Math.cos(p) * s;
            const vz = Math.sin(a) * Math.cos(p) * s;
            const vy = Math.sin(p) * s;
            this.plasma.spawn(x, y, z, vx, vy, vz, 0.3 + Math.random() * 0.3, 0.18, 0.02);
        }
    }

    update(dt) {
        for (const p of this.pools) p.update(dt);
    }

    dispose() {
        for (const p of this.pools) p.dispose();
    }
}
