// Teste de fumaça no navegador: o jogo abre, o fluxo de cenas funciona e nada gera erro.
// Lê o estado pelo gancho window.__game (game.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { openGame } = require('../lib/browser');

// Cada teste abre o seu próprio navegador para não herdar estado do anterior
async function withGame(fn, opts) {
    const g = await openGame(opts);
    try { await fn(g); } finally { await g.close(); }
}

// Ordem dos cards (= ordem de Characters.js), lida do código: personagem novo entra no teste sozinho
const CHARACTERS = [...require('../lib/project').read('Characters.js').matchAll(/\{\s*key:\s*'(\w+)'/g)].map(m => m[1]);

test('abre o jogo, escolhe personagem e joga alguns segundos sem erros', () => withGame(async (g) => {
    await g.startGame(0);
    await g.page.keyboard.down('ArrowRight');
    for (let i = 0; i < 6; i++) {            // andar e pular continuamente por ~4 s
        await g.page.keyboard.down('ArrowUp'); await g.page.waitForTimeout(450);
        await g.page.keyboard.up('ArrowUp');   await g.page.waitForTimeout(200);
    }
    await g.page.keyboard.up('ArrowRight');
    const moved = await g.game(() => window.__game.scene.getScene('GameScene').player.x);
    assert.ok(moved > 100, `o personagem deveria ter andado (x=${moved})`);
    assert.deepEqual(g.errors, []);
}));

assert.ok(CHARACTERS.length >= 3, 'não encontrei os personagens em Characters.js');
for (const [i, character] of CHARACTERS.entries()) {
    test(`personagem ${character}: usa o sprite e o item configurados`, () => withGame(async (g) => {
        await g.startGame(i);
        const info = await g.game(() => {
            const gs = window.__game.scene.getScene('GameScene');
            return {
                character: gs.character,
                expectedItem: COLLECTIBLE_TYPES[characterById(gs.character).collectible].texture,
                item: gs._collectType && gs._collectType.texture,
                hudCounter: !!window.__game.scene.getScene('HUDScene').collectedTxt,
            };
        });
        assert.equal(info.character, character);
        assert.equal(info.item, info.expectedItem, 'o item ativo deve ser o do personagem');
        assert.ok(info.hudCounter, 'o HUD deveria mostrar o contador do item');
        assert.deepEqual(g.errors, []);
    }));
}

test('coleta: item sobreposto ao jogador é coletado e soma pontos', () => withGame(async (g) => {
    await g.startGame(0);
    const before = await g.game(() => {
        const gs = window.__game.scene.getScene('GameScene');
        const item = gs.collectibles.getChildren()[0];
        const out = { score: gs.score, value: gs._collectType.value, total: gs.collectibles.getChildren().length };
        gs.player.setPosition(item.x, item.y); gs.player.setVelocity(0, 0);
        return out;
    });
    await g.page.waitForFunction(() => window.__game.scene.getScene('GameScene').collected >= 1, null, { timeout: 5000 });
    const after = await g.game(() => {
        const gs = window.__game.scene.getScene('GameScene');
        return { score: gs.score, collected: gs.collected, left: gs.collectibles.getChildren().length };
    });
    assert.equal(after.score, before.score + before.value);
    assert.equal(after.left, before.total - 1);
    assert.deepEqual(g.errors, []);
}));

test('coleta: andar no chão por baixo dos itens não coleta (só pulando)', () => withGame(async (g) => {
    await g.startGame(0);
    await g.game(() => {
        const gs = window.__game.scene.getScene('GameScene');
        const item = gs.collectibles.getChildren()[0];
        gs.player.setPosition(item.x, GROUND_Y - 40); gs.player.setVelocity(0, 0);   // GROUND_Y: global de GameScene.js
    });
    await g.page.waitForTimeout(900);
    const collected = await g.game(() => window.__game.scene.getScene('GameScene').collected);
    assert.equal(collected, 0, 'item alto demais para ser pego em pé foi coletado andando');
}));

test('fim de jogo: perder a última vida leva ao Game Over e salva o recorde', () => withGame(async (g) => {
    await g.startGame(0);
    await g.game(() => {
        const gs = window.__game.scene.getScene('GameScene');
        gs.score = 1234; gs.lives = 1; gs.loseLife();
    });
    await g.waitScene('GameOverScene');
    assert.equal(await g.page.evaluate(() => localStorage.getItem('sumanzada-highscore')), '1234');
    assert.deepEqual(g.errors, []);
}));

test('vitória: chegar à garrafa leva à tela de vitória', () => withGame(async (g) => {
    await g.startGame(0);
    await g.game(() => {
        const gs = window.__game.scene.getScene('GameScene');
        gs.player.setPosition(gs.bottle.x, gs.bottle.y); gs.player.setVelocity(0, 0);
    });
    await g.waitScene('WinScene');
    assert.deepEqual(g.errors, []);
}));

test('reiniciar após o Game Over: o HUD não acumula ouvintes e a nova partida funciona', () => withGame(async (g) => {
    const events = ['scoreChanged', 'livesChanged', 'timeChanged', 'comboChanged', 'collectedChanged'];
    const count = () => g.game((evs) => {
        const gs = window.__game.scene.getScene('GameScene');
        return evs.map(e => gs.events.listenerCount(e));
    }, events);

    await g.startGame(0);
    assert.deepEqual(await count(), [1, 1, 1, 1, 1], 'a 1ª partida deve ter 1 ouvinte por evento');

    await g.game(() => { const gs = window.__game.scene.getScene('GameScene'); gs.lives = 1; gs.loseLife(); });
    await g.waitScene('GameOverScene');
    await g.page.waitForTimeout(1500);                         // a tecla só vale depois de 1,2 s
    await g.page.keyboard.press('Space');
    await g.waitSelectReady();                                 // "jogar novamente" leva à escolha de personagem
    await g.page.keyboard.press('Enter');
    await g.page.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.isActive('HUDScene'), null, { timeout: 8000 });

    assert.deepEqual(await count(), [1, 1, 1, 1, 1], 'após reiniciar não pode sobrar ouvinte da partida anterior');
    // A nova partida precisa responder: coletar um item atualiza pontos e o texto do HUD
    await g.game(() => {
        const gs = window.__game.scene.getScene('GameScene');
        const item = gs.collectibles.getChildren()[0];
        gs.player.setPosition(item.x, item.y); gs.player.setVelocity(0, 0);
    });
    await g.page.waitForFunction(() => window.__game.scene.getScene('GameScene').collected === 1, null, { timeout: 5000 });
    assert.equal(await g.game(() => window.__game.scene.getScene('HUDScene').collectedTxt.text), '×1');
    assert.deepEqual(g.errors, []);
}));

// ── Fluxo "jogar novamente": sempre volta à escolha de personagem ─────────────────────────────────────

test('Game Over: o botão JOGAR NOVAMENTE leva à escolha de personagem', () => withGame(async (g) => {
    await g.startGame(0);
    await g.game(() => { const gs = window.__game.scene.getScene('GameScene'); gs.lives = 1; gs.loseLife(); });
    await g.waitScene('GameOverScene');
    await g.game(() => window.__game.scene.getScene('GameOverScene').children.list
        .find(o => o.text && o.text.includes('JOGAR NOVAMENTE')).emit('pointerdown'));
    await g.waitSelectReady();
    assert.deepEqual(await g.scenes(), ['CharacterSelectScene']);
    assert.deepEqual(g.errors, []);
}));

test('Vitória: o botão JOGAR NOVAMENTE leva à escolha de personagem', () => withGame(async (g) => {
    await g.startGame(0);
    await g.game(() => {
        const gs = window.__game.scene.getScene('GameScene');
        gs.player.setPosition(gs.bottle.x, gs.bottle.y); gs.player.setVelocity(0, 0);
    });
    await g.waitScene('WinScene');
    await g.game(() => window.__game.scene.getScene('WinScene').children.list
        .find(o => o.text && o.text.includes('JOGAR NOVAMENTE')).emit('pointerdown'));
    await g.waitSelectReady();
    assert.deepEqual(await g.scenes(), ['CharacterSelectScene']);
    assert.deepEqual(g.errors, []);
}));

test('o último personagem vem pré-selecionado e Enter o inicia (Pitcha, o último card)', () => withGame(async (g) => {
    const last = CHARACTERS.length - 1;
    await g.startGame(last);
    await g.game(() => { const gs = window.__game.scene.getScene('GameScene'); gs.lives = 1; gs.loseLife(); });
    await g.waitScene('GameOverScene');
    await g.page.waitForTimeout(1500);
    await g.page.keyboard.press('Space');
    await g.waitSelectReady();
    assert.equal(await g.game(() => window.__game.scene.getScene('CharacterSelectScene')._selected), last);
    await g.page.keyboard.press('Enter');
    await g.page.waitForFunction(() => window.__game.scene.isActive('GameScene'), null, { timeout: 8000 });
    assert.equal(await g.game(() => window.__game.scene.getScene('GameScene').character), CHARACTERS[last]);
}));

test('Enter segurado na tela de fim não pula a escolha de personagem (só repetições de tecla chegam)', () => withGame(async (g) => {
    await g.startGame(0);
    await g.game(() => { const gs = window.__game.scene.getScene('GameScene'); gs.lives = 1; gs.loseLife(); });
    await g.waitScene('GameOverScene');
    await g.page.waitForTimeout(1500);
    await g.page.keyboard.down('Enter');                       // 1º toque: leva à seleção
    await g.waitSelectReady();
    for (let i = 0; i < 4; i++) { await g.page.keyboard.down('Enter'); await g.page.waitForTimeout(40); }   // repetições
    await g.page.waitForTimeout(300);
    assert.deepEqual(await g.scenes(), ['CharacterSelectScene'], 'a repetição de tecla iniciou o jogo sem escolher');
    await g.page.keyboard.up('Enter');
    await g.page.keyboard.press('Enter');                      // um toque novo, sim, inicia
    await g.page.waitForFunction(() => window.__game.scene.isActive('GameScene'), null, { timeout: 8000 });
}));
