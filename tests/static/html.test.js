// index.html: scripts existentes, todos carregados e cache-bust (?v=AAAAMMDD) em dia.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, indexScripts, gameJsFiles } = require('../lib/project');

const local = () => indexScripts().filter(s => !s.external);
// vendor/ já leva a versão no nome do arquivo (phaser-3.60.0.min.js); o ?v=AAAAMMDD vale para os scripts do jogo
const gameScripts = () => local().filter(s => !s.src.startsWith('vendor/'));

test('todo <script src> local do index.html existe', () => {
    const missing = local().filter(s => !fs.existsSync(path.join(ROOT, s.src))).map(s => s.src);
    assert.deepEqual(missing, [], `scripts do index.html que não existem: ${missing.join(', ')}`);
});

test('todo .js do jogo é carregado pelo index.html', () => {
    const loaded = new Set(local().map(s => s.src));
    const orphans = gameJsFiles().filter(f => !loaded.has(f));
    assert.deepEqual(orphans, [], `arquivos .js que o index.html não carrega: ${orphans.join(', ')}`);
});

test('todo script local tem cache-bust no formato ?v=AAAAMMDD', () => {
    const bad = gameScripts().filter(s => !s.version).map(s => s.raw);
    assert.deepEqual(bad, [], `scripts sem ?v=AAAAMMDD: ${bad.join(', ')}`);
});

// Cache-bust em dia: o ?v= de um script não pode ser mais antigo que a última alteração dele.
// (Compara com a data do último commit que tocou o arquivo, ou com hoje se há alteração não commitada.)
// Tolerância de 1 dia por causa de fuso horário. Precisa do histórico git completo (fetch-depth: 0 no CI).
test('cache-bust do index.html acompanha a última alteração de cada script', (t) => {
    const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
    let isRepo = true;
    try { git(['rev-parse', '--git-dir']); } catch { isRepo = false; }
    if (!isRepo) return t.skip('sem repositório git');
    if (git(['rev-parse', '--is-shallow-repository']) === 'true') return t.skip('clone raso: datas de commit não confiáveis');

    const dirty = new Set(git(['status', '--porcelain']).split('\n').filter(Boolean).map(l => l.slice(3).trim()));
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const toTime = (yyyymmdd) => Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8));

    const stale = [];
    for (const s of gameScripts()) {
        if (!s.version || !fs.existsSync(path.join(ROOT, s.src))) continue;
        const last = dirty.has(s.src) ? today
            : git(['log', '-1', '--format=%cd', '--date=format:%Y%m%d', '--', s.src]) || null;
        if (!last) continue;                                    // arquivo novo ainda sem commit
        if (toTime(s.version) < toTime(last) - 24 * 3600 * 1000) {
            stale.push(`${s.src}: ?v=${s.version}, mas foi alterado em ${last}`);
        }
    }
    assert.deepEqual(stale, [], `atualize o ?v= no index.html:\n  ${stale.join('\n  ')}`);
});
