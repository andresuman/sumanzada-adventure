// Base das telas de fim de partida (vitória e game over): título, pontuação, recorde, botão e crédito.
// As subclasses só informam textos e cores em getLook().
class ResultScene extends Phaser.Scene {
    init(data) {
        this.finalScore  = (data && data.score) || 0;
        // Efeito colateral deliberado: salva o recorde ao entrar na tela
        this.isNewRecord = window.HighScore ? window.HighScore.check(this.finalScore) : false;
    }

    // { overlay, title, titleColor, subtitle, subtitleColor }
    getLook() {
        throw new Error('ResultScene.getLook() precisa ser implementado pela subclasse');
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;
        const look = this.getLook();
        const txt = UI.textFactory(this);

        this.add.rectangle(W / 2, H / 2, W, H, look.overlay, 0.90);

        txt(W / 2, 30, look.title, {
            fontSize: '28px', color: look.titleColor, stroke: '#000000', strokeThickness: 6,
        });
        txt(W / 2, 62, look.subtitle, {
            fontSize: '13px', color: look.subtitleColor, stroke: '#000000', strokeThickness: 4,
        });
        txt(W / 2, 105, `PONTUAÇÃO   ${String(this.finalScore).padStart(5, '0')}`, {
            fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 4,
        });

        if (this.isNewRecord) {
            txt(W / 2, 130, '★  NOVO RECORDE!  ★', {
                fontSize: '13px', color: '#ffdd00', stroke: '#000000', strokeThickness: 4,
            });
        } else {
            const hs = window.HighScore ? window.HighScore.get() : 0;
            txt(W / 2, 130, `RECORDE   ${String(hs).padStart(5, '0')}`, {
                fontSize: '12px', color: '#aaaaaa', stroke: '#000000', strokeThickness: 3,
            });
        }

        const btn = txt(W / 2, 185, '▶  JOGAR NOVAMENTE', {
            fontSize: '14px', color: '#111111', stroke: '#000000', strokeThickness: 1,
            backgroundColor: '#ffe040', padding: { x: 18, y: 9 },
        }).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setBackgroundColor('#ffffff'));
        btn.on('pointerout',  () => btn.setBackgroundColor('#ffe040'));
        btn.on('pointerdown', () => this._playAgain());

        UI.addCredit(this);

        // Delay evita restart acidental por tecla ainda pressionada no fim do jogo
        this.time.delayedCall(1200, () => {
            this.input.keyboard.once('keydown', () => this._playAgain());
        });

        this.tweens.add({ targets: btn, alpha: 0.5, duration: 550, yoyo: true, repeat: -1 });
    }

    // O personagem escolhido fica no registry, então não precisa ser repassado
    _playAgain() {
        this.scene.start('GameScene');
    }
}
