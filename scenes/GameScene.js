const GROUND_Y    = 248;
const TILE_W      = 64;
const TILE_H      = 48;
const PLAYER_SCALE = 0.28;
const CAPY_SCALE  = 0.22;
const PLAYER_SPEED = 140;
const JUMP_VY     = -440;
const LIVES_START = 5;
const CAPY_SPEED  = 85;     // velocidade base das capivaras (px/s)
const LEVEL_WIDTH = 2972;   // largura exata do background2.png
const TIME_START  = 60;     // 1 minuto em segundos

// Personagens jogáveis: textura idle + chaves das animações criadas em BootScene.
// A escolha vem de CharacterSelectScene (data.character) ou do registry
// (GameOver/WinScene reiniciam direto aqui, sem passar pela seleção); padrão: André.
const CHARACTERS = {
    andre: { idle: 'andre_idle', idleAnim: 'andre-idle', walkAnim: 'andre-walk' },
    thais: { idle: 'thais_idle', idleAnim: 'thais-idle', walkAnim: 'thais-walk' },
    rafinha: { idle: 'rafinha_idle', idleAnim: 'rafinha-idle', walkAnim: 'rafinha-walk' },
};

// Parâmetros de spawn das capivaras
const SPAWN_DELAY_MAX    = 3500; // intervalo inicial entre spawns (ms)
const SPAWN_DELAY_MIN    = 1500; // intervalo mínimo ao fim da fase (ms)
const SPAWN_DELAY_JITTER = 400;  // variação aleatória ±400ms no intervalo
const SPAWN_SPEED_RAMP   = 0.8;  // fator de aceleração máxima (80% acima do base)

// Tolerâncias de colisão e timings
const STOMP_TOLERANCE     = 14;  // px de tolerância para detectar pisada no topo da capivara
const GAMEOVER_DELAY      = 700; // ms de espera antes de exibir GameOverScene
const PHASE_TRANS_DELAY   = 600; // ms de espera antes da tela de vitória
const INVINCIBLE_REPEAT   = 10;  // repetições do piscar após levar dano
const INVINCIBLE_DURATION = 90;  // duração de cada piscar de invencibilidade (ms)

class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    init(data) {
        this.score       = data && data.score ? data.score : 0;
        this.lives       = data && data.lives ? data.lives : LIVES_START;
        // Personagem escolhido na CharacterSelectScene; o registry cobre o restart
        // de GameOver/WinScene, que não passam character.
        this.character   = (data && data.character) || this.registry.get('character') || 'andre';
        if (!CHARACTERS[this.character]) this.character = 'andre';
        this._charCfg    = CHARACTERS[this.character];
        this.gameTime    = TIME_START;
        this.dead        = false;
        this.invincible  = false;
        this.combo       = 1;   // multiplicador de passagem limpa
        this.comboPoints = 0;   // pontos acumulados na sequência atual (devolvidos se pisar)
        this._playerJumping = false; // diferencia pulo voluntário de empurrões/dano
    }

    create() {
        const H = this.scale.height;

        this._levelWidth = LEVEL_WIDTH;
        this._capySpeed  = CAPY_SPEED;
        this._bgKey      = 'background2';
        this._groundKey  = 'ground2';

        // ── Fundo (imagem estática de largura fixa) ──────────────────────────
        this.add.image(0, 0, this._bgKey).setOrigin(0, 0).setDepth(0);

        // ── Chão (gerado de uma vez para toda a fase) ─────────────────────────
        this.ground = this.physics.add.staticGroup();
        this.spawnGround(0, this._levelWidth);

        // ── Capivaras ────────────────────────────────────────────────────────
        this.capybaras = this.physics.add.group();

        // ── Garrafa (objetivo final) ──────────────────────────────────────────
        const bottleKey   = 'bottle2';
        const bottleH     = 240;
        const bottleScale = 0.48;
        const bottleX     = this._levelWidth - 80;
        const bottleY     = GROUND_Y - (bottleH * bottleScale) / 2 + 6;
        this.bottle = this.physics.add.staticSprite(bottleX, bottleY, bottleKey)
            .setScale(bottleScale)
            .setDepth(10);
        this.bottle.refreshBody();

        // ── Personagem escolhido (this.player é o jogador, seja qual for o personagem) ──
        this.player = this.physics.add.sprite(80, GROUND_Y - 50, this._charCfg.idle)
            .setScale(PLAYER_SCALE)
            .setCollideWorldBounds(false)
            .setDepth(10);

        // Hitbox proporcional ao sprite do personagem — 
        // os valores são os mesmos de antes; André e Thais são mais estreitos.
        const fw = this.player.frame.width;
        const fh = this.player.frame.height;
        this.player.body.setSize(fw * 0.55, fh * 0.80);
        this.player.body.setOffset(fw * 0.22, fh * 0.10);

        // ── Colisões ─────────────────────────────────────────────────────────
        this.physics.add.collider(this.player,    this.ground);
        this.physics.add.collider(this.capybaras, this.ground);
        this.physics.add.overlap(this.player, this.capybaras,
            this.onContact, null, this);
        this.physics.add.overlap(this.player, this.bottle,
            this.onReachBottle, null, this);

        // ── Câmera ───────────────────────────────────────────────────────────
        this.cameras.main.setBounds(0, 0, this._levelWidth, H);
        this.cameras.main.startFollow(this.player, true, 0.1, 0);

        // ── Controles ────────────────────────────────────────────────────────
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd    = this.input.keyboard.addKeys('W,A,S,D');
        this.btnLeft = false; this.btnRight = false; this.btnJump = false;

        this.input.addPointer(2);
        this.setupTouchControls();

        // ── Timer regressivo ─────────────────────────────────────────────────
        this.time.addEvent({
            delay: 1000,
            callback: () => {
                if (this.dead) return;
                this.gameTime--;
                this.events.emit('timeChanged', this.gameTime);
                if (this.gameTime <= 0) { this.triggerGameOver(); return; }
                if (this.gameTime <= 10) this.sndTick();
                // Dobra a frequência dos ticks nos últimos 5s para aumentar a tensão
                if (this.gameTime <= 5) {
                    this.time.delayedCall(500, () => { if (!this.dead) this.sndTick(); });
                }
            },
            loop: true
        });

        this.scene.launch('HUDScene', { gameScene: this });
        this._showPhaseAnnouncement();
        this._scheduleNextCapy();
    }

    update() {
        if (this.dead) return;

        const onGround = this.player.body.blocked.down || this.player.body.touching.down;
        const cam      = this.cameras.main.scrollX;

        // ── Movimento ────────────────────────────────────────────────────────
        let vx = 0;
        const goLeft  = this.cursors.left.isDown  || this.wasd.A.isDown || this.btnLeft;
        const goRight = this.cursors.right.isDown || this.wasd.D.isDown || this.btnRight;

        if (goLeft)       { vx = -PLAYER_SPEED; this.player.setFlipX(true);  }
        else if (goRight) { vx =  PLAYER_SPEED; this.player.setFlipX(false); }

        // Limites horizontais: não sai da fase nem fica atrás da câmera
        if (this.player.x < cam + 16)                  this.player.x = cam + 16;
        if (this.player.x > this._levelWidth - 20) this.player.x = this._levelWidth - 20;
        this.player.setVelocityX(vx);

        // ── Pulo ──────────────────────────────────────────────────────────────
        const jumpPressed = this.cursors.up.isDown || this.cursors.space.isDown ||
                            this.wasd.W.isDown || this.btnJump;
        if (jumpPressed && onGround) {
            this._playerJumping = true;
            this.player.setVelocityY(JUMP_VY);
            this.sndJump();
        }

        // ── Animação ─────────────────────────────────────────────────────────
        if (vx !== 0) this.player.anims.play(this._charCfg.walkAnim, true);
        else          this.player.anims.play(this._charCfg.idleAnim, true);

        // ── Detectar passagem limpa + limpar capivaras fora da tela ──────────
        const playerOnGround = this.player.body.blocked.down || this.player.body.touching.down;
        if (playerOnGround && this.player.body.velocity.y >= 0) this._playerJumping = false;
        this.capybaras.getChildren().forEach(capy => {
            // Momento em que a capivara cruza o jogador: decide se pontua ou não
            if (!capy._scored && !capy._stomped && !capy._missed && capy.x < this.player.x - 40) {
                if (!playerOnGround) {
                    // O jogador estava no ar — passagem limpa válida
                    capy._scored = true;
                    const usedCombo = this.combo;
                    const pts = 100 * usedCombo;
                    this.sndCleanPass(usedCombo);
                    this.score       += pts;
                    this.comboPoints += pts;
                    this.combo++;
                    this.events.emit('scoreChanged', this.score);
                    this.events.emit('comboChanged',  this.combo);
                    this._floatText(`+${pts}`, this.player.x, this.player.y - 40, '#44ff88', usedCombo);
                } else {
                    // O jogador estava no chão — sem pontos, não tenta novamente
                    capy._missed = true;
                }
            }
            if (capy.x < cam - 200) capy.destroy();
        });

        // ── Caiu no buraco ────────────────────────────────────────────────────
        if (this.player.y > this.scale.height + 60) this.loseLife();
    }

    // ── Chão ─────────────────────────────────────────────────────────────────
    spawnGround(from, to) {
        for (let x = from; x < to; x += TILE_W) {
            const tile = this.ground.create(x + TILE_W/2, GROUND_Y + TILE_H/2, this._groundKey);
            tile.setDisplaySize(TILE_W, TILE_H).refreshBody();
        }
    }

    // ── Intervalo de spawn (ms) com jitter, baseado no progresso da fase ────────
    _getSpawnInterval(progress) {
        const base = Math.max(SPAWN_DELAY_MIN, SPAWN_DELAY_MAX - (SPAWN_DELAY_MAX - SPAWN_DELAY_MIN) * progress);
        return base + Phaser.Math.Between(-SPAWN_DELAY_JITTER, SPAWN_DELAY_JITTER);
    }

    // ── Velocidade da capivara (px/s) baseada no progresso da fase ───────────
    _getCapySpeed(progress) {
        return this._capySpeed * (1 + SPAWN_SPEED_RAMP * progress);
    }

    // ── Agendar próxima capivara por timer (intervalo e velocidade crescem com o tempo) ─
    _scheduleNextCapy() {
        const elapsed  = TIME_START - this.gameTime;
        const progress = elapsed / TIME_START;  // 0 no início, 1 no fim
        const delay = this._getSpawnInterval(progress);

        this.time.delayedCall(delay, () => {
            if (this.dead) return;
            const cam    = this.cameras.main.scrollX;
            const spawnX = cam + this.scale.width + 60;
            this.spawnCapybara(spawnX);
            this._scheduleNextCapy();
        });
    }

    // ── Capivara ──────────────────────────────────────────────────────────────
    spawnCapybara(x) {
        const elapsed  = TIME_START - this.gameTime;
        const progress = elapsed / TIME_START;
        const speed    = this._getCapySpeed(progress);

        const capy = this.capybaras.create(x, GROUND_Y - 30, 'capy_walk1')
            .setScale(CAPY_SCALE)
            .setVelocityX(-speed)
            .setDepth(10);

        capy.body.setSize(276 * 0.72, 200 * 0.68);
        capy.body.setOffset(276 * 0.14, 200 * 0.22);
        capy.anims.play('capy-walk', true);
    }

    // ── Colisão jogador × capivara ──────────────────────────────────────────────
    onContact(player, capy) {
        // Guard: Phaser pode acionar overlap mesmo após game over — evita triggerGameOver() duplo.
        if (this.dead || this.invincible) return;
        const playerFeet = player.body.bottom;
        const capyTop   = capy.body.top;

        if (playerFeet <= capyTop + STOMP_TOLERANCE && player.body.velocity.y > 0) {
            // Pisou na capivara — penalidade: perde os pontos do combo atual
            capy._stomped = true;
            const visualBottom = capy.y + capy.displayHeight / 2;
            capy.anims.stop();
            capy.setTexture(Phaser.Math.RND.pick(['capy_flat1', 'capy_flat2']));
            capy.setVelocityX(0);
            capy.body.enable = false;
            capy.y = visualBottom - capy.displayHeight / 2;
            this.sndStomp();

            if (this.comboPoints > 0) {
                this.score = Math.max(0, this.score - this.comboPoints);
                this._floatText(`-${this.comboPoints}`, player.x, player.y - 40, '#ff4444');
            }
            this.combo       = 1;
            this.comboPoints = 0;
            this.events.emit('scoreChanged', this.score);
            this.events.emit('comboChanged',  this.combo);
            player.setVelocityY(JUMP_VY * 0.5);
            this.time.delayedCall(500, () => capy.destroy());
        } else {
            this.loseLife();
        }
    }

    // ── Chegou na garrafa! ────────────────────────────────────────────────────
    onReachBottle(player, bottle) {
        if (this.dead) return;
        this.dead = true;
        bottle.destroy();
        player.setVelocityX(0);

        this.sndVictory();
        this.time.delayedCall(PHASE_TRANS_DELAY, () => {
            this.scene.stop('HUDScene');
            this.scene.start('WinScene', { score: this.score, time: this.gameTime });
        });
    }

    // ── Perder vida ───────────────────────────────────────────────────────────
    loseLife() {
        if (this.invincible) return;
        this.sndHurt();
        this.lives--;
        this.events.emit('livesChanged', this.lives);
        // Encostou de lado: zera o combo mas não perde pontos já ganhos
        this.combo       = 1;
        this.comboPoints = 0;
        this.events.emit('comboChanged', this.combo);

        if (this.lives <= 0) { this.triggerGameOver(); return; }

        this.invincible = true;
        this.tweens.add({
            targets: this.player, alpha: 0.25, duration: INVINCIBLE_DURATION,
            yoyo: true, repeat: INVINCIBLE_REPEAT,
            onComplete: () => { this.player.setAlpha(1); this.invincible = false; }
        });

        const cam = this.cameras.main.scrollX;
        this._playerJumping = false;
        this.player.setPosition(cam + 80, GROUND_Y - 80);
        this.player.setVelocity(0, 0);
    }

    // ── Game Over ─────────────────────────────────────────────────────────────
    triggerGameOver() {
        this.dead = true;
        this.player.setVelocity(0, 0);
        this.sndGameOver();
        this.time.delayedCall(GAMEOVER_DELAY, () => {
            this.scene.stop('HUDScene');
            this.scene.start('GameOverScene', { score: this.score, time: this.gameTime });
        });
    }

    // ── Sons (Web Audio API — sem arquivos externos) ──────────────────────────
    // ── Som de passagem limpa (square, campo de Fá maior, evolui com o combo) ──
    sndCleanPass(combo) {
        this._sfx(ac => {
            // Notas do campo harmônico de Fá maior (hexacorde de Dó a Lá) — sobe um grau a cada passagem limpa.
            // Mesmo timbre square dos outros SFX; harmonicamente compatível com a trilha em Fá maior.
            const notes = [523, 587, 659, 698, 784, 880]; // C5 D5 E5 F5 G5 A5
            const base  = notes[Math.min(combo - 1, notes.length - 1)];
            const now   = ac.currentTime;

            // "Ping" curto: nota + leve slide de um semitom para cima (brilho retro)
            const ping = (freq, t, amp) => {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'square';
                o.frequency.setValueAtTime(freq, now + t);
                o.frequency.exponentialRampToValueAtTime(freq * 1.06, now + t + 0.07);
                g.gain.setValueAtTime(amp, now + t);
                g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.10);
                o.start(now + t); o.stop(now + t + 0.10);
            };

            ping(base,       0,    0.14); // nota principal (sempre)
            if (combo >= 3) ping(base * 1.5, 0.08, 0.10); // quinta justa — combo médio
            if (combo >= 5) ping(base * 2,   0.15, 0.07); // oitava acima — combo alto
        });
    }

    // ── Texto flutuante de pontuação ──────────────────────────────────────────
    // usedCombo opcional: fonte maior em combo alto para reforçar o impacto visual
    _floatText(text, x, y, color, usedCombo) {
        const label = text;
        const size  = usedCombo && usedCombo >= 5 ? '18px' : usedCombo && usedCombo >= 3 ? '16px' : '14px';
        const t = this.add.text(x, y, label, {
            fontFamily: 'monospace', fontSize: size,
            color, stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(20);
        // Fica parado 500ms para a criança ler, depois sobe e some
        this.tweens.add({
            targets: t, y: y - 44, alpha: 0,
            delay: 500, duration: 700,
            onComplete: () => t.destroy(),
        });
    }

    // ── Anúncio da cidade no início ───────────────────────────────────────────
    _showPhaseAnnouncement() {
        const W = this.scale.width;
        const H = this.scale.height;

        const title = this.add.text(W / 2, H / 2, 'ÁGUAS DE LINDÓIA', {
            fontFamily: 'monospace', fontSize: '28px',
            color: '#ffe040', stroke: '#000000', strokeThickness: 8,
        }).setOrigin(0.5).setDepth(30).setScrollFactor(0);

        this.tweens.add({
            targets: title, alpha: 0,
            delay: 2800, duration: 700,
            onComplete: () => title.destroy(),
        });
    }

    _sfx(fn) {
        try {
            // Reutiliza o contexto SFX já desbloqueado pelo AudioUnlock.js (evita contextos duplicados)
            if (!this._ac) {
                this._ac = window.SFX_AUDIO_CONTEXT || new (window.AudioContext || window['webkitAudioContext'])();
            }
            if (this._ac.state === 'suspended') this._ac.resume();
            fn(this._ac);
        } catch (e) {}
    }

    sndJump() {
        this._sfx(ac => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            o.type = 'square';
            o.frequency.setValueAtTime(180, ac.currentTime);
            o.frequency.exponentialRampToValueAtTime(420, ac.currentTime + 0.10);
            g.gain.setValueAtTime(0.18, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
            o.start(ac.currentTime); o.stop(ac.currentTime + 0.12);
        });
    }

    sndStomp() {
        this._sfx(ac => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            o.type = 'square';
            o.frequency.setValueAtTime(320, ac.currentTime);
            o.frequency.exponentialRampToValueAtTime(55, ac.currentTime + 0.14);
            g.gain.setValueAtTime(0.22, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
            o.start(ac.currentTime); o.stop(ac.currentTime + 0.15);
        });
    }

    sndTick() {
        // Frequência alta (880 Hz) reforça urgência — diferencia o tick do relógio dos outros SFX de jogo
        this._sfx(ac => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            o.type = 'square';
            o.frequency.setValueAtTime(880, ac.currentTime);
            g.gain.setValueAtTime(0.10, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);
            o.start(ac.currentTime); o.stop(ac.currentTime + 0.06);
        });
    }

    sndHurt() {
        // Sawtooth tem timbre mais áspero que square — transmite dano melhor do que os SFX de ação
        this._sfx(ac => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(220, ac.currentTime);
            o.frequency.exponentialRampToValueAtTime(70, ac.currentTime + 0.18);
            g.gain.setValueAtTime(0.18, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.20);
            o.start(ac.currentTime);
            o.stop(ac.currentTime + 0.20);
        });
    }

    sndGameOver() {
        // Descida cromática em sawtooth — derrota sem ser excessivamente dramático
        this._sfx(ac => {
            [[220, 0], [196, 0.16], [174, 0.32], [155, 0.52]].forEach(([f, d]) => {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sawtooth';
                o.frequency.setValueAtTime(f, ac.currentTime + d);
                g.gain.setValueAtTime(0.15, ac.currentTime + d);
                g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d + 0.14);
                o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.14);
            });
        });
    }

    sndVictory() {
        // Fanfarra ascendente de cinco notas
        this._sfx(ac => {
            [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38], [1319, 0.55]].forEach(([f, d]) => {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'square';
                o.frequency.value = f;
                g.gain.setValueAtTime(0.13, ac.currentTime + d);
                g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d + 0.22);
                o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.25);
            });
        });
    }

    // ── Controles touch ───────────────────────────────────────────────────────
    setupTouchControls() {
        const W = this.scale.width;
        const H = this.scale.height;
        const sz = 60, pad = 8;

        const mkBtn = (x, y, label) => {
            const c = this.add.container(x, y).setScrollFactor(0).setDepth(20);
            const bg = this.add.graphics();
            bg.fillStyle(0x000000, 0.45); bg.fillRoundedRect(-sz/2,-sz/2,sz,sz,10);
            bg.lineStyle(2, 0xffffff, 0.5); bg.strokeRoundedRect(-sz/2,-sz/2,sz,sz,10);
            const txt = this.add.text(0, 1, label, {
                fontSize:'20px', color:'#fff', fontFamily:'monospace'
            }).setOrigin(0.5);
            c.add([bg, txt]);
            c.setSize(sz, sz);
            c.setInteractive();
            return c;
        };

        const left  = mkBtn(pad+sz/2,        H-pad-sz/2, '◄');
        const right = mkBtn(pad+sz*1.5+8,    H-pad-sz/2, '►');
        const jump  = mkBtn(W-pad-sz/2,      H-pad-sz/2, '▲');

        this._touchBtns = [
            { btn: left,  prop: 'btnLeft',  pointerId: null },
            { btn: right, prop: 'btnRight', pointerId: null },
            { btn: jump,  prop: 'btnJump',  pointerId: null },
        ];

        const releasePointer = (pointer) => {
            this._touchBtns.forEach((b) => {
                if (b.pointerId === pointer.id) {
                    b.pointerId = null;
                    this[b.prop] = false;
                }
            });
        };

        this._touchBtns.forEach((b) => {
            b.btn.on('pointerdown', (pointer) => {
                if (b.pointerId !== null) return;
                b.pointerId = pointer.id;
                this[b.prop] = true;
            });
            b.btn.on('pointerout', (pointer) => releasePointer(pointer));
            b.btn.on('pointerup',  (pointer) => releasePointer(pointer));
        });

        this.input.on('pointerup',     (pointer) => releasePointer(pointer));
        this.input.on('pointercancel', (pointer) => releasePointer(pointer));
    }
}
