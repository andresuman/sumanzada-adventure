class BootScene extends Phaser.Scene {
    constructor() { super({ key: 'BootScene' }); }

    preload() {
        // Personagens jogáveis: <chave>_idle.png + <chave>_walk1..4.png (lista em Characters.js).
        // O Rafinha (carrinho) e o Gianluca (bicicleta) não andam a pé: o "andar" é o carro rolando / a pedalada.
        CHARACTERS.forEach(c => {
            const t = characterTextures(c.key);
            [t.idle, ...t.walk].forEach(name => this.load.image(name, `assets/${name}.png`));
        });

        // Inimigos
        this.load.image('capy_walk1', 'assets/capy_walk1.png');
        this.load.image('capy_walk2', 'assets/capy_walk2.png');
        this.load.image('capy_walk3', 'assets/capy_walk3.png');
        this.load.image('capy_flat1', 'assets/capy_flat1.png');
        this.load.image('capy_flat2', 'assets/capy_flat2.png');

        // Cenário e objetivo
        this.load.image('ground2', 'assets/ground2.png');
        this.load.image('bottle2', 'assets/bottle2.png');
        this.load.image('background2', 'assets/background2.png');

        // Itens coletáveis que usam imagem (os desenhados por código são gerados abaixo)
        Object.values(COLLECTIBLE_TYPES).forEach(t => {
            if (t.image) this.load.image(t.texture, t.image);
        });

        // Texturas geradas por código (síncrono)
        this.makeHeart();
        this.makeCollectibles();
    }

    create() {
        CHARACTERS.forEach(c => {
            const t = characterTextures(c.key);
            this.anims.create({ key: t.idleAnim, frames: [{ key: t.idle }], frameRate: 1, repeat: -1 });
            this.anims.create({ key: t.walkAnim, frames: t.walk.map(key => ({ key })), frameRate: 8, repeat: -1 });
        });

        this.anims.create({ key: 'capy-walk',
            frames: [
                { key: 'capy_walk1' }, { key: 'capy_walk2' }, { key: 'capy_walk3' }
            ], frameRate: 6, repeat: -1 });

        this.scene.start('TitleScene');
    }

    // Textura dos itens desenhados por código (sem PNG) — ver Collectibles.js
    makeCollectibles() {
        Object.values(COLLECTIBLE_TYPES).forEach(t => {
            if (!t.draw) return;
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            t.draw(g, t.size);
            g.generateTexture(t.texture, t.size, t.size);
            g.destroy();
        });
    }

    // Coração do HUD (canvas síncrono, pixel art 7×6 ampliada 2×)
    makeHeart() {
        const tex = this.textures.createCanvas('heart', 14, 12);
        const ctx = tex.getContext();
        const rows = [
            '.RR.RR.', 'RRRRRRR', 'RRRRRRR',
            '.RRRRR.', '..RRR..', '...R...'
        ];
        const scale = 2;
        rows.forEach((row, y) => {
            row.split('').forEach((ch, x) => {
                if (ch === 'R') { ctx.fillStyle = '#e83030'; ctx.fillRect(x * scale, y * scale, scale, scale); }
            });
        });
        tex.refresh();
    }
}
