// Teste de fumaça no navegador: abre o jogo e percorre o fluxo principal.
// Falha em qualquer erro de página, console.error ou arquivo faltando (404) — o que mais quebra
// quando uma imagem ou um nome é trocado. Lê o estado pelo gancho window.__game (game.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { openGame } = require('../lib/browser');

// Cada teste abre o seu próprio navegador para não herdar estado do anterior
async function withGame(fn) {
    const g = await openGame();
    try { await fn(g); } finally { await g.close(); }
}

test('percorre todos os personagens: sprite e item certos, andando, perdendo e voltando à escolha', () => withGame(async (g) => {
    const keys = await g.game(() => CHARACTERS.map(c => c.key));
    assert.ok(keys.length >= 3, 'não encontrei os personagens');
    await g.page.keyboard.press('Space');                       // título → escolha
    for (const [i, key] of keys.entries()) {
        await g.waitSelectReady();
        // Vai até o card i pelo estado (não por contagem de teclas): o último personagem vem pré-selecionado
        for (let n = 0; n < keys.length && await g.game(() => window.__game.scene.getScene('CharacterSelectScene')._selected) !== i; n++) {
            await g.page.keyboard.press('ArrowRight');
            await g.page.waitForTimeout(80);
        }
        await g.page.keyboard.press('Enter');
        await g.page.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.isActive('HUDScene'), null, { timeout: 10000 });

        const info = await g.game(() => {
            const gs = window.__game.scene.getScene('GameScene');
            return { character: gs.character, item: gs._collectType.texture, expected: COLLECTIBLE_TYPES[characterById(gs.character).collectible].texture };
        });
        assert.equal(info.character, key);
        assert.equal(info.item, info.expected, 'o item ativo deve ser o do personagem');

        await g.page.keyboard.down('ArrowRight');               // anda e pula por um instante
        await g.page.keyboard.down('ArrowUp');
        await g.page.waitForTimeout(500);
        await g.page.keyboard.up('ArrowUp');
        await g.page.keyboard.up('ArrowRight');
        assert.ok(await g.game(() => window.__game.scene.getScene('GameScene').player.x) > 80, `${key} deveria ter andado`);

        await g.game(() => { const gs = window.__game.scene.getScene('GameScene'); gs.lives = 1; gs.loseLife(); });
        await g.waitScene('GameOverScene');
        await g.page.waitForTimeout(1500);                      // a tecla só vale depois de 1,2 s
        await g.page.keyboard.press('Space');                   // "jogar novamente" → escolha de personagem
    }
    await g.waitSelectReady();
    assert.deepEqual(g.errors, []);
}));

test('coleta: item sobreposto ao jogador soma pontos; no chão, itens altos não são pegos', () => withGame(async (g) => {
    await g.startGame();
    await g.game(() => {                                        // em pé, abaixo de um item alto: não coleta
        const gs = window.__game.scene.getScene('GameScene');
        gs.player.setPosition(gs.collectibles.getChildren()[0].x, GROUND_Y - 40); gs.player.setVelocity(0, 0);
    });
    await g.page.waitForTimeout(900);
    assert.equal(await g.game(() => window.__game.scene.getScene('GameScene').collected), 0, 'item alto demais foi coletado em pé');

    const before = await g.game(() => {                         // em cima do item: coleta
        const gs = window.__game.scene.getScene('GameScene');
        const item = gs.collectibles.getChildren()[0];
        gs.player.setPosition(item.x, item.y); gs.player.setVelocity(0, 0);
        return { score: gs.score, value: gs._collectType.value };
    });
    await g.page.waitForFunction(() => window.__game.scene.getScene('GameScene').collected >= 1, null, { timeout: 5000 });
    assert.equal(await g.game(() => window.__game.scene.getScene('GameScene').score), before.score + before.value);
    assert.deepEqual(g.errors, []);
}));

test('vitória: chegar à garrafa leva à vitória e o botão volta à escolha de personagem', () => withGame(async (g) => {
    await g.startGame();
    await g.game(() => { const gs = window.__game.scene.getScene('GameScene'); gs.player.setPosition(gs.bottle.x, gs.bottle.y); gs.player.setVelocity(0, 0); });
    await g.waitScene('WinScene');
    await g.game(() => window.__game.scene.getScene('WinScene').children.list
        .find(o => o.text && o.text.includes('JOGAR NOVAMENTE')).emit('pointerdown'));
    await g.waitSelectReady();
    assert.deepEqual(await g.scenes(), ['CharacterSelectScene']);
    assert.deepEqual(g.errors, []);
}));

test('game over: salva o recorde e Enter segurado não pula a escolha de personagem', () => withGame(async (g) => {
    await g.startGame();
    await g.game(() => { const gs = window.__game.scene.getScene('GameScene'); gs.score = 1234; gs.lives = 1; gs.loseLife(); });
    await g.waitScene('GameOverScene');
    assert.equal(await g.page.evaluate(() => localStorage.getItem('sumanzada-highscore')), '1234');
    await g.page.waitForTimeout(1500);
    await g.page.keyboard.down('Enter');                        // 1º toque leva à escolha
    await g.waitSelectReady();
    for (let i = 0; i < 4; i++) { await g.page.keyboard.down('Enter'); await g.page.waitForTimeout(40); }   // repetições
    await g.page.waitForTimeout(300);
    assert.deepEqual(await g.scenes(), ['CharacterSelectScene'], 'a repetição de tecla iniciou o jogo sem escolher');
    assert.deepEqual(g.errors, []);
}));
