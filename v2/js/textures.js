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
const DESIGNS = {
    infernal: {
        size: 64,
        // Flagstones, 32px slabs: mottled grey-brown stone, dark grout, the odd crack and old blood
        floor(u, v, o) {
            const x = Math.floor(u * 64) & 63, y = Math.floor(v * 64) & 63;
            const row = y >> 5, xo = (x + (row ? 16 : 0)) & 63, col = xo >> 5, bx = xo & 31, by = y & 31;
            if (bx === 0 || by === 0) { set(o, 30, 24, 24); return; }
            const h = hash(col, row, 5), sp = hash(x, y, 9);
            const T = [[72, 62, 58], [86, 73, 66], [62, 54, 52], [78, 64, 56]][Math.floor(h * 4)];
            let k = 1;
            if (by === 31 || bx === 1) k += 0.14; if (by === 1 || bx === 31) k -= 0.16;
            if (sp > 0.88) k -= 0.14; else if (sp < 0.1) k += 0.1;
            if (h > 0.55 && Math.abs(bx - by * 0.6 - 6 - h * 8) < 0.8) k -= 0.4;
            let r = T[0] * k, g = T[1] * k, b = T[2] * k;
            if (fbm(u, v, 2, 4, 5) > 0.66 && sp > 0.25) { r = r * 0.5 + 52; g *= 0.32; b *= 0.3; }
            set(o, r, g, b);
        },
        // Bricks, 16x8px: three tones, bevelled top edge, chipped pixels, a few scorched ones
        wall(u, v, o) {
            const x = Math.floor(u * 64) & 63, y = Math.floor(v * 64) & 63;
            const row = y >> 3, xo = (x + ((row & 1) ? 8 : 0)) & 63, col = xo >> 4, bx = xo & 15, by = y & 7;
            if (bx === 0 || by === 0) { set(o, 34, 20, 20); return; }
            const h = hash(col, row, 3), sp = hash(x, y, 11);
            const T = [[98, 50, 38], [120, 62, 44], [138, 78, 54]][h < 0.3 ? 0 : h < 0.78 ? 1 : 2];
            let k = 1;
            if (by === 7) k += 0.16; if (by === 1) k -= 0.16; if (bx === 15) k -= 0.1; if (bx === 1) k += 0.07;
            if (sp > 0.9) k -= 0.14; else if (sp < 0.07) k += 0.1;
            if (hash(col, row, 21) > 0.9) k *= 0.5;
            set(o, T[0] * k, T[1] * k, T[2] * k);
        },
    },
    tech: {
        floor(u, v, o) {
            const k = cells(u, v, 4, 4, false);
            const n = fbm(u, v, 4, 16, 7);
            const h = hash(k.col, k.row, 9);
            const seam = 1 - sstep(0.003, 0.01, k.d);
            let tone = (0.7 + 0.3 * n) * (0.85 + 0.3 * h) * (1 - 0.8 * seam);
            if (h > 0.6 && Math.sin(k.by * Math.PI * 16) > 0) tone *= 0.55;
            const sq = Math.max(Math.abs(k.bx - 0.5), Math.abs(k.by - 0.5));
            const ring = h < 0.22 ? 1 - sstep(0.012, 0.03, Math.abs(sq - 0.3)) : 0;
            const cx = Math.min(k.bx, 1 - k.bx), cy = Math.min(k.by, 1 - k.by);
            const bolt = Math.hypot(cx - 0.08, cy - 0.08) < 0.035 ? 1 : 0;
            set(o, 60 * tone + 60 * bolt, 68 * tone + 60 * bolt, 80 * tone + 60 * bolt,
                50 * ring, 255 * ring, 120 * ring, 0.5 * (1 - seam) + 0.3 * bolt + 0.1 * n);
        },
        wall(u, v, o) {
            const k = cells(u, v, 2, 2, false);
            const n = fbm(u, v, 4, 16, 13);
            const seam = 1 - sstep(0.004, 0.012, k.d);
            let tone = (0.7 + 0.3 * n) * (1 - 0.8 * seam);
            let r = 46 * tone, g = 52 * tone, b = 62 * tone;
            if (v > 0.05 && v < 0.11) { // hazard stripe
                const s = (((u + v) * 24) % 1 + 1) % 1 > 0.5;
                r = s ? 190 : 20; g = s ? 150 : 18; b = s ? 20 : 16;
            }
            const du = Math.abs(u - 0.5);
            const strip = du < 0.014 && ((v * 4) % 1) < 0.82 ? 1 : 0;
            const halo = (1 - sstep(0.014, 0.06, du)) * 0.25;
            set(o, r, g, b, 40 * (strip + halo), 190 * (strip + halo), 255 * (strip + halo), 0.5 * (1 - seam) - 0.3 * strip);
        },
    },
    cathedral: {
        floor(u, v, o) {
            const k = cells(u, v, 4, 4, false);
            const n = fbm(u, v, 4, 8, 19);
            const vein = ridge(fbm(u, v, 4, 4, 29), 20);
            const inlay = 1 - sstep(0.004, 0.009, k.d);
            const red = (k.col + k.row) & 1;
            let r, g, b;
            if (red) { r = 92 + 70 * vein; g = 26 + 60 * vein; b = 30 + 55 * vein; }
            else { r = 190 - 80 * vein; g = 176 - 110 * vein; b = 160 - 100 * vein; }
            const t = 0.75 + 0.25 * n;
            set(o, r * t * (1 - inlay) + 170 * inlay, g * t * (1 - inlay) + 125 * inlay, b * t * (1 - inlay) + 40 * inlay,
                45 * inlay, 26 * inlay, 4 * inlay, 0.5 - 0.2 * inlay);
        },
        wall(u, v, o) {
            const k = cells(u, v, 4, 6);
            const n = fbm(u, v, 4, 8, 31);
            const mortar = 1 - sstep(0.003, 0.01, k.d);
            const tone = (0.6 + 0.4 * hash(k.col, k.row, 2)) * (0.6 + 0.4 * n) * (1 - 0.7 * mortar);
            set(o, 104 * tone, 86 * tone, 80 * tone, 0, 0, 0, (1 - mortar) * 0.7);
            // Lancet stained-glass window
            const du = Math.abs(u - 0.5), W = 0.15, y0 = 0.28, ys = 0.6, yt = 0.8;
            let lim = -1;
            if (v > y0 && v <= ys) lim = W;
            else if (v > ys && v < yt) { const q = (v - ys) / (yt - ys); lim = W * Math.sqrt(1 - q * q); }
            if (lim > 0 && du < lim + 0.012) {
                if (du > lim - 0.012 || v < y0 + 0.012) { set(o, 24, 20, 20, 0, 0, 0, 0.9); return; }
                const a = (u + v) * 22, b2 = (u - v) * 22;
                const fa = a - Math.floor(a), fb = b2 - Math.floor(b2);
                if (Math.min(fa, 1 - fa, fb, 1 - fb) < 0.07) { set(o, 14, 12, 12, 0, 0, 0, 0.6); return; }
                const P = [[230, 30, 30], [245, 150, 20], [40, 80, 230], [150, 40, 210], [245, 220, 120]];
                const c = P[Math.floor(hash(Math.floor(a), Math.floor(b2), 77) * P.length)];
                const br = 0.75 + 0.25 * hash(Math.floor(a), Math.floor(b2), 5);
                set(o, c[0] * 0.3, c[1] * 0.3, c[2] * 0.3, c[0] * br, c[1] * br, c[2] * br, 0.3);
            }
        },
    },
    void: {
        floor(u, v, o) {
            const n = fbm(u, v, 3, 8, 37);
            const gu = Math.abs(((u * 4 + 0.5) % 1) - 0.5) / 4, gv = Math.abs(((v * 4 + 0.5) % 1) - 0.5) / 4;
            const d = Math.min(gu, gv);
            const line = 1 - sstep(0.002, 0.005, d), halo = (1 - sstep(0.004, 0.03, d)) * 0.22;
            const star = hash(Math.floor(u * 256), Math.floor(v * 256), 51) > 0.9985 ? 0.6 : 0;
            const e = line + halo;
            set(o, 10 + 8 * n, 6 + 5 * n, 18 + 12 * n, 150 * e + 220 * star, 70 * e + 200 * star, 255 * e + 255 * star, 0.5 - 0.3 * line);
        },
        wall(u, v, o) {
            const n = fbm(u, v, 3, 8, 43);
            const k = cells(u, v, 4, 4, false);
            const d = Math.abs(((u * 4 + 0.5) % 1) - 0.5) / 4;
            const seam = 1 - sstep(0.003, 0.007, d), halo = (1 - sstep(0.006, 0.04, d)) * 0.2;
            const band = 1 - sstep(0.004, 0.009, Math.abs(v - 0.5));
            const lit = hash(k.col, k.row, 61) > 0.82 ? 0.12 : 0;
            const e = seam + halo + lit;
            set(o, 16 + 8 * n, 10 + 6 * n, 28 + 12 * n, 150 * e + 255 * band, 70 * e + 60 * band, 255 * e + 200 * band, 0.5 - 0.3 * seam);
        },
    },
    cryo: {
        floor(u, v, o) {
            const n = fbm(u, v, 5, 8, 47);
            const deep = fbm(u, v, 2, 3, 53);
            const c = ridge(fbm(u, v, 3, 5, 59), 26);
            const t = (0.6 + 0.4 * n) * (0.7 + 0.3 * deep);
            set(o, 130 * t + 110 * c, 180 * t + 70 * c, 215 * t + 40 * c, 30 * c, 110 * c, 150 * c, 0.4 + 0.3 * n - 0.4 * c);
        },
        wall(u, v, o) {
            const k = cells(u, v, 2, 3);
            const n = fbm(u, v, 4, 8, 67);
            const streak = fbm(u, v, 3, 24, 71, 2);
            const edge = 1 - sstep(0.004, 0.02, k.d);
            const t = (0.55 + 0.45 * n) * (0.7 + 0.3 * streak);
            const core = sstep(0.55, 0.8, n) * 0.5;
            set(o, 96 * t + 130 * edge, 142 * t + 95 * edge, 182 * t + 60 * edge, 20 * core, 90 * core, 130 * core, 0.5 * (1 - edge) + 0.3 * streak);
        },
    },
    ash: {
        floor(u, v, o) { // grey ash drifts over cracked clay; only a few fissures still glow
            const n = fbm(u, v, 5, 8, 73);
            const c = ridge(fbm(u, v, 3, 6, 79), 26);
            const crack = sstep(0.5, 0.85, c);
            const hot = crack * sstep(0.6, 0.74, fbm(u, v, 2, 3, 83));
            const dust = sstep(0.42, 0.7, fbm(u, v, 3, 4, 89));
            const t = (0.6 + 0.4 * n) * (1 - 0.85 * crack);
            set(o, (104 - 30 * dust) * t + 62 * dust, (72 - 14 * dust) * t + 58 * dust, (54 - 2 * dust) * t + 56 * dust,
                255 * hot, 80 * hot, 8 * hot, 0.4 + 0.4 * n - 0.5 * crack + 0.15 * dust);
        },
        wall(u, v, o) {
            const n = fbm(u, v, 4, 8, 97);
            const layer = 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 7 + n * 7);
            const crack = sstep(0.75, 0.95, ridge(fbm(u, v, 3, 6, 101, 2), 16));
            const t = (0.55 + 0.45 * n) * (1 - 0.45 * crack);
            set(o, (78 + 44 * layer) * t, (46 + 24 * layer) * t, (34 + 14 * layer) * t, 0, 0, 0, 0.3 + 0.4 * layer - 0.4 * crack);
        },
    },
    bone: {
        floor(u, v, o) {
            const n = fbm(u, v, 5, 8, 103);
            const p = fbm(u, v, 3, 4, 107);
            const pud = 1 - sstep(0.27, 0.33, p);
            const t = 0.55 + 0.45 * n;
            set(o, 58 * t * (1 - pud) + 16 * pud, 62 * t * (1 - pud) + 30 * pud, 38 * t * (1 - pud) + 18 * pud,
                8 * pud, 44 * pud, 8 * pud, (0.5 + 0.4 * n) * (1 - pud) + 0.1 * pud);
        },
        wall(u, v, o) {
            const k = cells(u, v, 8, 10);
            const cx = k.bx - 0.5, cy = k.by - 0.5;
            const hs = hash(k.col, k.row, 113);
            const cran = (cx * cx) / (0.42 * 0.42) + ((cy - 0.08) * (cy - 0.08)) / (0.36 * 0.36);
            const jaw = Math.abs(cx) < 0.2 && cy < -0.15 && cy > -0.46;
            if (cran >= 1 && !jaw) { set(o, 20, 17, 12, 0, 0, 0, 0.05); return; }
            const ex = Math.abs(cx) - 0.17, ey = cy - 0.04, er = Math.hypot(ex, ey);
            const nose = Math.abs(cx) < 0.045 * (1 - (cy + 0.2) / 0.14) && cy > -0.2 && cy < -0.06;
            const teeth = jaw && cy < -0.3 && ((cx * 14) % 1 + 1) % 1 < 0.2;
            if (er < 0.105 || nose || teeth) {
                const g = hs > 0.72 && er < 0.055 ? 1 : 0;
                set(o, 12, 10, 8, 50 * g, 255 * g, 40 * g, 0.1);
                return;
            }
            const sh = (0.62 + 0.38 * hs) * (jaw ? 0.85 : 1.05 - 0.35 * Math.min(1, cran));
            set(o, 196 * sh, 184 * sh, 152 * sh, 0, 0, 0, jaw ? 0.6 : 1 - 0.5 * cran);
        },
    },
};

// ---------------------------------------------------------------- baking
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
        const loader = new THREE.TextureLoader(), tiles = ['wall', 'floor', 'lava', 'face'];
        await Promise.all([...tiles, 'sky', ...Object.keys(atlas)].map(n =>
            loader.loadAsync(base + n + '.png').then(tex => { ASSETS[n] = nearest(tex, true, tiles.includes(n)); })));
        ATLAS = atlas;
    } catch (e) {
        ATLAS = null;
        for (const k of Object.keys(ASSETS)) delete ASSETS[k];
    }
}
export const asset = n => (ATLAS && ASSETS[n]) || null;

// Returns { floor: {map, emissiveMap}, wall: {...} } at chunky texel sizes, cached per biome.
export function biomeTextures(id) {
    if (id === 'infernal' && asset('wall') && asset('floor')) {
        return { floor: { map: asset('floor'), emissiveMap: null }, wall: { map: asset('wall'), emissiveMap: null } };
    }
    if (!_cache.has(id)) {
        const d = DESIGNS[id], size = d.size || 128;
        _cache.set(id, { floor: bake(d.floor, size), wall: bake(d.wall, size) });
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

// Hell sky strip for a cylinder around the arena: dithered red gradient, cloud streaks, two mountain ranges
export function skyPanorama() {
    if (asset('sky')) return asset('sky');
    const W = 256, H = 96;
    const ridge1 = x => 22 + 16 * fbm(x / W, 0.3, 4, 6, 201) + 8 * Math.abs(Math.sin(x / W * Math.PI * 10));
    const ridge2 = x => 10 + 20 * fbm(x / W, 0.7, 4, 5, 207);
    return pix('sky', W, H, (x, y, o) => {
        if (y < ridge2(x)) { o[0] = 22; o[1] = 5; o[2] = 8; return; }
        if (y < ridge1(x)) { const k = y > ridge1(x) - 2 ? 1.5 : 1; o[0] = 62 * k; o[1] = 12 * k; o[2] = 14 * k; return; }
        const t = Math.min(1, (y - 18) / (H - 18)), steps = 9;
        const q = Math.min(steps - 1, Math.floor((1 - t) * steps + bayer4(x, y) * 0.9)) / (steps - 1); // 1 at horizon
        let r = 28 + 212 * q * q, g = 4 + 104 * q * q * q, b = 8 + 16 * q;
        const cl = fbm(x / W, y / H, 4, 6, 211, 12);
        if (cl > 0.57 + bayer4(x, y) * 0.08) { r = r * 0.6 + 26; g = g * 0.5 + 4; b = b * 0.5 + 8; }
        else if (t > 0.45 && hash(x, y, 13) > 0.992) { r = 255; g = 210; b = 150; }
        o[0] = r; o[1] = g; o[2] = b;
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
