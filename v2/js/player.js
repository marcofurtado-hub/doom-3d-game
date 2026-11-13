import { WEAP } from './weapons.js';

// Player state. Forward vector on XZ is (cos angle, sin angle).
export class Player {
    constructor() { this.r = 0.5; this.reset(); }

    reset() {
        this.x = 0; this.z = 0; this.angle = -Math.PI / 2; this.pitch = 0;
        this.cameraHeight = 1.5; this.deathRoll = 0; this.strafe = 0;
        this.hp = 100; this.maxHp = 100; this.armor = 0; this.maxArmor = 100;
        this.spd = 9; this.wep = 1; this.shotT = 0;
        this.dmgM = 1; this.rateM = 1; this.healM = 1;
        this.dashCd = 0; this.dashT = 0; this.dashX = 0; this.dashZ = 0;
        this.inv = 0; this.hurtT = 0;
        this.unlocked = { 1: true };
        this.ammo = {}; this.ammoMax = {};
        for (const k of Object.keys(WEAP)) {
            if (WEAP[k].maxAmmo !== Infinity) { this.ammoMax[k] = WEAP[k].maxAmmo; this.ammo[k] = WEAP[k].maxAmmo; }
        }
        this.reloading = false; this.reloadT = 0;
        this.lookDx = 0; this.lookDy = 0;
        this.alive = true;
    }

    // Armor soaks half of incoming damage while it lasts. Returns true if this hit killed the player.
    damage(amount) {
        if (this.inv > 0 || !this.alive) return false;
        if (this.armor > 0) {
            const soak = Math.min(this.armor, amount * 0.5);
            this.armor -= soak; amount -= soak;
        }
        this.hp -= amount;
        this.inv = 0.25;
        this.hurtT = 0.35;
        if (this.hp <= 0) { this.hp = 0; this.alive = false; return true; }
        return false;
    }

    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
}
