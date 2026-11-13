import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// One combined pass: chromatic aberration, dash radial blur, vignette (biome tinted), hurt tint, grain.
const PostFXShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uAberration: { value: 0.0012 },
        uVignette: { value: 1.0 },
        uGrain: { value: 0.05 },
        uHurt: { value: 0 },
        uDash: { value: 0 },
        uAccent: { value: new THREE.Vector3(1, 0.4, 0.15) },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uTime, uAberration, uVignette, uGrain, uHurt, uDash;
        uniform vec3 uAccent;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
            vec2 c = vUv - 0.5;
            float dist = length(c);
            float ab = uAberration * (0.4 + dist * 2.5) * (1.0 + uHurt * 5.0 + uDash * 4.0);
            vec3 col;
            col.r = texture2D(tDiffuse, vUv + c * ab).r;
            col.g = texture2D(tDiffuse, vUv).g;
            col.b = texture2D(tDiffuse, vUv - c * ab).b;
            if (uDash > 0.01) {
                vec3 acc = vec3(0.0);
                for (int i = 1; i <= 6; i++) acc += texture2D(tDiffuse, vUv - c * uDash * 0.035 * float(i)).rgb;
                col = mix(col, acc / 6.0, min(1.0, uDash * 1.2) * smoothstep(0.05, 0.5, dist));
            }
            float edge = smoothstep(0.35, 0.85, dist) * uVignette;
            col *= 1.0 - edge * 0.55;
            col += uAccent * edge * 0.035;
            col = mix(col, vec3(0.9, 0.03, 0.0) * (0.3 + dot(col, vec3(0.33))), uHurt * (0.25 + edge * 0.6));
            // Grain scaled by luminance so dark areas stay clean after the sRGB transfer
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            col += (hash(vUv * 913.0 + uTime) - 0.5) * uGrain * (0.02 + lum);
            gl_FragColor = vec4(max(col, 0.0), 1.0);
        }`,
};

export class RendererSystem {
    constructor(scene, camera, { isMobile = false, perf = false } = {}) {
        this.isMobile = isMobile;
        this.scene = scene;
        this.camera = camera;
        this.perf = false;

        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
        this.basePixelRatio = isMobile ? 1 : Math.min(devicePixelRatio, 1.5);
        this.renderer.setPixelRatio(this.basePixelRatio);
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.renderer.shadowMap.enabled = !isMobile;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.prepend(this.renderer.domElement);

        const composer = new EffectComposer(this.renderer);
        composer.addPass(new RenderPass(scene, camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), isMobile ? 0.55 : 0.7, 0.55, 0.85);
        composer.addPass(this.bloom);
        this.postFX = new ShaderPass(PostFXShader);
        composer.addPass(this.postFX);
        composer.addPass(new OutputPass());
        if (!isMobile) {
            this.smaa = new SMAAPass(innerWidth * this.basePixelRatio, innerHeight * this.basePixelRatio);
            composer.addPass(this.smaa);
        }
        this.composer = composer;
        this.fx = this.postFX.uniforms;
        if (perf) this.setPerfMode(true);
    }

    setAccent(color) {
        const c = new THREE.Color(color);
        this.fx.uAccent.value.set(c.r, c.g, c.b);
    }

    // Perf mode: no bloom, no SMAA, no shadows, lower internal resolution.
    setPerfMode(on) {
        this.perf = on;
        this.bloom.enabled = !on;
        if (this.smaa) this.smaa.enabled = !on;
        this.fx.uGrain.value = on ? 0 : 0.05;
        const pr = on ? Math.min(this.basePixelRatio, 1) * (this.isMobile ? 0.75 : 1) : this.basePixelRatio;
        this.renderer.setPixelRatio(pr);
        this.composer.setPixelRatio(pr);
        this.onResize();
    }

    get shadows() { return !this.isMobile && !this.perf; }

    render(dt) {
        this.fx.uTime.value = (this.fx.uTime.value + dt) % 100;
        this.composer.render(dt);
    }

    onResize() {
        this.renderer.setSize(innerWidth, innerHeight);
        this.composer.setSize(innerWidth, innerHeight);
        this.camera.aspect = innerWidth / innerHeight;
        this.camera.updateProjectionMatrix();
    }
}
