// Tela de escolha de personagem — entre TitleScene e GameScene.
// O jogo é o mesmo para todos; só o personagem muda (sprite + animação).
// A escolha é salva no registry para sobreviver ao restart de GameOver/WinScene,
// que voltam direto para GameScene sem passar por aqui.
class CharacterSelectScene extends Phaser.Scene {
    constructor() { super({ key: 'CharacterSelectScene' }); }

    create() {
        const W = this.scale.width;

        // Fundo + overlay escuro (mesmo padrão da TitleScene)
        this.add.image(0, 0, 'background2').setOrigin(0, 0);
        this.add.rectangle(W / 2, this.scale.height / 2, W, this.scale.height, 0x000a1a, 0.82);

        const txt = (x, y, str, style) =>
            this.add.text(x, y, str, { fontFamily: 'monospace', resolution: 3, ...style })
                .setOrigin(0.5);

        // Título
        txt(W / 2, 24, 'ESCOLHA SEU PERSONAGEM', {
            fontSize: '20px',
            color: '#ffe040',
            stroke: '#000000',
            strokeThickness: 5
        });

        // Voltar para a tela inicial
        const back = txt(10, 10, '← VOLTAR', {
            fontSize: '9px',
            color: '#cccccc',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        back.on('pointerover', () => back.setColor('#ffffff'));
        back.on('pointerout',  () => back.setColor('#cccccc'));
        back.on('pointerdown', () => this.scene.start('TitleScene'));

        // ── Personagens ──
        // O tamanho do sprite é calculado para caber na caixa do card, então um personagem novo
        // não precisa de escala manual.
        const CHARACTERS = [
            { key: 'andre',   name: 'DEDÉ',    tag: '▶ SELECIONADO ◀', idle: 'andre_idle' },
            { key: 'thais',   name: 'TATÁ',    tag: '▶ SELECIONADA ◀', idle: 'thais_idle' },
            { key: 'rafinha', name: 'RAFINHA', tag: '▶ SELECIONADO ◀', idle: 'rafinha_idle' },
            { key: 'marcela', name: 'PITU',    tag: '▶ SELECIONADA ◀', idle: 'marcela_idle' },
            { key: 'marilia', name: 'PITCHA',  tag: '▶ SELECIONADA ◀', idle: 'marilia_idle' },
        ];
        const n = CHARACTERS.length;
        this._count = n;

        // Layout (480×270): título no alto, cards no meio e botão embaixo, com folgas parecidas (~14 px).
        // A largura do card encolhe conforme a quantidade de personagens, até no máximo 108 px.
        const MARGIN = 12, GAP = 6, CARD_MAX_W = 108;
        const CARD_W = Math.min(CARD_MAX_W, Math.floor((W - 2 * MARGIN - (n - 1) * GAP) / n));
        const CARD_H = 162, CARD_TOP = 46;
        const CARD_Y = CARD_TOP + CARD_H / 2;                 // centro do card
        const SPRITE_MAX_W = CARD_W - 12, SPRITE_MAX_H = 112;
        const SPRITE_FEET_Y = CARD_TOP + 10 + SPRITE_MAX_H;   // pés alinhados na mesma linha em todos
        const NAME_Y = SPRITE_FEET_Y + 14, TAG_Y = NAME_Y + 15;
        const TAG_SIZE = CARD_W < 100 ? '8px' : '9px';        // "▶ SELECIONADA ◀" precisa caber no card
        // Cards distribuídos e centralizados na largura, qualquer que seja a quantidade
        const CARD_XS = CHARACTERS.map((_, i) => W / 2 + (i - (n - 1) / 2) * (CARD_W + GAP));

        this._cards = [];
        CHARACTERS.forEach((ch, i) => {
            const cx = CARD_XS[i];
            const container = this.add.container(cx, 0);

            // Fundo do card: painel escuro, borda branca; amarela quando selecionado
            const bg = this.add.rectangle(0, CARD_Y, CARD_W, CARD_H, 0x000a1a, 0.85);
            bg.setStrokeStyle(3, 0xffffff);
            container.add(bg);

            const src = this.textures.get(ch.idle).getSourceImage();
            const fit = Math.min(SPRITE_MAX_W / src.width, SPRITE_MAX_H / src.height);
            const sprite = this.add.image(0, SPRITE_FEET_Y, ch.idle).setOrigin(0.5, 1).setScale(fit);
            container.add(sprite);

            const name = txt(0, NAME_Y, ch.name, {
                fontSize: '11px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            });
            container.add(name);

            const tag = txt(0, TAG_Y, ch.tag, {
                fontSize: TAG_SIZE,
                color: '#ffe040',
                stroke: '#000000',
                strokeThickness: 3
            }).setVisible(false);
            container.add(tag);

            // Zona clicável do card inteiro
            const zone = this.add.zone(0, CARD_Y, CARD_W, CARD_H)
                .setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => this._select(i));
            zone.on('pointerover', () => { if (this._selected !== i) bg.setStrokeStyle(3, 0x66ccff); });
            zone.on('pointerout',  () => { if (this._selected !== i) bg.setStrokeStyle(3, 0xffffff); });
            container.add(zone);

            this._cards.push({ key: ch.key, bg, tag, sprite, container });
        });

        // Botão começar (mesmo estilo do JOGAR da TitleScene)
        const btn = txt(W / 2, 238, '▶  COMEÇAR AVENTURA', {
            fontSize: '14px',
            color: '#111111',
            stroke: '#000000',
            strokeThickness: 1,
            backgroundColor: '#ffe040',
            padding: { x: 20, y: 8 }
        }).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setBackgroundColor('#ffffff'));
        btn.on('pointerout',  () => btn.setBackgroundColor('#ffe040'));
        btn.on('pointerdown', () => this._startGame());

        this.tweens.add({ targets: btn, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });

        // Teclado: setas trocam o personagem, Enter começa, Esc volta
        this.input.keyboard.on('keydown-LEFT',  () => this._select((this._selected + this._count - 1) % this._count));
        this.input.keyboard.on('keydown-RIGHT', () => this._select((this._selected + 1) % this._count));
        this.input.keyboard.on('keydown-ENTER', () => this._startGame());
        this.input.keyboard.on('keydown-ESC',   () => this.scene.start('TitleScene'));

        // Primeiro personagem pré-selecionado
        this._select(0);
    }

    _select(i) {
        this._selected = i;
        this._cards.forEach((card, j) => {
            const selected = j === i;
            card.bg.setStrokeStyle(3, selected ? 0xffe040 : 0xffffff);
            card.tag.setVisible(selected);
            card.sprite.setAlpha(selected ? 1 : 0.8);   // destaca o escolhido sem esconder os outros
            // Card selecionado sobe 4px (mesmo efeito do protótipo)
            card.container.setY(selected ? -4 : 0);
        });
    }

    _startGame() {
        const key = this._cards[this._selected].key;
        // Salva no registry: GameOver/WinScene reiniciam direto na GameScene,
        // então a escolha precisa sobreviver sem passar por esta cena.
        this.registry.set('character', key);
        this.scene.start('GameScene', { character: key });
    }
}
