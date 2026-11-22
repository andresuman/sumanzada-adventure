// Tela de escolha de personagem — entre TitleScene e GameScene, e também o destino de "jogar novamente"
// nas telas de Vitória e Game Over. O jogo é o mesmo para todos; só o personagem muda (sprite + animação).
// A última escolha fica no registry e vem pré-selecionada na próxima vez.
class CharacterSelectScene extends Phaser.Scene {
    constructor() { super({ key: 'CharacterSelectScene' }); }

    create() {
        const W = this.scale.width;

        // Fundo + overlay escuro (mesmo padrão da TitleScene)
        this.add.image(0, 0, 'background2').setOrigin(0, 0);
        this.add.rectangle(W / 2, this.scale.height / 2, W, this.scale.height, 0x000a1a, 0.82);

        const txt = UI.textFactory(this);

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

        // ── Personagens (lista única em Characters.js) ──
        // O tamanho do sprite é calculado para caber na caixa do card (ver SPRITE_MAX_*),
        // então um personagem novo não precisa de escala manual.
        const cards = CHARACTERS.map(c => ({
            key: c.key,
            name: c.name,
            idle: characterTextures(c.key).idle,
        }));
        const n = cards.length;
        this._count = n;

        // Layout (480×270): título no alto, grade de cards no meio e botão embaixo.
        // Os cards ficam em 2 linhas (metade em cada; a última linha é centralizada), com o sprite em cima e o
        // nome embaixo: assim cabem 4 colunas (~109 px) sem apertar o nome. A seleção aparece na borda amarela.
        const COLS = Math.ceil(n / 2);
        this._cols = COLS;
        const ROWS = Math.ceil(n / COLS);
        const MARGIN = 12, GAP = 6;
        const CARD_W = Math.min(148, Math.floor((W - 2 * MARGIN - (COLS - 1) * GAP) / COLS));
        const CARD_H = 84, GRID_TOP = 44, PAD = 6;
        const SPRITE_MAX_W = CARD_W - 2 * PAD, SPRITE_MAX_H = 52;
        const cardPos = (i) => {
            const row = Math.floor(i / COLS), inRow = row === ROWS - 1 ? n - row * COLS : COLS;
            return {
                cx: W / 2 + (i - row * COLS - (inRow - 1) / 2) * (CARD_W + GAP),
                cy: GRID_TOP + CARD_H / 2 + row * (CARD_H + GAP),
            };
        };

        this._cards = [];
        cards.forEach((ch, i) => {
            const { cx, cy } = cardPos(i);
            const top = cy - CARD_H / 2;
            const container = this.add.container(cx, 0);

            // Fundo do card: painel escuro, borda branca; amarela quando selecionado
            const bg = this.add.rectangle(0, cy, CARD_W, CARD_H, 0x000a1a, 0.85);
            bg.setStrokeStyle(3, 0xffffff);
            container.add(bg);

            // Escala para caber na caixa do sprite; pés na mesma linha em todos os cards
            const src = this.textures.get(ch.idle).getSourceImage();
            const fit = Math.min(SPRITE_MAX_W / src.width, SPRITE_MAX_H / src.height);
            const sprite = this.add.image(0, top + PAD + SPRITE_MAX_H, ch.idle).setOrigin(0.5, 1).setScale(fit);
            container.add(sprite);

            const name = txt(0, top + PAD + SPRITE_MAX_H + 13, ch.name, {
                fontSize: '11px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            });
            // Nome comprido (ex.: "PITU E AMORA") encolhe a fonte até caber no card
            let nameSize = 11;
            while (name.width > CARD_W - 10 && nameSize > 7) name.setFontSize(`${--nameSize}px`);
            container.add(name);

            // Zona clicável do card inteiro
            const zone = this.add.zone(0, cy, CARD_W, CARD_H)
                .setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => this._select(i));
            zone.on('pointerover', () => { if (this._selected !== i) bg.setStrokeStyle(3, 0x66ccff); });
            zone.on('pointerout',  () => { if (this._selected !== i) bg.setStrokeStyle(3, 0xffffff); });
            container.add(zone);

            this._cards.push({ key: ch.key, bg, sprite, container });
        });

        // Botão começar (mesmo estilo do JOGAR da TitleScene)
        const btn = txt(W / 2, 240, '▶  COMEÇAR AVENTURA', {
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

        // Teclado: ← → percorrem os cards em ordem de leitura, ↑ ↓ trocam de linha, Enter começa, Esc volta
        this.input.keyboard.on('keydown-LEFT',  () => this._select((this._selected + this._count - 1) % this._count));
        this.input.keyboard.on('keydown-RIGHT', () => this._select((this._selected + 1) % this._count));
        this.input.keyboard.on('keydown-UP',    () => { if (this._selected >= this._cols) this._select(this._selected - this._cols); });
        this.input.keyboard.on('keydown-DOWN',  () => { if (this._selected < this._cols) this._select(Math.min(this._selected + this._cols, this._count - 1)); });
        // Enter segurado na tela anterior chega aqui como repetição (event.repeat): não pode pular a escolha
        this.input.keyboard.on('keydown-ENTER', (event) => { if (!event.repeat) this._startGame(); });
        this.input.keyboard.on('keydown-ESC',   () => this.scene.start('TitleScene'));

        // Vem pré-selecionado o último personagem jogado (ou o primeiro, na 1ª vez)
        this._select(Math.max(0, cards.findIndex(c => c.key === this.registry.get('character'))));
    }

    _select(i) {
        this._selected = i;
        this._cards.forEach((card, j) => {
            const selected = j === i;
            card.bg.setStrokeStyle(3, selected ? 0xffe040 : 0xffffff);
            card.sprite.setAlpha(selected ? 1 : 0.8);   // destaca o escolhido sem esconder os outros
            // Card selecionado sobe 4px (mesmo efeito do protótipo)
            card.container.setY(selected ? -4 : 0);
        });
    }

    _startGame() {
        const key = this._cards[this._selected].key;
        // Guarda a escolha para pré-selecionar o mesmo personagem na próxima volta a esta tela
        this.registry.set('character', key);
        this.scene.start('GameScene', { character: key });
    }
}
