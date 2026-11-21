// localStorage é compartilhado por origem (andresuman.github.io): chaves próprias evitam misturar jogos.
const test = require('node:test');
const assert = require('node:assert/strict');
const { read, gameJsFiles } = require('../lib/project');

test('toda chave de localStorage tem o prefixo "sumanzada-"', () => {
    const bad = [];
    for (const f of gameJsFiles()) {
        const code = read(f);
        for (const m of code.matchAll(/(?:const|let|var)\s+KEY\s*=\s*['"]([^'"]+)['"]/g)) {
            if (!m[1].startsWith('sumanzada-')) bad.push(`${f}: ${m[1]}`);
        }
        for (const m of code.matchAll(/localStorage\.\w+Item\(\s*['"]([^'"]+)['"]/g)) {
            if (!m[1].startsWith('sumanzada-')) bad.push(`${f}: ${m[1]}`);
        }
    }
    assert.deepEqual(bad, [], `chaves sem prefixo: ${bad.join(', ')}`);
});

test('HighScore: recorde novo, igual e menor', () => {
    const store = new Map();
    const localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
    const { window } = loadHighScore(localStorage);
    assert.equal(window.HighScore.get(), 0);
    assert.equal(window.HighScore.check(100), true);
    assert.equal(window.HighScore.check(100), false);   // igual não é recorde
    assert.equal(window.HighScore.check(50), false);
    assert.equal(window.HighScore.get(), 100);
    assert.equal(window.HighScore.check(101), true);
});

function loadHighScore(localStorage) {
    return require('../lib/project').loadScripts(['HighScore.js'], { localStorage });
}
