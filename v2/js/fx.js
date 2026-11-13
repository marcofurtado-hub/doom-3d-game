// Camera feel + DOM-side screen effects.
// The player's forward vector is (cos angle, sin angle) on XZ; the camera yaw is derived from it.

export class FX {
    constructor({ camera, renderer }) {
        this.camera = camera;
        this.renderer = renderer;
        this.baseFov = camera.fov;

        this.shake = 0;
        this.bobPhase = 0;
        this.bobAmp = 0;
        this.jolt = 0;
        this.recoil = 0;
        this.swayX = 0; this.swayY = 0;
        this.hurt = 0;
        this.dash = 0;
        this.roll = 0;
        this.slowT = 0;
        this.timeScale = 1;
        this.slowScale = 1;

        const $ = id => document.getElementById(id);
        this.$hit = $('hit-flash');
        this.$announce = $('announce');
        this.$annH1 = this.$announce.querySelector('h1');
        this.$annH2 = this.$announce.querySelector('h2');
        this.$biomeCard = $('biome-card');
        this.$fade = $('fade');
        this.$dirs = $('damage-dirs');
    }

    addShake(a) { this.shake = Math.min(1.5, this.shake + a); }
    kickRecoil(a) { this.recoil = Math.min(0.35, this.recoil + a); }
    addJolt(a) { this.jolt = Math.min(0.6, this.jolt + a); }
    slowMo(duration = 0.2, scale = 0.35) { this.slowT = duration; this.slowScale = scale; }

    screenFlash(color, ms = 70) {
        this.$hit.style.background = color;
        clearTimeout(this._hitT);
        this._hitT = setTimeout(() => { this.$hit.style.background = 'transparent'; }, ms);
    }

    damage(intensity) { this.hurt = Math.min(1, Math.max(this.hurt, 0.35 + intensity)); }

    // rel = angle of the damage source relative to the player's facing (0 = ahead, + = right)
    damageArc(rel) {
        const el = document.createElement('div');
        el.className = 'dmg-arc';
        el.style.transform = `rotate(${rel - Math.PI / 2}rad)`;
        this.$dirs.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '0'; });
        setTimeout(() => el.remove(), 700);
    }

    announce(main, sub = '', ms = 1600) {
        this.$annH1.textContent = main;
        this.$annH2.textContent = sub;
        this.$announce.style.opacity = '1';
        clearTimeout(this._annT);
        this._annT = setTimeout(() => { this.$announce.style.opacity = '0'; }, ms);
    }

    showBiomeCard(name, sub, accent) {
        this.$biomeCard.style.setProperty('--accent', accent);
        this.$biomeCard.querySelector('.name').textContent = name;
        this.$biomeCard.querySelector('.sub').textContent = sub;
        this.$biomeCard.classList.add('on');
        clearTimeout(this._biomeT);
        this._biomeT = setTimeout(() => this.$biomeCard.classList.remove('on'), 2200);
    }

    fade(on) { this.$fade.classList.toggle('on', on); }

    // dt is real time. Writes the camera transform for this frame.
    update(dt, pl, { moving, dashing }) {
        this.shake = Math.max(0, this.shake - (2.5 + this.shake * 3) * dt);
        this.recoil += (0 - this.recoil) * Math.min(1, dt * 9);
        this.jolt += (0 - this.jolt) * Math.min(1, dt * 7);
        this.hurt = Math.max(0, this.hurt - dt * 1.8);
        this.dash += ((dashing ? 1 : 0) - this.dash) * Math.min(1, dt * (dashing ? 30 : 7));

        if (this.slowT > 0) this.slowT -= dt;
        this.timeScale += ((this.slowT > 0 ? this.slowScale : 1) - this.timeScale) * Math.min(1, dt * 14);

        this.bobAmp += ((moving ? 1 : 0) - this.bobAmp) * Math.min(1, dt * 8);
        if (moving) this.bobPhase += dt * 10.5;
        const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.055 * this.bobAmp;
        const bobX = Math.cos(this.bobPhase) * 0.03 * this.bobAmp;

        // Shake: smooth pseudo-noise, not per-frame random jitter
        const t = performance.now() * 0.001, s = this.shake * this.shake;
        const shx = (Math.sin(t * 61) + Math.sin(t * 37.3 + 1.7)) * 0.5 * s;
        const shy = (Math.sin(t * 53 + 0.5) + Math.sin(t * 41.7 + 4.1)) * 0.5 * s;

        const cam = this.camera;
        const rx = -Math.sin(pl.angle), rz = Math.cos(pl.angle); // right vector
        cam.position.set(pl.x + rx * bobX, pl.cameraHeight + bobY - this.jolt * 0.25 + shy * 0.05, pl.z + rz * bobX);
        cam.rotation.order = 'YXZ';
        cam.rotation.y = -pl.angle - Math.PI / 2 + shx * 0.03;
        cam.rotation.x = pl.pitch + this.recoil + shy * 0.03 - this.jolt * 0.12;
        const strafeRoll = -(pl.strafe || 0) * 0.02;
        this.roll += (strafeRoll - this.roll) * Math.min(1, dt * 8);
        cam.rotation.z = this.roll + shx * 0.02 + (pl.deathRoll || 0);

        const fov = this.baseFov + this.dash * 14;
        if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
        cam.updateMatrixWorld();

        const lx = Math.max(-40, Math.min(40, pl.lookDx || 0)), ly = Math.max(-40, Math.min(40, pl.lookDy || 0));
        this.swayX += (-lx * 0.0012 - bobX * 0.4 - this.swayX) * Math.min(1, dt * 10);
        this.swayY += (ly * 0.0012 - bobY * 0.35 - this.swayY) * Math.min(1, dt * 10);

        const u = this.renderer.fx;
        u.uHurt.value = this.hurt;
        u.uDash.value = this.dash;
    }
}
