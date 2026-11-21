// Verificações dos PNGs: defeitos de recorte nos sprites e consistência entre assets e código.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, read } = require('../lib/project');
const { loadPng } = require('../lib/png');
const { semiTransparentCount, enclosedHoles, opaqueGapStrips } = require('../lib/sprites');

const ASSETS = path.join(ROOT, 'assets');
const pngs = fs.readdirSync(ASSETS).filter(f => f.endsWith('.png')).sort();
// Personagens descobertos pelos arquivos (<nome>_idle.png): um novo personagem entra nos testes sozinho
const characters = pngs.filter(f => f.endsWith('_idle.png')).map(f => f.replace('_idle.png', ''));
const characterPngs = pngs.filter(f => characters.some(c => f.startsWith(c + '_')));
const MAX_FACE_HOLE_PX = 40;
const BASELINE_FILE = path.join(__dirname, 'sprite-baseline.json');

// ── Assets × código ─────────────────────────────────────────────────────────
// Arquivos que o código referencia: load.image(...) do BootScene e `image:` de Collectibles.js
function referencedAssets() {
    // Remove comentários de linha: exemplos como 'assets/arquivo.png' não são referências reais
    const code = (read('scenes/BootScene.js') + '\n' + read('Collectibles.js')).replace(/\/\/.*$/gm, '');
    return new Set([...code.matchAll(/['"](assets\/[^'"]+)['"]/g)].map(m => m[1]));
}

test('todo asset referenciado no código existe', () => {
    const missing = [...referencedAssets()].filter(rel => !fs.existsSync(path.join(ROOT, rel)));
    assert.deepEqual(missing, [], `arquivos referenciados que não existem: ${missing.join(', ')}`);
});

test('todo PNG de assets/ é usado pelo código', () => {
    const used = referencedAssets();
    const unused = pngs.filter(f => !used.has('assets/' + f));
    assert.deepEqual(unused, [], `PNGs sem uso (apague ou referencie): ${unused.join(', ')}`);
});

// ── Defeitos de recorte ─────────────────────────────────────────────────────
test('sprites não têm pixels semitransparentes (pixel art usa só alpha 0 ou 255)', () => {
    const bad = pngs.map(f => [f, semiTransparentCount(loadPng(path.join(ASSETS, f)))]).filter(([, n]) => n > 0);
    assert.deepEqual(bad, [], `PNGs com alpha parcial: ${bad.map(([f, n]) => `${f} (${n}px)`).join(', ')}`);
});

test('rosto dos personagens não tem buracos transparentes (olhos, dentes, bochecha)', () => {
    const problems = [];
    for (const f of characterPngs) {
        const img = loadPng(path.join(ASSETS, f));
        const faceLimit = img.h * 0.35;   // o rosto fica no terço superior do sprite
        for (const h of enclosedHoles(img)) {
            // Buracos de poucos pixels são recorte furado (olho, dente, bochecha). Os grandes são
            // espaço de propósito (ex.: entre o rabo de cavalo e o pescoço) e não entram aqui.
            if (h.y0 < faceLimit && h.n <= MAX_FACE_HOLE_PX) problems.push(`${f}: buraco de ${h.n}px em x${h.x0}-${h.x1}, y${h.y0}-${h.y1}`);
        }
    }
    assert.deepEqual(problems, []);
});

test('todos os frames de um personagem têm a mesma altura', () => {
    for (const c of characters) {
        const heights = new Set(characterPngs.filter(f => f.startsWith(c + '_')).map(f => loadPng(path.join(ASSETS, f)).h));
        assert.equal(heights.size, 1, `${c}: alturas diferentes entre frames: ${[...heights].join(', ')}`);
    }
});

// Faixas opacas entre dois contornos pretos (vão braço/corpo que deveria ser transparente).
// O André deve estar totalmente limpo. Thais e Rafinha têm faixas ainda NÃO REVISADAS (podem ser
// arte legítima, como o carrinho do Rafinha); elas ficam na linha de base para que qualquer
// faixa NOVA falhe. Para regravar a linha de base: UPDATE_BASELINE=1 npm test
test('sprites não têm faixas opacas novas entre contornos pretos (vão braço/corpo)', () => {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).strips;
    const current = {};
    for (const f of characterPngs) {
        const strips = opaqueGapStrips(loadPng(path.join(ASSETS, f)));
        if (strips.length) current[f] = strips.map(s => `x${s.x0}-${s.x1},y${s.y0}-${s.y1}`);
    }
    if (process.env.UPDATE_BASELINE) {
        fs.writeFileSync(BASELINE_FILE, JSON.stringify({ strips: current }, null, 2) + '\n');
        return;
    }
    const added = [], stale = [];
    for (const f of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
        const cur = current[f] || [], base = baseline[f] || [];
        cur.filter(s => !base.includes(s)).forEach(s => added.push(`${f}: ${s}`));
        base.filter(s => !cur.includes(s)).forEach(s => stale.push(`${f}: ${s}`));
    }
    assert.deepEqual(added, [], `faixas opacas novas (vão que deveria ser transparente?):\n  ${added.join('\n  ')}`);
    assert.deepEqual(stale, [], `faixas da linha de base que já não existem (rode UPDATE_BASELINE=1 npm test):\n  ${stale.join('\n  ')}`);
});
