// Garante que nada do jogo antigo (o de outra personagem histórica, com fases e perguntas) volte ao projeto.
// O histórico do git não conta: o teste olha só os arquivos rastreados hoje.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('../lib/project');

const FORBIDDEN = [/\bmarie\b/i, /\bcurie\b/i, /\bquiz\b/i, /thermas/i, /lindoya/i, /\b1926\b/, /nobel/i, /pergunta/i];
const BINARY = /\.(png|jpe?g|gif|ico)$/i;
// Este próprio arquivo cita os termos; vendor/ é código de terceiros; o lockfile é gerado
const SKIP = new Set(['tests/static/legacy.test.js', 'tests/package-lock.json']);

function trackedFiles() {
    return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
}

test('nenhum arquivo ou conteúdo rastreado menciona o jogo antigo', (t) => {
    let files;
    try { files = trackedFiles(); } catch { return t.skip('sem repositório git'); }
    const hits = [];
    for (const f of files) {
        if (SKIP.has(f) || f.startsWith('vendor/')) continue;
        FORBIDDEN.forEach(re => { if (re.test(f)) hits.push(`${f} (nome do arquivo: ${re})`); });
        if (BINARY.test(f)) continue;
        const abs = path.join(ROOT, f);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;   // links e pastas não têm conteúdo a ler
        fs.readFileSync(abs, 'utf8').split('\n').forEach((line, i) => {
            FORBIDDEN.forEach(re => { if (re.test(line)) hits.push(`${f}:${i + 1}  ${re}  →  ${line.trim().slice(0, 90)}`); });
        });
    }
    assert.deepEqual(hits, [], `menções ao jogo antigo:\n  ${hits.join('\n  ')}`);
});
