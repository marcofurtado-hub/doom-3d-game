import * as THREE from 'three';

// Particles: soft point sprites (one draw call each for glow and smoke), InstancedMesh pools for
// solid debris (blood, shell casings), and pooled additive flash spheres / ground rings.

const _UP = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

class Pool {
    constructor(scene, geo, mat, size, gravity, bounce = true) {
        this.mesh = new THREE.InstancedMesh(geo, mat, size);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        this.mesh.setColorAt(0, _c.set(0xffffff));
        this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        scene.add(this.mesh);
        this.data = Array.from({ length: size }, () => ({
            alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, s0: 1, s1: 0, rot: 0, vrot: 0, r: 1, g: 1, b: 1,
        }));
        this.size = size;
        this.gravity = gravity;
        this.bounce = bounce;
        this.cursor = 0;
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
        this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
    }

    spawn(x, y, z, vx, vy, vz, life, s0, s1, color = 0xffffff, boost = 1, vrot = 0) {
        // Ring-buffer search; when full, the oldest slot is recycled
        let d = null;
        for (let k = 0; k < 8; k++) {
            const c = this.data[this.cursor];
            this.cursor = (this.cursor + 1) % this.size;
            if (!c.alive) { d = c; break; }
        }
        if (!d) d = this.data[this.cursor];
        d.alive = true;
        d.x = x; d.y = y; d.z = z; d.vx = vx; d.vy = vy; d.vz = vz;
        d.life = 0; d.maxLife = life; d.s0 = s0; d.s1 = s1;
        d.rot = Math.random() * 6.28; d.vrot = vrot;
        _c.set(color);
        d.r = _c.r * boost; d.g = _c.g * boost; d.b = _c.b * boost;
    }

    update(dt) {
        let n = 0;
        const col = this.mesh.instanceColor.array;
        for (let i = 0; i < this.size; i++) {
            const d = this.data[i];
            if (!d.alive) continue;
            d.life += dt;
            if (d.life >= d.maxLife) { d.alive = false; continue; }
            d.vy += this.gravity * dt;
            d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
            d.rot += d.vrot * dt;
            if (this.bounce && d.y < 0.03) {
                d.y = 0.03; d.vy = -d.vy * 0.3; d.vx *= 0.6; d.vz *= 0.6; d.vrot *= 0.5;
            }
            const t = d.life / d.maxLife;
            const s = d.s0 + (d.s1 - d.s0) * t;
            this._p.set(d.x, d.y, d.z); this._s.set(s, s, s);
            this._q.setFromAxisAngle(_UP, d.rot);
            this._m.compose(this._p, this._q, this._s);
            this.mesh.setMatrixAt(n, this._m);
            col[n * 3] = d.r; col[n * 3 + 1] = d.g; col[n * 3 + 2] = d.b;
            n++;
        }
        this.mesh.count = n;
        if (n > 0) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
    }

    clear() { for (const d of this.data) d.alive = false; this.mesh.count = 0; }
}

// Soft round sprites sized in world units. Same pool API as Pool.
class PointPool {
    constructor(scene, size, gravity, additive, getHeight) {
        this.size = size; this.gravity = gravity; this.getHeight = getHeight; this.cursor = 0; this.additive = additive;
        this.data = Array.from({ length: size }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, s0: 1, s1: 0, r: 1, g: 1, b: 1 }));
        const geo = new THREE.BufferGeometry();
        this.pos = new THREE.BufferAttribute(new Float32Array(size * 3), 3).setUsage(THREE.DynamicDrawUsage);
        this.col = new THREE.BufferAttribute(new Float32Array(size * 3), 3).setUsage(THREE.DynamicDrawUsage);
        this.misc = new THREE.BufferAttribute(new Float32Array(size * 2), 2).setUsage(THREE.DynamicDrawUsage); // size, alpha
        geo.setAttribute('position', this.pos); geo.setAttribute('color', this.col); geo.setAttribute('misc', this.misc);
        geo.setDrawRange(0, 0);
        this.uniforms = { uH: { value: 720 }, uOpacity: { value: additive ? 1.6 : 0.75 } };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms, transparent: false, depthWrite: true,
            vertexShader: /* glsl */`
                attribute vec3 color; attribute vec2 misc;
                uniform float uH; varying vec3 vC; varying float vA;
                void main(){
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mv;
                    gl_PointSize = min(misc.x * uH * 0.5 * projectionMatrix[1][1] / max(0.05, -mv.z), uH * 0.14);
                    vC = color; vA = misc.y;
                }`,
            fragmentShader: /* glsl */`
                uniform float uOpacity; varying vec3 vC; varying float vA;
                void main(){
                    // square sprites; transparency is a 2x2 stipple pattern, the way pre-blending hardware faked it
                    vec2 q = floor(mod(gl_FragCoord.xy, 2.0));
                    float th = (q.x + q.y * 2.0 == 0.0 ? 0.125 : q.x + q.y * 2.0 == 3.0 ? 0.375 : q.x + q.y * 2.0 == 1.0 ? 0.625 : 0.875);
                    if (vA * uOpacity < th) discard;
                    gl_FragColor = vec4(vC, 1.0);
                }`,
        });
        this.mesh = new THREE.Points(geo, mat);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
    }

    spawn(x, y, z, vx, vy, vz, life, s0, s1, color = 0xffffff, boost = 1) {
        let d = null;
        for (let k = 0; k < 8; k++) {
            const c = this.data[this.cursor];
            this.cursor = (this.cursor + 1) % this.size;
            if (!c.alive) { d = c; break; }
        }
        if (!d) d = this.data[this.cursor];
        d.alive = true; d.x = x; d.y = y; d.z = z; d.vx = vx; d.vy = vy; d.vz = vz;
        d.life = 0; d.maxLife = life; d.s0 = s0; d.s1 = s1;
        _c.set(color);
        const k = Math.min(boost, 1.2); // no bloom to feed any more
        d.r = _c.r * k; d.g = _c.g * k; d.b = _c.b * k;
    }

    update(dt) {
        const P = this.pos.array, C = this.col.array, M = this.misc.array;
        let n = 0;
        for (let i = 0; i < this.size; i++) {
            const d = this.data[i];
            if (!d.alive) continue;
            d.life += dt;
            if (d.life >= d.maxLife) { d.alive = false; continue; }
            d.vy += this.gravity * dt;
            d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
            if (d.y < 0.03 && this.gravity < 0) { d.y = 0.03; d.vy = -d.vy * 0.35; d.vx *= 0.6; d.vz *= 0.6; }
            const t = d.life / d.maxLife;
            P[n * 3] = d.x; P[n * 3 + 1] = d.y; P[n * 3 + 2] = d.z;
            C[n * 3] = d.r; C[n * 3 + 1] = d.g; C[n * 3 + 2] = d.b;
            M[n * 2] = (d.s0 + (d.s1 - d.s0) * t) * (this.additive ? 1.5 : 1.3);
            M[n * 2 + 1] = Math.min(1, (1 - t) * 3) * Math.min(1, t * 12 + 0.3);
            n++;
        }
        this.mesh.geometry.setDrawRange(0, n);
        if (n > 0) { this.pos.needsUpdate = true; this.col.needsUpdate = true; this.misc.needsUpdate = true; }
        this.uniforms.uH.value = this.getHeight();
    }

    clear() { for (const d of this.data) d.alive = false; this.mesh.geometry.setDrawRange(0, 0); }
}

export class Particles {
    constructor(scene, low = false, getHeight = () => innerHeight) {
        const sphere = new THREE.SphereGeometry(1, 6, 4);
        const box = new THREE.BoxGeometry(1, 1.8, 1);
        const k = low ? 0.5 : 1;
        this.k = k;
        this.glow = new PointPool(scene, Math.floor(800 * k), -6, true, getHeight);   // sparks, plasma, muzzle, fire
        this.smoke = new PointPool(scene, Math.floor(260 * k), 0.8, false, getHeight);
        this.blood = new Pool(scene, sphere, new THREE.MeshBasicMaterial(), Math.floor(400 * k), -11);
        this.shells = new Pool(scene, box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.9 }), 60, -12);
        this.pools = [this.glow, this.blood, this.smoke, this.shells];

        // Flash spheres + ground rings
        this.flashes = [];
        const fGeo = new THREE.IcosahedronGeometry(1, 1);
        const rGeo = new THREE.RingGeometry(0.8, 1, 16);
        rGeo.rotateX(-Math.PI / 2);
        for (let i = 0; i < 14; i++) {
            const ring = i >= 8;
            const m = new THREE.Mesh(ring ? rGeo : fGeo, new THREE.MeshBasicMaterial({
                transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: ring ? THREE.DoubleSide : THREE.FrontSide,
            }));
            m.visible = false;
            scene.add(m);
            this.flashes.push({ m, ring, t: 1, dur: 1, r: 1, base: new THREE.Color() });
        }
    }

    _n(count) { return Math.max(1, Math.round(count * this.k)); }

    hitSpark(x, y, z, count = 6, color = 0xffd060, strength = 1) {
        for (let i = this._n(count); i > 0; i--) {
            const a = Math.random() * 6.28, p = Math.random() * Math.PI - Math.PI / 2, s = (2 + Math.random() * 5) * strength;
            this.glow.spawn(x, y, z, Math.cos(a) * Math.cos(p) * s, Math.sin(p) * s + 1.5, Math.sin(a) * Math.cos(p) * s,
                0.25 + Math.random() * 0.3, 0.07, 0.01, color, 2.5);
        }
    }

    blood_(x, y, z, dx, dz, count = 10, color = 0xa01010) {
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        for (let i = this._n(count); i > 0; i--) {
            this.blood.spawn(x, y, z, dx * (1 + Math.random() * 4) + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 4,
                dz * (1 + Math.random() * 4) + (Math.random() - 0.5) * 3, 0.5 + Math.random() * 0.5, 0.09 + Math.random() * 0.06, 0.02, color, 0.8 + Math.random() * 0.4);
        }
    }

    gibs(x, y, z, color, count = 14) {
        for (let i = this._n(count); i > 0; i--) {
            const a = Math.random() * 6.28, s = 2 + Math.random() * 5;
            this.blood.spawn(x, y + Math.random() * 0.8, z, Math.cos(a) * s, 3 + Math.random() * 5, Math.sin(a) * s,
                0.9 + Math.random() * 0.6, 0.16 + Math.random() * 0.12, 0.05, color, 0.7);
        }
    }

    smokePuff(x, y, z, count = 6, color = 0x55504c, size = 1) {
        for (let i = this._n(count); i > 0; i--) {
            this.smoke.spawn(x + (Math.random() - 0.5) * 0.3 * size, y, z + (Math.random() - 0.5) * 0.3 * size,
                (Math.random() - 0.5) * 1.6 * size, 0.4 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6 * size,
                0.8 + Math.random() * 0.7, 0.25 * size, 0.8 * size, color);
        }
    }

    trail(x, y, z, color, size = 0.1, life = 0.25) {
        this.glow.spawn(x, y, z, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6 + 0.6, (Math.random() - 0.5) * 0.6, life, size, 0.01, color, 2);
    }

    muzzle(x, y, z, dx, dy, dz, color, count = 5) {
        for (let i = this._n(count); i > 0; i--) {
            const s = 4 + Math.random() * 8;
            this.glow.spawn(x, y, z, dx * s + (Math.random() - 0.5) * 2.5, dy * s + (Math.random() - 0.5) * 2.5, dz * s + (Math.random() - 0.5) * 2.5,
                0.06 + Math.random() * 0.08, 0.06, 0.01, color, 3);
        }
    }

    shell(x, y, z, rx, rz, color = 0xd0a040) {
        this.shells.spawn(x, y, z, rx * (2 + Math.random()), 2.2 + Math.random(), rz * (2 + Math.random()), 1.6, 0.03, 0.03, color, 1, 14);
    }

    fire(x, y, z, color = 0xff7a20) {
        this.glow.spawn(x, y, z, (Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 0.8,
            0.4 + Math.random() * 0.4, 0.2 + Math.random() * 0.15, 0.02, color, 1.6);
    }

    explosion(x, y, z, color = 0xff7a20, radius = 4) {
        for (let i = this._n(30); i > 0; i--) {
            const a = Math.random() * 6.28, p = Math.random() * Math.PI - Math.PI / 2, s = (3 + Math.random() * 9) * (0.5 + radius / 8);
            this.glow.spawn(x, y, z, Math.cos(a) * Math.cos(p) * s, Math.sin(p) * s + 3, Math.sin(a) * Math.cos(p) * s,
                0.4 + Math.random() * 0.5, 0.14, 0.02, i % 3 ? color : 0xffffff, 2.5);
        }
        this.smokePuff(x, y + 0.3, z, 12, 0x3a3532, 0.6 + radius / 5);
        this.flash(x, y, z, color, radius * 0.45, 0.22);
        this.flash(x, y, z, 0xffe080, radius * 0.25, 0.12);
        this.ring(x, z, color, radius, 0.4);
    }

    flash(x, y, z, color, r, dur) { this._flash(false, x, y, z, color, r, dur); }
    ring(x, z, color, r, dur) { this._flash(true, x, 0.06, z, color, r, dur); }

    _flash(ring, x, y, z, color, r, dur) {
        let best = null;
        for (const f of this.flashes) {
            if (f.ring !== ring) continue;
            if (!f.m.visible) { best = f; break; }
            if (!best || f.t / f.dur > best.t / best.dur) best = f;
        }
        best.t = 0; best.dur = dur; best.r = r;
        best.base.set(color);
        best.m.position.set(x, y, z);
        best.m.visible = true;
    }

    update(dt) {
        for (const p of this.pools) p.update(dt);
        for (const f of this.flashes) {
            if (!f.m.visible) continue;
            f.t += dt;
            const t = f.t / f.dur;
            if (t >= 1) { f.m.visible = false; continue; }
            const e = 1 - (1 - t) * (1 - t);
            f.m.scale.setScalar(f.r * (0.15 + 0.85 * e));
            f.m.material.color.copy(f.base).multiplyScalar(1 - t);
            f.m.material.opacity = 1 - t;
        }
    }

    clear() {
        for (const p of this.pools) p.clear();
        for (const f of this.flashes) f.m.visible = false;
    }
}
