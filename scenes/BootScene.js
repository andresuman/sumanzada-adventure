class BootScene extends Phaser.Scene {
    constructor() { super({ key: 'BootScene' }); }

    preload() {
        // Personagens jogáveis da família (idle + 4 frames de caminhada)
        this.load.image('andre_idle',  'assets/andre_idle.png');
        this.load.image('andre_walk1', 'assets/andre_walk1.png');
        this.load.image('andre_walk2', 'assets/andre_walk2.png');
        this.load.image('andre_walk3', 'assets/andre_walk3.png');
        this.load.image('andre_walk4', 'assets/andre_walk4.png');

        this.load.image('thais_idle',  'assets/thais_idle.png');
        this.load.image('thais_walk1', 'assets/thais_walk1.png');
        this.load.image('thais_walk2', 'assets/thais_walk2.png');
        this.load.image('thais_walk3', 'assets/thais_walk3.png');
        this.load.image('thais_walk4', 'assets/thais_walk4.png');

        // Rafinha: não anda a pé, vai no carrinho (mesmo padrão: idle + 4 frames do carro)
        this.load.image('rafinha_idle',  'assets/rafinha_idle.png');
        this.load.image('rafinha_walk1', 'assets/rafinha_walk1.png');
        this.load.image('rafinha_walk2', 'assets/rafinha_walk2.png');
        this.load.image('rafinha_walk3', 'assets/rafinha_walk3.png');
        this.load.image('rafinha_walk4', 'assets/rafinha_walk4.png');

        // Inimigos
        this.load.image('capy_walk1', 'assets/capy_walk1.png');
        this.load.image('capy_walk2', 'assets/capy_walk2.png');
        this.load.image('capy_walk3', 'assets/capy_walk3.png');
        this.load.image('capy_flat1', 'assets/capy_flat1.png');
        this.load.image('capy_flat2', 'assets/capy_flat2.png');

        // Cenário e itens
        this.load.image('ground2', 'assets/ground2.png');
        this.load.image('bottle2', 'assets/bottle2.png');
        this.load.image('background2', 'assets/background2.png');

        // Itens coletáveis que usam imagem (os desenhados por código são gerados abaixo)
        Object.values(COLLECTIBLE_TYPES).forEach(t => {
            if (t.image) this.load.image(t.texture, t.image);
        });

        // Coração gerado via canvas (síncrono)
        this.makeHeart();
        this.makeCollectibles();
    }

    create() {
        // Animações do André 
        this.anims.create({ key: 'andre-idle',
            frames: [{ key:'andre_idle' }], frameRate:1, repeat:-1 });
        this.anims.create({ key: 'andre-walk',
            frames: [
                { key:'andre_walk1' }, { key:'andre_walk2' },
                { key:'andre_walk3' }, { key:'andre_walk4'  }
            ], frameRate:8, repeat:-1 });

        // Animações da Thais 
        this.anims.create({ key: 'thais-idle',
            frames: [{ key:'thais_idle' }], frameRate:1, repeat:-1 });
        this.anims.create({ key: 'thais-walk',
            frames: [
                { key:'thais_walk1' }, { key:'thais_walk2' },
                { key:'thais_walk3' }, { key:'thais_walk4'  }
            ], frameRate:8, repeat:-1 });

        // Animações do Rafinha (o "andar" é o carrinho rolando)
        this.anims.create({ key: 'rafinha-idle',
            frames: [{ key:'rafinha_idle' }], frameRate:1, repeat:-1 });
        this.anims.create({ key: 'rafinha-walk',
            frames: [
                { key:'rafinha_walk1' }, { key:'rafinha_walk2' },
                { key:'rafinha_walk3' }, { key:'rafinha_walk4'  }
            ], frameRate:8, repeat:-1 });

        // Animações da capivara
        this.anims.create({ key: 'capy-walk',
            frames: [
                { key:'capy_walk1' }, { key:'capy_walk2' }, { key:'capy_walk3' }
            ], frameRate:6, repeat:-1 });

        this.scene.start('TitleScene');
    }

    // ── Coração para HUD (canvas síncrono) ───────────────────────────────────
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
                if (ch === 'R') { ctx.fillStyle='#e83030'; ctx.fillRect(x*scale,y*scale,scale,scale); }
            });
        });
        tex.refresh();
    }
}
