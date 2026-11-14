import * as THREE from 'three';

// Procedural, tileable textures baked per biome: albedo + emissive + normal.
// Everything is computed per pixel from periodic value noise, so tiles are seamless.

const _cache = new Map();

function hash(ix, iy, seed) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

function vnoise(x, y, px, py, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const xa = ((x0 % px) + px) % px, xb = (xa + 1) % px;
    const ya = ((y0 % py) + py) % py, yb = (ya + 1) % py;
    const a = hash(xa, ya, seed), b = hash(xb, ya, seed);
    const c = hash(xa, yb, seed), d = hash(xb, yb, seed);
    return a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy;
}

// u,v in [0,1); px/py = lattice cells across the tile at the first octave
function fbm(u, v, oct, px, seed, py = px) {
    let amp = 1, sum = 0, max = 0;
    for (let i = 0; i < oct; i++) {
        sum += vnoise(u * px, v * py, px, py, seed + i * 17) * amp;
        max += amp; amp *= 0.5; px *= 2; py *= 2;
    }
    return sum / max;
}

const ridge = (n, k) => Math.max(0, 1 - Math.abs(n - 0.5) * k);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Offset brick/cell layout. Returns cell-local coords and distance to the cell edge (tile units).
const _cell = { bx: 0, by: 0, col: 0, row: 0, d: 0 };
function cells(u, v, cols, rows, offset = true) {
    const ry = v * rows, row = Math.floor(ry);
    const fx = u * cols + (offset && (row & 1) ? 0.5 : 0), col = Math.floor(fx);
    const bx = fx - col, by = ry - row;
    _cell.bx = bx; _cell.by = by; _cell.row = row; _cell.col = ((col % cols) + cols) % cols;
    _cell.d = Math.min(Math.min(bx, 1 - bx) / cols, Math.min(by, 1 - by) / rows);
    return _cell;
}

function set(o, r, g, b, er = 0, eg = 0, eb = 0, h = 0.5) {
    o[0] = r; o[1] = g; o[2] = b; o[3] = er; o[4] = eg; o[5] = eb; o[6] = h;
}

// ---------------------------------------------------------------- designs
// Every design is drawn on a 64px grid (16 texels per world unit on walls). v = 0 is the bottom.
const P = u => Math.floor(u * 64) & 63;
const mul = (o, k) => { o[0] *= k; o[1] *= k; o[2] *= k; };
// Shared brick helper: returns shade factor, or 0 on mortar
function brick(x, y, bw, bh, seed) {
    const row = Math.floor(y / bh), xo = (x + ((row & 1) ? bw >> 1 : 0)) & 63, bx = xo % bw, by = y % bh;
    if (bx === 0 || by === 0) return 0;
    let k = 0.8 + 0.4 * hash(Math.floor(xo / bw), row, seed);
    if (by === bh - 1) k += 0.12; if (by === 1) k -= 0.12;
    if (hash(x, y, seed + 5) > 0.9) k -= 0.12;
    return k;
}
const DESIGNS = {
    // ---------------- OFFICE: stained carpet tiles, beige wall with blinds glowing red from outside
    office: {
        floor(u, v, o) {
            const x = P(u), y = P(v), n = hash(x, y, 3), t = hash(x >> 4, y >> 4, 7);
            let k = 0.85 + 0.25 * n + 0.12 * t;
            if ((x & 15) === 0 || (y & 15) === 0) k *= 0.72;
            set(o, 52 * k, 62 * k, 86 * k);
            if (fbm(u, v, 3, 4, 9) > 0.68) { o[0] = o[0] * 0.6 + 30; o[1] *= 0.5; o[2] *= 0.45; }
        },
        wall(u, v, o) {
            const x = P(u), y = P(v), n = hash(x, y, 5);
            let k = 0.9 + 0.12 * n;
            if ((x & 31) === 0) k *= 0.75;
            set(o, 168 * k, 158 * k, 138 * k);
            if (y < 5) set(o, 48, 40, 36);
            if (y === 5) set(o, 90, 78, 66);
            if (x >= 9 && x <= 54 && y >= 24 && y <= 55) {           // window with blinds
                if (x === 9 || x === 54 || y === 24 || y === 55 || x === 31 || x === 32) { set(o, 60, 56, 54); return; }
                const slat = (y % 3) !== 0, broken = hash(x >> 2, Math.floor(y / 3), 13) > 0.86;
                if (slat && !broken) set(o, 176, 172, 160);
                else set(o, 60, 10, 14, broken ? 200 : 110, broken ? 30 : 12, broken ? 30 : 16);
            }
        },
        inner(u, v, o) {                                              // cubicle partition fabric
            const x = P(u), y = P(v);
            let k = 0.85 + 0.2 * hash(x, y, 4) + (((x + y) & 1) ? 0.05 : 0);
            set(o, 78 * k, 88 * k, 104 * k);
            if ((x & 31) < 2) set(o, 150, 150, 156);
            if ((y & 15) === 15) set(o, 150, 150, 156);
        },
    },
    // ---------------- BUTCHER: checker tiles with blood, white wall tiles with drips, steel counters
    butcher: {
        floor(u, v, o) {
            const x = P(u), y = P(v), c = ((x >> 4) + (y >> 4)) & 1, n = hash(x, y, 2);
            let k = 0.9 + 0.12 * n;
            if ((x & 15) === 0 || (y & 15) === 0) { set(o, 70, 62, 60); }
            else if (c) set(o, 200 * k, 196 * k, 186 * k); else set(o, 44 * k, 44 * k, 50 * k);
            const b = fbm(u, v, 3, 4, 21);
            if (b > 0.6) { const d = b > 0.68 ? 0.5 : 0.8; set(o, (o[0] * 0.3 + 120) * d, o[1] * 0.15, o[2] * 0.15); }
        },
        wall(u, v, o) {
            const x = P(u), y = P(v), n = hash(x, y, 6);
            let k = 0.9 + 0.1 * n + 0.08 * hash(x >> 3, y >> 3, 8);
            if ((x & 7) === 0 || (y & 7) === 0) set(o, 120, 112, 108); else set(o, 214 * k, 212 * k, 204 * k);
            if (y >= 36 && y <= 39 && (x & 7) && (y & 7)) set(o, 150, 30, 30);
            const col = x >> 1, top = 64 - Math.floor(hash(col, 0, 31) * 70);  // drips running down from the top
            if (hash(col, 1, 33) > 0.55 && y > top) { const d = 0.6 + 0.4 * hash(x, y, 9); set(o, 130 * d, 10 * d, 12 * d); }
            if (y < 6 && fbm(u, 0.1, 2, 8, 5) > 0.45) set(o, 96, 10, 12);
        },
        inner(u, v, o) {                                              // brushed steel
            const x = P(u), y = P(v);
            let k = 0.8 + 0.25 * hash(x >> 3, y, 12) + 0.08 * hash(x, y, 2);
            if ((y & 15) === 0 || (x & 31) === 0) k *= 0.6;
            set(o, 132 * k, 138 * k, 146 * k);
            if (((x & 31) === 3 || (x & 31) === 28) && ((y & 15) === 3 || (y & 15) === 12)) set(o, 70, 72, 78);
            if (fbm(u, v, 3, 4, 44) > 0.7) set(o, 110, 14, 14);
        },
    },
    // ---------------- BANK: marble checker, wood panelling under green wallpaper with gold trim
    bank: {
        floor(u, v, o) {
            const x = P(u), y = P(v), c = ((x >> 5) + (y >> 5)) & 1;
            const vein = ridge(fbm(u, v, 4, 4, c ? 50 : 60), 9);
            let k = 0.9 + 0.1 * hash(x, y, 3) - 0.35 * vein;
            if ((x & 31) === 0 || (y & 31) === 0) k *= 0.6;
            if (c) set(o, 206 * k, 198 * k, 178 * k); else set(o, 40 * k, 66 * k, 54 * k);
        },
        wall(u, v, o) {
            const x = P(u), y = P(v), n = hash(x, y, 4);
            if (y < 26) {                                             // wood panels
                const bx = x & 15, by = y;
                let k = 0.85 + 0.2 * hash(x, y >> 2, 6) + 0.05 * n;
                if (bx === 0 || by === 0 || by === 25) k *= 0.55;
                else if (bx > 2 && bx < 13 && by > 3 && by < 22) { k *= 1.12; if (bx === 3 || by === 21) k *= 0.7; if (bx === 12 || by === 4) k *= 1.2; }
                set(o, 96 * k, 54 * k, 30 * k);
            } else if (y < 29) {
                set(o, y === 27 ? 240 : 190, y === 27 ? 200 : 150, 50);
            } else {                                                  // wallpaper
                let k = 0.9 + 0.12 * n;
                set(o, 34 * k, 70 * k, 52 * k);
                const dx = (x & 15) - 8, dy = ((y - 29) & 15) - 8;
                if (Math.abs(dx) + Math.abs(dy) < 3) set(o, 200, 160, 50);
                if ((x & 15) === 0) mul(o, 0.8);
            }
        },
        inner(u, v, o) {                                              // cream marble
            const x = P(u), y = P(v);
            const vein = ridge(fbm(u, v, 4, 4, 70), 10);
            let k = 0.92 + 0.1 * hash(x, y, 3) - 0.4 * vein;
            if ((y & 31) === 0) k *= 0.7;
            set(o, 214 * k, 206 * k, 190 * k);
        },
    },
    // ---------------- TOWN SQUARE: cobbles, house fronts with one lit window, hedges
    square: {
        floor(u, v, o) {
            const x = P(u), y = P(v), row = y >> 3, xo = (x + ((row & 1) ? 4 : 0)) & 63, bx = xo & 7, by = y & 7;
            const h = hash(xo >> 3, row, 5), n = hash(x, y, 8);
            const edge = bx === 0 || by === 0 || ((bx === 1 || bx === 7) && (by === 1 || by === 7));
            let k = edge ? 0.45 : 0.8 + 0.4 * h + 0.1 * n;
            if (!edge && (by === 6 || bx === 2)) k += 0.08;
            set(o, 92 * k, 88 * k, 90 * k);
            if (fbm(u, v, 3, 4, 14) > 0.66 && edge) set(o, 40, 70, 36);
        },
        wall(u, v, o) {
            const x = P(u), y = P(v), k = brick(x, y, 8, 4, 3);
            if (k === 0) set(o, 60, 50, 46); else set(o, 132 * k, 64 * k, 48 * k);
            if (y < 4) set(o, 70, 66, 64);
            const win = (x0, lit) => {
                if (x < x0 || x > x0 + 15 || y < 30 || y > 53) return;
                const bx = x - x0, by = y - 30;
                if (bx === 0 || bx === 15 || by === 0 || by === 23 || bx === 7 || bx === 8 || by === 11 || by === 12) { set(o, 214, 206, 190); return; }
                if (lit) { const f = 0.8 + 0.2 * hash(x, y, 2); set(o, 90, 60, 20, 255 * f, 170 * f, 60 * f); }
                else if (hash(bx >> 2, by >> 1, 41) > 0.5) set(o, 86, 60, 38); else set(o, 14, 14, 22);
            };
            win(4, true); win(44, false);
            if (x >= 25 && x <= 38 && y < 28) {                        // door
                const bx = x - 25;
                if (bx === 0 || bx === 13 || y === 27) set(o, 214, 206, 190);
                else { const d = 0.8 + 0.2 * hash(bx >> 2, y >> 3, 9); set(o, 40 * d, 70 * d, 60 * d); if (bx === 10 && y === 13) set(o, 220, 180, 60); }
            }
        },
        inner(u, v, o) {                                              // hedge
            const x = P(u), y = P(v), n = hash(x, y, 6), m = hash(x >> 1, y >> 1, 9);
            const k = 0.6 + 0.5 * m + 0.25 * n;
            set(o, 30 * k, 78 * k, 34 * k);
            if (n > 0.93) set(o, 120, 30, 40);
        },
    },
    // ---------------- FOREST: dead leaves and dirt, a wall of trunks, log-cabin planks
    forest: {
        floor(u, v, o) {
            const x = P(u), y = P(v), n = hash(x, y, 3), f = fbm(u, v, 4, 4, 17);
            let k = 0.7 + 0.5 * f + 0.15 * n;
            set(o, 62 * k, 48 * k, 34 * k);
            if (f > 0.6) set(o, 34 * k, 62 * k, 36 * k);
            const l = hash(x >> 1, y >> 1, 23);
            if (l > 0.9) set(o, 150, 70, 24); else if (l > 0.84) set(o, 110, 36, 26); else if (l < 0.04) set(o, 20, 16, 14);
        },
        wall(u, v, o) {
            const x = P(u), y = P(v);
            const mist = 0.5 + 0.5 * Math.sin(v * 6.283);
            set(o, 8 + 10 * mist, 16 + 16 * mist, 22 + 20 * mist);
            for (let i = 0; i < 9; i++) {                             // trunks, far ones first
                const cx = Math.floor(hash(i, 1, 71) * 64), w = 2 + Math.floor(hash(i, 2, 71) * 5), d = ((x - cx) & 63);
                if (d < w) {
                    const sh = 0.45 + 0.09 * i + (d === 0 ? 0.25 : 0) - (d === w - 1 ? 0.2 : 0) + 0.2 * hash(d, y >> 2, 5 + i);
                    set(o, 48 * sh, 36 * sh, 32 * sh);
                    if (hash(d + i * 9, y, 91) > 0.95) set(o, 110, 20, 26);
                }
            }
            const leaf = fbm(u, v, 3, 8, 37);
            if ((y > 50 || y < 3) && leaf > 0.42) { const k = 0.6 + hash(x, y, 4) * 0.6; set(o, 14 * k, 40 * k, 34 * k); }
        },
        inner(u, v, o) {                                              // cabin logs
            const x = P(u), y = P(v), by = y & 7, row = y >> 3;
            let k = 0.75 + 0.3 * hash(x >> 3, row, 6) + 0.1 * hash(x, y, 2);
            if (by === 0) k *= 0.4; else if (by === 7) k *= 0.7; else if (by === 4) k *= 1.15;
            if (((x + row * 21) & 63) === 0) k *= 0.5;
            set(o, 98 * k, 66 * k, 40 * k);
        },
    },
    // ---------------- DUNGEON: flagstones, big mossy blocks with iron rings
    dungeon: {
        floor(u, v, o) {
            const x = P(u), y = P(v);
            const row = y >> 5, xo = (x + (row ? 16 : 0)) & 63, col = xo >> 5, bx = xo & 31, by = y & 31;
            if (bx === 0 || by === 0) { set(o, 22, 22, 24); return; }
            const h = hash(col, row, 5), sp = hash(x, y, 9);
            let k = 0.8 + 0.35 * h;
            if (by === 31 || bx === 1) k += 0.12; if (by === 1 || bx === 31) k -= 0.14;
            if (sp > 0.88) k -= 0.12; else if (sp < 0.1) k += 0.08;
            if (h > 0.5 && Math.abs(bx - by * 0.6 - 6 - h * 8) < 0.8) k -= 0.4;
            set(o, 70 * k, 70 * k, 74 * k);
            if (fbm(u, v, 2, 4, 5) > 0.66 && sp > 0.25) set(o, 40 * k, 62 * k, 36 * k);
        },
        wall(u, v, o) {
            const x = P(u), y = P(v), k = brick(x, y, 16, 8, 3);
            if (k === 0) { set(o, 20, 20, 22); return; }
            set(o, 86 * k, 84 * k, 88 * k);
            if (fbm(u, v, 3, 4, 27) > 0.6 - (y < 12 ? 0.12 : 0)) set(o, 36 * k, 64 * k, 38 * k);
            const dx = x - 32, dy = y - 44, r = Math.abs(Math.hypot(dx, dy) - 4);     // iron ring
            if (r < 0.9 || (Math.abs(dx) < 1.5 && dy > 3 && dy < 7)) set(o, 34, 30, 30);
        },
    },
};
// Upside-down rot: dark tendrils creeping over every wall, thicker near floor and top
function vines(u, v, o) {
    const x = P(u), y = P(v);
    const n = fbm(u, v, 3, 4, 133), edge = Math.min(v, 1 - v);
    const t = ridge(n, 16 - 6 * (1 - Math.min(1, edge * 4)));
    if (t > 0.72) {
        const hot = hash(x, y, 77) > 0.9;
        set(o, hot ? 150 : 16, hot ? 20 : 10, hot ? 34 : 18, hot ? 120 : 0, hot ? 10 : 0, hot ? 20 : 0);
    } else if (t > 0.55) mul(o, 0.6);
}

function nearest(t, srgb = true, mips = true) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = mips ? THREE.NearestMipmapNearestFilter : THREE.NearestFilter;
    t.generateMipmaps = mips;
    t.anisotropy = 1;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function bake(fn, size) {
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
    const cA = mk(), cE = mk();
    const gA = cA.getContext('2d'), gE = cE.getContext('2d');
    const iA = gA.createImageData(size, size), iE = gE.createImageData(size, size);
    const o = new Float32Array(7);
    let glow = false;
    for (let y = 0; y < size; y++) {
        const v = 1 - (y + 0.5) / size;
        for (let x = 0; x < size; x++) {
            o[3] = o[4] = o[5] = 0;
            fn((x + 0.5) / size, v, o);
            const i = (y * size + x) * 4;
            iA.data[i] = o[0]; iA.data[i + 1] = o[1]; iA.data[i + 2] = o[2]; iA.data[i + 3] = 255;
            iE.data[i] = o[3]; iE.data[i + 1] = o[4]; iE.data[i + 2] = o[5]; iE.data[i + 3] = 255;
            if (o[3] + o[4] + o[5] > 8) glow = true;
        }
    }
    gA.putImageData(iA, 0, 0); gE.putImageData(iE, 0, 0);
    return { map: nearest(new THREE.CanvasTexture(cA)), emissiveMap: glow ? nearest(new THREE.CanvasTexture(cE)) : null };
}

// ---------------------------------------------------------------- painted assets (v2/assets)
// Low-res PNGs generated with GPT Image 2.6 and reduced offline. If they fail to load (e.g. file://),
// everything falls back to the procedural versions below.
const ASSETS = {};
export let ATLAS = null;
export async function loadAssets(base) {
    try {
        const atlas = await (await fetch(base + 'atlas.json')).json();
        const loader = new THREE.TextureLoader(), tiles = ['wall', 'floor'];
        await Promise.all(tiles.map(n =>
            loader.loadAsync(base + n + '.png').then(tex => { ASSETS[n] = nearest(tex, true, tiles.includes(n)); })));
        ATLAS = atlas;
    } catch (e) {
        ATLAS = null;
        for (const k of Object.keys(ASSETS)) delete ASSETS[k];
    }
}
export const asset = n => (ATLAS && ASSETS[n]) || null;

// Returns { floor, wall, inner } (each {map, emissiveMap}), cached per theme. inner = free-standing walls.
export function biomeTextures(id) {
    if (!_cache.has(id)) {
        const d = DESIGNS[id], size = 64;
        const withVines = fn => (u, v, o) => { fn(u, v, o); vines(u, v, o); };
        const wall = bake(withVines(d.wall), size);
        _cache.set(id, { floor: bake(d.floor, size), wall, inner: d.inner ? bake(d.inner, size) : wall });
    }
    return _cache.get(id);
}

// ---------------------------------------------------------------- pixel-art extras
// fn(x, y, out) with y = 0 at the bottom; out = [r, g, b, a]
function pix(key, w, h, fn, mips = false) {
    if (_cache.has(key)) return _cache.get(key);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h), o = [0, 0, 0, 255];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        o[0] = o[1] = o[2] = 0; o[3] = 255;
        fn(x, h - 1 - y, o);
        const i = (y * w + x) * 4;
        img.data[i] = o[0]; img.data[i + 1] = o[1]; img.data[i + 2] = o[2]; img.data[i + 3] = o[3];
    }
    g.putImageData(img, 0, 0);
    const t = nearest(new THREE.CanvasTexture(c), true, mips);
    _cache.set(key, t);
    return t;
}
const bayer4 = (x, y) => [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(x & 3) + (y & 3) * 4] / 16;

// Lava: four hard colour bands, scrolled by the arena
export function lavaTexture() {
    if (asset('lava')) return asset('lava');
    return pix('lava', 64, 64, (x, y, o) => {
        const n = fbm(x / 64, y / 64, 3, 4, 131) + (bayer4(x, y) - 0.5) * 0.05;
        const c = n > 0.62 ? [255, 226, 90] : n > 0.53 ? [248, 140, 24] : n > 0.44 ? [196, 52, 12] : [84, 20, 12];
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    }, true);
}

// Carved demon face on a stone slab, eyes lit
export function facePanel() {
    if (asset('face')) return asset('face');
    return pix('face', 64, 64, (x, y, o) => {
        const sp = hash(x, y, 41);
        let r = 96, g = 86, b = 84, k = 1 + (sp > 0.85 ? -0.12 : sp < 0.1 ? 0.08 : 0);
        const e = Math.min(x, y, 63 - x, 63 - y);
        if (e < 1) k = 0.45; else if (e < 3) k *= (x < 3 || y > 60) ? 1.25 : 0.7;
        const cx = (x - 31.5) / 32, cy = (y - 29) / 32, ax = Math.abs(cx);
        const head = (cx * cx) / 0.3 + ((cy - 0.02) * (cy - 0.02)) / 0.36 < 1;
        const hy = (cy - 0.42) / 0.5;
        const horn = hy > 0 && hy < 1 && Math.abs(ax - 0.42 - hy * 0.26) < 0.13 * (1 - hy) + 0.02;
        if (head || horn) { r = 128; g = 112; b = 104; k *= 1.05 - cx * 0.28 + (cy > 0.3 ? 0.08 : 0); }
        if (head) {
            const ex = ax - 0.23, ey = cy - 0.12 - ax * 0.25;
            if ((ex * ex) / 0.018 + (ey * ey) / 0.006 < 1) {
                const core = Math.abs(ex) < 0.04;
                o[0] = 255; o[1] = core ? 220 : 50; o[2] = core ? 90 : 20; return;
            }
            if (ey > 0.06 && ey < 0.11 && ax > 0.08 && ax < 0.4) k *= 0.6;                     // brow
            if (ax > 0.02 && ax < 0.07 && cy > -0.16 && cy < -0.08) k *= 0.35;                 // nostrils
            if (ax < 0.34 && cy > -0.44 && cy < -0.24) {                                       // mouth
                const tooth = (x % 4 < 2) && (cy > -0.3 || cy < -0.38);
                if (tooth) { r = 214; g = 204; b = 176; k = 1; } else { r = 26; g = 8; b = 8; k = 1; }
            }
        }
        o[0] = r * k; o[1] = g * k; o[2] = b * k;
    }, true);
}

// Summoning circle for the arena centre (transparent outside the lines)
export function pentagramTexture() {
    const V = [];
    for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + i * Math.PI * 4 / 5; V.push([32 + Math.cos(a) * 27, 32 + Math.sin(a) * 27]); }
    const seg = (px, py, a, b) => {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
        return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
    };
    return pix('penta', 64, 64, (x, y, o) => {
        const d = Math.hypot(x - 32, y - 32);
        let on = Math.abs(d - 29.5) < 1 || Math.abs(d - 26) < 0.6;
        for (let i = 0; i < 5 && !on; i++) on = seg(x, y, V[i], V[(i + 1) % 5]) < 0.9;
        if (!on) { o[3] = 0; return; }
        const k = hash(x, y, 7) > 0.8 ? 0.6 : 1;
        o[0] = 200 * k; o[1] = 22 * k; o[2] = 14 * k;
    });
}

// End-of-the-world sky for a dome: glowing horizon, heavy cloud deck lit from below, red lightning veins.
// y = 0 is the horizon, top row is the zenith. Wraps horizontally.
export function skyDome() {
    const W = 256, H = 96;
    return pix('skydome', W, H, (x, y, o) => {
        const u = x / W, v = y / H, t = v, d = bayer4(x, y) / 16;
        const g = Math.pow(1 - t, 3);
        let r = 26 + 190 * g, gg = 10 + 46 * g, b = 30 + 30 * (1 - t);
        const c = fbm(u, v * 0.75, 5, 6, 31, 3) + d;                  // cloud deck
        if (c > 0.47) {
            const depth = Math.min(1, (c - 0.47) * 7);
            const rim = 1 - depth;
            r = 22 + 150 * rim * (0.4 + g); gg = 14 + 26 * rim; b = 30 + 14 * rim;
            const l = ridge(fbm(u, v * 0.75, 3, 5, 77, 3), 30);       // lightning inside the clouds
            if (l > 0.82) { r = 255; gg = 120; b = 110; } else if (l > 0.55) { r += 110; gg += 12; b += 16; }
        } else if (hash(x, y, 13) > 0.994 && t > 0.3) { r = 255; gg = 150; b = 130; }
        const q = 8;                                                   // posterise for a chunky look
        o[0] = Math.min(255, Math.round(r / q) * q); o[1] = Math.min(255, Math.round(gg / q) * q); o[2] = Math.min(255, Math.round(b / q) * q);
    });
}

// Four 16x24 flame frames in one strip
export function flameStrip() {
    return pix('flame', 64, 24, (X, y, o) => {
        const f = X >> 4, x = X & 15, q = y / 23;
        const cx = 7.5 + Math.sin(y * 0.55 + f * 2.1) * 1.6 * q;
        const w = 5.6 * Math.pow(1 - q, 0.75) + Math.sin(y * 0.8 + f * 1.7) * 1.0 * q;
        const d = Math.abs(x - cx) / Math.max(0.01, w);
        if (d > 1 || (q > 0.6 && hash(x, y, 50 + f) > 0.75)) { o[3] = 0; return; }
        const c = d < 0.4 && q < 0.5 ? [255, 244, 150] : d < 0.75 && q < 0.75 ? [255, 160, 30] : [214, 56, 12];
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
}
