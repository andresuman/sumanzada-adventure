// Utilitários comuns: caminhos do projeto, leitura do index.html e carregamento de scripts "de navegador" em vm.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// <script src="caminho?v=AAAAMMDD"> do index.html, na ordem em que aparecem
function indexScripts() {
    const html = read('index.html');
    return [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => {
        const [src, query] = m[1].split('?');
        const v = query && /^v=(\d{8})$/.exec(query);
        return { raw: m[1], src, external: /^https?:/.test(src), version: v ? v[1] : null };
    });
}

// Todos os .js do jogo (fora de tests/, node_modules/ e pastas ocultas)
function gameJsFiles(dir = '') {
    const abs = path.join(ROOT, dir);
    return fs.readdirSync(abs, { withFileTypes: true }).flatMap(e => {
        if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'tests') return [];
        const rel = path.posix.join(dir, e.name);
        if (e.isDirectory()) return gameJsFiles(rel);
        return e.name.endsWith('.js') ? [rel] : [];
    });
}

// Executa arquivos de script clássicos (consts globais viram globais do contexto) num contexto isolado.
// Phaser é falso: basta `Phaser.Scene` existir para as classes das cenas serem declaradas.
function loadScripts(files, extra = {}) {
    const window = {};
    const ctx = vm.createContext({
        window, console,
        Phaser: { Scene: class {}, Math: {}, Utils: { Array: {} } },
        localStorage: extra.localStorage,
        ...extra,
    });
    for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
    return { ctx, window, get: (expr) => vm.runInContext(expr, ctx) };
}

module.exports = { ROOT, read, indexScripts, gameJsFiles, loadScripts };
