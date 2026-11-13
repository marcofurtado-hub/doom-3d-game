import { WEAP, WC } from './weapons.js';

// DOM HUD: eased numbers, weapon strip, DOOM face, boss bar, hit marker.
export class HUD {
    constructor() {
        const $ = id => document.getElementById(id);
        this.$ = {
            hud: $('hud'), bottom: $('bottom-hud'), cross: $('crosshair'),
            wave: $('h-wave'), score: $('h-score'), kills: $('h-kills'), hi: $('h-hi'), time: $('h-time'), biome: $('h-biome'),
            ammo: $('hv-ammo'), hp: $('hv-hp'), armor: $('hv-armor'), hvWave: $('hv-wave'), hpBar: $('hp-bar'),
            wepName: $('wep-name'), slots: $('weap-slots'), combo: $('combo'),
            boss: $('boss-bar'), bossName: $('boss-name'), bossFill: $('boss-fill'), left: $('h-left'),
        };
        this.faceCtx = $('face-canvas').getContext('2d');
        this.anim = { score: 0, hp: 100 };
        this.last = {};
        this.faceKey = ''; this.faceT = 0; this.hitT = 0;
        this.slots = [];
        for (let i = 1; i <= WC; i++) {
            const d = document.createElement('div');
            d.className = 'wep-slot'; d.textContent = i;
            this.$.slots.appendChild(d);
            this.slots.push(d);
        }
    }

    show(on) {
        this.$.hud.style.display = on ? 'block' : 'none';
        this.$.bottom.classList.toggle('hidden', !on);
        this.$.cross.style.display = on ? 'block' : 'none';
        if (!on) this.setBoss(null);
    }

    _set(key, el, val) { if (this.last[key] !== val) { this.last[key] = val; el.textContent = val; } }

    setBiome(name, accent) { this.$.biome.textContent = name; this.$.biome.style.color = accent; }

    setBoss(name, pct = 1) {
        if (!name) { this.$.boss.classList.remove('on'); return; }
        this.$.boss.classList.add('on');
        this._set('bossName', this.$.bossName, name);
        this.$.bossFill.style.width = Math.max(0, pct * 100) + '%';
    }

    hitMarker(kill) {
        this.hitT = kill ? 0.22 : 0.1;
        document.body.classList.add('crosshair-hit');
        document.body.classList.toggle('crosshair-kill', !!kill);
    }

    setCombo(text) {
        if (text) this._set('combo', this.$.combo, text);
        this.$.combo.classList.toggle('on', !!text);
    }

    update(dt, { pl, wave, score, kills, hi, time, left }) {
        const a = this.anim, $ = this.$;
        a.score += (score - a.score) * Math.min(1, dt * 8);
        if (Math.abs(score - a.score) < 1) a.score = score;
        a.hp += (pl.hp - a.hp) * Math.min(1, dt * 12);

        this._set('wave', $.wave, wave);
        this._set('hvWave', $.hvWave, wave);
        this._set('score', $.score, Math.round(a.score));
        this._set('kills', $.kills, kills);
        this._set('hi', $.hi, Math.max(hi, score));
        this._set('left', $.left, left);
        const s = Math.floor(time % 60);
        this._set('time', $.time, Math.floor(time / 60) + ':' + (s < 10 ? '0' : '') + s);
        this._set('hp', $.hp, Math.max(0, Math.ceil(a.hp - 0.01)));
        this._set('armor', $.armor, pl.armor > 0 ? '◆ ' + Math.ceil(pl.armor) : '');

        const def = WEAP[pl.wep];
        this._set('ammo', $.ammo, pl.reloading ? '···' : def.maxAmmo === Infinity ? '∞' : pl.ammo[pl.wep]);
        this._set('wepName', $.wepName, pl.reloading ? 'RELOADING' : def.name);

        const pct = Math.max(0, Math.min(1, pl.hp / pl.maxHp));
        const pk = Math.round(pct * 100);
        if (this.last.pct !== pk) {
            this.last.pct = pk;
            $.hpBar.style.width = pk + '%';
            $.hpBar.style.background = `hsl(${pct * 120}, 85%, 48%)`;
            $.hp.classList.toggle('low', pct < 0.3);
        }
        const sk = pl.wep + ':' + Object.keys(pl.unlocked).join('');
        if (this.last.slots !== sk) {
            this.last.slots = sk;
            this.slots.forEach((el, i) => {
                el.classList.toggle('has', !!pl.unlocked[i + 1]);
                el.classList.toggle('active', pl.wep === i + 1);
            });
        }

        if (this.hitT > 0) {
            this.hitT -= dt;
            if (this.hitT <= 0) document.body.classList.remove('crosshair-hit', 'crosshair-kill');
        }

        // Face: redraw on state change, or every ~0.6s so the eyes glance around
        this.faceT -= dt;
        const key = (pl.hurtT > 0 ? 'h' : '') + Math.floor(pct * 5);
        if (key !== this.faceKey || this.faceT <= 0) {
            this.faceKey = key; this.faceT = 0.6;
            this.drawFace(pct, pl.hurtT > 0);
        }
    }

    drawFace(hp, hurt) {
        const c = this.faceCtx, W = 64;
        const g = c.createLinearGradient(0, 0, 0, W);
        g.addColorStop(0, hp > 0.6 ? '#2a1a18' : '#3a0a08'); g.addColorStop(1, '#0a0202');
        c.fillStyle = g; c.fillRect(0, 0, W, W);
        const skin = hurt ? '#ff6a5a' : hp > 0.7 ? '#d4a574' : hp > 0.4 ? '#c88a64' : hp > 0.2 ? '#a86848' : '#84503a';
        c.fillStyle = skin; c.fillRect(14, 10, 36, 42);
        c.fillStyle = '#4a2c18'; c.fillRect(14, 6, 36, 10); c.fillRect(12, 10, 4, 12); c.fillRect(48, 10, 4, 12);
        c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(14, 16, 3, 36); c.fillRect(47, 16, 3, 36); c.fillRect(14, 48, 36, 4);
        // brows
        c.fillStyle = '#2a1608';
        if (hurt || hp < 0.4) { c.fillRect(18, 19, 10, 3); c.fillRect(36, 19, 10, 3); c.fillRect(26, 21, 3, 2); c.fillRect(35, 21, 3, 2); }
        else { c.fillRect(18, 20, 10, 2); c.fillRect(36, 20, 10, 2); }
        // eyes
        const px = hurt ? 0 : Math.floor(Math.random() * 3) - 1;
        c.fillStyle = '#fff';
        if (hurt) { c.fillRect(18, 25, 10, 3); c.fillRect(36, 25, 10, 3); }
        else { c.fillRect(18, 23, 10, 7); c.fillRect(36, 23, 10, 7); }
        c.fillStyle = '#1a1a1a'; c.fillRect(21 + px * 2, 25, 4, hurt ? 3 : 4); c.fillRect(39 + px * 2, 25, 4, hurt ? 3 : 4);
        // nose
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(30, 30, 4, 7);
        // mouth
        if (hurt) {
            c.fillStyle = '#400'; c.fillRect(21, 40, 22, 8);
            c.fillStyle = '#fff'; for (let i = 0; i < 5; i++) c.fillRect(23 + i * 4, 40, 3, 3);
        } else if (hp > 0.6) { c.fillStyle = '#6a1a10'; c.fillRect(24, 41, 16, 3); c.fillRect(22, 40, 2, 2); c.fillRect(40, 40, 2, 2); }
        else if (hp > 0.3) { c.fillStyle = '#6a1a10'; c.fillRect(23, 42, 18, 3); }
        else { c.fillStyle = '#700'; c.fillRect(21, 40, 22, 6); c.fillStyle = '#fff'; c.fillRect(24, 40, 3, 3); c.fillRect(37, 40, 3, 3); }
        // blood
        c.fillStyle = '#b00000';
        if (hp < 0.8) c.fillRect(44, 12, 4, 9);
        if (hp < 0.6) { c.fillRect(16, 30, 4, 10); c.fillRect(31, 37, 2, 6); }
        if (hp < 0.4) { c.fillRect(22, 10, 5, 12); c.fillRect(40, 30, 6, 4); c.fillRect(24, 46, 3, 6); }
        if (hp < 0.2) { c.fillRect(14, 14, 8, 5); c.fillRect(34, 12, 4, 10); c.fillRect(38, 44, 4, 8); c.fillRect(18, 40, 3, 8); }
    }
}
