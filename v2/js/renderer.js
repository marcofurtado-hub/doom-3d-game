import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Retro pipeline: the scene is rendered into a small buffer (about 240 lines) and stretched with
// nearest-neighbour, so every pixel is a chunky square. One post pass does the classic tricks:
// palette quantisation with ordered (Bayer) dithering and the red "pain" palette shift.
// No bloom, no antialiasing, no shadow maps.
const RetroShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uLevels: { value: 40 },
        uHurt: { value: 0 },
        uDash: { value: 0 },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uLevels, uHurt, uDash;
        uniform vec3 uTint;
        varying vec2 vUv;
        float bayer(vec2 p) {
            vec2 a = floor(mod(p, 4.0));
            float i = a.x + a.y * 4.0;
            // 4x4 Bayer matrix, values 0..15
            float v = 0.0;
            if (i < 0.5) v = 0.0; else if (i < 1.5) v = 8.0; else if (i < 2.5) v = 2.0; else if (i < 3.5) v = 10.0;
            else if (i < 4.5) v = 12.0; else if (i < 5.5) v = 4.0; else if (i < 6.5) v = 14.0; else if (i < 7.5) v = 6.0;
            else if (i < 8.5) v = 3.0; else if (i < 9.5) v = 11.0; else if (i < 10.5) v = 1.0; else if (i < 11.5) v = 9.0;
            else if (i < 12.5) v = 15.0; else if (i < 13.5) v = 7.0; else if (i < 14.5) v = 13.0; else v = 5.0;
            return (v + 0.5) / 16.0;
        }
        void main(){
            vec2 uv = vUv;
            // dash: squeeze the image toward the centre for a few frames (cheap speed feel, no blur)
            uv = (uv - 0.5) * (1.0 - uDash * 0.06) + 0.5;
            vec3 col = texture2D(tDiffuse, uv).rgb;
            col = mix(col, vec3(dot(col, vec3(0.5, 0.3, 0.2)) + 0.25, 0.0, 0.0), uHurt * 0.55);
            col *= uTint;
            col = floor(col * uLevels + bayer(gl_FragCoord.xy)) / uLevels;
            gl_FragColor = vec4(col, 1.0);
        }`,
};

export class RendererSystem {
    // barHeight(): pixels of the status bar at the bottom that the 3D view must not cover
    constructor(scene, camera, { isMobile = false, hd = false, barHeight = () => 0 } = {}) {
        this.isMobile = isMobile;
        this.scene = scene;
        this.camera = camera;
        this.hd = hd;
        this.barHeight = barHeight;

        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
        this.renderer.setPixelRatio(1);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.shadowMap.enabled = false;
        const c = this.renderer.domElement;
        c.id = 'view';
        document.body.prepend(c);

        const composer = new EffectComposer(this.renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new OutputPass());
        this.retro = new ShaderPass(RetroShader);
        composer.addPass(this.retro);
        this.composer = composer;
        this.fx = this.retro.uniforms;
        this.onResize();
    }

    setAccent() {}

    // "HD" just doubles the line count; the look stays pixelated.
    setHd(on) { this.hd = on; this.onResize(); }

    get shadows() { return false; }

    render(dt) {
        this.fx.uTime.value = (this.fx.uTime.value + dt) % 100;
        this.composer.render(dt);
    }

    onResize() {
        const vw = innerWidth, vh = Math.max(120, innerHeight - this.barHeight());
        const lines = this.hd ? 480 : 240;
        const scale = Math.max(1, Math.round(vh / lines));
        const bw = Math.ceil(vw / scale), bh = Math.ceil(vh / scale);
        this.renderer.setSize(bw, bh, false);
        this.composer.setSize(bw, bh);
        const c = this.renderer.domElement;
        c.style.width = vw + 'px';
        c.style.height = vh + 'px';
        this.camera.aspect = vw / vh;
        this.camera.updateProjectionMatrix();
    }
}
