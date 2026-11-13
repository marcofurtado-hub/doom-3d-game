import * as THREE from 'three';
import { buildSky } from './biomes.js';

// Arena: floor, ceiling, outer walls, inner maze. Rebuilt on biome change.

export const ARENA = {
    W: 52, // X-span
    H: 36, // Z-span
    WALL_H: 5,
    WALL_T: 1.5,
};

const MAZE_LAYOUTS = [
    // L-shape — open center with corridor arms
    [
        { x: 7, z: 0, w: 1, d: 6 },
        { x: 14, z: 5, w: 6, d: 1 },
        { x: 14, z: -5, w: 6, d: 1 },
        { x: 0, z: 10, w: 8, d: 1 },
        { x: 20, z: 0, w: 1, d: 5 },
    ],
    // Staggered corridors
    [
        { x: 5, z: 4, w: 1, d: 5 },
        { x: 12, z: 0, w: 1, d: 7 },
        { x: 9, z: 9, w: 5, d: 1 },
        { x: 19, z: 5, w: 1, d: 5 },
        { x: 0, z: 13, w: 5, d: 1 },
    ],
    // Scattered barriers
    [
        { x: 6, z: 0, w: 6, d: 1 },
        { x: 15, z: 0, w: 1, d: 4 },
        { x: 10, z: 7, w: 1, d: 5 },
        { x: 0, z: 11, w: 5, d: 1 },
        { x: 20, z: 9, w: 4, d: 1 },
    ],
    // Pillars + walls
    [
        { x: 0, z: 5, w: 8, d: 1 },
        { x: 8, z: 0, w: 1, d: 4 },
        { x: 16, z: 3, w: 1, d: 7 },
        { x: 10, z: 11, w: 6, d: 1 },
        { x: 21, z: 0, w: 2, d: 2 },
        { x: 13, z: 7, w: 2, d: 2 },
    ],
    // Cross / plus
    [
        { x: 0, z: 0, w: 2, d: 2 },
        { x: 10, z: 0, w: 1, d: 8 },
        { x: 0, z: 9, w: 10, d: 1 },
        { x: 18, z: 4, w: 1, d: 6 },
    ],
    // Dense maze
    [
        { x: 4, z: 3, w: 1, d: 4 },
        { x: 9, z: 0, w: 4, d: 1 },
        { x: 13, z: 5, w: 1, d: 5 },
        { x: 18, z: 2, w: 4, d: 1 },
        { x: 7, z: 8, w: 1, d: 3 },
        { x: 20, z: 10, w: 3, d: 1 },
    ],
];

export class Arena {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);

        this.innerWalls = []; // AABB colliders
        this.innerWallMeshes = [];
        this.sky = null;
        this.floor = null;
        this.ceiling = null;
        this.outerWalls = [];
        this.lights = {};
        this.biome = null;
        this.emberParticles = null;
        this._emberData = null;
    }

    setBiome(biome, { mazeIndex = null } = {}) {
        this.disposeBiome();
        this.biome = biome;

        // Scene fog
        this.scene.fog = new THREE.Fog(biome.fogColor, biome.fogNear, biome.fogFar);
        this.scene.background = new THREE.Color(biome.skyColor);

        // Sky dome
        this.sky = buildSky(biome);
        this.group.add(this.sky);

        // Floor
        const floorMat = biome.floorMat();
        const floorGeo = new THREE.PlaneGeometry(ARENA.W, ARENA.H, 1, 1);
        this.floor = new THREE.Mesh(floorGeo, floorMat);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.group.add(this.floor);

        // Ceiling (darker)
        const ceilMat = new THREE.MeshStandardMaterial({ color: biome.ceilColor, roughness: 0.9, metalness: 0.1 });
        this.ceilMat = ceilMat;
        this.ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.W, ARENA.H), ceilMat);
        this.ceiling.rotation.x = Math.PI / 2;
        this.ceiling.position.y = ARENA.WALL_H;
        this.group.add(this.ceiling);

        // Outer walls (4 pieces) using biome wall material
        const wallMat = biome.wallMat();
        this.wallMat = wallMat;
        const mkWall = (w, h, d, x, y, z) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            m.position.set(x, y, z);
            m.castShadow = true;
            m.receiveShadow = true;
            this.group.add(m);
            this.outerWalls.push(m);
            return m;
        };
        mkWall(ARENA.W, ARENA.WALL_H, ARENA.WALL_T, 0, ARENA.WALL_H / 2, -ARENA.H / 2);
        mkWall(ARENA.W, ARENA.WALL_H, ARENA.WALL_T, 0, ARENA.WALL_H / 2, ARENA.H / 2);
        mkWall(ARENA.WALL_T, ARENA.WALL_H, ARENA.H, -ARENA.W / 2, ARENA.WALL_H / 2, 0);
        mkWall(ARENA.WALL_T, ARENA.WALL_H, ARENA.H, ARENA.W / 2, ARENA.WALL_H / 2, 0);

        // Inner walls
        this.buildMaze(mazeIndex);

        // Lights
        const amb = new THREE.AmbientLight(biome.ambColor, biome.ambIntensity);
        this.group.add(amb);
        this.lights.amb = amb;

        const sun = new THREE.DirectionalLight(biome.sunColor, biome.sunIntensity);
        sun.position.set(...biome.sunDir);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 60;
        sun.shadow.camera.left = -30;
        sun.shadow.camera.right = 30;
        sun.shadow.camera.top = 24;
        sun.shadow.camera.bottom = -24;
        sun.shadow.bias = -0.0005;
        this.group.add(sun);
        this.lights.sun = sun;

        const rim = new THREE.PointLight(biome.rimColor, biome.rimIntensity, 60, 1.5);
        rim.position.set(0, 4.5, 0);
        this.group.add(rim);
        this.lights.rim = rim;

        // Embers (instanced particles)
        this.buildEmbers();
    }

    buildMaze(mazeIndex) {
        const idx = mazeIndex !== null ? mazeIndex : Math.floor(Math.random() * MAZE_LAYOUTS.length);
        const layout = MAZE_LAYOUTS[idx];

        for (const def of layout) {
            // Mirror 4-way for max symmetry
            const positions = [{ x: def.x, z: def.z }];
            if (def.x !== 0) positions.push({ x: -def.x, z: def.z });
            if (def.z !== 0) positions.push({ x: def.x, z: -def.z });
            if (def.x !== 0 && def.z !== 0) positions.push({ x: -def.x, z: -def.z });

            for (const pos of positions) {
                if (Math.abs(pos.x) < 3 && Math.abs(pos.z) < 3) continue; // spawn clear
                if (Math.abs(pos.x) + def.w / 2 > ARENA.W / 2 - 2) continue;
                if (Math.abs(pos.z) + def.d / 2 > ARENA.H / 2 - 2) continue;

                this.innerWalls.push({ x: pos.x, z: pos.z, w: def.w, d: def.d });
                const geo = new THREE.BoxGeometry(def.w, ARENA.WALL_H, def.d);
                const mesh = new THREE.Mesh(geo, this.wallMat);
                mesh.position.set(pos.x, ARENA.WALL_H / 2, pos.z);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.group.add(mesh);
                this.innerWallMeshes.push(mesh);
            }
        }
    }

    buildEmbers() {
        const cfg = this.biome.embers;
        const count = cfg.count;
        const geo = new THREE.SphereGeometry(0.06, 5, 4);
        const mat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.85 });
        const inst = new THREE.InstancedMesh(geo, mat, count);
        inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        inst.frustumCulled = false;
        this.group.add(inst);

        const data = [];
        const m = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
            const d = {
                x: (Math.random() - 0.5) * ARENA.W * 0.9,
                z: (Math.random() - 0.5) * ARENA.H * 0.9,
                y: Math.random() * ARENA.WALL_H,
                vy: cfg.rise ? (0.2 + Math.random() * 0.6) * cfg.speed : (Math.random() - 0.5) * 0.3 * cfg.speed,
                vx: (Math.random() - 0.5) * 0.4,
                vz: (Math.random() - 0.5) * 0.4,
                flicker: Math.random() * Math.PI * 2,
            };
            data.push(d);
            m.makeTranslation(d.x, d.y, d.z);
            inst.setMatrixAt(i, m);
        }
        inst.instanceMatrix.needsUpdate = true;
        this.emberParticles = inst;
        this._emberData = data;
    }

    updateEmbers(dt, t) {
        if (!this.emberParticles) return;
        const m = new THREE.Matrix4();
        const cfg = this.biome.embers;
        for (let i = 0; i < this._emberData.length; i++) {
            const d = this._emberData[i];
            d.y += d.vy * dt;
            d.x += d.vx * dt;
            d.z += d.vz * dt;
            d.flicker += dt * 2;
            if (cfg.rise) {
                if (d.y > ARENA.WALL_H + 0.5) { d.y = 0.1; d.x = (Math.random() - 0.5) * ARENA.W * 0.9; d.z = (Math.random() - 0.5) * ARENA.H * 0.9; }
            } else {
                if (d.y > ARENA.WALL_H - 0.3 || d.y < 0.1) d.vy *= -1;
            }
            const s = 0.6 + Math.sin(d.flicker) * 0.4;
            m.makeScale(s, s, s);
            m.setPosition(d.x, d.y, d.z);
            this.emberParticles.setMatrixAt(i, m);
        }
        this.emberParticles.instanceMatrix.needsUpdate = true;
    }

    // ---- COLLISION ----
    collideCircle(e) {
        for (const w of this.innerWalls) {
            const hw = w.w / 2, hd = w.d / 2;
            const cx = Math.max(w.x - hw, Math.min(e.x, w.x + hw));
            const cz = Math.max(w.z - hd, Math.min(e.z, w.z + hd));
            const dx = e.x - cx, dz = e.z - cz, dist = Math.hypot(dx, dz);
            if (dist < e.r) {
                if (dist > 0.001) {
                    e.x = cx + (dx / dist) * e.r;
                    e.z = cz + (dz / dist) * e.r;
                } else {
                    const dL = e.x - (w.x - hw), dR = (w.x + hw) - e.x, dT = e.z - (w.z - hd), dB = (w.z + hd) - e.z;
                    const mn = Math.min(dL, dR, dT, dB);
                    if (mn === dL) e.x = w.x - hw - e.r;
                    else if (mn === dR) e.x = w.x + hw + e.r;
                    else if (mn === dT) e.z = w.z - hd - e.r;
                    else e.z = w.z + hd + e.r;
                }
            }
        }
        // Outer walls: hard clamp
        const hx = ARENA.W / 2 - ARENA.WALL_T / 2 - e.r;
        const hz = ARENA.H / 2 - ARENA.WALL_T / 2 - e.r;
        if (e.x > hx) e.x = hx;
        if (e.x < -hx) e.x = -hx;
        if (e.z > hz) e.z = hz;
        if (e.z < -hz) e.z = -hz;
    }

    // Bullet vs inner wall with ricochet. Returns true if ricocheted.
    bulletBounceInnerWall(b) {
        for (const w of this.innerWalls) {
            const hw = w.w / 2 + b.sz, hd = w.d / 2 + b.sz;
            if (b.x >= w.x - hw && b.x <= w.x + hw && b.z >= w.z - hd && b.z <= w.z + hd) {
                const dL = b.x - (w.x - hw), dR = (w.x + hw) - b.x, dT = b.z - (w.z - hd), dB = (w.z + hd) - b.z;
                const mn = Math.min(dL, dR, dT, dB);
                if (mn === dL || mn === dR) {
                    b.vx = -b.vx;
                    b.x = mn === dL ? w.x - hw - 0.01 : w.x + hw + 0.01;
                } else {
                    b.vz = -b.vz;
                    b.z = mn === dT ? w.z - hd - 0.01 : w.z + hd + 0.01;
                }
                return true;
            }
        }
        // Outer walls
        const hx = ARENA.W / 2 - ARENA.WALL_T / 2 - b.sz;
        const hz = ARENA.H / 2 - ARENA.WALL_T / 2 - b.sz;
        if (b.x > hx) { b.x = hx; b.vx = -b.vx; return true; }
        if (b.x < -hx) { b.x = -hx; b.vx = -b.vx; return true; }
        if (b.z > hz) { b.z = hz; b.vz = -b.vz; return true; }
        if (b.z < -hz) { b.z = -hz; b.vz = -b.vz; return true; }
        return false;
    }

    // Line-of-sight check from p1 to p2 (XZ plane) — for enemy AI
    hasLineOfSight(p1, p2) {
        const dx = p2.x - p1.x, dz = p2.z - p1.z;
        const dist = Math.hypot(dx, dz);
        const steps = Math.max(2, Math.ceil(dist));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const x = p1.x + dx * t, z = p1.z + dz * t;
            for (const w of this.innerWalls) {
                if (x > w.x - w.w / 2 && x < w.x + w.w / 2 && z > w.z - w.d / 2 && z < w.z + w.d / 2) return false;
            }
        }
        return true;
    }

    disposeBiome() {
        // Remove all children and dispose geometries/materials specific to this biome
        for (const m of this.innerWallMeshes) {
            this.group.remove(m);
            m.geometry.dispose();
        }
        this.innerWallMeshes.length = 0;
        this.innerWalls.length = 0;
        for (const m of this.outerWalls) {
            this.group.remove(m);
            m.geometry.dispose();
        }
        this.outerWalls.length = 0;

        if (this.floor) {
            this.group.remove(this.floor);
            this.floor.geometry.dispose();
            if (this.floor.material.map) this.floor.material.map.dispose();
            this.floor.material.dispose();
            this.floor = null;
        }
        if (this.ceiling) {
            this.group.remove(this.ceiling);
            this.ceiling.geometry.dispose();
            this.ceilMat?.dispose();
            this.ceiling = null;
        }
        if (this.wallMat) {
            if (this.wallMat.map) this.wallMat.map.dispose();
            this.wallMat.dispose();
            this.wallMat = null;
        }
        if (this.sky) {
            this.group.remove(this.sky);
            this.sky.geometry.dispose();
            this.sky.material.dispose();
            this.sky = null;
        }
        if (this.lights.amb) { this.group.remove(this.lights.amb); }
        if (this.lights.sun) { this.group.remove(this.lights.sun); this.lights.sun.dispose?.(); }
        if (this.lights.rim) { this.group.remove(this.lights.rim); }
        this.lights = {};

        if (this.emberParticles) {
            this.group.remove(this.emberParticles);
            this.emberParticles.geometry.dispose();
            this.emberParticles.material.dispose();
            this.emberParticles = null;
        }
    }
}
