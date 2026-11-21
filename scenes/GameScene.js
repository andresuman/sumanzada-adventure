const GROUND_Y    = 248;
const TILE_W      = 64;
const TILE_H      = 48;
const PLAYER_SCALE = 0.28;
const CAPY_SCALE  = 0.22;
const PLAYER_SPEED = 140;
const JUMP_VY     = -440;
const LIVES_START = 5;
const CAPY_SPEED  = 85;     // velocidade base das capivaras (px/s)
const WORLD_WIDTH = 2972;   // largura exata do background2.png (largura do mundo do jogo)
const TIME_START  = 60;     // 1 minuto em segundos

// Garrafa (objetivo): escala do sprite e quanto os pés afundam no chão (px)
const BOTTLE_SCALE = 0.48;
const BOTTLE_SINK  = 3;

// Personagens jogáveis: lista única em Characters.js (texturas, nomes e item de cada um).
// A escolha vem de CharacterSelectScene (data.character); o registry guarda a última escolha e serve de
// reserva se a cena for iniciada sem `character`.

// Parâmetros de spawn das capivaras
const SPAWN_DELAY_MAX    = 3500; // intervalo inicial entre spawns (ms)
const SPAWN_DELAY_MIN    = 1500; // intervalo mínimo ao fim da fase (ms)
const SPAWN_DELAY_JITTER = 400;  // variação aleatória ±400ms no intervalo
const SPAWN_SPEED_RAMP   = 0.8;  // fator de aceleração máxima (80% acima do base)

// Tolerâncias de colisão e timings
const STOMP_TOLERANCE     = 14;  // px de tolerância para detectar pisada no topo da capivara
const GAMEOVER_DELAY      = 700; // ms de espera antes de exibir GameOverScene
const WIN_DELAY           = 600; // ms de espera antes da tela de vitória
const INVINCIBLE_REPEAT   = 10;  // repetições do piscar após levar dano
const INVINCIBLE_DURATION = 90;  // duração de cada piscar de invencibilidade (ms)

class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    init(data) {
        // Personagem escolhido na CharacterSelectScene; sem `character`, vale a última escolha no registry.
        // Chave desconhecida cai no primeiro personagem da lista.
        const wanted     = (data && data.character) || this.registry.get('character');
        this._charCfg    = characterById(wanted);
        this.character   = this._charCfg.key;
        this._tex        = characterTextures(this.character);
        this.score       = 0;
        this.lives       = LIVES_START;
        this.gameTime    = TIME_START;
        this.dead        = false;
        this.invincible  = false;
        this.combo       = 1;   // multiplicador de passagem limpa
        this.comboPoints = 0;   // pontos acumulados na sequência atual (devolvidos se pisar)
        this.collected   = 0;   // itens coletados (mostrado no HUD)
        this._groupLeft  = {};  // itens restantes por grupo (bônus ao completar)
    }

    create() {
        const H = this.scale.height;

        // ── Fundo (imagem estática de largura fixa) ──────────────────────────
        this.add.image(0, 0, 'background2').setOrigin(0, 0).setDepth(0);

        // ── Chão (gerado de uma vez para toda a fase) ─────────────────────────
        this.ground = this.physics.add.staticGroup();
        this.spawnGround(0, WORLD_WIDTH);

        // ── Capivaras ────────────────────────────────────────────────────────
        this.capybaras = this.physics.add.group();

        // ── Garrafa (objetivo final) ──────────────────────────────────────────
        this.bottle = this.physics.add.staticSprite(WORLD_WIDTH - 80, 0, 'bottle2')
            .setScale(BOTTLE_SCALE)
            .setDepth(10);
        // Altura vem do sprite (e não de um número fixo): a base fica logo abaixo do topo do chão
        this.bottle.y = GROUND_Y + BOTTLE_SINK - this.bottle.displayHeight / 2;
        this.bottle.refreshBody();

        // ── Personagem escolhido (this.player é o jogador, seja qual for o personagem) ──
        this.player = this.physics.add.sprite(80, GROUND_Y - 50, this._tex.idle)
            .setScale(PLAYER_SCALE)
            .setCollideWorldBounds(false)
            .setDepth(10);

        // Hitbox proporcional ao frame do personagem (55% × 80%, centrada). Vale para todos porque os
        // canvases dos sprites são centrados no corpo; o corpo usa o tamanho do frame idle.
        const fw = this.player.frame.width;
        const fh = this.player.frame.height;
        this.player.body.setSize(fw * 0.55, fh * 0.80);
        this.player.body.setOffset(fw * 0.22, fh * 0.10);

        // ── Itens coletáveis (tipo definido pelo personagem) ──────────────────
        this._spawnCollectibles();

        // ── Colisões ─────────────────────────────────────────────────────────
        this.physics.add.collider(this.player,    this.ground);
        this.physics.add.collider(this.capybaras, this.ground);
        this.physics.add.overlap(this.player, this.capybaras,
            this.onContact, null, this);
        this.physics.add.overlap(this.player, this.bottle,
            this.onReachBottle, null, this);
        this.physics.add.overlap(this.player, this.collectibles,
            this._onCollect, null, this);

        // ── Câmera ───────────────────────────────────────────────────────────
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, H);
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
        this._showCityAnnouncement();
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
        if (this.player.x > WORLD_WIDTH - 20) this.player.x = WORLD_WIDTH - 20;
        this.player.setVelocityX(vx);

        // ── Pulo ──────────────────────────────────────────────────────────────
        const jumpPressed = this.cursors.up.isDown || this.cursors.space.isDown ||
                            this.wasd.W.isDown || this.btnJump;
        if (jumpPressed && onGround) {
            this.player.setVelocityY(JUMP_VY);
            this.sndJump();
        }

        // ── Animação ─────────────────────────────────────────────────────────
        if (vx !== 0) this.player.anims.play(this._tex.walkAnim, true);
        else          this.player.anims.play(this._tex.idleAnim, true);

        // ── Detectar passagem limpa + limpar capivaras fora da tela ──────────
        const playerOnGround = this.player.body.blocked.down || this.player.body.touching.down;
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

    // ── Itens coletáveis (flutuam no ar — o jogador pula para pegar) ─────────
    _spawnCollectibles() {
        // Tipo vem do personagem; cai em 'coin' se o personagem não definir
        const type = COLLECTIBLE_TYPES[this._charCfg.collectible] || COLLECTIBLE_TYPES.coin;
        this._collectType = type;
        this.collectibles = this.physics.add.group({ allowGravity: false, immovable: true });

        COLLECTIBLE_LAYOUT.forEach((group, gi) => {
            const pts = collectibleLayoutPoints(group, GROUND_Y);
            this._groupLeft[gi] = pts.length;

            pts.forEach((p, i) => {
                const item = this.collectibles.create(p.x, p.y, type.texture)
                    .setScale(type.scale || 1)
                    .setDepth(8);
                item.body.allowGravity = false;
                item.body.immovable    = true;
                item._group = gi;

                // Defasagem por item faz a fileira "ondular" em vez de mover tudo junto
                this.tweens.add({
                    targets: item, y: p.y - 4,
                    duration: 700, delay: i * 90,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
                // O corpo do jogador é bem maior que o item, então encolher a largura
                // no giro não atrapalha a coleta.
                if (type.spin) {
                    this.tweens.add({
                        targets: item, scaleX: 0.25 * (type.scale || 1),
                        duration: 420, delay: i * 60,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                }
            });
        });
    }

    _onCollect(player, item) {
        if (this.dead || !item.active) return;
        const type = this._collectType;
        const group = item._group;

        this.tweens.killTweensOf(item);
        item.destroy();

        this.collected++;
        this.score += type.value;
        this.events.emit('collectedChanged', this.collected);
        this.events.emit('scoreChanged', this.score);
        this._floatText(`+${type.value}`, item.x, item.y - 10, type.color);
        this._sndCollectible(type);

        // Grupo completo: bônus extra
        this._groupLeft[group]--;
        if (this._groupLeft[group] === 0 && type.groupBonus) {
            this.score += type.groupBonus;
            this.events.emit('scoreChanged', this.score);
            this.time.delayedCall(180, () => {
                this._floatText(`+${type.groupBonus}`, player.x, player.y - 56, '#44ff88', 3);
            });
        }
    }

    // ── Chão ─────────────────────────────────────────────────────────────────
    spawnGround(from, to) {
        for (let x = from; x < to; x += TILE_W) {
            const tile = this.ground.create(x + TILE_W/2, GROUND_Y + TILE_H/2, 'ground2');
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
        return CAPY_SPEED * (1 + SPAWN_SPEED_RAMP * progress);
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
        this.time.delayedCall(WIN_DELAY, () => {
            this.scene.stop('HUDScene');
            this.scene.start('WinScene', { score: this.score });
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
            this.scene.start('GameOverScene', { score: this.score });
        });
    }

    // ── Texto flutuante de pontuação ──────────────────────────────────────────
    // usedCombo opcional: fonte maior em combo alto para reforçar o impacto visual
    _floatText(text, x, y, color, usedCombo) {
        const size  = usedCombo && usedCombo >= 5 ? '18px' : usedCombo && usedCombo >= 3 ? '16px' : '14px';
        const t = this.add.text(x, y, text, {
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
    _showCityAnnouncement() {
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
        } catch {
            // Sem áudio disponível (ou bloqueado): o jogo nunca pode quebrar por causa de um efeito sonoro
        }
    }

    // ── Sons (Web Audio API — sem arquivos externos) ──────────────────────────
    // Toca um tom curto. `sweepTo` desliza a frequência de `freq` até ele em `sweepTime` s; o volume cai
    // exponencialmente até 0.001 em `decay` s (nunca 0: exponentialRamp não aceita zero e geraria clique)
    // e o oscilador para em `stop` s. `delay` agenda a nota para depois (melodias curtas).
    _tone(ac, { type = 'square', freq, sweepTo, sweepTime = 0.10, gain = 0.15, decay = 0.12, stop = decay, delay = 0 }) {
        const t = ac.currentTime + delay;
        const o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + sweepTime);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + decay);
        o.start(t); o.stop(t + stop);
    }

    sndJump() {
        this._sfx(ac => this._tone(ac, { freq: 180, sweepTo: 420, sweepTime: 0.10, gain: 0.18, decay: 0.12 }));
    }

    sndStomp() {
        this._sfx(ac => this._tone(ac, { freq: 320, sweepTo: 55, sweepTime: 0.14, gain: 0.22, decay: 0.15 }));
    }

    sndTick() {
        // Frequência alta (880 Hz) reforça urgência — diferencia o tick do relógio dos outros SFX de jogo
        this._sfx(ac => this._tone(ac, { freq: 880, gain: 0.10, decay: 0.06 }));
    }

    sndHurt() {
        // Sawtooth tem timbre mais áspero que square — transmite dano melhor do que os SFX de ação
        this._sfx(ac => this._tone(ac, { type: 'sawtooth', freq: 220, sweepTo: 70, sweepTime: 0.18, gain: 0.18, decay: 0.20 }));
    }

    sndGameOver() {
        // Descida cromática em sawtooth — derrota sem ser excessivamente dramático
        this._sfx(ac => {
            [[220, 0], [196, 0.16], [174, 0.32], [155, 0.52]].forEach(([freq, delay]) =>
                this._tone(ac, { type: 'sawtooth', freq, delay, gain: 0.15, decay: 0.14 }));
        });
    }

    sndVictory() {
        // Fanfarra ascendente de cinco notas
        this._sfx(ac => {
            [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38], [1319, 0.55]].forEach(([freq, delay]) =>
                this._tone(ac, { freq, delay, gain: 0.13, decay: 0.22, stop: 0.25 }));
        });
    }

    // SFX do item vem do catálogo (type.sfx), então cada tipo pode ter seu som
    _sndCollectible(type) {
        const sfx = type.sfx;
        if (!sfx) return;
        this._sfx(ac => {
            sfx.notes.forEach(([freq, delay]) =>
                this._tone(ac, { type: sfx.wave || 'square', freq, delay, gain: sfx.gain || 0.13, decay: 0.10, stop: 0.11 }));
        });
    }

    // Passagem limpa: sobe um grau da escala a cada acerto seguido (square, hexacorde de Dó a Lá).
    sndCleanPass(combo) {
        this._sfx(ac => {
            const notes = [523, 587, 659, 698, 784, 880]; // C5 D5 E5 F5 G5 A5
            const base  = notes[Math.min(combo - 1, notes.length - 1)];
            // "Ping" curto: nota + leve slide de um semitom para cima (brilho retro)
            const ping = (freq, delay, gain) =>
                this._tone(ac, { freq, sweepTo: freq * 1.06, sweepTime: 0.07, gain, decay: 0.10, delay });

            ping(base,       0,    0.14); // nota principal (sempre)
            if (combo >= 3) ping(base * 1.5, 0.08, 0.10); // quinta justa — combo médio
            if (combo >= 5) ping(base * 2,   0.15, 0.07); // oitava acima — combo alto
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
