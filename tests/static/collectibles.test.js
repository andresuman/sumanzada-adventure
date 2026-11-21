// Itens coletáveis: catálogo consistente e posições alcançáveis só pulando.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadScripts } = require('../lib/project');

const g = loadScripts(['Collectibles.js', 'scenes/GameScene.js']);
const types = g.get('COLLECTIBLE_TYPES');
const layout = g.get('COLLECTIBLE_LAYOUT');
const characters = g.get('CHARACTERS');
const GROUND_Y = g.get('GROUND_Y'), JUMP_VY = g.get('JUMP_VY'), LEVEL_WIDTH = g.get('LEVEL_WIDTH');
const GRAVITY = 700;   // game.js: physics.arcade.gravity.y

test('todo personagem aponta para um tipo de item que existe', () => {
    for (const [name, cfg] of Object.entries(characters)) {
        assert.ok(types[cfg.collectible], `${name}: collectible "${cfg.collectible}" não existe em COLLECTIBLE_TYPES`);
    }
});

test('todo tipo de item tem textura, valor e uma forma de desenhar (draw ou image)', () => {
    for (const [name, t] of Object.entries(types)) {
        assert.ok(t.texture, `${name}: falta texture`);
        assert.ok(t.value > 0, `${name}: value deve ser > 0`);
        assert.ok(typeof t.draw === 'function' || t.image, `${name}: precisa de draw ou image`);
        if (t.image) assert.ok(fs.existsSync(path.join(ROOT, t.image)), `${name}: ${t.image} não existe`);
        assert.ok(t.sfx && t.sfx.notes && t.sfx.notes.length, `${name}: falta sfx.notes`);
    }
});

test('texturas dos tipos de item não colidem entre si', () => {
    const keys = Object.values(types).map(t => t.texture);
    assert.equal(new Set(keys).size, keys.length);
});

test('os grupos ficam dentro da fase e antes da garrafa', () => {
    const points = layout.flatMap(grp => g.get(`collectibleLayoutPoints(${JSON.stringify(grp)}, ${GROUND_Y})`));
    assert.ok(points.length > 0);
    for (const p of points) assert.ok(p.x > 0 && p.x < LEVEL_WIDTH - 100, `item fora da fase em x=${p.x}`);
});

// O corpo em pé chega a ~68 px (frame 302 px × PLAYER_SCALE 0.28 × 0.80) e o pulo a v²/(2g).
// Itens com a base abaixo do topo do corpo seriam coletados só de andar.
test('itens só são alcançáveis pulando (acima do corpo em pé e abaixo do pico do pulo)', () => {
    const itemRadius = 8;
    const bodyTop = 302 * g.get('PLAYER_SCALE') * 0.80;
    const apex = (JUMP_VY * JUMP_VY) / (2 * GRAVITY);
    const heights = layout.flatMap(grp => g.get(`collectibleLayoutPoints(${JSON.stringify(grp)}, ${GROUND_Y})`))
        .map(p => GROUND_Y - p.y);
    assert.ok(Math.min(...heights) - itemRadius > bodyTop, `item muito baixo (${Math.min(...heights)}px): dá para pegar andando (corpo em pé ≈ ${bodyTop.toFixed(0)}px)`);
    assert.ok(Math.max(...heights) < apex + bodyTop, `item muito alto (${Math.max(...heights)}px): fora do alcance do pulo (pico ${apex.toFixed(0)}px)`);
});
