import * as THREE from 'three';

// Enemy definitions — 5+ types with distinct silhouettes and behavior.

export const EDEF = {
    imp:    { r: 0.7, spd: 3.3, hp: 22, dmg: 16, sc: 55,  col: 0xb02010, eye: 0xff4444, build: 'imp' },
    skull:  { r: 0.4, spd: 5.2, hp: 10, dmg: 10, sc: 30,  col: 0xb8a898, eye: 0xff2222, build: 'skull', flying: true },
    demon:  { r: 0.85, spd: 4.0, hp: 42, dmg: 24, sc: 110, col: 0xaa3366, eye: 0xff66ff, build: 'demon' },
    caco:   { r: 1.0, spd: 2.4, hp: 55, dmg: 18, sc: 160, col: 0xcc4444, eye: 0x44ff44, build: 'caco', flying: true, ranged: true, fRate: 1.2, projColor: 0x44ff44 },
    baron:  { r: 1.0, spd: 2.7, hp: 85, dmg: 32, sc: 280, col: 0x446622, eye: 0xff6600, build: 'baron', ranged: true, fRate: 1.6, projColor: 0xff6600 },
    revenant:{ r: 0.75, spd: 3.5, hp: 40, dmg: 20, sc: 140, col: 0xc0b8a8, eye: 0xff4040, build: 'revenant', ranged: true, fRate: 2.0, projColor: 0xff4040, tracking: true },
};

export const BDEF = [
    { name: 'IMP LORD',     r: 1.3, spd: 2.0, hp: 400,  dmg: 12, sc: 500,   col: 0x993322, eye: 0xff4444, pat: 'charge', fRate: 1.4, build: 'imp' },
    { name: 'DEMON CHIEF',  r: 1.5, spd: 2.2, hp: 600,  dmg: 14, sc: 1000,  col: 0x882244, eye: 0xff66ff, pat: 'charge', fRate: 1.1, build: 'demon', div: true, dI: 'imp' },
    { name: 'CYBERDEMON',   r: 1.6, spd: 1.6, hp: 900,  dmg: 16, sc: 1500,  col: 0x8a3030, eye: 0xff2200, pat: 'radial', fRate: 0.9, build: 'cyber' },
    { name: 'CACO KING',    r: 1.7, spd: 1.5, hp: 1200, dmg: 16, sc: 2000,  col: 0xcc3333, eye: 0x44ff44, pat: 'radial', fRate: 0.8, build: 'caco', flying: true, div: true, dI: 'skull' },
    { name: 'BARON LORD',   r: 1.6, spd: 2.0, hp: 1500, dmg: 20, sc: 2500,  col: 0x2a4a12, eye: 0xff8800, pat: 'stomp',  fRate: 1.2, build: 'baron' },
    { name: 'SPIDER MIND',  r: 1.8, spd: 1.1, hp: 1800, dmg: 18, sc: 3000,  col: 0x665544, eye: 0xff0000, pat: 'spray',  fRate: 0.5, build: 'spider', div: true, dI: 'imp' },
    { name: 'ARCH-VILE',    r: 1.3, spd: 2.7, hp: 1700, dmg: 20, sc: 4000,  col: 0xaa7722, eye: 0xffff00, pat: 'blink',  fRate: 0.7, build: 'imp' },
    { name: 'PAIN ELEM',    r: 1.6, spd: 1.3, hp: 2000, dmg: 18, sc: 4500,  col: 0x8a5533, eye: 0xff4444, pat: 'summon', fRate: 1.3, build: 'caco', flying: true, div: true, dI: 'skull' },
    { name: 'ICON OF SIN',  r: 1.9, spd: 0.9, hp: 2700, dmg: 24, sc: 6000,  col: 0x5a1a1a, eye: 0xffff00, pat: 'radial', fRate: 0.5, build: 'cyber', div: true, dI: 'demon' },
    { name: 'DARK LORD',    r: 2.1, spd: 1.2, hp: 3500, dmg: 26, sc: 10000, col: 0x3a0a0a, eye: 0xffff00, pat: 'all',    fRate: 0.4, build: 'cyber', div: true, dI: 'baron' },
];

// ===== BUILDERS =====
function mkStd(color, emissive) {
    return new THREE.MeshStandardMaterial({ color, emissive: emissive || 0x000000, emissiveIntensity: 0.5, roughness: 0.6, metalness: 0.1 });
}
function mkEye(color) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 3, roughness: 0.2 });
}

function buildImp(def) {
    const g = new THREE.Group();
    const bodyMat = mkStd(def.col, 0x200404);
    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(def.r * 1.2, def.r * 1.3, def.r * 0.8), bodyMat);
    torso.position.y = def.r * 1.4;
    torso.castShadow = true; g.add(torso);
    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.9, def.r * 0.8, def.r * 0.9), bodyMat);
    head.position.y = def.r * 2.3;
    head.castShadow = true; g.add(head);
    // Horns
    const hornMat = mkStd(0x1a0808);
    for (const s of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.ConeGeometry(def.r * 0.12, def.r * 0.4, 5), hornMat);
        h.position.set(s * def.r * 0.3, def.r * 2.75, 0);
        h.rotation.z = s * 0.3;
        g.add(h);
    }
    // Eyes
    const eyeMat = mkEye(def.eye);
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(def.r * 0.1, 6, 5), eyeMat);
        e.position.set(s * def.r * 0.25, def.r * 2.3, def.r * 0.42);
        g.add(e);
    }
    // Arms
    for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.32, def.r * 1.1, def.r * 0.32), bodyMat);
        arm.position.set(s * def.r * 0.8, def.r * 1.3, 0);
        arm.castShadow = true; g.add(arm);
    }
    // Legs
    for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.42, def.r * 0.8, def.r * 0.42), bodyMat);
        leg.position.set(s * def.r * 0.3, def.r * 0.4, 0);
        leg.castShadow = true; g.add(leg);
        g.userData.legs = g.userData.legs || [];
        g.userData.legs.push(leg);
    }
    g.userData.height = def.r * 2.7;
    g.userData.eyeMat = eyeMat;
    g.userData.head = head;
    return g;
}

function buildSkull(def) {
    const g = new THREE.Group();
    const bodyMat = mkStd(def.col, 0x101010);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(def.r * 1.6, def.r * 1.6, def.r * 1.4), bodyMat);
    skull.castShadow = true;
    g.add(skull);
    // Jaw
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(def.r * 1.4, def.r * 0.4, def.r * 1.2), bodyMat);
    jaw.position.set(0, -def.r * 0.7, def.r * 0.1);
    g.add(jaw);
    // Eye sockets (emissive)
    const eyeMat = mkEye(def.eye);
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.3, def.r * 0.4, def.r * 0.2), eyeMat);
        e.position.set(s * def.r * 0.4, def.r * 0.2, def.r * 0.7);
        g.add(e);
    }
    // Floating effect uses y offset from spawn
    g.userData.height = def.r * 1.6;
    g.userData.eyeMat = eyeMat;
    return g;
}

function buildDemon(def) {
    const g = new THREE.Group();
    const bodyMat = mkStd(def.col, 0x200820);
    // Hulking body (wider, lower)
    const body = new THREE.Mesh(new THREE.BoxGeometry(def.r * 1.8, def.r * 1.2, def.r * 1.4), bodyMat);
    body.position.y = def.r * 1.2;
    body.castShadow = true; g.add(body);
    // Head big + fat
    const head = new THREE.Mesh(new THREE.BoxGeometry(def.r * 1.3, def.r * 1.0, def.r * 1.1), bodyMat);
    head.position.y = def.r * 2.2;
    head.castShadow = true; g.add(head);
    // Huge jaws (open)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(def.r * 1.1, def.r * 0.3, def.r * 0.6),
        new THREE.MeshStandardMaterial({ color: 0x300818, emissive: 0x600820, emissiveIntensity: 2 }));
    mouth.position.set(0, def.r * 2, def.r * 0.4);
    g.add(mouth);
    // Teeth
    const teethMat = mkStd(0xeeeedd);
    for (let i = -2; i <= 2; i++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(def.r * 0.07, def.r * 0.18, 4), teethMat);
        t.position.set(i * def.r * 0.18, def.r * 2.08, def.r * 0.56);
        g.add(t);
    }
    // Eyes
    const eyeMat = mkEye(def.eye);
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(def.r * 0.14, 7, 6), eyeMat);
        e.position.set(s * def.r * 0.35, def.r * 2.5, def.r * 0.55);
        g.add(e);
    }
    // Stumpy legs
    for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.5, def.r * 0.8, def.r * 0.5), bodyMat);
        leg.position.set(s * def.r * 0.5, def.r * 0.4, 0);
        leg.castShadow = true; g.add(leg);
        g.userData.legs = g.userData.legs || [];
        g.userData.legs.push(leg);
    }
    g.userData.height = def.r * 2.7;
    g.userData.eyeMat = eyeMat;
    return g;
}

function buildCaco(def) {
    const g = new THREE.Group();
    const bodyMat = mkStd(def.col, 0x400808);
    // Spherical bloated body
    const body = new THREE.Mesh(new THREE.SphereGeometry(def.r, 12, 10), bodyMat);
    body.scale.set(1.3, 1.0, 1.3);
    body.castShadow = true;
    g.add(body);
    // Horns
    const hornMat = mkStd(0x1a0808);
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const h = new THREE.Mesh(new THREE.ConeGeometry(def.r * 0.15, def.r * 0.5, 5), hornMat);
        h.position.set(Math.cos(a) * def.r * 0.9, def.r * 0.7, Math.sin(a) * def.r * 0.9);
        h.rotation.z = -Math.cos(a) * 0.5;
        h.rotation.x = Math.sin(a) * 0.5;
        g.add(h);
    }
    // Giant central eye
    const eyeMat = mkEye(def.eye);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(def.r * 0.35, 10, 8), eyeMat);
    eye.position.set(0, 0, def.r * 1.1);
    g.add(eye);
    // Mouth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.7, def.r * 0.2, def.r * 0.3),
        new THREE.MeshStandardMaterial({ color: 0x100204, emissive: 0x400408, emissiveIntensity: 2 }));
    mouth.position.set(0, -def.r * 0.5, def.r * 1.1);
    g.add(mouth);
    g.userData.height = def.r * 1.3;
    g.userData.eyeMat = eyeMat;
    g.userData.hover = true;
    return g;
}

function buildBaron(def) {
    const g = new THREE.Group();
    const bodyMat = mkStd(def.col, 0x081808);
    // Tall muscular torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(def.r * 1.4, def.r * 1.6, def.r * 1.0), bodyMat);
    torso.position.y = def.r * 1.8;
    torso.castShadow = true; g.add(torso);
    // Goat head
    const head = new THREE.Mesh(new THREE.BoxGeometry(def.r * 1.0, def.r * 1.0, def.r * 1.3), bodyMat);
    head.position.y = def.r * 3.0;
    head.castShadow = true; g.add(head);
    // Massive curved horns
    const hornMat = mkStd(0x080808);
    for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(def.r * 0.14, def.r * 0.8, 6), hornMat);
        horn.position.set(s * def.r * 0.4, def.r * 3.5, 0);
        horn.rotation.z = s * 0.5;
        g.add(horn);
    }
    // Eyes
    const eyeMat = mkEye(def.eye);
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(def.r * 0.1, 7, 6), eyeMat);
        e.position.set(s * def.r * 0.25, def.r * 3.1, def.r * 0.6);
        g.add(e);
    }
    // Arms (hanging long)
    for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.4, def.r * 1.6, def.r * 0.4), bodyMat);
        arm.position.set(s * def.r * 0.9, def.r * 1.6, 0);
        arm.castShadow = true; g.add(arm);
        // Clawed hand
        const hand = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.5, def.r * 0.3, def.r * 0.5),
            mkStd(0x200804, 0x200408));
        hand.position.set(s * def.r * 0.9, def.r * 0.7, 0);
        g.add(hand);
    }
    // Hoofs
    for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.5, def.r * 1.0, def.r * 0.5), bodyMat);
        leg.position.set(s * def.r * 0.3, def.r * 0.5, 0);
        leg.castShadow = true; g.add(leg);
        g.userData.legs = g.userData.legs || [];
        g.userData.legs.push(leg);
    }
    g.userData.height = def.r * 3.5;
    g.userData.eyeMat = eyeMat;
    return g;
}

function buildRevenant(def) {
    const g = new THREE.Group();
    const bodyMat = mkStd(def.col, 0x200404);
    // Skeletal torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(def.r * 1.1, def.r * 1.6, def.r * 0.6), bodyMat);
    torso.position.y = def.r * 1.7;
    torso.castShadow = true; g.add(torso);
    // Skull head
    const head = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.85, def.r * 0.9, def.r * 0.9), bodyMat);
    head.position.y = def.r * 2.8;
    head.castShadow = true; g.add(head);
    const eyeMat = mkEye(def.eye);
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.18, def.r * 0.3, def.r * 0.12), eyeMat);
        e.position.set(s * def.r * 0.22, def.r * 2.85, def.r * 0.45);
        g.add(e);
    }
    // Shoulder-mounted missile pods
    const podMat = mkStd(0x4a2a1a, 0x200408);
    for (const s of [-1, 1]) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.45, def.r * 0.4, def.r * 0.7), podMat);
        pod.position.set(s * def.r * 0.7, def.r * 2.5, -def.r * 0.1);
        pod.castShadow = true; g.add(pod);
    }
    // Arms (bony)
    for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.25, def.r * 1.2, def.r * 0.25), bodyMat);
        arm.position.set(s * def.r * 0.75, def.r * 1.7, 0);
        arm.castShadow = true; g.add(arm);
    }
    // Legs
    for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.3, def.r * 0.9, def.r * 0.3), bodyMat);
        leg.position.set(s * def.r * 0.3, def.r * 0.45, 0);
        leg.castShadow = true; g.add(leg);
        g.userData.legs = g.userData.legs || [];
        g.userData.legs.push(leg);
    }
    g.userData.height = def.r * 3.3;
    g.userData.eyeMat = eyeMat;
    return g;
}

function buildCyber(def) {
    const g = new THREE.Group();
    const bodyMat = mkStd(def.col, 0x200408);
    // Huge torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(def.r * 1.8, def.r * 1.8, def.r * 1.2), bodyMat);
    torso.position.y = def.r * 2.0;
    torso.castShadow = true; g.add(torso);
    // Bull head
    const head = new THREE.Mesh(new THREE.BoxGeometry(def.r * 1.1, def.r * 1.0, def.r * 1.3), bodyMat);
    head.position.y = def.r * 3.2;
    head.castShadow = true; g.add(head);
    // Horns
    const hornMat = mkStd(0x080808);
    for (const s of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.ConeGeometry(def.r * 0.18, def.r * 0.6, 5), hornMat);
        h.position.set(s * def.r * 0.5, def.r * 3.6, 0);
        h.rotation.z = s * 0.4;
        g.add(h);
    }
    const eyeMat = mkEye(def.eye);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(def.r * 0.2, 8, 7), eyeMat);
    eye.position.set(0, def.r * 3.2, def.r * 0.65);
    g.add(eye);
    // Rocket launcher arm (right)
    const rl = new THREE.Mesh(new THREE.CylinderGeometry(def.r * 0.25, def.r * 0.25, def.r * 1.4, 10), mkStd(0x1a1a1a, 0x100408));
    rl.rotation.x = Math.PI / 2;
    rl.position.set(def.r * 1.0, def.r * 1.8, 0);
    g.add(rl);
    // Normal arm (left)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.4, def.r * 1.5, def.r * 0.4), bodyMat);
    arm.position.set(-def.r * 1.0, def.r * 1.8, 0);
    g.add(arm);
    // Mechanical legs
    for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(def.r * 0.18, def.r * 0.28, def.r * 1.4, 8), mkStd(0x2a2a2a, 0x100408));
        leg.position.set(s * def.r * 0.4, def.r * 0.7, 0);
        leg.castShadow = true; g.add(leg);
        g.userData.legs = g.userData.legs || [];
        g.userData.legs.push(leg);
    }
    g.userData.height = def.r * 3.8;
    g.userData.eyeMat = eyeMat;
    return g;
}

function buildSpider(def) {
    const g = new THREE.Group();
    const bodyMat = mkStd(def.col, 0x200408);
    // Big round abdomen
    const body = new THREE.Mesh(new THREE.SphereGeometry(def.r * 1.3, 10, 8), bodyMat);
    body.position.y = def.r * 1.5;
    body.scale.set(1.2, 0.8, 1.2);
    body.castShadow = true; g.add(body);
    // Brain head on top
    const brain = new THREE.Mesh(new THREE.SphereGeometry(def.r * 0.8, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xaa6060, emissive: 0x400010, emissiveIntensity: 0.8, roughness: 0.3 }));
    brain.position.y = def.r * 2.4;
    g.add(brain);
    // Eyes (multiple)
    const eyeMat = mkEye(def.eye);
    for (let i = 0; i < 4; i++) {
        const a = -0.6 + i * 0.4;
        const e = new THREE.Mesh(new THREE.SphereGeometry(def.r * 0.12, 6, 5), eyeMat);
        e.position.set(Math.cos(a) * def.r * 0.8, def.r * 2.2, Math.sin(a) * def.r * 0.8 + def.r * 0.3);
        g.add(e);
    }
    // Spider legs
    const legMat = mkStd(0x201810);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.1, def.r * 1.4, def.r * 0.1), legMat);
        leg.position.set(Math.cos(a) * def.r * 1.3, def.r * 0.8, Math.sin(a) * def.r * 1.3);
        leg.rotation.z = -Math.cos(a) * 0.5;
        leg.rotation.x = Math.sin(a) * 0.5;
        g.add(leg);
    }
    g.userData.height = def.r * 3.0;
    g.userData.eyeMat = eyeMat;
    return g;
}

const BUILDERS = {
    imp: buildImp,
    skull: buildSkull,
    demon: buildDemon,
    caco: buildCaco,
    baron: buildBaron,
    revenant: buildRevenant,
    cyber: buildCyber,
    spider: buildSpider,
};

export function buildEnemyMesh(def, isBoss = false) {
    const key = def.build || 'imp';
    const builder = BUILDERS[key] || buildImp;
    const g = builder(def);
    if (isBoss) {
        g.scale.multiplyScalar(1.1);
        // Boss aura light
        const aura = new THREE.PointLight(def.eye, 1.4, 12, 1.5);
        aura.position.y = def.r * 2;
        g.add(aura);
        g.userData.aura = aura;
    }
    return g;
}
