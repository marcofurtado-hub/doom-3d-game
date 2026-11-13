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
        floor(u, v, o) {
            const n = fbm(u, v, 5, 8, 11);
            const c = ridge(fbm(u, v, 3, 4, 23), 22);
            const lava = sstep(0.6, 0.95, c);
            const rock = (0.35 + n * 0.65) * (1 - 0.7 * sstep(0.1, 0.6, c));
            const glow = c * c * c;
            set(o, 62 * rock + 110 * lava, 44 * rock + 26 * lava, 42 * rock,
                255 * lava + 70 * glow, 100 * lava + 8 * glow, 14 * lava, 0.3 + n * 0.6 - lava * 0.5);
        },
        wall(u, v, o) {
            const k = cells(u, v, 4, 8);
            const n = fbm(u, v, 4, 8, 5);
            const mortar = 1 - sstep(0.004, 0.012, k.d);
            const tone = (0.5 + 0.5 * hash(k.col, k.row, 3)) * (0.55 + 0.45 * n) * (1 - mortar);
            const hot = mortar * sstep(0.56, 0.72, fbm(u, v, 3, 4, 41));
            set(o, 74 * tone + 12, 50 * tone + 8, 52 * tone + 8, 255 * hot, 85 * hot, 12 * hot, (1 - mortar) * (0.6 + 0.4 * n));
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
function bake(fn, size, withNormal) {
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
    const cA = mk(), cE = mk();
    const gA = cA.getContext('2d'), gE = cE.getContext('2d');
    const iA = gA.createImageData(size, size), iE = gE.createImageData(size, size);
    const H = new Float32Array(size * size);
    const o = new Float32Array(7);
    for (let y = 0; y < size; y++) {
        const v = 1 - (y + 0.5) / size;
        for (let x = 0; x < size; x++) {
            fn((x + 0.5) / size, v, o);
            const i = (y * size + x) * 4;
            iA.data[i] = o[0]; iA.data[i + 1] = o[1]; iA.data[i + 2] = o[2]; iA.data[i + 3] = 255;
            iE.data[i] = o[3]; iE.data[i + 1] = o[4]; iE.data[i + 2] = o[5]; iE.data[i + 3] = 255;
            H[y * size + x] = o[6];
        }
    }
    gA.putImageData(iA, 0, 0); gE.putImageData(iE, 0, 0);
    const tex = (c, srgb) => {
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 4;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
    };
    const out = { map: tex(cA, true), emissiveMap: tex(cE, true), normalMap: null };
    if (withNormal) {
        const cN = mk(), gN = cN.getContext('2d'), iN = gN.createImageData(size, size);
        const S = 3.0;
        for (let y = 0; y < size; y++) {
            const yu = (y - 1 + size) % size, yd = (y + 1) % size;
            for (let x = 0; x < size; x++) {
                const xl = (x - 1 + size) % size, xr = (x + 1) % size;
                const nx = -(H[y * size + xr] - H[y * size + xl]) * S;
                const ny = -(H[yu * size + x] - H[yd * size + x]) * S;
                const l = Math.hypot(nx, ny, 1), i = (y * size + x) * 4;
                iN.data[i] = (nx / l * 0.5 + 0.5) * 255;
                iN.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
                iN.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
                iN.data[i + 3] = 255;
            }
        }
        gN.putImageData(iN, 0, 0);
        out.normalMap = tex(cN, false);
    }
    return out;
}

// Returns { floor: {map, emissiveMap, normalMap}, wall: {...} }, cached per biome + quality.
export function biomeTextures(id, low = false) {
    const key = id + (low ? ':low' : '');
    if (!_cache.has(key)) {
        const d = DESIGNS[id];
        _cache.set(key, {
            floor: bake(d.floor, low ? 256 : 512, !low),
            wall: bake(d.wall, low ? 128 : 256, !low),
        });
    }
    return _cache.get(key);
}
