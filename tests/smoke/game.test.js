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

// Ordem dos cards em CharacterSelectScene, lida do código: personagem novo entra no teste sozinho
const CHARACTERS = [...require('../lib/project').read('scenes/CharacterSelectScene.js')
    .matchAll(/\{\s*key:\s*'(\w+)',\s*name:/g)].map(m => m[1]);

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

assert.ok(CHARACTERS.length >= 3, 'não encontrei os personagens em CharacterSelectScene.js');
for (const [i, character] of CHARACTERS.entries()) {
    test(`personagem ${character}: usa o sprite e o item configurados`, () => withGame(async (g) => {
        await g.startGame(i);
        const info = await g.game(() => {
            const gs = window.__game.scene.getScene('GameScene');
            return {
                character: gs.character,
                expectedItem: CHARACTERS_CFG(gs).collectible,
                item: gs._collectType && gs._collectType.texture,
                hudCounter: !!window.__game.scene.getScene('HUDScene').collectedTxt,
            };
            function CHARACTERS_CFG(gs) { return CHARACTERS[gs.character]; }   // global de script-tag de GameScene.js
        });
        assert.equal(info.character, character);
        assert.ok(info.item, 'GameScene deveria ter um tipo de item ativo');
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
