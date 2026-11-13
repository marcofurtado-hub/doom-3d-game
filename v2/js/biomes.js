import * as THREE from 'three';
import { biomeTextures } from './textures.js';

// One biome per wave. Each owns palette, fog, lights, surface response, sky, props and ambient tone.
// props.type: 'flame' (stand + flickering flame), 'crystal', 'tube' (wall-mounted strip), 'orb' (floating)

export const BIOMES = [
    {
        id: 'infernal', trim: 0x3a2a26, name: 'INFERNAL KEEP', sub: 'tijolo · lava · enxofre',
        keep: true, tile: 2, openSky: true,
        fogColor: 0x1a0606, fogNear: 6, fogFar: 46, skyColor: 0x100206,
        hemiSky: 0xfff0e4, hemiGround: 0x8a6858, hemiIntensity: 2.9,
        sunColor: 0xffe0c0, sunIntensity: 1.2, sunDir: [10, 20, 8],
        rimColor: 0xff6030, rimIntensity: 14,
        accent: 0xff6a28,
        floor: { glow: 0 }, wall: { glow: 0 },
        ceilColor: 0x1a0806,
        embers: { count: 50, color: 0xff7a20, rise: true, speed: 0.5 },
        props: null,
        audioAmbient: { base: 50, lead: 80, texture: 'rumble' },
    },
    {
        id: 'tech', trim: 0x1e262e, name: 'TECH HELL', sub: 'steel · plasma · sigil',
        fogColor: 0x06141c, fogNear: 14, fogFar: 56, skyColor: 0x020810, openSky: false,
        hemiSky: 0x7aa0c0, hemiGround: 0x103828, hemiIntensity: 1.5,
        sunColor: 0x9fdcff, sunIntensity: 1.4, sunDir: [-8, 18, -6],
        rimColor: 0x50ff90, rimIntensity: 50,
        accent: 0x60ff98,
        floor: { roughness: 0.35, metalness: 0.7, glow: 2.4 },
        wall: { roughness: 0.4, metalness: 0.6, glow: 2.6 },
        ceilColor: 0x0c1218,
        embers: { count: 40, color: 0x60ffb0, rise: false, speed: 0.25 },
        props: { type: 'tube', color: 0x40ffa0, spacing: 6 },
        audioAmbient: { base: 70, lead: 140, texture: 'hum' },
    },
    {
        id: 'cathedral', trim: 0x30221e, name: 'BLOOD CATHEDRAL', sub: 'marble · candle · stained glass',
        fogColor: 0x1c0a10, fogNear: 12, fogFar: 50, skyColor: 0x100206, openSky: false,
        hemiSky: 0xc09078, hemiGround: 0x50181c, hemiIntensity: 1.5,
        sunColor: 0xffc080, sunIntensity: 1.5, sunDir: [6, 20, 10],
        rimColor: 0xff5040, rimIntensity: 50,
        accent: 0xff8848,
        floor: { roughness: 0.22, metalness: 0.15, glow: 1.6 },
        wall: { roughness: 0.7, metalness: 0.05, glow: 2.4 },
        ceilColor: 0x140808,
        embers: { count: 30, color: 0xffc070, rise: true, speed: 0.15 },
        props: { type: 'flame', color: 0xffb040, spacing: 5, candle: true },
        audioAmbient: { base: 55, lead: 110, texture: 'choir' },
    },
    {
        id: 'void', trim: 0x1c1230, name: 'VOID ARENA', sub: 'starlit · violet · endless',
        fogColor: 0x0a0418, fogNear: 16, fogFar: 64, skyColor: 0x020008, openSky: true,
        hemiSky: 0x7858d8, hemiGround: 0x281048, hemiIntensity: 1.0,
        sunColor: 0xb890ff, sunIntensity: 1.2, sunDir: [4, 22, -4],
        rimColor: 0xb060ff, rimIntensity: 60,
        accent: 0xa868ff,
        floor: { roughness: 0.3, metalness: 0.5, glow: 2.6 },
        wall: { roughness: 0.45, metalness: 0.5, glow: 2.6 },
        ceilColor: 0x020008,
        embers: { count: 110, color: 0xc090ff, rise: false, speed: 0.12 },
        props: { type: 'orb', color: 0xb070ff, spacing: 7 },
        sky: { stars: 1.0, moon: [0.35, 0.55, -0.75], moonColor: 0xd0b0ff, nebula: 0.5 },
        audioAmbient: { base: 40, lead: 90, texture: 'pad' },
    },
    {
        id: 'cryo', trim: 0x223444, name: 'CRYO LAB', sub: 'frost · crystal · silence',
        fogColor: 0x16222e, fogNear: 14, fogFar: 54, skyColor: 0x050a12, openSky: false,
        hemiSky: 0xa8d0ee, hemiGround: 0x284860, hemiIntensity: 1.5,
        sunColor: 0xc8e8ff, sunIntensity: 1.6, sunDir: [10, 20, 10],
        rimColor: 0x60c8ff, rimIntensity: 50,
        accent: 0x68c8ff,
        floor: { roughness: 0.15, metalness: 0.25, glow: 1.6 },
        wall: { roughness: 0.3, metalness: 0.2, glow: 1.6 },
        ceilColor: 0x0c141c,
        embers: { count: 60, color: 0xd0f0ff, rise: false, speed: 0.1 },
        props: { type: 'crystal', color: 0x60d0ff, spacing: 5 },
        audioAmbient: { base: 60, lead: 170, texture: 'crystal' },
    },
    {
        id: 'ash', trim: 0x2e1e16, name: 'ASH WASTES', sub: 'cinder · ember · red sky',
        fogColor: 0x2a1408, fogNear: 12, fogFar: 54, skyColor: 0x1a0402, openSky: true,
        hemiSky: 0xd08858, hemiGround: 0x502410, hemiIntensity: 1.5,
        sunColor: 0xff9050, sunIntensity: 1.8, sunDir: [-10, 14, 6],
        rimColor: 0xff7018, rimIntensity: 40,
        accent: 0xff8020,
        floor: { roughness: 0.9, metalness: 0.0, glow: 2.0 },
        wall: { roughness: 0.85, metalness: 0.0, glow: 1.0 },
        ceilColor: 0x080402,
        embers: { count: 140, color: 0xff8030, rise: true, speed: 0.7 },
        props: { type: 'flame', color: 0xff5a10, spacing: 9 },
        sky: { stars: 0.15, moon: [-0.55, 0.3, 0.75], moonColor: 0xff5020, nebula: 1.0 },
        audioAmbient: { base: 48, lead: 95, texture: 'wind' },
    },
    {
        id: 'bone', trim: 0x262c1c, name: 'BONE MIRE', sub: 'skull · bog · rot',
        fogColor: 0x0e160a, fogNear: 10, fogFar: 44, skyColor: 0x030602, openSky: true,
        hemiSky: 0x90a878, hemiGround: 0x283818, hemiIntensity: 1.4,
        sunColor: 0xc8f0a0, sunIntensity: 1.3, sunDir: [6, 18, -8],
        rimColor: 0x70ff40, rimIntensity: 40,
        accent: 0x80ff48,
        floor: { roughness: 0.6, metalness: 0.0, glow: 1.8 },
        wall: { roughness: 0.75, metalness: 0.0, glow: 2.4 },
        ceilColor: 0x060802,
        embers: { count: 50, color: 0x90ff50, rise: true, speed: 0.2 },
        props: { type: 'flame', color: 0x70ff30, spacing: 8 },
        sky: { stars: 0.5, moon: [0.2, 0.5, 0.85], moonColor: 0xc8ffb0, nebula: 0.3 },
        audioAmbient: { base: 45, lead: 85, texture: 'drip' },
    },
];

export function biomeForWave(wave) {
    return BIOMES[(wave - 1) % BIOMES.length];
}

// Retro surfaces: Lambert lighting, nearest-filtered textures, glow only where the emissive map says so.
export function buildSurfaceMaterial(biome, which) {
    const t = biomeTextures(biome.id)[which];
    return new THREE.MeshLambertMaterial({
        map: t.map,
        emissiveMap: t.emissiveMap,
        emissive: t.emissiveMap ? 0xffffff : 0x000000,
        emissiveIntensity: Math.min(1, biome[which].glow * 0.45),
    });
}

// Shader sky dome: gradient + horizon glow + stars + moon/sun disc + drifting nebula.
export function buildSky(biome) {
    const s = biome.sky || { stars: 0.3, moon: [0.3, 0.5, 0.8], moonColor: biome.accent, nebula: 0.4 };
    const uniforms = {
        topColor: { value: new THREE.Color(biome.skyColor) },
        bottomColor: { value: new THREE.Color(biome.fogColor) },
        accentColor: { value: new THREE.Color(biome.accent) },
        moonColor: { value: new THREE.Color(s.moonColor) },
        moonDir: { value: new THREE.Vector3(...s.moon).normalize() },
        stars: { value: s.stars },
        nebula: { value: s.nebula },
        time: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
        uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: /* glsl */`
            varying vec3 vDir;
            void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
            uniform vec3 topColor, bottomColor, accentColor, moonColor, moonDir;
            uniform float stars, nebula, time;
            varying vec3 vDir;
            float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
                return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
            void main(){
                vec3 d = normalize(vDir);
                float h = clamp(d.y, 0.0, 1.0);
                vec3 col = mix(bottomColor, topColor, smoothstep(0.0, 0.55, h));
                col += accentColor * pow(1.0 - h, 6.0) * 0.35;
                vec2 q = d.xz / (d.y + 0.35);
                float n = noise(q * 1.6 + time * 0.02) * 0.6 + noise(q * 3.7 - time * 0.03) * 0.4;
                col += accentColor * smoothstep(0.45, 0.9, n) * nebula * 0.22 * smoothstep(0.02, 0.4, h);
                vec2 sp = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 60.0;
                float st = hash(floor(sp));
                float tw = 0.6 + 0.4 * sin(time * 2.0 + st * 80.0);
                col += vec3(1.6) * step(0.985, st) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5)) * stars * tw * smoothstep(0.05, 0.3, h);
                float m = dot(d, moonDir);
                col += moonColor * (smoothstep(0.9982, 0.9988, m) * 1.6 + pow(max(m, 0.0), 90.0) * 0.35);
                gl_FragColor = vec4(col, 1.0);
            }`,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), mat);
    mesh.userData.uniforms = uniforms;
    return mesh;
}
