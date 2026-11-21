// A documentação precisa acompanhar o código: personagens, itens, arquivos, constantes e a música citada.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { read, gameJsFiles, loadScripts } = require('../lib/project');

const readme = read('README.md');
const claude = read('CLAUDE.md');
const lower = (s) => s.toLowerCase();

const g = loadScripts(['Characters.js', 'Collectibles.js']);
const characters = g.get('CHARACTERS');
const types = g.get('COLLECTIBLE_TYPES');

test('README e CLAUDE.md citam cada personagem pelo nome do jogo', () => {
    for (const c of characters) {
        assert.ok(lower(readme).includes(lower(c.name)), `README não cita o personagem ${c.name}`);
        assert.ok(lower(claude).includes(lower(c.name)), `CLAUDE.md não cita o personagem ${c.name}`);
        assert.ok(claude.includes(`\`${c.key}\``), `CLAUDE.md não lista a chave \`${c.key}\` (mapa chave → nome)`);
    }
});

test('README e CLAUDE.md citam o item de cada personagem', () => {
    for (const c of characters) {
        const { label } = types[c.collectible];
        assert.ok(label, `o tipo ${c.collectible} precisa de label em Collectibles.js`);
        assert.ok(lower(readme).includes(lower(label)), `README não cita o item "${label}" (${c.name})`);
        assert.ok(lower(claude).includes(lower(label)), `CLAUDE.md não cita o item "${label}" (${c.name})`);
    }
});

test('README e CLAUDE.md listam todos os arquivos de código do jogo', () => {
    const files = [...gameJsFiles().filter(f => !f.startsWith('vendor/')), 'eslint.config.mjs'];
    for (const f of files) {
        const name = path.posix.basename(f);
        assert.ok(readme.includes(name), `README não menciona ${name} (árvore "Estrutura")`);
        assert.ok(claude.includes(name), `CLAUDE.md não menciona ${name} (seção "Estrutura de arquivos")`);
    }
});

test('o bloco de constantes do CLAUDE.md cobre todas as constantes de GameScene.js', () => {
    const names = [...read('scenes/GameScene.js').matchAll(/^const ([A-Z][A-Z0-9_]+)\s*=/gm)].map(m => m[1]);
    assert.ok(names.length > 10);
    const missing = names.filter(n => !claude.includes(n));
    assert.deepEqual(missing, [], `constantes ausentes do CLAUDE.md: ${missing.join(', ')}`);
});

test('os documentos descrevem a música que realmente toca (cabeçalho de GameTheme.js)', () => {
    const header = read('audio/GameTheme.js').split('\n').slice(0, 6).join('\n');
    const original = /original/i.test(header);
    for (const [name, text] of [['README', readme], ['CLAUDE.md', claude]]) {
        if (original) {
            assert.ok(!/Zequinha|Tardes em Lind/i.test(text), `${name} credita uma obra de terceiros, mas o tema é original`);
            assert.ok(text.includes('Fá maior'), `${name} deveria descrever o tema (valsa em Fá maior)`);
        } else {
            assert.ok(/Zequinha/.test(text), `${name} deveria creditar o compositor do tema`);
        }
    }
});
