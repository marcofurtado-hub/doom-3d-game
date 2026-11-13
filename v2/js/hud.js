import { WEAP, WC } from './weapons.js';

// HUD: DOM-side updates. Animated numbers on HP/score/kills, DOOM face canvas, weapon slots.

export class HUD {
    constructor() {
        this.$hud = document.getElementById('hud');
        this.$bottom = document.getElementById('bottom-hud');
        this.$hWave = document.getElementById('h-wave');
        this.$hScore = document.getElementById('h-score');
        this.$hKills = document.getElementById('h-kills');
        this.$hHi = document.getElementById('h-hi');
        this.$hTime = document.getElementById('h-time');
        this.$hBiome = document.getElementById('h-biome');

        this.$hvAmmo = document.getElementById('hv-ammo');
        this.$hvHp = document.getElementById('hv-hp');
        this.$hvWave = document.getElementById('hv-wave');
        this.$hpBar = document.getElementById('hp-bar');
        this.$wepName = document.getElementById('wep-name');
        this.$wepSlots = document.getElementById('weap-slots');
        this.$faceCanvas = document.getElementById('face-canvas');
        this.faceCtx = this.$faceCanvas.getContext('2d');
        this.$crosshair = document.getElementById('crosshair');

        this.anim = { score: 0, kills: 0, hp: 100, ammo: 0 };

        this.buildWeaponSlots();
    }

    buildWeaponSlots() {
        this.$wepSlots.innerHTML = '';
        for (let i = 1; i <= WC; i++) {
            const d = document.createElement('div');
            d.className = 'wep-slot';
            d.id = 'wep-slot-' + i;
            d.textContent = String(i);
            this.$wepSlots.appendChild(d);
        }
    }

    show() {
        this.$hud.style.display = 'block';
        this.$bottom.classList.remove('hidden');
        this.$crosshair.style.display = 'block';
    }
    hide() {
        this.$hud.style.display = 'none';
        this.$bottom.classList.add('hidden');
        this.$crosshair.style.display = 'none';
    }

    setBiome(name) {
        this.$hBiome.textContent = name;
    }

    update(dt, { pl, wave, score, kills, hi, time }) {
        // Animated numbers (ease)
        this.anim.score += (score - this.anim.score) * Math.min(1, dt * 8);
        this.anim.kills += (kills - this.anim.kills) * Math.min(1, dt * 10);
        this.anim.hp += (pl.hp - this.anim.hp) * Math.min(1, dt * 12);

        const def = WEAP[pl.wep];
        const ammo = def.maxAmmo === Infinity ? Infinity : (pl.ammo[pl.wep] ?? 0);
        this.anim.ammo += ((ammo === Infinity ? 999 : ammo) - this.anim.ammo) * Math.min(1, dt * 10);

        this.$hWave.textContent = wave;
        this.$hScore.textContent = Math.floor(this.anim.score);
        this.$hKills.textContent = Math.floor(this.anim.kills);
        this.$hHi.textContent = hi;
        const m = Math.floor(time / 60), s = Math.floor(time % 60);
        this.$hTime.textContent = m + ':' + (s < 10 ? '0' : '') + s;

        this.$hvHp.textContent = Math.max(0, Math.floor(this.anim.hp));
        this.$hvWave.textContent = wave;
        if (pl.reloading) this.$hvAmmo.textContent = '...';
        else this.$hvAmmo.textContent = ammo === Infinity ? '∞' : Math.floor(this.anim.ammo);
        const pct = Math.max(0, Math.min(100, (pl.hp / pl.maxHp) * 100));
        this.$hpBar.style.width = pct + '%';
        // HP color shifts
        const hue = pct / 100 * 120; // red->green
        this.$hpBar.style.background = `linear-gradient(90deg, hsl(0,80%,50%), hsl(${hue},80%,50%))`;

        this.$wepName.textContent = def.name;
        for (let i = 1; i <= WC; i++) {
            const slot = document.getElementById('wep-slot-' + i);
            slot.classList.toggle('has', !!pl.unlocked[i]);
            slot.classList.toggle('active', pl.wep === i);
        }

        this.drawFace(pl);
    }

    // ===== DOOM FACE =====
    drawFace(pl) {
        const c = this.faceCtx, W = 64, H = 64;
        const hpRatio = pl.hp / pl.maxHp;
        const isHurt = pl.hurtT > 0;

        c.clearRect(0, 0, W, H);

        // Background panel
        const grad = c.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, hpRatio > 0.6 ? '#2a1a18' : '#2a0a08');
        grad.addColorStop(1, '#0a0202');
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);

        // Skin color
        const skin = isHurt ? '#ff5050' :
            hpRatio > 0.7 ? '#d4a574' :
            hpRatio > 0.4 ? '#c88060' :
            hpRatio > 0.2 ? '#a06040' : '#703020';

        // Face shape (slightly tilted at low HP)
        c.save();
        if (hpRatio < 0.3) c.translate(1, 1);
        c.fillStyle = skin;
        c.fillRect(14, 10, 36, 40);
        // Hair
        c.fillStyle = '#5a3820';
        c.fillRect(14, 8, 36, 10);
        // Shadows
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.fillRect(14, 10, 2, 40);
        c.fillRect(48, 10, 2, 40);

        // Eyes
        if (hpRatio > 0.35) {
            c.fillStyle = '#fff';
            c.fillRect(18, 22, 10, 7);
            c.fillRect(36, 22, 10, 7);
            const px = isHurt ? 0 : Math.floor(Math.random() * 3) - 1;
            c.fillStyle = '#222';
            c.fillRect(21 + px, 24, 4, 4);
            c.fillRect(39 + px, 24, 4, 4);
        } else {
            // squinting
            c.fillStyle = '#fff';
            c.fillRect(18, 24, 10, 3);
            c.fillRect(36, 24, 10, 3);
            c.fillStyle = '#222';
            c.fillRect(22, 25, 2, 2);
            c.fillRect(40, 25, 2, 2);
        }

        // Mouth
        if (isHurt) {
            c.fillStyle = '#500';
            c.fillRect(20, 38, 24, 7);
            c.fillStyle = '#fff';
            c.fillRect(22, 39, 3, 3);
            c.fillRect(29, 39, 3, 3);
            c.fillRect(36, 39, 3, 3);
        } else if (hpRatio > 0.6) {
            c.fillStyle = '#700';
            c.fillRect(24, 38, 16, 4);
        } else if (hpRatio > 0.3) {
            c.fillStyle = '#700';
            c.fillRect(22, 40, 20, 4);
            c.fillStyle = '#500';
            c.fillRect(24, 36, 16, 2);
        } else {
            c.fillStyle = '#900';
            c.fillRect(20, 36, 24, 8);
            c.fillStyle = '#ff0000';
            c.fillRect(14, 18, 5, 12);
            c.fillRect(46, 24, 5, 10);
            c.fillStyle = '#fff';
            c.fillRect(24, 38, 3, 3);
            c.fillRect(36, 38, 3, 3);
        }

        // Blood splatters
        if (hpRatio < 0.5) {
            c.fillStyle = '#880000';
            c.fillRect(13 + Math.floor(Math.random() * 6), 14, 4, 4);
            if (hpRatio < 0.25) {
                c.fillRect(44 + Math.floor(Math.random() * 6), 20, 5, 4);
                c.fillRect(18, 44, 8, 3);
            }
        }

        c.restore();
    }

    // Combo flash
    setCombo(text) {
        const $c = document.getElementById('combo');
        if (text) {
            $c.textContent = text;
            $c.classList.add('on');
        } else {
            $c.classList.remove('on');
        }
    }
}
