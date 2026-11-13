import * as THREE from 'three';
import * as TX from './textures.js';

// Each biome defines palette, lighting, materials, fog, ambient tone.
// Called by arena.js when rotating.

export const BIOMES = [
    {
        id: 'infernal',
        name: 'INFERNAL KEEP',
        sub: 'brimstone · obsidian · lava',
        fogColor: 0x1a0505, fogNear: 10, fogFar: 42,
        skyColor: 0x100206,
        ambColor: 0x8a5438, ambIntensity: 0.85,
        sunColor: 0xff8450, sunIntensity: 1.6, sunDir: [10, 20, 8],
        rimColor: 0xff3818, rimIntensity: 1.8,
        accent: 0xff6a28,
        fogMix: 0.04,
        floorMat: () => new THREE.MeshStandardMaterial({
            map: TX.infernalFloor(), roughness: 0.7, metalness: 0.15,
            emissive: 0x401008, emissiveIntensity: 0.3,
        }),
        wallMat: () => new THREE.MeshStandardMaterial({
            map: TX.infernalWall(), roughness: 0.8, metalness: 0.05,
            emissive: 0x200404, emissiveIntensity: 0.4,
        }),
        ceilColor: 0x080204,
        embers: { count: 60, color: 0xff6a20, rise: true, speed: 0.4 },
        audioAmbient: { base: 50, lead: 80, texture: 'rumble' },
    },
    {
        id: 'tech',
        name: 'TECH HELL',
        sub: 'steel · plasma · sigil',
        fogColor: 0x02121a, fogNear: 12, fogFar: 44,
        skyColor: 0x020810,
        ambColor: 0x405060, ambIntensity: 0.7,
        sunColor: 0x80d4ff, sunIntensity: 1.4, sunDir: [-8, 18, -6],
        rimColor: 0x60ff88, rimIntensity: 1.9,
        accent: 0x60ff88,
        fogMix: 0.02,
        floorMat: () => new THREE.MeshStandardMaterial({
            map: TX.techFloor(), roughness: 0.4, metalness: 0.8,
            emissive: 0x002010, emissiveIntensity: 0.15,
        }),
        wallMat: () => new THREE.MeshStandardMaterial({
            map: TX.techWall(), roughness: 0.3, metalness: 0.75,
            emissive: 0x001820, emissiveIntensity: 0.25,
        }),
        ceilColor: 0x060a0e,
        embers: { count: 40, color: 0x60ffaa, rise: false, speed: 0.25 },
        audioAmbient: { base: 70, lead: 140, texture: 'hum' },
    },
    {
        id: 'cathedral',
        name: 'BLOOD CATHEDRAL',
        sub: 'marble · candle · chant',
        fogColor: 0x1a0a0e, fogNear: 10, fogFar: 40,
        skyColor: 0x100206,
        ambColor: 0x8a6050, ambIntensity: 0.85,
        sunColor: 0xffb060, sunIntensity: 1.5, sunDir: [6, 20, 10],
        rimColor: 0xff4040, rimIntensity: 1.8,
        accent: 0xff8040,
        fogMix: 0.05,
        floorMat: () => new THREE.MeshStandardMaterial({
            map: TX.cathedralFloor(), roughness: 0.4, metalness: 0.2,
            emissive: 0x200810, emissiveIntensity: 0.2,
        }),
        wallMat: () => new THREE.MeshStandardMaterial({
            map: TX.cathedralWall(), roughness: 0.6, metalness: 0.1,
            emissive: 0x200404, emissiveIntensity: 0.3,
        }),
        ceilColor: 0x080204,
        embers: { count: 25, color: 0xffb060, rise: true, speed: 0.15 },
        audioAmbient: { base: 55, lead: 110, texture: 'choir' },
    },
    {
        id: 'void',
        name: 'VOID ARENA',
        sub: 'starlit · violet · empty',
        fogColor: 0x080312, fogNear: 14, fogFar: 50,
        skyColor: 0x020008,
        ambColor: 0x4030a0, ambIntensity: 0.65,
        sunColor: 0xa060ff, sunIntensity: 1.1, sunDir: [4, 22, -4],
        rimColor: 0xb060ff, rimIntensity: 2.0,
        accent: 0xa060ff,
        fogMix: 0.01,
        floorMat: () => new THREE.MeshStandardMaterial({
            map: TX.voidFloor(), roughness: 0.6, metalness: 0.4,
            emissive: 0x100820, emissiveIntensity: 0.4,
        }),
        wallMat: () => new THREE.MeshStandardMaterial({
            map: TX.voidWall(), roughness: 0.5, metalness: 0.5,
            emissive: 0x200840, emissiveIntensity: 0.5,
        }),
        ceilColor: 0x020008,
        embers: { count: 100, color: 0xb080ff, rise: false, speed: 0.1 },
        audioAmbient: { base: 40, lead: 90, texture: 'pad' },
    },
    {
        id: 'cryo',
        name: 'CRYO LAB',
        sub: 'frost · crystal · silent',
        fogColor: 0x101822, fogNear: 12, fogFar: 46,
        skyColor: 0x050a12,
        ambColor: 0x6a9abe, ambIntensity: 0.8,
        sunColor: 0xa0d4ff, sunIntensity: 1.6, sunDir: [10, 20, 10],
        rimColor: 0x60c0ff, rimIntensity: 1.7,
        accent: 0x60c0ff,
        fogMix: 0.03,
        floorMat: () => new THREE.MeshStandardMaterial({
            map: TX.cryoFloor(), roughness: 0.25, metalness: 0.4,
            emissive: 0x081020, emissiveIntensity: 0.25,
        }),
        wallMat: () => new THREE.MeshStandardMaterial({
            map: TX.cryoWall(), roughness: 0.4, metalness: 0.3,
            emissive: 0x081020, emissiveIntensity: 0.2,
        }),
        ceilColor: 0x060a12,
        embers: { count: 50, color: 0xc0e8ff, rise: false, speed: 0.08 },
        audioAmbient: { base: 60, lead: 170, texture: 'crystal' },
    },
    {
        id: 'ash',
        name: 'ASH WASTES',
        sub: 'cinder · ember · wind',
        fogColor: 0x18100a, fogNear: 10, fogFar: 40,
        skyColor: 0x100804,
        ambColor: 0xaa8060, ambIntensity: 0.85,
        sunColor: 0xff8040, sunIntensity: 1.5, sunDir: [-10, 18, 6],
        rimColor: 0xff8020, rimIntensity: 1.7,
        accent: 0xff8020,
        fogMix: 0.06,
        floorMat: () => new THREE.MeshStandardMaterial({
            map: TX.ashFloor(), roughness: 0.85, metalness: 0.05,
            emissive: 0x200800, emissiveIntensity: 0.2,
        }),
        wallMat: () => new THREE.MeshStandardMaterial({
            map: TX.ashWall(), roughness: 0.75, metalness: 0.1,
            emissive: 0x180804, emissiveIntensity: 0.25,
        }),
        ceilColor: 0x080402,
        embers: { count: 120, color: 0xff8040, rise: true, speed: 0.6 },
        audioAmbient: { base: 48, lead: 95, texture: 'wind' },
    },
    {
        id: 'bone',
        name: 'BONE MIRE',
        sub: 'skull · bog · rot',
        fogColor: 0x0a1008, fogNear: 10, fogFar: 36,
        skyColor: 0x040802,
        ambColor: 0x708a60, ambIntensity: 0.75,
        sunColor: 0xa0ff80, sunIntensity: 1.3, sunDir: [6, 18, -8],
        rimColor: 0x80ff40, rimIntensity: 1.6,
        accent: 0x80ff40,
        fogMix: 0.05,
        floorMat: () => new THREE.MeshStandardMaterial({
            map: TX.ashFloor(), color: 0x6a8060, roughness: 0.8, metalness: 0.05,
            emissive: 0x0a1004, emissiveIntensity: 0.2,
        }),
        wallMat: () => new THREE.MeshStandardMaterial({
            map: TX.cathedralWall(), color: 0x8a9080, roughness: 0.7, metalness: 0.1,
            emissive: 0x081008, emissiveIntensity: 0.25,
        }),
        ceilColor: 0x060802,
        embers: { count: 40, color: 0x80ff40, rise: true, speed: 0.2 },
        audioAmbient: { base: 45, lead: 85, texture: 'drip' },
    },
];

export function biomeForWave(wave) {
    return BIOMES[(wave - 1) % BIOMES.length];
}

// Tunable procedural sky-dome (a large gradient sphere).
export function buildSky(biome) {
    const geo = new THREE.SphereGeometry(80, 24, 12);
    const uniforms = {
        topColor: { value: new THREE.Color(biome.skyColor) },
        bottomColor: { value: new THREE.Color(biome.fogColor) },
        accentColor: { value: new THREE.Color(biome.accent) },
        time: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: /* glsl */`
            varying vec3 vPos;
            void main(){
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform vec3 accentColor;
            uniform float time;
            varying vec3 vPos;
            float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
            void main(){
                float h = normalize(vPos).y * 0.5 + 0.5;
                vec3 col = mix(bottomColor, topColor, smoothstep(0.1, 0.9, h));
                // Horizon glow
                float horizon = pow(1.0 - abs(normalize(vPos).y), 8.0);
                col += accentColor * horizon * 0.3;
                // Faint stars on the top
                vec2 p = vPos.xz * 0.5;
                float st = hash(floor(p * 40.0));
                if (st > 0.985 && h > 0.5) col += vec3(1.0) * (st - 0.985) * 40.0;
                // Pulsing cloud of color
                float pulse = sin(time * 0.3 + vPos.x * 0.05) * 0.5 + 0.5;
                col += accentColor * pulse * 0.04 * smoothstep(0.1, 0.5, h);
                gl_FragColor = vec4(col, 1.0);
            }
        `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.uniforms = uniforms;
    return mesh;
}
