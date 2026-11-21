// Abre o jogo no Chromium (Playwright) coletando qualquer erro de página, console ou rede.
const fs = require('fs');
const path = require('path');
const { startServer } = require('./server');

// O Phaser vem do CDN no index.html. Nos testes usamos uma cópia local (PHASER_FILE ou a do npm)
// para não depender de rede; sem nenhuma das duas, o CDN real é usado.
function phaserFile() {
    if (process.env.PHASER_FILE) return process.env.PHASER_FILE;
    const npm = path.join(__dirname, '..', 'node_modules', 'phaser', 'dist', 'phaser.min.js');
    return fs.existsSync(npm) ? npm : null;
}

async function openGame({ storage } = {}) {
    const { chromium } = require('playwright');
    const server = await startServer();
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const local = phaserFile();
    if (local) await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ path: local, contentType: 'application/javascript' }));

    const errors = [];
    page.on('pageerror', e => errors.push(`erro de página: ${e.message}`));
    // Avisos de GPU do Chromium sem placa de vídeo não são problema do jogo
    page.on('console', m => { if (m.type() === 'error' && !/GPU|WebGL/i.test(m.text())) errors.push(`console.error: ${m.text()}`); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
    page.on('requestfailed', r => errors.push(`requisição falhou: ${r.url()}`));

    await page.goto(server.url);
    // Espera o jogo iniciar a primeira cena
    await page.waitForFunction(() => window.__game && window.__game.scene.isActive('TitleScene'), null, { timeout: 15000 });

    return {
        page, errors, server,
        // Cenas ativas no momento
        scenes: () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key)),
        waitScene: (key, timeout = 10000) => page.waitForFunction(k => window.__game.scene.isActive(k), key, { timeout }),
        // Título → seleção → jogo, escolhendo o personagem pelo índice (0 = primeiro card)
        async startGame(characterIndex = 0) {
            await page.keyboard.press('Space');
            // isActive fica verdadeiro antes do create(): espera os cards existirem para os atalhos já estarem ligados
            await page.waitForFunction(() => {
                const s = window.__game.scene.getScene('CharacterSelectScene');
                return window.__game.scene.isActive('CharacterSelectScene') && s._cards && s._cards.length > 0;
            }, null, { timeout: 10000 });
            for (let i = 0; i < characterIndex; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60); }
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.isActive('HUDScene'), null, { timeout: 10000 });
        },
        game: (fn, arg) => page.evaluate(fn, arg),
        async close() { await browser.close(); await server.close(); },
    };
}

module.exports = { openGame };
