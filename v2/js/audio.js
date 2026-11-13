// Layered Web Audio: biome ambient pad + dynamic combat music + procedural SFX.
// Everything procedural — no asset fetches.

export class Audio {
    constructor() {
        this.ac = null;
        this.master = null;
        this.musGain = null;
        this.sfxGain = null;
        this.ambGain = null;
        this.musStep = 0;
        this.musInterval = null;
        this.musMode = 'normal'; // 'normal' | 'boss' | 'intermission'
        this.volume = 0.5;
        this.ambOscs = [];
    }

    init() {
        if (this.ac) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ac = new AC();
        this.master = this.ac.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ac.destination);
        this.sfxGain = this.ac.createGain(); this.sfxGain.gain.value = 1.0; this.sfxGain.connect(this.master);
        this.musGain = this.ac.createGain(); this.musGain.gain.value = 0.35; this.musGain.connect(this.master);
        this.ambGain = this.ac.createGain(); this.ambGain.gain.value = 0.5; this.ambGain.connect(this.master);
    }

    setVolume(v) {
        this.volume = v;
        if (this.master) this.master.gain.value = v;
    }

    // ===== PRIMITIVES =====
    _tone(freq, duration, type = 'sine', vol = 0.1, dest = null) {
        if (!this.ac) return;
        const d = dest || this.sfxGain;
        const o = this.ac.createOscillator(), g = this.ac.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol, this.ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ac.currentTime + duration);
        o.connect(g); g.connect(d);
        o.start();
        o.stop(this.ac.currentTime + duration);
    }

    _noise(duration, vol = 0.1, filterFreq = 3000, dest = null) {
        if (!this.ac) return;
        const d = dest || this.sfxGain;
        const bs = Math.ceil(this.ac.sampleRate * duration);
        const nb = this.ac.createBuffer(1, bs, this.ac.sampleRate);
        const dd = nb.getChannelData(0);
        for (let i = 0; i < bs; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bs, 2);
        const s = this.ac.createBufferSource(), g = this.ac.createGain(), f = this.ac.createBiquadFilter();
        s.buffer = nb; f.type = 'lowpass'; f.frequency.value = filterFreq;
        g.gain.setValueAtTime(vol, this.ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ac.currentTime + duration);
        s.connect(f); f.connect(g); g.connect(d);
        s.start(); s.stop(this.ac.currentTime + duration);
    }

    // Positional 3D sound (PannerNode) — subset of SFX use this
    _spatial(x, z, player, baseGain) {
        if (!this.ac) return baseGain;
        const panner = this.ac.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'linear';
        panner.maxDistance = 40;
        panner.rolloffFactor = 1;
        // Translate world coords (x,z) relative to player
        const dx = x - player.x, dz = z - player.z;
        panner.positionX.value = dx;
        panner.positionY.value = 0;
        panner.positionZ.value = dz;
        panner.connect(baseGain);
        return panner;
    }

    // ===== SFX =====
    shoot() { this._noise(0.08, 0.12, 2800); this._tone(400, 0.03, 'square', 0.04); }
    shotgun() { this._noise(0.18, 0.2, 2200); this._tone(120, 0.1, 'sawtooth', 0.09); this._tone(80, 0.12, 'square', 0.06); }
    chain() { this._noise(0.04, 0.1, 3000); this._tone(600, 0.02, 'square', 0.03); }
    rocket() { this._noise(0.25, 0.16, 2000); this._tone(80, 0.3, 'sawtooth', 0.11); this._tone(50, 0.4, 'square', 0.08); }
    plasma() { this._tone(1800, 0.08, 'sine', 0.08); this._tone(2400, 0.06, 'sine', 0.06); this._noise(0.05, 0.04, 4000); }
    bomb() { this._noise(0.35, 0.22, 1500); this._tone(50, 0.5, 'sawtooth', 0.16); this._tone(30, 0.6, 'square', 0.1); }
    molotov() { this._noise(0.28, 0.14, 2200); this._tone(200, 0.2, 'sawtooth', 0.07); }
    laser() { this._tone(1200, 0.04, 'sine', 0.06); this._tone(1600, 0.03, 'sine', 0.04); }
    bfg() { // BFG analogue - layered charge + release
        if (!this.ac) return;
        const now = this.ac.currentTime;
        // Charge up
        const o1 = this.ac.createOscillator(), g1 = this.ac.createGain();
        o1.type = 'sawtooth'; o1.frequency.setValueAtTime(80, now); o1.frequency.exponentialRampToValueAtTime(400, now + 0.3);
        g1.gain.setValueAtTime(0.0001, now); g1.gain.exponentialRampToValueAtTime(0.14, now + 0.2); g1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        o1.connect(g1); g1.connect(this.sfxGain); o1.start(now); o1.stop(now + 0.45);
        // Explosion
        this._noise(0.6, 0.3, 1200);
        this._tone(30, 0.7, 'sawtooth', 0.22);
    }
    hit() { this._noise(0.03, 0.06, 2000); this._tone(350 + Math.random() * 150, 0.03, 'square', 0.03); }
    kill() { this._noise(0.08, 0.1, 2500); this._tone(150, 0.08, 'sawtooth', 0.06); this._tone(80, 0.1, 'square', 0.04); }
    pickup() { this._tone(600, 0.05, 'sine', 0.07); this._tone(900, 0.05, 'sine', 0.06); }
    boss() { this._noise(0.4, 0.14, 1500); this._tone(55, 0.35, 'sawtooth', 0.12); this._tone(38, 0.4, 'sawtooth', 0.09); }
    explode() { this._noise(0.4, 0.22, 1800); this._tone(60, 0.35, 'sawtooth', 0.14); this._tone(30, 0.45, 'square', 0.1); }
    dash() { this._tone(500, 0.04, 'sine', 0.04); this._tone(800, 0.03, 'sine', 0.03); }
    ricochet() { this._noise(0.06, 0.08, 4500); this._tone(3000 + Math.random() * 2000, 0.03, 'sine', 0.03); this._tone(100 + Math.random() * 60, 0.08, 'sine', 0.04); }
    growl(x, z, player) {
        if (!this.ac) return;
        const g = this.ac.createGain(); g.gain.value = 0.9;
        const panner = this._spatial(x, z, player, this.sfxGain);
        const dest = panner || this.sfxGain;
        const o = this.ac.createOscillator(), og = this.ac.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(90 + Math.random() * 60, this.ac.currentTime);
        o.frequency.exponentialRampToValueAtTime(40, this.ac.currentTime + 0.3);
        og.gain.setValueAtTime(0.08, this.ac.currentTime);
        og.gain.exponentialRampToValueAtTime(0.001, this.ac.currentTime + 0.35);
        o.connect(og); og.connect(dest); o.start(); o.stop(this.ac.currentTime + 0.4);
    }

    // ===== AMBIENT BIOME PAD =====
    stopAmbient() {
        for (const o of this.ambOscs) try { o.stop(); } catch (e) {}
        this.ambOscs.length = 0;
    }
    setAmbient(biome) {
        if (!this.ac) return;
        this.stopAmbient();
        const cfg = biome.audioAmbient;
        const now = this.ac.currentTime;

        // Low pad drone
        const makeOsc = (freq, type, vol) => {
            const o = this.ac.createOscillator(), g = this.ac.createGain();
            o.type = type; o.frequency.value = freq;
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(vol, now + 1.5);
            o.connect(g); g.connect(this.ambGain);
            o.start();
            this.ambOscs.push(o);
            return { o, g };
        };

        makeOsc(cfg.base, 'sawtooth', 0.04);
        makeOsc(cfg.base * 1.5, 'sine', 0.025);
        makeOsc(cfg.lead, 'sine', 0.018);

        // Textured LFO on amplitude based on cfg.texture
        if (cfg.texture === 'rumble' || cfg.texture === 'crystal') {
            makeOsc(cfg.lead * 2, 'sine', 0.012);
        }
        if (cfg.texture === 'choir') {
            makeOsc(cfg.lead * 1.333, 'sine', 0.015);
            makeOsc(cfg.lead * 1.666, 'sine', 0.012);
        }
        if (cfg.texture === 'hum') {
            makeOsc(cfg.base * 2, 'sawtooth', 0.02);
        }
    }

    // ===== COMBAT MUSIC =====
    _normalBass = [41, 41, 0, 41, 41, 0, 41, 0, 49, 49, 0, 49, 55, 0, 52, 0, 41, 41, 0, 41, 55, 0, 49, 0, 41, 0, 41, 55, 52, 49, 41, 0];
    _normalLead = [165, 0, 165, 196, 220, 0, 196, 0, 165, 0, 220, 0, 247, 220, 196, 0, 165, 0, 196, 220, 262, 0, 247, 0, 220, 0, 196, 0, 330, 294, 262, 220];
    _bossBass = [37, 37, 37, 0, 37, 37, 0, 37, 41, 41, 0, 37, 44, 0, 41, 37, 37, 37, 37, 0, 44, 0, 41, 37, 37, 0, 37, 37, 44, 41, 37, 0];
    _bossLead = [294, 0, 330, 370, 392, 0, 370, 330, 294, 0, 330, 0, 440, 392, 370, 330, 392, 0, 440, 494, 523, 0, 494, 440, 392, 0, 440, 0, 523, 494, 440, 392];

    setMusicMode(mode) { this.musMode = mode; }

    startMusic() {
        if (!this.ac || this.musInterval) return;
        this.musStep = 0;
        const dist = this.ac.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) { const x = i * 2 / 256 - 1; curve[i] = Math.tanh(x * 3); }
        dist.curve = curve;
        dist.connect(this.musGain);
        this._musBus = dist;

        const ST = 60000 / 175 / 4;
        this.musInterval = setInterval(() => {
            if (!this.ac) return;
            const i = this.musStep % 32;
            const boss = this.musMode === 'boss';
            const bassP = boss ? this._bossBass : this._normalBass;
            const leadP = boss ? this._bossLead : this._normalLead;
            const v = boss ? 1.3 : 1;
            const t = this.ac.currentTime;

            if (bassP[i] > 0) {
                const o = this.ac.createOscillator(), g = this.ac.createGain();
                o.type = 'sawtooth'; o.frequency.value = bassP[i];
                g.gain.setValueAtTime(0.05 * v, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + ST / 1000 * 0.8);
                o.connect(g); g.connect(this._musBus); o.start(); o.stop(t + ST / 1000);
            }
            if (leadP[i] > 0) {
                const o = this.ac.createOscillator(), g = this.ac.createGain();
                o.type = 'sawtooth'; o.frequency.value = leadP[i];
                g.gain.setValueAtTime(0.025 * v, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + ST / 1000 * 0.6);
                o.connect(g); g.connect(this._musBus); o.start(); o.stop(t + ST / 1000);
            }
            // Kick
            if (i % (boss ? 1 : 2) === 0) {
                const o = this.ac.createOscillator(), g = this.ac.createGain();
                o.type = 'sine';
                o.frequency.setValueAtTime(180, t);
                o.frequency.exponentialRampToValueAtTime(30, t + 0.06);
                g.gain.setValueAtTime(0.08 * v, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
                o.connect(g); g.connect(this.musGain); o.start(); o.stop(t + 0.08);
            }
            // Snare
            if (i % 8 === (boss ? 2 : 4)) {
                const bs = Math.ceil(this.ac.sampleRate * 0.05);
                const nb = this.ac.createBuffer(1, bs, this.ac.sampleRate);
                const dd = nb.getChannelData(0);
                for (let j = 0; j < bs; j++) dd[j] = (Math.random() * 2 - 1) * (1 - j / bs);
                const s = this.ac.createBufferSource(), g = this.ac.createGain();
                s.buffer = nb;
                g.gain.setValueAtTime(0.07 * v, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
                s.connect(g); g.connect(this.musGain); s.start(); s.stop(t + 0.06);
            }
            this.musStep++;
        }, ST);
    }

    stopMusic() {
        if (this.musInterval) { clearInterval(this.musInterval); this.musInterval = null; }
    }
}
