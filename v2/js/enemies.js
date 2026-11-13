import * as THREE from 'three';
import { P, box, cone, cyl, ball, merge, both } from './geo.js';
import { asset, ATLAS } from './textures.js';

// Enemy definitions — 5+ types with distinct silhouettes and behavior.

export const EDEF = {
    imp:    { r: 0.7, spd: 3.6, hp: 30, dmg: 12, sc: 55,  col: 0xb02010, eye: 0xff4444, build: 'imp' },
    skull:  { r: 0.45, spd: 6.0, hp: 14, dmg: 8, sc: 30,  col: 0xb8a898, eye: 0xff2222, build: 'skull', flying: true },
    demon:  { r: 0.85, spd: 4.2, hp: 70, dmg: 20, charger: true, sc: 110, col: 0xaa3366, eye: 0xff66ff, build: 'demon' },
    caco:   { r: 1.0, spd: 2.6, hp: 80, dmg: 14, sc: 160, col: 0xcc4444, eye: 0x44ff44, build: 'caco', flying: true, ranged: true, fRate: 1.2, projColor: 0x44ff44 },
    baron:  { r: 1.0, spd: 3.0, hp: 150, dmg: 22, sc: 280, col: 0x446622, eye: 0xff6600, build: 'baron', ranged: true, fRate: 1.6, projColor: 0xff6600 },
    revenant:{ r: 0.75, spd: 3.6, hp: 70, dmg: 16, sc: 140, col: 0xc0b8a8, eye: 0xff4040, build: 'revenant', ranged: true, fRate: 2.0, projColor: 0xff4040, tracking: true },
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

// ===== MODELS =====
// Each build is authored at unit radius from primitives, then merged into one geometry per material
// (body / dark trim / bone / glow) plus separate limbs for animation. Templates are cached and shared
// by every enemy of that build: ~6 draw calls per enemy, zero geometry allocation at spawn time.

// A limb: geometry with its pivot at the origin, attached at (x, y, z)
const limb = (parts, x, y, z) => ({ geo: merge(parts), x, y, z });

const TEMPLATES = {
    imp() {
        return {
            height: 2.75,
            body: [
                P(cyl(0.56, 0.36, 1.1, 6), 0, 1.55, 0, 0.16),
                P(box(0.62, 0.36, 0.42), 0, 0.96, 0),
                P(ball(0.43, 1), 0, 2.27, 0.14, 0, 0, 0, 1, 0.9, 1.08),
                P(box(0.4, 0.15, 0.38), 0, 1.98, 0.3, 0.2),
                ...both(s => P(ball(0.25, 0), s * 0.63, 1.96, 0)),
            ],
            trim: [
                ...both(s => P(cone(0.1, 0.6), s * 0.27, 2.7, -0.04, -0.35, 0, -s * 0.4)),
                ...both(s => P(cone(0.08, 0.38), s * 0.76, 2.18, 0, 0, 0, -s * 0.7)),
                P(cone(0.09, 0.42), 0, 2.0, -0.42, -1.25), P(cone(0.09, 0.42), 0, 1.65, -0.46, -1.35), P(cone(0.08, 0.36), 0, 1.3, -0.42, -1.45),
            ],
            glow: [...both(s => P(ball(0.085, 0), s * 0.17, 2.31, 0.5)), P(box(0.26, 0.045, 0.05), 0, 2.02, 0.5)],
            arms: both(s => limb([
                P(cyl(0.13, 0.1, 0.95, 5), 0, -0.47, 0), P(ball(0.15, 0), 0, -0.98, 0),
                P(cone(0.04, 0.26, 4), -0.07, -1.16, 0.05, Math.PI), P(cone(0.04, 0.26, 4), 0.07, -1.16, 0.05, Math.PI), P(cone(0.04, 0.26, 4), 0, -1.17, -0.06, Math.PI),
            ], s * 0.66, 1.92, 0)),
            legs: both(s => limb([
                P(cyl(0.18, 0.13, 0.52, 5), 0, -0.24, 0.05, -0.3), P(cyl(0.12, 0.09, 0.5, 5), 0, -0.66, 0.02, 0.35), P(box(0.2, 0.1, 0.38), 0, -0.9, 0.1),
            ], s * 0.24, 0.95, 0)),
        };
    },
    skull() { // lost soul: centred on its origin, trailing flames
        return {
            height: 1.6,
            bone: [
                P(ball(0.82, 1), 0, 0.12, 0, 0, 0, 0, 1, 0.95, 1.05),
                P(box(0.8, 0.34, 0.7), 0, -0.6, 0.22),
                P(box(0.5, 0.2, 0.2), 0, -0.3, 0.78),
            ],
            trim: [
                ...both(s => P(cone(0.16, 0.8), s * 0.62, 0.66, 0.1, 0.5, 0, -s * 0.75)),
                ...both(s => P(ball(0.26, 0), s * 0.33, 0.12, 0.72)),
                P(cone(0.1, 0.22, 3), 0, -0.14, 0.86, Math.PI),
                P(box(0.56, 0.08, 0.06), 0, -0.5, 0.6),
            ],
            glow: [
                ...both(s => P(ball(0.13, 0), s * 0.33, 0.12, 0.84)),
                P(cone(0.6, 1.5, 6), 0, 0.2, -1.0, -Math.PI / 2), P(cone(0.3, 0.9, 5), 0.4, 0.5, -0.8, -Math.PI / 2 + 0.3), P(cone(0.3, 0.9, 5), -0.4, 0.5, -0.8, -Math.PI / 2 + 0.3),
            ],
        };
    },
    demon() { // pinky: all jaw and shoulders
        return {
            height: 2.6,
            body: [
                P(ball(1.0, 1), 0, 1.45, -0.15, 0, 0, 0, 1.05, 0.82, 1.15),
                P(ball(0.7, 1), 0, 1.95, 0.62, 0, 0, 0, 1.05, 0.8, 1.0),
                P(box(0.95, 0.3, 0.8), 0, 1.36, 0.82, 0.12),
                ...both(s => P(ball(0.42, 0), s * 0.92, 1.75, 0.1)),
                P(cone(0.3, 0.9, 5), 0, 1.4, -1.3, -1.9),
            ],
            trim: [
                ...both(s => P(cone(0.13, 0.5), s * 0.5, 2.5, 0.5, 0.5, 0, -s * 0.5)),
                P(cone(0.12, 0.4), 0, 2.4, -0.1, -0.4), P(cone(0.12, 0.4), 0, 2.2, -0.6, -0.8), P(cone(0.11, 0.36), 0, 1.9, -1.0, -1.1),
            ],
            bone: [
                ...[-0.36, -0.18, 0, 0.18, 0.36].map(x => P(cone(0.075, 0.26, 4), x, 1.6, 1.16, 0.15)),
                ...[-0.3, -0.1, 0.1, 0.3].map(x => P(cone(0.07, 0.22, 4), x, 1.78, 1.22, Math.PI - 0.1)),
            ],
            glow: [...both(s => P(ball(0.11, 0), s * 0.36, 2.2, 1.12)), P(box(0.66, 0.12, 0.1), 0, 1.7, 1.08)],
            arms: both(s => limb([P(cyl(0.2, 0.15, 0.7, 5), 0, -0.35, 0.1, -0.4), P(ball(0.2, 0), 0, -0.72, 0.26)], s * 0.98, 1.6, 0.25)),
            legs: both(s => limb([
                P(cyl(0.34, 0.24, 0.6, 6), 0, -0.3, 0), P(cyl(0.22, 0.18, 0.4, 6), 0, -0.72, 0.05), P(box(0.42, 0.14, 0.56), 0, -0.92, 0.12),
            ], s * 0.5, 1.0, -0.1)),
        };
    },
    caco() { // floating ball of hate, centred on its origin
        const horns = [];
        for (let i = 0; i < 9; i++) {
            const a = (i / 9) * 6.283 + 0.35;
            horns.push(P(cone(0.16, 0.6), Math.cos(a) * 1.1, 0.72, Math.sin(a) * 1.1, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9));
        }
        return {
            height: 1.3,
            body: [P(ball(1.0, 2), 0, 0, 0, 0, 0, 0, 1.3, 1.02, 1.3), P(box(1.1, 0.16, 0.3), 0, 0.42, 1.12, -0.25)],
            trim: [...horns, P(cone(0.2, 0.7), 0, 1.25, 0, 0), P(ball(0.16, 0), 0, 0.02, 1.52), P(box(1.0, 0.3, 0.3), 0, -0.52, 1.08, 0.3)],
            bone: [
                ...[-0.36, -0.12, 0.12, 0.36].map(x => P(cone(0.075, 0.24, 4), x, -0.4, 1.2, Math.PI + 0.3)),
                ...[-0.28, 0, 0.28].map(x => P(cone(0.07, 0.2, 4), x, -0.66, 1.14, 0.3)),
            ],
            glow: [P(ball(0.27, 1), 0, 0.02, 1.26), P(box(0.8, 0.08, 0.1), 0, -0.52, 1.2, 0.3)],
        };
    },
    baron() {
        return {
            height: 3.6,
            body: [
                P(cyl(0.8, 0.5, 1.3, 6), 0, 2.05, 0, 0.1),
                P(box(0.9, 0.36, 0.5), 0, 2.45, 0.34, -0.2),
                P(box(0.74, 0.4, 0.5), 0, 1.3, 0),
                P(ball(0.46, 1), 0, 3.02, 0.16, 0, 0, 0, 0.95, 1.05, 1.1),
                P(box(0.4, 0.34, 0.5), 0, 2.86, 0.5, 0.3),
                ...both(s => P(ball(0.38, 0), s * 0.92, 2.6, 0)),
            ],
            trim: [
                ...both(s => P(cone(0.16, 0.7, 6), s * 0.46, 3.36, 0.0, 0, 0, -s * 1.05)),
                ...both(s => P(cone(0.1, 0.55, 6), s * 0.92, 3.7, 0.0, 0, 0, -s * 0.15)),
                ...both(s => P(cone(0.09, 0.3), s * 1.0, 2.95, 0, 0, 0, -s * 0.5)),
                P(cone(0.1, 0.3), 0, 2.62, 0.72, Math.PI * 0.9),
            ],
            glow: [...both(s => P(ball(0.085, 0), s * 0.2, 3.1, 0.6))],
            arms: both(s => limb([
                P(cyl(0.24, 0.18, 0.8, 6), 0, -0.4, 0), P(cyl(0.18, 0.22, 0.7, 6), 0, -1.1, 0.08, -0.25), P(ball(0.3, 0), 0, -1.55, 0.2),
            ], s * 0.96, 2.55, 0)),
            armGlow: both(s => limb([P(ball(0.2, 0), 0, -1.62, 0.34)], s * 0.96, 2.55, 0)),
            legs: both(s => limb([
                P(cyl(0.3, 0.2, 0.62, 6), 0, -0.28, 0.1, -0.45), P(cyl(0.16, 0.11, 0.62, 6), 0, -0.8, 0.0, 0.5), P(cyl(0.12, 0.2, 0.22, 6), 0, -1.14, 0.12),
            ], s * 0.3, 1.25, 0)),
            legTrim: true,
        };
    },
    revenant() {
        const ribs = [];
        for (let i = 0; i < 4; i++) ribs.push(P(box(0.82 - i * 0.08, 0.08, 0.5 - i * 0.04), 0, 2.36 - i * 0.2, 0.02));
        return {
            height: 3.4,
            bone: [
                ...ribs, P(cyl(0.09, 0.09, 1.3, 5), 0, 1.95, -0.1),
                P(box(0.5, 0.22, 0.3), 0, 1.3, 0),
                P(ball(0.36, 1), 0, 2.98, 0.06, 0, 0, 0, 0.92, 1.05, 1.05),
                P(box(0.34, 0.2, 0.3), 0, 2.68, 0.14),
            ],
            trim: [
                ...both(s => P(box(0.36, 0.34, 0.8), s * 0.62, 2.78, -0.08, -0.15)),
                ...both(s => P(ball(0.11, 0), s * 0.14, 3.02, 0.36)),
                P(box(0.2, 0.05, 0.05), 0, 2.74, 0.32),
            ],
            glow: [
                ...both(s => P(ball(0.06, 0), s * 0.14, 3.02, 0.42)),
                ...both(s => P(cyl(0.1, 0.1, 0.06, 6), s * 0.62, 2.84, 0.34, Math.PI / 2)),
                P(ball(0.14, 0), 0, 2.2, 0.1),
            ],
            armsBone: true,
            arms: both(s => limb([P(cyl(0.07, 0.06, 0.8, 5), 0, -0.4, 0), P(cyl(0.06, 0.05, 0.75, 5), 0, -1.15, 0.08, -0.2), P(box(0.14, 0.2, 0.1), 0, -1.6, 0.14)], s * 0.5, 2.5, 0)),
            legs: both(s => limb([P(cyl(0.09, 0.07, 0.62, 5), 0, -0.3, 0), P(cyl(0.07, 0.06, 0.6, 5), 0, -0.9, 0), P(box(0.16, 0.08, 0.34), 0, -1.22, 0.08)], s * 0.2, 1.26, 0)),
        };
    },
    cyber() { // boss chassis: bull head, cannon arm, one piston leg
        return {
            height: 3.9,
            body: [
                P(cyl(0.95, 0.62, 1.4, 6), 0, 2.3, 0, 0.08),
                P(box(1.1, 0.4, 0.6), 0, 2.72, 0.36, -0.2),
                P(box(0.86, 0.45, 0.6), 0, 1.45, 0),
                P(ball(0.5, 1), 0, 3.3, 0.2, 0, 0, 0, 1, 0.95, 1.15),
                P(box(0.46, 0.36, 0.5), 0, 3.12, 0.62, 0.25),
                P(ball(0.44, 0), -1.08, 2.85, 0),
            ],
            trim: [
                ...both(s => P(cone(0.17, 0.8, 6), s * 0.5, 3.7, 0.1, 0.2, 0, -s * 0.9)),
                P(ball(0.5, 0), 1.08, 2.85, 0), P(cyl(0.34, 0.3, 1.5, 8), 1.12, 2.3, 0.55, Math.PI / 2), P(cyl(0.4, 0.4, 0.2, 8), 1.12, 2.3, 1.3, Math.PI / 2),
                P(box(0.9, 0.5, 0.12), 0, 2.3, 0.72, 0.08), P(box(0.5, 0.3, 0.5), 0, 2.2, -0.75),
                ...both(s => P(cone(0.1, 0.4), s * 0.36, 2.9, -0.6, -1.0)),
            ],
            glow: [
                P(ball(0.1, 0), -0.22, 3.4, 0.72), P(ball(0.1, 0), 0.22, 3.4, 0.72),
                P(cyl(0.24, 0.24, 0.06, 8), 1.12, 2.3, 1.42, Math.PI / 2),
                P(box(0.5, 0.1, 0.05), 0, 2.3, 0.8, 0.08), P(box(0.3, 0.1, 0.05), 0, 2.2, -1.01),
            ],
            arms: [limb([P(cyl(0.26, 0.2, 0.9, 6), 0, -0.45, 0), P(cyl(0.2, 0.24, 0.8, 6), 0, -1.2, 0.1, -0.25), P(ball(0.32, 0), 0, -1.7, 0.22)], -1.1, 2.8, 0)],
            legs: [
                limb([P(cyl(0.36, 0.26, 0.7, 6), 0, -0.32, 0), P(cyl(0.2, 0.16, 0.7, 6), 0, -0.95, 0), P(box(0.5, 0.16, 0.7), 0, -1.34, 0.12)], -0.42, 1.42, 0),
                limb([P(cyl(0.3, 0.3, 0.5, 8), 0, -0.25, 0), P(cyl(0.12, 0.12, 0.8, 6), 0, -0.85, 0), P(cyl(0.2, 0.34, 0.3, 8), 0, -1.28, 0)], 0.42, 1.42, 0),
            ],
        };
    },
    spider() { // boss chassis: exposed brain on a walker
        const legs = [];
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * 6.283 + 0.52, cx = Math.cos(a), sz = Math.sin(a);
            legs.push(P(cyl(0.1, 0.1, 1.5, 5), cx * 1.55, 1.75, sz * 1.55, sz * 0.9, 0, -cx * 0.9));
            legs.push(P(cyl(0.09, 0.05, 1.9, 5), cx * 2.3, 0.95, sz * 2.3, -sz * 0.25, 0, cx * 0.25));
            legs.push(P(ball(0.16, 0), cx * 2.08, 1.95, sz * 2.08));
        }
        return {
            height: 3.2,
            body: [P(ball(1.05, 2), 0, 2.2, -0.1, 0, 0, 0, 1.15, 0.85, 1.25), P(box(0.9, 0.5, 0.5), 0, 1.75, 0.95, 0.2)],
            trim: [
                P(cyl(1.25, 1.0, 0.5, 8), 0, 1.45, 0), ...legs,
                P(cyl(0.16, 0.16, 1.2, 6), 0, 1.3, 1.1, Math.PI / 2), P(cyl(0.22, 0.22, 0.3, 6), 0, 1.3, 0.7, Math.PI / 2),
            ],
            bone: [...[-0.3, -0.1, 0.1, 0.3].map(x => P(cone(0.06, 0.2, 4), x, 1.56, 1.24, Math.PI))],
            glow: [
                ...both(s => P(ball(0.13, 0), s * 0.3, 1.95, 1.22)), ...both(s => P(ball(0.07, 0), s * 0.52, 2.08, 1.08)),
                P(cyl(0.1, 0.1, 0.05, 6), 0, 1.3, 1.72, Math.PI / 2),
                P(box(0.06, 0.06, 1.6), 0, 3.02, -0.1), P(box(1.4, 0.06, 0.06), 0, 2.98, -0.1),
            ],
        };
    },
};

const _shadowGeo = new THREE.CircleGeometry(1.0, 10).rotateX(-Math.PI / 2);
const _shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });
const _templates = new Map();
function template(key) {
    if (!_templates.has(key)) {
        const t = (TEMPLATES[key] || TEMPLATES.imp)();
        for (const k of ['body', 'trim', 'bone', 'glow']) t[k] = t[k] && t[k].length ? merge(t[k]) : null;
        _templates.set(key, t);
    }
    return _templates.get(key);
}

// Billboard enemies drawn from a painted sprite strip (classic 2D monsters in a 3D world)
const SPRITES = {
    imp: { height: 2.75, centered: false, walk: [1, 0, 2, 0], attack: 3, pain: 4, dead: 5 },
    skull: { height: 2.9, centered: true, walk: [0], attack: 1, pain: 2, dead: 3 },
    demon: { height: 2.6, centered: false, walk: [1, 0, 2, 0], attack: 3, pain: 4, dead: 5 },
    baron: { height: 3.6, centered: false, walk: [1, 0, 2, 0], attack: 3, pain: 4, dead: 5 },
    revenant: { height: 3.4, centered: false, walk: [1, 0, 2, 0], attack: 3, pain: 4, dead: 5 },
    cyber: { height: 3.9, centered: false, walk: [1, 0, 2, 0], attack: 3, pain: 4, dead: 5 },
    caco: { height: 2.5, centered: true, walk: [0], attack: 1, pain: 2, dead: 3 },
    spider: { height: 3.2, centered: false, walk: [0, 1], attack: 2, pain: 0, dead: 3 },
};
function buildSpriteEnemy(def, cfg, isBoss) {
    const info = ATLAS[def.build], tex = asset(def.build).clone();
    tex.needsUpdate = true;
    tex.repeat.set(1 / info.frames, 1);
    const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5 });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(cfg.height * info.w / info.h, cfg.height, 1);
    sp.center.set(0.5, cfg.centered ? 0.5 : 0);
    const g = new THREE.Group();
    g.add(sp);
    if (!def.flying) {
        const sh = new THREE.Mesh(_shadowGeo, _shadowMat);
        sh.position.y = 0.03 / def.r; sh.scale.setScalar(0.8); sh.renderOrder = 2;
        g.add(sh);
    }
    g.userData = { legs: [], arms: [], flash: [], mats: [mat, tex], height: cfg.height * def.r, sprite: { ...cfg, tex, mat, frames: info.frames } };
    g.scale.setScalar(def.r * (isBoss ? 1.15 : 1));
    return g;
}

export function buildEnemyMesh(def, isBoss = false) {
    if (SPRITES[def.build] && asset(def.build)) return buildSpriteEnemy(def, SPRITES[def.build], isBoss);
    const t = template(def.build);
    const col = new THREE.Color(def.col);
    const mats = {
        body: new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: isBoss ? 0.22 : 0.1, flatShading: true }),
        trim: new THREE.MeshLambertMaterial({ color: 0x3a3034, emissive: 0x000000, emissiveIntensity: 1, flatShading: true }),
        bone: new THREE.MeshLambertMaterial({ color: 0xd8ceb4, emissive: 0x30281c, emissiveIntensity: 0.3, flatShading: true }),
        glow: new THREE.MeshLambertMaterial({ color: 0x000000, emissive: def.eye, emissiveIntensity: 1, flatShading: true }),
    };
    const g = new THREE.Group();
    const add = (geo, mat, at) => {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = true;
        if (at) m.position.set(at.x, at.y, at.z);
        g.add(m);
        return m;
    };
    for (const k of ['body', 'trim', 'bone', 'glow']) if (t[k]) add(t[k], mats[k]);
    const limbMat = t.armsBone ? mats.bone : mats.body;
    g.userData.legs = (t.legs || []).map(l => add(l.geo, t.legTrim ? mats.trim : limbMat, l));
    g.userData.arms = (t.arms || []).map(l => add(l.geo, limbMat, l));
    if (t.armGlow) t.armGlow.forEach((l, i) => g.userData.arms[i].add(new THREE.Mesh(l.geo, mats.glow)));
    g.userData.height = t.height * def.r;
    g.userData.eyeMat = mats.glow;
    g.userData.mats = Object.values(mats);
    g.userData.flash = g.userData.mats.map(m => ({ m, hex: m.emissive.getHex(), i: m.emissiveIntensity }));
    if (!def.flying) { // old-school blob shadow instead of shadow maps
        const sh = new THREE.Mesh(_shadowGeo, _shadowMat);
        sh.position.y = 0.03 / def.r;
        sh.renderOrder = 2;
        g.add(sh);
    }
    g.scale.setScalar(def.r * (isBoss ? 1.15 : 1));
    return g;
}

// Geometry is shared between all enemies of a build; only the per-enemy materials are released.
export function disposeEnemyMesh(g) {
    for (const m of g.userData.mats) m.dispose();
}
