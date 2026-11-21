// Phaser copiado para vendor/: sem CDN, e o arquivo é exatamente o que a tabela de vendor/README.md declara.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ROOT, read, indexScripts } = require('../lib/project');

const phaserScript = () => indexScripts().filter(s => /^vendor\/phaser-[\d.]+\.min\.js$/.test(s.src));

test('o jogo não carrega nenhum script de terceiros por rede (CDN)', () => {
    const external = indexScripts().filter(s => s.external).map(s => s.raw);
    assert.deepEqual(external, [], `scripts externos no index.html: ${external.join(', ')}`);
});

test('o index.html carrega exatamente um Phaser local', () => {
    assert.equal(phaserScript().length, 1, 'esperava um <script src="vendor/phaser-X.Y.Z.min.js">');
});

test('versão no nome do arquivo = versão embutida no Phaser', () => {
    const [{ src }] = phaserScript();
    const version = /phaser-([\d.]+)\.min\.js$/.exec(src)[1];
    const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
    assert.ok(code.includes(`VERSION:"${version}"`), `${src} não contém VERSION:"${version}"`);
});

test('o hash do Phaser confere com vendor/README.md (arquivo não foi editado à mão)', () => {
    const [{ src }] = phaserScript();
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, src))).digest('hex');
    const readme = read('vendor/README.md');
    assert.ok(readme.includes(sha), `o SHA-256 de ${src} (${sha}) não está em vendor/README.md: atualize a tabela`);
    assert.ok(fs.existsSync(path.join(ROOT, 'vendor/PHASER-LICENSE.md')), 'falta vendor/PHASER-LICENSE.md');
});
