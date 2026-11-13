import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Tiny modelling kit: place primitives, then merge everything that shares a material into one geometry.
const _m4 = new THREE.Matrix4(), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export function P(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    _m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    g.applyMatrix4(_m4);
    return g;
}
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cone = (r, h, n = 5) => new THREE.ConeGeometry(r, h, n);
export const cyl = (rt, rb, h, n = 7) => new THREE.CylinderGeometry(rt, rb, h, n);
export const ball = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
export const merge = list => { const g = mergeGeometries(list); list.forEach(x => x.dispose()); return g; };
export const both = fn => [fn(-1), fn(1)];
