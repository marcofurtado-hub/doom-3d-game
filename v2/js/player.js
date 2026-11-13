// Player state and movement.

export class Player {
    constructor() {
        this.x = 0; this.z = 0; this.r = 0.5;
        this.angle = 0; this.pitch = 0;
        this.cameraHeight = 1.45;
        this.hp = 100; this.maxHp = 100;
        this.armor = 0; this.maxArmor = 100;
        this.spd = 10;
        this.wep = 1;
        this.shotT = 0;
        this.dmgM = 1; this.rateM = 1;
        this.dashCd = 0; this.dashT = 0;
        this.inv = 0; // invulnerability window (frames of mercy)
        this.hurtT = 0;
        this.walkPhase = 0;
        this.ammo = { 2: 28, 3: 150, 4: 12, 5: 80, 6: 6, 7: 8, 8: 200, 9: 3 };
        this.unlocked = { 1: true }; // weapon set
        this.reloading = false; this.reloadT = 0;
        this.lookDx = 0; this.lookDy = 0; // input-side for weapon sway
        this.wantsSwitchTo = null;
        this.alive = true;
    }

    reset() {
        this.x = 0; this.z = 0;
        this.angle = 0; this.pitch = 0;
        this.hp = 100; this.maxHp = 100;
        this.armor = 0;
        this.spd = 10;
        this.wep = 1;
        this.shotT = 0; this.dmgM = 1; this.rateM = 1;
        this.dashCd = 0; this.dashT = 0; this.inv = 0; this.hurtT = 0;
        this.ammo = { 2: 28, 3: 150, 4: 12, 5: 80, 6: 6, 7: 8, 8: 200, 9: 3 };
        this.unlocked = { 1: true };
        this.reloading = false; this.reloadT = 0;
        this.alive = true;
    }

    damage(amount, fromAngle) {
        if (this.inv > 0 || !this.alive) return false;
        // Armor absorbs 50% up to armor value
        let dmg = amount;
        if (this.armor > 0) {
            const absorbed = Math.min(this.armor, dmg * 0.5);
            this.armor -= absorbed;
            dmg -= absorbed;
        }
        this.hp -= dmg;
        this.inv = 0.4; // mercy frames
        this.hurtT = 0.35;
        if (this.hp <= 0) {
            this.hp = 0;
            this.alive = false;
            return true; // died
        }
        return false;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }
}
