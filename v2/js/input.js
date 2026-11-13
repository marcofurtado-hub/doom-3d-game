// Unified input: keyboard + mouse + touch. Preserves v1 mobile fixes.

export class Input {
    constructor({ player, isMobile, onPause, onFire, onReload, onWeapon, onCycleWep, onStart }) {
        this.pl = player;
        this.isMobile = isMobile;
        this.onPause = onPause;
        this.onFire = onFire;
        this.onReload = onReload;
        this.onWeapon = onWeapon;
        this.onCycleWep = onCycleWep;
        this.onStart = onStart;

        this.keys = {};
        this.mDown = false;
        this.firing = false;
        this.clicked = false;
        this.paused = false;
        this.state = 'menu';

        this.lookDx = 0;
        this.lookDy = 0;
        this.moveFwd = 0;
        this.moveStr = 0;

        this.joyTouchId = null;
        this.joyStart = null;
        this.lookTouches = new Map();

        this.MOUSE_SENS = 0.0022;
        this.TOUCH_LOOK_SENS = 0.02;
        this.PITCH_MAX = 1.35;

        this._setupKeyboard();
        this._setupMouse();
        if (isMobile) this._setupTouch();
    }

    setState(s) { this.state = s; }
    setPaused(p) { this.paused = p; }

    _setupKeyboard() {
        addEventListener('keydown', e => {
            const k = e.key.toLowerCase();
            this.keys[k] = true;
            if (e.key === 'Escape' && this.state === 'play') {
                this.onPause?.();
            }
            if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key) && this.state === 'play') {
                this.onWeapon?.(parseInt(e.key));
            }
            if (k === 'r' && this.state === 'play') this.onReload?.();
        });
        addEventListener('keyup', e => {
            const k = e.key.toLowerCase();
            this.keys[k] = false;
        });
        addEventListener('wheel', e => {
            if (this.state !== 'play') return;
            this.onCycleWep?.(e.deltaY > 0 ? 1 : -1);
        }, { passive: true });
    }

    _setupMouse() {
        addEventListener('mousemove', e => {
            if (document.pointerLockElement) {
                this.pl.angle += e.movementX * this.MOUSE_SENS;
                this.pl.pitch -= e.movementY * this.MOUSE_SENS;
                if (this.pl.pitch > this.PITCH_MAX) this.pl.pitch = this.PITCH_MAX;
                if (this.pl.pitch < -this.PITCH_MAX) this.pl.pitch = -this.PITCH_MAX;
                this.lookDx = e.movementX;
                this.lookDy = e.movementY;
            }
        });
        addEventListener('mousedown', e => {
            if (e.button === 0) {
                this.mDown = true;
                this.firing = true;
                this.clicked = true;
                if (this.state === 'menu') { this.onStart?.(); return; }
                if (!this.isMobile && !this.paused && !document.pointerLockElement && this.state === 'play') {
                    try { document.body.requestPointerLock(); } catch (err) {}
                }
            }
        });
        addEventListener('mouseup', e => {
            if (e.button === 0) {
                this.mDown = false;
                this.firing = false;
            }
        });
        addEventListener('contextmenu', e => e.preventDefault());

        document.addEventListener('pointerlockchange', () => {
            document.body.classList.toggle('locked', !!document.pointerLockElement);
            if (this.state === 'play' && !document.pointerLockElement && !this.paused) {
                this.onPause?.();
            }
        });
    }

    _setupTouch() {
        const addLook = (id, x, y) => this.lookTouches.set(id, { x, y });
        const removeLook = (id) => this.lookTouches.delete(id);
        const registerLookTouches = (e) => { for (const t of e.changedTouches) addLook(t.identifier, t.clientX, t.clientY); };
        const unregisterLookTouches = (e) => { for (const t of e.changedTouches) removeLook(t.identifier); };

        const isBtnTarget = (t) => {
            let n = t;
            while (n && n !== document.body) {
                if (n.classList && n.classList.contains('mbtn')) return true;
                n = n.parentNode;
            }
            return false;
        };
        const showJoy = (x, y) => {
            const b = document.getElementById('joy-base'), k = document.getElementById('joy-knob');
            b.style.left = (x - 60) + 'px'; b.style.top = (y - 60) + 'px';
            k.style.left = (x - 30) + 'px'; k.style.top = (y - 30) + 'px';
            b.classList.add('on'); k.classList.add('on');
        };
        const updJoyKnob = (sx, sy, tx, ty, mr) => {
            const k = document.getElementById('joy-knob');
            const dx = tx - sx, dy = ty - sy, m = Math.hypot(dx, dy);
            const cm = Math.min(m, mr);
            const nx = m > 0 ? (dx / m) * cm : 0, ny = m > 0 ? (dy / m) * cm : 0;
            k.style.left = (sx + nx - 30) + 'px'; k.style.top = (sy + ny - 30) + 'px';
        };
        const hideJoy = () => {
            document.getElementById('joy-base').classList.remove('on');
            document.getElementById('joy-knob').classList.remove('on');
        };

        const onTouchStart = (e) => {
            if (isBtnTarget(e.target)) return;
            const inMenu = (this.state === 'menu' || this.state === 'dead' || this.paused);
            for (const t of e.changedTouches) {
                const x = t.clientX, y = t.clientY;
                if (inMenu) { this.clicked = true; continue; }
                if (x < innerWidth / 2) {
                    if (this.joyTouchId === null) {
                        this.joyTouchId = t.identifier;
                        this.joyStart = { x, y };
                        showJoy(x, y);
                    } else {
                        addLook(t.identifier, x, y);
                    }
                } else {
                    addLook(t.identifier, x, y);
                }
            }
            if (!inMenu) e.preventDefault();
        };

        const onTouchMove = (e) => {
            const inMenu = (this.state === 'menu' || this.state === 'dead' || this.paused);
            for (const t of e.changedTouches) {
                if (t.identifier === this.joyTouchId) {
                    const jdx = t.clientX - this.joyStart.x, jdy = t.clientY - this.joyStart.y;
                    const m = Math.hypot(jdx, jdy), mr = 55;
                    if (m > 6) {
                        const n = Math.min(1, m / mr);
                        this.moveStr = (jdx / m) * n;
                        this.moveFwd = -(jdy / m) * n;
                    } else {
                        this.moveStr = 0; this.moveFwd = 0;
                    }
                    updJoyKnob(this.joyStart.x, this.joyStart.y, t.clientX, t.clientY, mr);
                } else if (this.lookTouches.has(t.identifier)) {
                    const prev = this.lookTouches.get(t.identifier);
                    const dx = t.clientX - prev.x, dy = t.clientY - prev.y;
                    this.pl.angle += dx * this.TOUCH_LOOK_SENS;
                    this.pl.pitch -= dy * this.TOUCH_LOOK_SENS;
                    if (this.pl.pitch > this.PITCH_MAX) this.pl.pitch = this.PITCH_MAX;
                    if (this.pl.pitch < -this.PITCH_MAX) this.pl.pitch = -this.PITCH_MAX;
                    this.lookDx = dx; this.lookDy = dy;
                    this.lookTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
                }
            }
            if (!inMenu) e.preventDefault();
        };

        const onTouchEnd = (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === this.joyTouchId) {
                    this.joyTouchId = null;
                    this.moveStr = 0; this.moveFwd = 0;
                    hideJoy();
                }
                if (this.lookTouches.has(t.identifier)) removeLook(t.identifier);
            }
        };

        addEventListener('touchstart', onTouchStart, { passive: false });
        addEventListener('touchmove', onTouchMove, { passive: false });
        addEventListener('touchend', onTouchEnd, { passive: false });
        addEventListener('touchcancel', onTouchEnd, { passive: false });

        // ===== BUTTONS =====
        const bFire = document.getElementById('btn-fire');
        bFire.addEventListener('touchstart', e => {
            this.mDown = true; this.firing = true; this.clicked = true;
            bFire.classList.add('on');
            registerLookTouches(e);
            e.stopPropagation(); e.preventDefault();
        }, { passive: false });
        bFire.addEventListener('touchend', e => {
            this.mDown = false; this.firing = false;
            bFire.classList.remove('on');
            unregisterLookTouches(e);
            e.stopPropagation(); e.preventDefault();
        }, { passive: false });
        bFire.addEventListener('touchcancel', e => {
            this.mDown = false; this.firing = false;
            bFire.classList.remove('on');
            unregisterLookTouches(e);
            e.stopPropagation(); e.preventDefault();
        }, { passive: false });

        const bDash = document.getElementById('btn-dash');
        bDash.addEventListener('touchstart', e => {
            this.keys['shift'] = true; bDash.classList.add('on');
            registerLookTouches(e); e.stopPropagation(); e.preventDefault();
        }, { passive: false });
        bDash.addEventListener('touchend', e => {
            this.keys['shift'] = false; bDash.classList.remove('on');
            unregisterLookTouches(e); e.stopPropagation(); e.preventDefault();
        }, { passive: false });
        bDash.addEventListener('touchcancel', e => {
            this.keys['shift'] = false; bDash.classList.remove('on');
            unregisterLookTouches(e); e.stopPropagation(); e.preventDefault();
        }, { passive: false });

        const bRld = document.getElementById('btn-reload');
        bRld.addEventListener('touchstart', e => {
            this.onReload?.();
            bRld.classList.add('on');
            registerLookTouches(e);
            setTimeout(() => bRld.classList.remove('on'), 150);
            e.stopPropagation(); e.preventDefault();
        }, { passive: false });
        bRld.addEventListener('touchend', e => { unregisterLookTouches(e); e.stopPropagation(); e.preventDefault(); }, { passive: false });
        bRld.addEventListener('touchcancel', e => { unregisterLookTouches(e); e.stopPropagation(); e.preventDefault(); }, { passive: false });

        const bWepNext = document.getElementById('btn-wep-next');
        bWepNext.addEventListener('touchstart', e => {
            this.onCycleWep?.(1);
            bWepNext.classList.add('on');
            setTimeout(() => bWepNext.classList.remove('on'), 120);
            registerLookTouches(e); e.stopPropagation(); e.preventDefault();
        }, { passive: false });
        bWepNext.addEventListener('touchend', e => { unregisterLookTouches(e); e.stopPropagation(); e.preventDefault(); }, { passive: false });
        bWepNext.addEventListener('touchcancel', e => { unregisterLookTouches(e); e.stopPropagation(); e.preventDefault(); }, { passive: false });

        const bWepPrev = document.getElementById('btn-wep-prev');
        bWepPrev.addEventListener('touchstart', e => {
            this.onCycleWep?.(-1);
            bWepPrev.classList.add('on');
            setTimeout(() => bWepPrev.classList.remove('on'), 120);
            registerLookTouches(e); e.stopPropagation(); e.preventDefault();
        }, { passive: false });
        bWepPrev.addEventListener('touchend', e => { unregisterLookTouches(e); e.stopPropagation(); e.preventDefault(); }, { passive: false });
        bWepPrev.addEventListener('touchcancel', e => { unregisterLookTouches(e); e.stopPropagation(); e.preventDefault(); }, { passive: false });

        const bPause = document.getElementById('btn-pause');
        bPause.addEventListener('touchstart', e => {
            if (this.state === 'play') this.onPause?.();
            e.stopPropagation(); e.preventDefault();
        }, { passive: false });
    }

    // Convenience accessors for the game loop
    getMove() {
        if (this.isMobile) {
            return { fwd: this.moveFwd, str: this.moveStr };
        }
        const fwd = (this.keys['w'] ? 1 : 0) + (this.keys['s'] ? -1 : 0);
        const str = (this.keys['d'] ? 1 : 0) + (this.keys['a'] ? -1 : 0);
        return { fwd, str };
    }

    isDashing() {
        return !!this.keys['shift'];
    }

    isFiring() {
        return this.firing;
    }

    consumeClick() {
        const c = this.clicked;
        this.clicked = false;
        return c;
    }

    // Decay look deltas each frame (for sway target)
    tick() {
        this.lookDx *= 0.7;
        this.lookDy *= 0.7;
    }
}
