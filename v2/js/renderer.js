import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Custom chromatic aberration + vignette + grain shader in one pass
const PostFXShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uAberration: { value: 0.0015 },
        uVignette: { value: 0.65 },
        uGrain: { value: 0.045 },
        uHurt: { value: 0.0 },
        uAccent: { value: new THREE.Vector3(1, 0.4, 0.15) },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uAberration;
        uniform float uVignette;
        uniform float uGrain;
        uniform float uHurt;
        uniform vec3 uAccent;
        varying vec2 vUv;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

        void main(){
            vec2 uv = vUv;
            vec2 center = uv - 0.5;
            float dist = length(center);

            // Chromatic aberration (scaled by distance from center)
            float ab = uAberration * (0.5 + dist * 2.0 + uHurt * 6.0);
            vec3 col;
            col.r = texture2D(tDiffuse, uv + center * ab * 1.0).r;
            col.g = texture2D(tDiffuse, uv).g;
            col.b = texture2D(tDiffuse, uv - center * ab * 1.0).b;

            // Vignette
            float vig = 1.0 - smoothstep(0.3, 0.95, dist * uVignette);
            col *= mix(0.4, 1.0, vig);

            // Hurt flash tint
            col = mix(col, uAccent, uHurt * 0.3);

            // Film grain
            float grain = hash(uv + vec2(uTime, uTime * 1.3));
            col += (grain - 0.5) * uGrain;

            // Subtle warm color grade
            col.r = mix(col.r, pow(col.r, 0.92), 0.4);
            col.b = mix(col.b, pow(col.b, 1.08), 0.4);

            gl_FragColor = vec4(col, 1.0);
        }
    `,
};

export class RendererSystem {
    constructor(scene, camera, opts = {}) {
        this.isMobile = opts.isMobile || false;
        this.perfMode = opts.perfMode || false;
        this.scene = scene;
        this.camera = camera;

        const canvas = opts.canvas || document.createElement('canvas');
        if (!opts.canvas) document.body.prepend(canvas);

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: false,
            powerPreference: 'high-performance',
            alpha: false,
            stencil: false,
        });
        this.renderer.setPixelRatio(this.isMobile ? 1 : Math.min(devicePixelRatio, 1.5));
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.setClearColor(0x000000);
        this.renderer.shadowMap.enabled = !this.perfMode && !this.isMobile;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.setupComposer();
    }

    setupComposer() {
        const composer = new EffectComposer(this.renderer);
        composer.setSize(innerWidth, innerHeight);
        composer.setPixelRatio(this.renderer.getPixelRatio());

        const renderPass = new RenderPass(this.scene, this.camera);
        composer.addPass(renderPass);

        // Bloom — the signature move for emissive muzzle flashes
        const bloom = new UnrealBloomPass(
            new THREE.Vector2(innerWidth, innerHeight),
            this.isMobile ? 0.6 : 0.95, // strength
            this.isMobile ? 0.5 : 0.7,  // radius
            0.4,                         // threshold
        );
        this.bloom = bloom;
        composer.addPass(bloom);

        // Custom post FX (chromatic aberration, vignette, grain)
        const postFX = new ShaderPass(PostFXShader);
        this.postFX = postFX;
        composer.addPass(postFX);

        // SMAA on desktop only (expensive on mobile)
        if (!this.isMobile && !this.perfMode) {
            const smaa = new SMAAPass(innerWidth, innerHeight);
            composer.addPass(smaa);
            this.smaa = smaa;
        }

        const output = new OutputPass();
        composer.addPass(output);

        this.composer = composer;
    }

    setAccent(color) {
        if (!this.postFX) return;
        const c = new THREE.Color(color);
        this.postFX.uniforms.uAccent.value.set(c.r, c.g, c.b);
    }

    setHurt(v) {
        if (!this.postFX) return;
        this.postFX.uniforms.uHurt.value = v;
    }

    setBloomStrength(s) {
        if (!this.bloom) return;
        this.bloom.strength = s;
    }

    togglePerfMode(on) {
        this.perfMode = on;
        this.renderer.shadowMap.enabled = !on && !this.isMobile;
        if (on) {
            this.bloom.strength = 0.4;
            this.postFX.uniforms.uGrain.value = 0.02;
            this.postFX.uniforms.uAberration.value = 0.0005;
        } else {
            this.bloom.strength = this.isMobile ? 0.6 : 0.95;
            this.postFX.uniforms.uGrain.value = 0.045;
            this.postFX.uniforms.uAberration.value = 0.0015;
        }
    }

    render(dt) {
        this.postFX.uniforms.uTime.value += dt;
        this.composer.render();
    }

    onResize() {
        this.renderer.setSize(innerWidth, innerHeight);
        this.composer.setSize(innerWidth, innerHeight);
        this.camera.aspect = innerWidth / innerHeight;
        this.camera.updateProjectionMatrix();
    }
}
