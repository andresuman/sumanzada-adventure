// Leitura de PNG em RGBA para os testes de sprite (pngjs é a única dependência).
const fs = require('fs');
const { PNG } = require('pngjs');

function loadPng(file) {
    const png = PNG.sync.read(fs.readFileSync(file));
    return {
        w: png.width,
        h: png.height,
        // Pixel [r,g,b,a] na posição (x,y)
        px(x, y) { const i = (y * png.width + x) * 4; return [png.data[i], png.data[i+1], png.data[i+2], png.data[i+3]]; },
    };
}

module.exports = { loadPng };
