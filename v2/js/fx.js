import * as THREE from 'three';

// Screen & camera feel system.
// - Screen shake with proper falloff
// - Camera bob when moving, land jolt
// - Weapon sway + recoil
// - Slow-mo pinch on kill
// - DOM-side flash / vignette / damage arcs

export class FX {
    constructor({ camera, renderer, hud }) {
        this.camera = camera;
        this.renderer = renderer;
        this.hud = hud;

        this.shake = 0;         // linear shake magnitude
        this.shakeDecay = 4;    // per second
        this.bobPhase = 0;      // for walking
        this.landJolt = 0;      // decays
        this.recoil = 0;        // view kick
        this.swayX = 0; this.swayY = 0; // weapon sway
        this.slowMoT = 0;       // slow-mo countdown
        this.timeScale = 1;
        this.targetTimeScale = 1;

        this.$hit = document.getElementById('hit-flash');
        this.$dmgVig = document.getElementById('damage-vig');
        this.$announce = document.getElementById('announce');
        this.$annH1 = this.$announce.querySelector('h1');
        this.$annH2 = this.$announce.querySelector('h2');
        this.$biomeCard = document.getElementById('biome-card');
        this.$combo = document.getElementById('combo');
    }

    addShake(a) { this.shake = Math.min(1.2, this.shake + a); }
    kickRecoil(a) { this.recoil = Math.min(0.5, this.recoil + a); }
    landed(a) { this.landJolt = Math.min(0.6, this.landJolt + a); }

    slowMo(duration = 0.18, scale = 0.35) {
        this.slowMoT = duration;
        this.targetTimeScale = scale;
    }

    hitFlash(color = 'rgba(255,100,40,0.35)', ms = 50) {
        this.$hit.style.background = color;
        setTimeout(() => { this.$hit.style.background = 'rgba(255,80,20,0)'; }, ms);
    }

    damageVignette(intensity = 1) {
        this.$dmgVig.style.opacity = String(Math.min(1, intensity));
        setTimeout(() => { this.$dmgVig.style.opacity = '0'; }, 120);
        if (this.renderer) {
            this.renderer.setHurt(Math.min(1, intensity));
            setTimeout(() => this.renderer.setHurt(0), 250);
        }
    }

    announce(main, sub = '', ms = 1600) {
        this.$annH1.textContent = main;
        this.$annH2.textContent = sub;
        this.$announce.style.opacity = '1';
        clearTimeout(this._annT);
        this._annT = setTimeout(() => { this.$announce.style.opacity = '0'; }, ms);
    }

    showBiomeCard(name, sub = '') {
        const n = this.$biomeCard.querySelector('.name');
        const s = this.$biomeCard.querySelector('.sub');
        n.textContent = name; s.textContent = sub;
        this.$biomeCard.classList.add('on');
        clearTimeout(this._biomeT);
        this._biomeT = setTimeout(() => this.$biomeCard.classList.remove('on'), 2200);
    }

    showCombo(text) {
        this.$combo.textContent = text;
        if (text) this.$combo.classList.add('on'); else this.$combo.classList.remove('on');
    }

    update(dt, { pl, moving, dashing }) {
        // Decays
        this.shake = Math.max(0, this.shake - this.shakeDecay * dt);
        this.recoil = Math.max(0, this.recoil - 3 * dt);
        this.landJolt = Math.max(0, this.landJolt - 4 * dt);

        // Slow-mo
        if (this.slowMoT > 0) {
            this.slowMoT -= dt;
            if (this.slowMoT <= 0) this.targetTimeScale = 1;
        }
        this.timeScale += (this.targetTimeScale - this.timeScale) * Math.min(1, dt * 12);

        // Walking bob
        if (moving && !dashing) {
            this.bobPhase += dt * (dashing ? 14 : 9);
        } else {
            this.bobPhase *= 0.9;
        }
        const bobY = moving ? Math.sin(this.bobPhase * 2) * 0.03 : 0;
        const bobX = moving ? Math.sin(this.bobPhase) * 0.015 : 0;

        // Camera base position
        const baseY = pl.cameraHeight;
        const sx = (Math.random() - 0.5) * this.shake * 0.18;
        const sy = (Math.random() - 0.5) * this.shake * 0.18;
        this.camera.position.x = pl.x + bobX + sx;
        this.camera.position.y = baseY + bobY - this.landJolt * 0.3 + sy;
        this.camera.position.z = pl.z + sx * 0.5;

        // Rotation: yaw + pitch + recoil
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = -pl.angle + Math.PI / 2;
        this.camera.rotation.x = pl.pitch - this.recoil - this.landJolt * 0.4;
        this.camera.rotation.z = Math.sin(this.bobPhase) * 0.008 + sx * 0.08;

        // Weapon sway (we'll apply externally)
        const targetSwayX = -pl.lookDx * 0.4 || 0;
        const targetSwayY = -pl.lookDy * 0.4 || 0;
        this.swayX += (targetSwayX - this.swayX) * Math.min(1, dt * 8);
        this.swayY += (targetSwayY - this.swayY) * Math.min(1, dt * 8);
    }
}

// Directional damage arc: brief colored arc from the direction hit came from
export function flashDamageArc(fromAngle) {
    const el = document.createElement('div');
    el.className = 'dmg-arc';
    const dmgDirs = document.getElementById('damage-dirs');
    el.style.transform = `rotate(${fromAngle}rad)`;
    el.style.opacity = '0.9';
    el.style.transition = 'opacity 0.5s';
    dmgDirs.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 600);
}
