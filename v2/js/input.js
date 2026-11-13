// Unified input: keyboard + mouse (pointer lock) + touch. Mobile contract carried over from v1:
// left half = analog joystick, right half = look drag, fingers resting on buttons also rotate the camera,
// menu taps never start firing.

export class Input {
    constructor({ player, isMobile, canPlay, onPause, onReload, onWeapon, onCycleWep, onStart }) {
        this.pl = player;
        this.isMobile = isMobile;
        this.canPlay = canPlay;     // () => true while gameplay input should apply
        this.cb = { onPause, onReload, onWeapon, onCycleWep, onStart };

        this.keys = {};
        this.firing = false;
        this.state = 'menu';
        this.lookDx = 0; this.lookDy = 0;
        this.moveFwd = 0; this.moveStr = 0;
        this.joyTouchId = null; this.joyStart = null;
        this.lookTouches = new Map();
        this._wheelT = 0;

        this.MOUSE_SENS = 0.0022;
        this.TOUCH_LOOK_SENS = 0.02;
        this.PITCH_MAX = 1.35;

        this._setupKeyboard();
        this._setupMouse();
        if (isMobile) this._setupTouch();
        addEventListener('blur', () => this.releaseAll());
    }

    setState(s) { this.state = s; }

    releaseAll() {
        this.firing = false;
        this.keys = {};
        this.moveFwd = 0; this.moveStr = 0;
        this.joyTouchId = null;
        this.lookTouches.clear();
        document.getElementById('joy-base').classList.remove('on');
        document.getElementById('joy-knob').classList.remove('on');
        document.getElementById('btn-fire').classList.remove('on');
    }

    lock() {
        if (this.isMobile || document.pointerLockElement) return;
        try { const p = document.body.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
    unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

    _look(dx, dy, sens) {
        this.pl.angle += dx * sens;
        this.pl.pitch = Math.max(-this.PITCH_MAX, Math.min(this.PITCH_MAX, this.pl.pitch - dy * sens));
        this.lookDx += dx; this.lookDy += dy;
    }

    _setupKeyboard() {
        addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT') return;
            const k = e.key.toLowerCase();
            if (this.state === 'play' && (k === 'tab' || k === ' ')) e.preventDefault();
            if (e.repeat) return;
            this.keys[k] = true;
            if (this.state !== 'play') return;
            if (e.key === 'Escape' || k === 'p') this.cb.onPause();
            else if (k >= '1' && k <= '9') this.cb.onWeapon(+k);
            else if (k === 'r') this.cb.onReload();
            else if (k === 'q') this.cb.onCycleWep(-1);
            else if (k === 'e') this.cb.onCycleWep(1);
        });
        addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
        addEventListener('wheel', e => {
            if (!this.canPlay()) return;
            const now = performance.now();
            if (now - this._wheelT < 110) return; // trackpads fire dozens of events per gesture
            this._wheelT = now;
            this.cb.onCycleWep(e.deltaY > 0 ? 1 : -1);
        }, { passive: true });
    }

    _setupMouse() {
        addEventListener('mousemove', e => {
            if (!document.pointerLockElement || !this.canPlay()) return;
            // Some browsers report one bogus jump right after the lock engages or a button changes; drop it
            if (this._skipMove) { this._skipMove = false; return; }
            this._look(e.movementX, e.movementY, this.MOUSE_SENS);
        });
        addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            if (this.state === 'menu') {
                if (!e.target.closest || !e.target.closest('.nostart')) this.cb.onStart();
                return;
            }
            if (!this.canPlay()) return;
            if (!this.isMobile && !document.pointerLockElement) { this.lock(); return; }
            this.firing = true;
        });
        addEventListener('mouseup', e => { if (e.button === 0) this.firing = false; });
        addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('pointerlockchange', () => {
            const locked = !!document.pointerLockElement;
            this._skipMove = locked;
            document.body.classList.toggle('locked', locked);
            if (!locked) {
                this.firing = false;
                if (this.canPlay()) this.cb.onPause(); // Esc while locked: the browser eats the key
            }
        });
    }

    _setupTouch() {
        const $ = id => document.getElementById(id);
        const base = $('joy-base'), knob = $('joy-knob');
        const addLook = (id, x, y) => this.lookTouches.set(id, { x, y });
        const regLook = e => { for (const t of e.changedTouches) addLook(t.identifier, t.clientX, t.clientY); };
        const unregLook = e => { for (const t of e.changedTouches) this.lookTouches.delete(t.identifier); };
        const isBtn = t => !!(t.closest && t.closest('.mbtn'));

        const onStart = e => {
            if (isBtn(e.target)) return;
            if (!this.canPlay()) return; // menus: let the browser deliver clicks
            for (const t of e.changedTouches) {
                const x = t.clientX, y = t.clientY;
                if (x < innerWidth / 2 && this.joyTouchId === null) {
                    this.joyTouchId = t.identifier; this.joyStart = { x, y };
                    base.style.left = (x - 60) + 'px'; base.style.top = (y - 60) + 'px';
                    knob.style.left = (x - 30) + 'px'; knob.style.top = (y - 30) + 'px';
                    base.classList.add('on'); knob.classList.add('on');
                } else addLook(t.identifier, x, y);
            }
            e.preventDefault();
        };
        const onMove = e => {
            if (!this.canPlay()) return;
            for (const t of e.changedTouches) {
                if (t.identifier === this.joyTouchId) {
                    const dx = t.clientX - this.joyStart.x, dy = t.clientY - this.joyStart.y;
                    const m = Math.hypot(dx, dy), mr = 55;
                    if (m > 6) { const n = Math.min(1, m / mr); this.moveStr = (dx / m) * n; this.moveFwd = -(dy / m) * n; }
                    else { this.moveStr = 0; this.moveFwd = 0; }
                    const cm = Math.min(m, mr), nx = m > 0 ? dx / m * cm : 0, ny = m > 0 ? dy / m * cm : 0;
                    knob.style.left = (this.joyStart.x + nx - 30) + 'px'; knob.style.top = (this.joyStart.y + ny - 30) + 'px';
                } else if (this.lookTouches.has(t.identifier)) {
                    const prev = this.lookTouches.get(t.identifier);
                    this._look(t.clientX - prev.x, t.clientY - prev.y, this.TOUCH_LOOK_SENS);
                    prev.x = t.clientX; prev.y = t.clientY;
                }
            }
            e.preventDefault();
        };
        const onEnd = e => {
            for (const t of e.changedTouches) {
                if (t.identifier === this.joyTouchId) {
                    this.joyTouchId = null; this.moveStr = 0; this.moveFwd = 0;
                    base.classList.remove('on'); knob.classList.remove('on');
                }
                this.lookTouches.delete(t.identifier);
            }
        };
        addEventListener('touchstart', onStart, { passive: false });
        addEventListener('touchmove', onMove, { passive: false });
        addEventListener('touchend', onEnd, { passive: false });
        addEventListener('touchcancel', onEnd, { passive: false });

        // Buttons: explicit start/end handlers; each one also registers its finger as a look source.
        const bind = (id, down, up) => {
            const el = $(id);
            const stop = e => { e.stopPropagation(); e.preventDefault(); };
            el.addEventListener('touchstart', e => { down(el); regLook(e); stop(e); }, { passive: false });
            const end = e => { if (up) up(el); unregLook(e); stop(e); };
            el.addEventListener('touchend', end, { passive: false });
            el.addEventListener('touchcancel', end, { passive: false });
        };
        const blink = el => { el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 130); };
        bind('btn-fire', el => { if (this.canPlay()) { this.firing = true; el.classList.add('on'); } },
            el => { this.firing = false; el.classList.remove('on'); });
        bind('btn-dash', el => { this.keys['shift'] = true; el.classList.add('on'); },
            el => { this.keys['shift'] = false; el.classList.remove('on'); });
        bind('btn-reload', el => { if (this.canPlay()) this.cb.onReload(); blink(el); });
        bind('btn-wep-next', el => { if (this.canPlay()) this.cb.onCycleWep(1); blink(el); });
        bind('btn-wep-prev', el => { if (this.canPlay()) this.cb.onCycleWep(-1); blink(el); });
        bind('btn-pause', () => { if (this.state === 'play') this.cb.onPause(); });
    }

    getMove() {
        if (this.isMobile) return { fwd: this.moveFwd, str: this.moveStr };
        const k = this.keys;
        let fwd = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
        let str = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
        if (fwd && str) { fwd *= 0.7071; str *= 0.7071; }
        return { fwd, str };
    }

    wantsDash() { return !!this.keys['shift']; }
    isFiring() { return this.firing; }

    tick() { this.lookDx *= 0.6; this.lookDy *= 0.6; }
}
