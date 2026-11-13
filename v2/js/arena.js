import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildSky, buildSurfaceMaterial } from './biomes.js';
import { lavaTexture, facePanel, pentagramTexture, skyPanorama, flameStrip } from './textures.js';

// Arena: floor, optional ceiling, outer walls, inner maze, lights, sky, embers, glowing props.
// Fully rebuilt (and disposed) on biome change.

export const ARENA = { W: 52, H: 36, WALL_H: 5, WALL_T: 1.5, TILE: 4, FLOOR_TILE: 8 };

const MAZE_LAYOUTS = [
    [{ x: 7, z: 0, w: 1, d: 6 }, { x: 14, z: 5, w: 6, d: 1 }, { x: 0, z: 10, w: 8, d: 1 }, { x: 20, z: 0, w: 1, d: 5 }],
    [{ x: 5, z: 4, w: 1, d: 5 }, { x: 12, z: 0, w: 1, d: 7 }, { x: 9, z: 9, w: 5, d: 1 }, { x: 19, z: 5, w: 1, d: 5 }, { x: 0, z: 13, w: 5, d: 1 }],
    [{ x: 6, z: 0, w: 6, d: 1 }, { x: 15, z: 0, w: 1, d: 4 }, { x: 10, z: 7, w: 1, d: 5 }, { x: 0, z: 11, w: 5, d: 1 }, { x: 20, z: 9, w: 4, d: 1 }],
    [{ x: 0, z: 5, w: 8, d: 1 }, { x: 8, z: 0, w: 1, d: 4 }, { x: 16, z: 3, w: 1, d: 7 }, { x: 10, z: 11, w: 6, d: 1 }, { x: 21, z: 0, w: 2, d: 2 }, { x: 13, z: 7, w: 2, d: 2 }],
    [{ x: 10, z: 0, w: 1, d: 8 }, { x: 0, z: 9, w: 10, d: 1 }, { x: 18, z: 4, w: 1, d: 6 }, { x: 5, z: 5, w: 2, d: 2 }],
    [{ x: 4, z: 4, w: 1, d: 4 }, { x: 9, z: 0, w: 4, d: 1 }, { x: 13, z: 5, w: 1, d: 5 }, { x: 18, z: 2, w: 4, d: 1 }, { x: 7, z: 9, w: 1, d: 3 }, { x: 20, z: 10, w: 3, d: 1 }],
    [{ x: 8, z: 6, w: 2, d: 2 }, { x: 16, z: 6, w: 2, d: 2 }, { x: 8, z: 12, w: 2, d: 2 }, { x: 16, z: 0, w: 2, d: 2 }, { x: 0, z: 8, w: 2, d: 2 }],
];

// Box with world-space UVs so the wall texture keeps a constant texel density on any wall size.
function worldBox(w, h, d, T) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
        for (let i = 0; i < 4; i++) {
            const k = f * 4 + i;
            uv.setXY(k, uv.getX(k) * spans[f][0] / T, uv.getY(k) * spans[f][1] / T);
        }
    }
    return g;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _e = new THREE.Euler();

export class Arena {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.innerWalls = [];
        this.owned = [];      // meshes whose geometry (+ optional material) we dispose on rebuild
        this.lights = {};
        this.biome = null;
        this.openSky = false;
        this.sky = null;
        this.embers = null;
        this.props = null;
    }

    _add(mesh, disposeMat = true) {
        this.group.add(mesh);
        this.owned.push({ mesh, disposeMat });
        return mesh;
    }

    setBiome(biome, { low = false, shadows = true } = {}) {
        this.dispose();
        this.biome = biome;
        this.openSky = !!biome.openSky;

        this.scene.fog = new THREE.Fog(biome.fogColor, biome.fogNear, biome.fogFar);
        this.scene.background = new THREE.Color(biome.fogColor);

        this.lava = null; this.sprites = []; this.flameTex = null; this.lavaTex = null;
        const tile = biome.tile || ARENA.TILE, floorTile = biome.tile || ARENA.FLOOR_TILE;
        if (biome.keep) {
            // Classic sky: a painted strip on a cylinder instead of a shader dome
            const tex = skyPanorama();
            tex.repeat.set(3, 1);
            const cyl = this._add(new THREE.Mesh(new THREE.CylinderGeometry(95, 95, 60, 24, 1, true),
                new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })));
            cyl.position.y = 22;
            const cap = this._add(new THREE.Mesh(new THREE.CircleGeometry(96, 16),
                new THREE.MeshBasicMaterial({ color: 0x1c0206, side: THREE.DoubleSide, fog: false, depthWrite: false })));
            cap.rotation.x = Math.PI / 2; cap.position.y = 51.9;
            this.sky = null;
        } else this.sky = this._add(buildSky(biome));

        // Floor
        const floorMat = buildSurfaceMaterial(biome, 'floor', low);
        const rep = new THREE.Vector2(ARENA.W / floorTile, ARENA.H / floorTile);
        for (const t of [floorMat.map, floorMat.emissiveMap, floorMat.normalMap]) if (t) t.repeat.copy(rep);
        const floor = this._add(new THREE.Mesh(new THREE.PlaneGeometry(ARENA.W, ARENA.H), floorMat));
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;

        // Ceiling only on enclosed biomes; open-sky biomes show the dome
        if (!this.openSky) {
            const ceil = this._add(new THREE.Mesh(new THREE.PlaneGeometry(ARENA.W, ARENA.H),
                new THREE.MeshLambertMaterial({ color: biome.ceilColor })));
            ceil.rotation.x = Math.PI / 2;
            ceil.position.y = ARENA.WALL_H;
        }

        // Walls: outer ring and maze are each merged into one geometry (2 draw calls for all walls),
        // plus one merged "trim" mesh: cornices, skirting, corner pillars and ceiling beams.
        const wallMat = buildSurfaceMaterial(biome, 'wall', low);
        this.wallMat = wallMat;
        const T = ARENA.WALL_T, WH = ARENA.WALL_H;
        const outer = [], inner = [], trim = [];
        const wall = (list, w, d, x, z) => {
            list.push(worldBox(w, WH, d, tile).translate(x, WH / 2, z));
            trim.push(new THREE.BoxGeometry(w + 0.24, 0.28, d + 0.24).translate(x, WH - 0.14, z));
            trim.push(new THREE.BoxGeometry(w + 0.16, 0.3, d + 0.16).translate(x, 0.15, z));
        };
        wall(outer, ARENA.W + T, T, 0, -ARENA.H / 2);
        wall(outer, ARENA.W + T, T, 0, ARENA.H / 2);
        wall(outer, T, ARENA.H - T, -ARENA.W / 2, 0);
        wall(outer, T, ARENA.H - T, ARENA.W / 2, 0);
        const ph = this.openSky ? WH + 2.5 : WH;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            trim.push(new THREE.BoxGeometry(1.3, ph, 1.3).translate(sx * (ARENA.W / 2 - T / 2 - 0.3), ph / 2, sz * (ARENA.H / 2 - T / 2 - 0.3)));
        }
        if (!this.openSky) for (let x = -ARENA.W / 2 + 6.5; x < ARENA.W / 2; x += 6.5) trim.push(new THREE.BoxGeometry(0.5, 0.45, ARENA.H).translate(x, WH - 0.22, 0));

        const layout = MAZE_LAYOUTS[Math.floor(Math.random() * MAZE_LAYOUTS.length)];
        for (const def of layout) {
            const pos = [{ x: def.x, z: def.z }];
            if (def.x !== 0) pos.push({ x: -def.x, z: def.z });
            if (def.z !== 0) pos.push({ x: def.x, z: -def.z });
            if (def.x !== 0 && def.z !== 0) pos.push({ x: -def.x, z: -def.z });
            for (const p of pos) {
                if (Math.abs(p.x) < 3 && Math.abs(p.z) < 3) continue;
                if (Math.abs(p.x) + def.w / 2 > ARENA.W / 2 - 2.5) continue;
                if (Math.abs(p.z) + def.d / 2 > ARENA.H / 2 - 2.5) continue;
                this.innerWalls.push({ x: p.x, z: p.z, w: def.w, d: def.d });
                wall(inner, def.w, def.d, p.x, p.z);
            }
        }
        if (biome.keep) this._buildKeep(trim);
        const mergeAdd = (list, mat, own) => {
            const g = mergeGeometries(list);
            list.forEach(x => x.dispose());
            const m = this._add(new THREE.Mesh(g, mat), own);
            m.castShadow = true; m.receiveShadow = true;
            return m;
        };
        mergeAdd(outer, wallMat, false);
        this.mazeMesh = inner.length ? mergeAdd(inner, wallMat, false) : null;
        this.trimMesh = mergeAdd(trim, new THREE.MeshLambertMaterial({ color: biome.trim }), true);

        // Lights (same count in every biome, so shader programs are reused across swaps)
        const hemi = new THREE.HemisphereLight(biome.hemiSky, biome.hemiGround, biome.hemiIntensity * 0.6);
        const sun = new THREE.DirectionalLight(biome.sunColor, biome.sunIntensity);
        sun.position.set(...biome.sunDir);
        const rim = new THREE.PointLight(biome.rimColor, biome.rimIntensity * 0.35, 70, 1.6);
        rim.position.set(0, 4.2, 0);
        this.group.add(hemi, sun, rim);
        this.lights = { hemi, sun, rim };

        this._buildEmbers();
        this._buildProps();
    }

    // Wave-1 set dressing: lava moat along the outer walls, wall torches, carved faces, floor sigil.
    _buildKeep(trim) {
        const T = ARENA.WALL_T, MW = 2.2;
        const ox = ARENA.W / 2 - T / 2, oz = ARENA.H / 2 - T / 2;   // inner face of the outer walls
        const hx = ox - MW, hz = oz - MW;                              // inner edge of the moat
        this.lava = { hx, hz };

        const strip = (w, d, x, z) => {
            const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, 0.04, z);
            const uv = g.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 2, uv.getY(i) * d / 2);
            return g;
        };
        const strips = [strip(ox * 2, MW, 0, -oz + MW / 2), strip(ox * 2, MW, 0, oz - MW / 2), strip(MW, hz * 2, -ox + MW / 2, 0), strip(MW, hz * 2, ox - MW / 2, 0)];
        this.lavaTex = lavaTexture();
        const lava = this._add(new THREE.Mesh(mergeGeometries(strips), new THREE.MeshBasicMaterial({ map: this.lavaTex })));
        strips.forEach(g => g.dispose());
        lava.renderOrder = 1;
        // stone kerb around the moat
        trim.push(new THREE.BoxGeometry(hx * 2 + 0.3, 0.16, 0.3).translate(0, 0.08, -hz), new THREE.BoxGeometry(hx * 2 + 0.3, 0.16, 0.3).translate(0, 0.08, hz),
            new THREE.BoxGeometry(0.3, 0.16, hz * 2 + 0.3).translate(-hx, 0.08, 0), new THREE.BoxGeometry(0.3, 0.16, hz * 2 + 0.3).translate(hx, 0.08, 0));

        // Torches and faces alternate along the walls
        this.flameTex = flameStrip();
        this.flameTex.repeat.set(0.25, 1);
        this.flameMat = new THREE.SpriteMaterial({ map: this.flameTex, fog: true });
        const faces = [];
        const spot = (x, z, ry, i) => {
            const nx = Math.sin(ry), nz = Math.cos(ry);   // wall normal, pointing into the arena
            if (i % 2 === 0) {
                trim.push(new THREE.BoxGeometry(0.16, 0.16, 0.5).rotateY(ry).translate(x + nx * 0.25, 2.2, z + nz * 0.25));
                trim.push(new THREE.CylinderGeometry(0.2, 0.1, 0.22, 6).translate(x + nx * 0.5, 2.36, z + nz * 0.5));
                const s = new THREE.Sprite(this.flameMat);
                s.scale.set(0.6, 0.9, 1);
                s.position.set(x + nx * 0.5, 2.9, z + nz * 0.5);
                this.group.add(s);
                this.sprites.push(s);
            } else faces.push(new THREE.PlaneGeometry(2, 2).rotateY(ry).translate(x + nx * 0.03, 2.2, z + nz * 0.03));
        };
        let i = 0;
        for (let x = -ARENA.W / 2 + 4.5; x <= ARENA.W / 2 - 4; x += 4.3) { spot(x, -oz, 0, i); spot(x, oz, Math.PI, i + 1); i++; }
        i = 1;
        for (let z = -ARENA.H / 2 + 5; z <= ARENA.H / 2 - 4; z += 4.3) { spot(-ox, z, Math.PI / 2, i); spot(ox, z, -Math.PI / 2, i + 1); i++; }
        const ft = facePanel();
        this._add(new THREE.Mesh(mergeGeometries(faces), new THREE.MeshLambertMaterial({ map: ft, emissiveMap: ft, emissive: 0x3a1410 })));
        faces.forEach(g => g.dispose());

        const sig = this._add(new THREE.Mesh(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ map: pentagramTexture(), transparent: true, alphaTest: 0.5, depthWrite: false })));
        sig.position.y = 0.03;
        sig.renderOrder = 1;
    }

    inLava(x, z) { return !!this.lava && (Math.abs(x) > this.lava.hx + 0.2 || Math.abs(z) > this.lava.hz + 0.2); }

    _buildEmbers() {
        const cfg = this.biome.embers;
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(cfg.color).multiplyScalar(2.2),
            transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const inst = this._add(new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 5, 4), mat, cfg.count));
        inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        inst.frustumCulled = false;
        const top = this.openSky ? 9 : ARENA.WALL_H;
        const data = [];
        for (let i = 0; i < cfg.count; i++) {
            data.push({
                x: (Math.random() - 0.5) * ARENA.W * 0.95, z: (Math.random() - 0.5) * ARENA.H * 0.95, y: Math.random() * top,
                vy: cfg.rise ? (0.3 + Math.random() * 0.9) * cfg.speed : (Math.random() - 0.5) * 0.4 * cfg.speed,
                vx: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.4, ph: Math.random() * 6.28,
            });
        }
        this.embers = { inst, data, top };
    }

    _buildProps() {
        const cfg = this.biome.props;
        if (!cfg) return;
        const pts = [];
        const inset = ARENA.WALL_T / 2 + (cfg.type === 'tube' ? 0.08 : 0.45);
        const hx = ARENA.W / 2 - inset, hz = ARENA.H / 2 - inset;
        for (let x = -ARENA.W / 2 + 4; x <= ARENA.W / 2 - 4; x += cfg.spacing) { pts.push([x, -hz]); pts.push([x, hz]); }
        for (let z = -ARENA.H / 2 + 5; z <= ARENA.H / 2 - 5; z += cfg.spacing) { pts.push([-hx, z]); pts.push([hx, z]); }

        let glowGeo, standGeo = null, y = 1, standH = 0;
        if (cfg.type === 'flame') {
            standH = cfg.candle ? 1.5 : 0.9;
            standGeo = new THREE.CylinderGeometry(cfg.candle ? 0.05 : 0.2, cfg.candle ? 0.09 : 0.32, standH, 8);
            glowGeo = new THREE.ConeGeometry(cfg.candle ? 0.09 : 0.24, cfg.candle ? 0.3 : 0.75, 7);
            glowGeo.translate(0, cfg.candle ? 0.15 : 0.37, 0);
            y = standH;
        } else if (cfg.type === 'crystal') {
            glowGeo = new THREE.OctahedronGeometry(0.42); y = 0.75;
        } else if (cfg.type === 'tube') {
            glowGeo = new THREE.BoxGeometry(0.1, 3.0, 0.1); y = 2.2;
        } else {
            glowGeo = new THREE.IcosahedronGeometry(0.28, 1); y = 2.6;
        }
        const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.color).multiplyScalar(cfg.type === 'crystal' ? 1.6 : 2.6) });
        const glow = this._add(new THREE.InstancedMesh(glowGeo, glowMat, pts.length));
        glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        glow.frustumCulled = false;
        const items = pts.map(([x, z]) => ({
            x, z, y, ph: Math.random() * 6.28,
            rx: cfg.type === 'crystal' ? (Math.random() - 0.5) * 0.7 : 0, ry: Math.random() * 6.28,
            s: cfg.type === 'crystal' ? 0.7 + Math.random() * 0.8 : 1,
        }));
        if (standGeo) {
            const stand = this._add(new THREE.InstancedMesh(standGeo,
                new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.6, metalness: 0.5 }), pts.length));
            items.forEach((it, i) => { _m.makeTranslation(it.x, standH / 2, it.z); stand.setMatrixAt(i, _m); });
            stand.instanceMatrix.needsUpdate = true;
        }
        this.props = { glow, items, type: cfg.type };
        this._updateProps(0);
    }

    _updateProps(t) {
        const pr = this.props;
        if (!pr) return;
        for (let i = 0; i < pr.items.length; i++) {
            const it = pr.items[i];
            let sx = it.s, sy = it.s, py = it.y;
            if (pr.type === 'flame') {
                sy = 0.8 + 0.25 * Math.sin(t * 11 + it.ph) + 0.15 * Math.sin(t * 23 + it.ph * 2);
                sx = 0.9 + 0.12 * Math.sin(t * 17 + it.ph);
            } else if (pr.type === 'orb') {
                py += Math.sin(t * 1.3 + it.ph) * 0.35;
                sx = sy = 1 + 0.15 * Math.sin(t * 3 + it.ph);
            } else if (pr.type === 'crystal') {
                sy = it.s * 2.1;
            }
            _p.set(it.x, py, it.z); _s.set(sx, sy, sx);
            _q.setFromEuler(_e.set(it.rx, it.ry, it.rx * 0.5));
            _m.compose(_p, _q, _s);
            pr.glow.setMatrixAt(i, _m);
        }
        pr.glow.instanceMatrix.needsUpdate = true;
    }

    update(dt, t) {
        if (this.sky) this.sky.userData.uniforms.time.value = t;
        if (this.lavaTex) this.lavaTex.offset.set(Math.floor(t * 6) / 64 % 1, Math.floor(Math.sin(t * 0.5) * 6) / 64); // steps of one texel, like a palette-era scroll
        if (this.flameTex) this.flameTex.offset.x = (Math.floor(t * 9) % 4) * 0.25;
        const em = this.embers;
        if (em) {
            const rise = this.biome.embers.rise;
            for (let i = 0; i < em.data.length; i++) {
                const d = em.data[i];
                d.y += d.vy * dt; d.x += (d.vx + Math.sin(t + d.ph) * 0.2) * dt; d.z += d.vz * dt; d.ph += dt * 3;
                if (rise) {
                    if (d.y > em.top + 0.5) { d.y = 0.05; d.x = (Math.random() - 0.5) * ARENA.W * 0.95; d.z = (Math.random() - 0.5) * ARENA.H * 0.95; }
                } else if (d.y > em.top - 0.3 || d.y < 0.1) d.vy *= -1;
                if (Math.abs(d.x) > ARENA.W / 2) d.vx *= -1;
                if (Math.abs(d.z) > ARENA.H / 2) d.vz *= -1;
                const s = 0.6 + Math.sin(d.ph) * 0.4;
                _m.makeScale(s, s, s); _m.setPosition(d.x, d.y, d.z);
                em.inst.setMatrixAt(i, _m);
            }
            em.inst.instanceMatrix.needsUpdate = true;
        }
        if (this.props && this.props.type !== 'tube' && this.props.type !== 'crystal') this._updateProps(t);
        if (this.lights.rim) this.lights.rim.intensity = this.biome.rimIntensity * 0.35 * (0.9 + 0.1 * Math.sin(t * 2.3));
    }

    // ---- collision ----
    collideCircle(e) {
        for (const w of this.innerWalls) {
            const hw = w.w / 2, hd = w.d / 2;
            const cx = Math.max(w.x - hw, Math.min(e.x, w.x + hw));
            const cz = Math.max(w.z - hd, Math.min(e.z, w.z + hd));
            const dx = e.x - cx, dz = e.z - cz, dist = Math.hypot(dx, dz);
            if (dist < e.r) {
                if (dist > 0.001) { e.x = cx + (dx / dist) * e.r; e.z = cz + (dz / dist) * e.r; }
                else {
                    const dL = e.x - (w.x - hw), dR = (w.x + hw) - e.x, dT = e.z - (w.z - hd), dB = (w.z + hd) - e.z;
                    const mn = Math.min(dL, dR, dT, dB);
                    if (mn === dL) e.x = w.x - hw - e.r; else if (mn === dR) e.x = w.x + hw + e.r;
                    else if (mn === dT) e.z = w.z - hd - e.r; else e.z = w.z + hd + e.r;
                }
            }
        }
        const hx = ARENA.W / 2 - ARENA.WALL_T / 2 - e.r, hz = ARENA.H / 2 - ARENA.WALL_T / 2 - e.r;
        e.x = Math.max(-hx, Math.min(hx, e.x));
        e.z = Math.max(-hz, Math.min(hz, e.z));
    }

    // Bullet vs walls. Reflects velocity and returns true on contact.
    bulletBounce(b) {
        for (const w of this.innerWalls) {
            const hw = w.w / 2 + b.sz, hd = w.d / 2 + b.sz;
            if (b.x >= w.x - hw && b.x <= w.x + hw && b.z >= w.z - hd && b.z <= w.z + hd) {
                const dL = b.x - (w.x - hw), dR = (w.x + hw) - b.x, dT = b.z - (w.z - hd), dB = (w.z + hd) - b.z;
                const mn = Math.min(dL, dR, dT, dB);
                if (mn === dL || mn === dR) { b.vx = -b.vx; b.x = mn === dL ? w.x - hw - 0.01 : w.x + hw + 0.01; }
                else { b.vz = -b.vz; b.z = mn === dT ? w.z - hd - 0.01 : w.z + hd + 0.01; }
                return true;
            }
        }
        const hx = ARENA.W / 2 - ARENA.WALL_T / 2 - b.sz, hz = ARENA.H / 2 - ARENA.WALL_T / 2 - b.sz;
        if (b.x > hx) { b.x = hx; b.vx = -b.vx; return true; }
        if (b.x < -hx) { b.x = -hx; b.vx = -b.vx; return true; }
        if (b.z > hz) { b.z = hz; b.vz = -b.vz; return true; }
        if (b.z < -hz) { b.z = -hz; b.vz = -b.vz; return true; }
        return false;
    }

    pointInWall(x, z, pad = 0) {
        if (Math.abs(x) > ARENA.W / 2 - ARENA.WALL_T / 2 - pad || Math.abs(z) > ARENA.H / 2 - ARENA.WALL_T / 2 - pad) return true;
        for (const w of this.innerWalls) {
            if (x > w.x - w.w / 2 - pad && x < w.x + w.w / 2 + pad && z > w.z - w.d / 2 - pad && z < w.z + w.d / 2 + pad) return true;
        }
        return false;
    }

    hasLineOfSight(p1, p2) {
        const dx = p2.x - p1.x, dz = p2.z - p1.z;
        const steps = Math.max(2, Math.ceil(Math.hypot(dx, dz) * 2));
        for (let i = 1; i < steps; i++) {
            const t = i / steps, x = p1.x + dx * t, z = p1.z + dz * t;
            for (const w of this.innerWalls) {
                if (x > w.x - w.w / 2 && x < w.x + w.w / 2 && z > w.z - w.d / 2 && z < w.z + w.d / 2) return false;
            }
        }
        return true;
    }

    randomOpenSpot(avoid, minDist = 8) {
        for (let i = 0; i < 40; i++) {
            const x = (Math.random() - 0.5) * (ARENA.W - 8), z = (Math.random() - 0.5) * (ARENA.H - 8);
            if (this.pointInWall(x, z, 1.2)) continue;
            if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < minDist) continue;
            return { x, z };
        }
        return { x: 0, z: 0 };
    }

    dispose() {
        for (const { mesh, disposeMat } of this.owned) {
            this.group.remove(mesh);
            mesh.geometry.dispose();
            if (disposeMat) mesh.material.dispose();
            if (mesh.isInstancedMesh) mesh.dispose();
        }
        this.owned.length = 0;
        this.innerWalls.length = 0;
        if (this.wallMat) { this.wallMat.dispose(); this.wallMat = null; }
        for (const k of Object.keys(this.lights)) {
            this.group.remove(this.lights[k]);
            this.lights[k].dispose?.();
        }
        this.lights = {};
        for (const s of this.sprites || []) this.group.remove(s);
        this.sprites = [];
        if (this.flameMat) { this.flameMat.dispose(); this.flameMat = null; }
        this.sky = null; this.embers = null; this.props = null; this.lava = null; this.lavaTex = null; this.flameTex = null;
    }
}
