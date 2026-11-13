import * as THREE from 'three';

// Procedural canvas-baked textures for biome walls/floor.
// Each texture returns a CanvasTexture that can be used as map/roughnessMap/normalMap.
const _cache = new Map();

function canvas(size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return { c, ctx: c.getContext('2d') };
}

function fbm(x, y, oct = 4, seed = 0) {
    let v = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < oct; i++) {
        const s = Math.sin(x * freq * 0.7 + y * freq * 1.3 + seed + i * 11.7);
        const t = Math.cos(x * freq * 1.1 - y * freq * 0.9 + seed * 2 + i * 7.3);
        v += (s * t) * amp;
        max += amp;
        amp *= 0.5;
        freq *= 2.03;
    }
    return 0.5 + 0.5 * (v / max);
}

// Make a CanvasTexture that repeats
function makeTexture(canvasEl, repeat = 2) {
    const t = new THREE.CanvasTexture(canvasEl);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// === BIOME-SPECIFIC TEXTURES ===

// Infernal: brimstone with lava cracks
export function infernalFloor() {
    if (_cache.has('inf_f')) return _cache.get('inf_f');
    const { c, ctx } = canvas(512);
    const img = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
            const n = fbm(x * 0.02, y * 0.02, 5, 3.1);
            const cracks = Math.max(0, 1 - Math.abs(fbm(x * 0.008, y * 0.008, 3) - 0.5) * 12);
            const base = n * 90;
            const i = (y * 512 + x) * 4;
            if (cracks > 0.5) {
                img.data[i] = 180 + cracks * 60;
                img.data[i + 1] = 60 + cracks * 40;
                img.data[i + 2] = 20;
            } else {
                img.data[i] = 50 + base * 0.7;
                img.data[i + 1] = 20 + base * 0.3;
                img.data[i + 2] = 15 + base * 0.2;
            }
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const t = makeTexture(c, 6);
    _cache.set('inf_f', t);
    return t;
}
export function infernalWall() {
    if (_cache.has('inf_w')) return _cache.get('inf_w');
    const { c, ctx } = canvas(256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
            const brick = Math.floor(y / 32) % 2 === 0 ? 0 : 32;
            const bx = (x + brick) % 64;
            const by = y % 32;
            const edge = (bx < 2 || bx > 62 || by < 1 || by > 30) ? 0.3 : 1;
            const n = fbm(x * 0.03, y * 0.03, 4);
            const r = (60 * edge * n + 10) | 0;
            const g = (20 * edge * n + 5) | 0;
            const b = (15 * edge * n + 5) | 0;
            const i = (y * 256 + x) * 4;
            img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const t = makeTexture(c, 3);
    _cache.set('inf_w', t);
    return t;
}

// Tech Hell: metal grates + green sigils
export function techFloor() {
    if (_cache.has('tech_f')) return _cache.get('tech_f');
    const { c, ctx } = canvas(512);
    ctx.fillStyle = '#1a1e24'; ctx.fillRect(0, 0, 512, 512);
    // Grate pattern
    ctx.strokeStyle = '#0a0d10'; ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 32) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    // Rust noise
    for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(80,50,30,${Math.random() * 0.3})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    // Neon green sigils
    ctx.strokeStyle = 'rgba(80,255,120,0.4)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
        const cx = 60 + Math.random() * 400, cy = 60 + Math.random() * 400, s = 40 + Math.random() * 30;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
            const x = cx + Math.cos(a) * s, y = cy + Math.sin(a) * s;
            if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.stroke();
    }
    const t = makeTexture(c, 4);
    _cache.set('tech_f', t);
    return t;
}
export function techWall() {
    if (_cache.has('tech_w')) return _cache.get('tech_w');
    const { c, ctx } = canvas(256);
    ctx.fillStyle = '#20242a'; ctx.fillRect(0, 0, 256, 256);
    // Panel lines
    ctx.strokeStyle = '#0a0d10'; ctx.lineWidth = 2;
    for (let i = 0; i < 256; i += 64) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    }
    // Rivets
    ctx.fillStyle = '#404040';
    for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
        ctx.beginPath(); ctx.arc(x + 8, y + 8, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 56, y + 56, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Vertical pipes
    ctx.fillStyle = '#2a4858';
    ctx.fillRect(100, 0, 6, 256);
    ctx.fillStyle = '#4080a0';
    ctx.fillRect(101, 0, 2, 256);
    const t = makeTexture(c, 2);
    _cache.set('tech_w', t);
    return t;
}

// Blood Cathedral: marble with red veins
export function cathedralFloor() {
    if (_cache.has('cath_f')) return _cache.get('cath_f');
    const { c, ctx } = canvas(512);
    const img = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
            const n = fbm(x * 0.012, y * 0.012, 5, 7.1);
            const vein = Math.max(0, 1 - Math.abs(fbm(x * 0.006, y * 0.006, 4) - 0.5) * 18);
            const i = (y * 512 + x) * 4;
            const base = 180 * n + 40;
            if (vein > 0.3) {
                img.data[i] = 120 + vein * 60;
                img.data[i + 1] = 20;
                img.data[i + 2] = 20;
            } else {
                img.data[i] = base * 0.9;
                img.data[i + 1] = base * 0.85;
                img.data[i + 2] = base * 0.8;
            }
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const t = makeTexture(c, 4);
    _cache.set('cath_f', t);
    return t;
}
export function cathedralWall() {
    if (_cache.has('cath_w')) return _cache.get('cath_w');
    const { c, ctx } = canvas(256);
    ctx.fillStyle = '#4a3838'; ctx.fillRect(0, 0, 256, 256);
    // Marble vein
    for (let i = 0; i < 20; i++) {
        ctx.strokeStyle = `rgba(100,20,20,${0.2 + Math.random() * 0.3})`;
        ctx.lineWidth = 0.5 + Math.random() * 2;
        ctx.beginPath();
        const x = Math.random() * 256, y = Math.random() * 256;
        ctx.moveTo(x, y);
        for (let k = 0; k < 20; k++) ctx.lineTo(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80);
        ctx.stroke();
    }
    // Stone block pattern
    ctx.strokeStyle = 'rgba(20,10,10,0.5)'; ctx.lineWidth = 1;
    for (let y = 0; y < 256; y += 40) {
        const off = (y / 40) % 2 === 0 ? 0 : 32;
        for (let x = -off; x < 256; x += 64) {
            ctx.strokeRect(x, y, 64, 40);
        }
    }
    const t = makeTexture(c, 2);
    _cache.set('cath_w', t);
    return t;
}

// Void: starfield-ish black panels
export function voidFloor() {
    if (_cache.has('void_f')) return _cache.get('void_f');
    const { c, ctx } = canvas(512);
    ctx.fillStyle = '#060008'; ctx.fillRect(0, 0, 512, 512);
    // Hex pattern faint
    ctx.strokeStyle = 'rgba(80,40,120,0.2)'; ctx.lineWidth = 1;
    const hex = 32;
    for (let r = 0; r < 20; r++) for (let q = 0; q < 20; q++) {
        const cx = q * hex * 1.5 + (r % 2) * hex * 0.75;
        const cy = r * hex * 0.87;
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
            const x = cx + Math.cos(a / 6 * Math.PI * 2) * hex / 2;
            const y = cy + Math.sin(a / 6 * Math.PI * 2) * hex / 2;
            if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.stroke();
    }
    // Star points
    for (let i = 0; i < 80; i++) {
        ctx.fillStyle = `rgba(200,180,255,${0.3 + Math.random() * 0.5})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
    }
    const t = makeTexture(c, 3);
    _cache.set('void_f', t);
    return t;
}
export function voidWall() {
    if (_cache.has('void_w')) return _cache.get('void_w');
    const { c, ctx } = canvas(256);
    ctx.fillStyle = '#0a0612'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(120,60,200,0.4)'; ctx.lineWidth = 1;
    for (let i = 0; i < 256; i += 32) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    }
    // Glowing seams
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(180,80,255,0.3)');
    grad.addColorStop(0.5, 'rgba(60,20,100,0.1)');
    grad.addColorStop(1, 'rgba(180,80,255,0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(126, 0, 4, 256);
    const t = makeTexture(c, 2);
    _cache.set('void_w', t);
    return t;
}

// Cryo: ice crystals + frost
export function cryoFloor() {
    if (_cache.has('cryo_f')) return _cache.get('cryo_f');
    const { c, ctx } = canvas(512);
    const img = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
            const n = fbm(x * 0.02, y * 0.02, 5, 2.4);
            const i = (y * 512 + x) * 4;
            img.data[i] = 160 + n * 50;
            img.data[i + 1] = 200 + n * 40;
            img.data[i + 2] = 230 + n * 25;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    // Crystal lines
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 30; i++) {
        ctx.lineWidth = 0.5 + Math.random() * 1.5;
        ctx.beginPath();
        const x = Math.random() * 512, y = Math.random() * 512;
        for (let k = 0; k < 3; k++) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80);
        }
        ctx.stroke();
    }
    const t = makeTexture(c, 5);
    _cache.set('cryo_f', t);
    return t;
}
export function cryoWall() {
    if (_cache.has('cryo_w')) return _cache.get('cryo_w');
    const { c, ctx } = canvas(256);
    ctx.fillStyle = '#4a6878'; ctx.fillRect(0, 0, 256, 256);
    // Ice shard triangles
    for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(200,230,255,${0.1 + Math.random() * 0.3})`;
        ctx.beginPath();
        const x = Math.random() * 256, y = Math.random() * 256;
        const s = 10 + Math.random() * 30;
        ctx.moveTo(x, y);
        ctx.lineTo(x + s, y + s * 2);
        ctx.lineTo(x - s * 0.5, y + s * 1.5);
        ctx.closePath(); ctx.fill();
    }
    // Horizontal veins
    for (let y = 0; y < 256; y += 32) {
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    const t = makeTexture(c, 2);
    _cache.set('cryo_w', t);
    return t;
}

// Ash Wastes: cracked clay + ash falling
export function ashFloor() {
    if (_cache.has('ash_f')) return _cache.get('ash_f');
    const { c, ctx } = canvas(512);
    const img = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
            const n = fbm(x * 0.025, y * 0.025, 5, 9.8);
            const crack = Math.max(0, 1 - Math.abs(fbm(x * 0.01, y * 0.01, 3) - 0.5) * 20);
            const i = (y * 512 + x) * 4;
            const base = n * 80;
            if (crack > 0.5) {
                img.data[i] = 20; img.data[i + 1] = 10; img.data[i + 2] = 10;
            } else {
                img.data[i] = 110 + base * 0.6;
                img.data[i + 1] = 70 + base * 0.4;
                img.data[i + 2] = 50 + base * 0.3;
            }
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const t = makeTexture(c, 6);
    _cache.set('ash_f', t);
    return t;
}
export function ashWall() {
    if (_cache.has('ash_w')) return _cache.get('ash_w');
    const { c, ctx } = canvas(256);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
            const n = fbm(x * 0.03, y * 0.03, 4, 4.2);
            const i = (y * 256 + x) * 4;
            img.data[i] = 90 + n * 50;
            img.data[i + 1] = 50 + n * 30;
            img.data[i + 2] = 35 + n * 20;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    // Horizontal cracks
    ctx.strokeStyle = 'rgba(10,5,5,0.6)'; ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        const y = Math.random() * 256;
        ctx.moveTo(0, y);
        for (let x = 0; x < 256; x += 20) ctx.lineTo(x, y + (Math.random() - 0.5) * 6);
        ctx.stroke();
    }
    const t = makeTexture(c, 2);
    _cache.set('ash_w', t);
    return t;
}

// Normal-map generator from any grayscale heightmap
export function normalFromTexture(tex, strength = 1.0) {
    const srcCanvas = tex.image;
    const w = srcCanvas.width, h = srcCanvas.height;
    const { c, ctx } = canvas(w);
    c.height = h;
    const srcCtx = srcCanvas.getContext('2d');
    const src = srcCtx.getImageData(0, 0, w, h).data;
    const out = ctx.createImageData(w, h);
    const lum = (i) => (src[i] + src[i + 1] + src[i + 2]) / 3;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const xL = ((x - 1 + w) % w), xR = ((x + 1) % w);
            const yU = ((y - 1 + h) % h), yD = ((y + 1) % h);
            const dx = (lum((y * w + xR) * 4) - lum((y * w + xL) * 4)) * strength;
            const dy = (lum((yD * w + x) * 4) - lum((yU * w + x) * 4)) * strength;
            const nx = -dx / 255, ny = -dy / 255, nz = 1;
            const l = Math.hypot(nx, ny, nz);
            out.data[i] = (nx / l * 0.5 + 0.5) * 255;
            out.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
            out.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
            out.data[i + 3] = 255;
        }
    }
    ctx.putImageData(out, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.copy(tex.repeat);
    return t;
}
