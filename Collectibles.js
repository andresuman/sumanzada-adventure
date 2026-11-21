// Catálogo de itens coletáveis e layout deles na fase.
//
// Para o personagem coletar outra coisa, basta:
//   1. adicionar um tipo em COLLECTIBLE_TYPES (desenhado por código via `draw`,
//      ou uma imagem via `image`);
//   2. apontar para ele em `collectible` na entrada do personagem em CHARACTERS (GameScene.js).
// O layout (onde ficam os grupos) é o mesmo para todos os personagens.

const COLLECTIBLE_TYPES = {
    coin: {
        texture: 'item_coin',   // chave da textura no Phaser
        size:    16,            // lado (px) da textura gerada por `draw`
        scale:   1,             // escala do sprite no cenário
        value:   50,            // pontos por item
        groupBonus: 100,        // bônus ao pegar todos os itens de um grupo
        color:   '#ffdd00',     // cor do texto flutuante (+50)
        spin:    true,          // efeito de giro (achata e abre a largura)
        // Arpejo curto; cada nota é [frequência Hz, atraso em s]
        sfx: { wave: 'square', gain: 0.13, notes: [[988, 0], [1319, 0.07]] },
        // Desenha a textura sem precisar de PNG. Para usar imagem no lugar,
        // troque `draw` por `image: 'assets/arquivo.png'` (BootScene carrega sob a chave `texture`).
        draw(g, s) {
            const c = s / 2;
            g.fillStyle(0x8a5a00, 1); g.fillCircle(c, c, c);                  // contorno
            g.fillStyle(0xffc933, 1); g.fillCircle(c, c, c - 1.5);            // corpo
            g.fillStyle(0xffe680, 1); g.fillCircle(c - 1.5, c - 1.5, c - 4);  // brilho
            g.fillStyle(0xe0a000, 1); g.fillRect(c - 1, c - 4, 2, 8);         // detalhe central
        },
    },
    accordion: {
        texture: 'item_accordion', // chave da textura no Phaser
        image:   'assets/item_accordion.png', // PNG carregado em BootScene
        scale:   0.25,             // 96px -> 24px no jogo (perto do tamanho da moeda)
        value:   50,               // pontos por item
        groupBonus: 100,           // bônus ao pegar todos os itens de um grupo
        color:   '#ff5555',        // cor do texto flutuante (+50) e do contador no HUD
        spin:    false,            // sanfona não gira como a moeda
        // Arpejo curto; cada nota é [frequência Hz, atraso em s]
        sfx: { wave: 'square', gain: 0.13, notes: [[988, 0], [1319, 0.07]] },
    },
    shoe: {
        texture: 'item_shoe',      // chave da textura no Phaser
        image:   'assets/item_shoe.png', // PNG carregado em BootScene
        scale:   0.25,             // 96px -> 24px no jogo (perto do tamanho da moeda)
        value:   50,               // pontos por item
        groupBonus: 100,           // bônus ao pegar todos os itens de um grupo
        color:   '#aaff00',        // verde volt — cor do texto flutuante e do contador no HUD
        spin:    false,            // tênis não gira como a moeda
        // Arpejo curto; cada nota é [frequência Hz, atraso em s]
        sfx: { wave: 'square', gain: 0.13, notes: [[988, 0], [1319, 0.07]] },
    },
    kitty: {
        texture: 'item_kitty',     // chave da textura no Phaser
        image:   'assets/item_kitty.png', // PNG carregado em BootScene
        scale:   0.25,             // 96px -> 24px no jogo (perto do tamanho da moeda)
        value:   50,               // pontos por item
        groupBonus: 100,           // bônus ao pegar todos os itens de um grupo
        color:   '#ff77aa',        // rosa — cor do texto flutuante e do contador no HUD
        spin:    false,            // cabeça não gira como a moeda
        // Arpejo curto; cada nota é [frequência Hz, atraso em s]
        sfx: { wave: 'square', gain: 0.13, notes: [[988, 0], [1319, 0.07]] },
    },
    yarn: {
        texture: 'item_yarn',      // chave da textura no Phaser
        image:   'assets/item_yarn.png', // PNG carregado em BootScene
        scale:   0.25,             // 96px -> 24px no jogo (perto do tamanho da moeda)
        value:   50,               // pontos por item
        groupBonus: 100,           // bônus ao pegar todos os itens de um grupo
        color:   '#ff7ab8',        // rosa — cor do texto flutuante e do contador no HUD (combina com o novelo)
        spin:    false,            // novelo não gira como a moeda
        // Arpejo curto; cada nota é [frequência Hz, atraso em s]
        sfx: { wave: 'square', gain: 0.13, notes: [[988, 0], [1319, 0.07]] },
    },
    conniff: {
        texture: 'item_rayconniff', // chave da textura no Phaser
        image:   'assets/item_rayconniff.png', // PNG carregado em BootScene
        scale:   0.25,             // 96px -> 24px no jogo (perto do tamanho da moeda)
        value:   50,               // pontos por item
        groupBonus: 100,           // bônus ao pegar todos os itens de um grupo
        color:   '#66aaff',        // azul — cor do texto flutuante e do contador no HUD
        spin:    false,            // rosto não gira como a moeda
        // Arpejo curto; cada nota é [frequência Hz, atraso em s]
        sfx: { wave: 'square', gain: 0.13, notes: [[988, 0], [1319, 0.07]] },
    },
};

// Grupos de itens ao longo da fase (x em px do mundo).
// shape: 'arc' (sobe e desce, pico em `peak`) ou 'line' (altura fixa `h`).
// Alturas são medidas a partir do chão: o corpo do personagem em pé chega a ~68px e o
// pulo a ~138px, então itens acima de ~90px só são pegos pulando.
const COLLECTIBLE_LAYOUT = [
    { x:  420, shape: 'arc',  count: 5 },
    { x:  780, shape: 'line', count: 4, h: 115 },
    { x: 1140, shape: 'arc',  count: 5 },
    { x: 1500, shape: 'arc',  count: 6 },
    { x: 1860, shape: 'line', count: 5, h: 120 },
    { x: 2200, shape: 'arc',  count: 5 },
    { x: 2540, shape: 'arc',  count: 4 },
    { x: 2780, shape: 'line', count: 3, h: 110 },
];

// Converte um grupo do layout em posições {x, y} (y em coordenadas do mundo).
function collectibleLayoutPoints(group, groundY) {
    const SPACING = 26, BASE_H = 95, PEAK = 45;
    const n = group.count, mid = (n - 1) / 2, pts = [];
    for (let i = 0; i < n; i++) {
        const x = group.x + (i - mid) * SPACING;
        let h;
        if (group.shape === 'line') {
            h = group.h || 110;
        } else {
            const t = mid === 0 ? 0 : (i - mid) / mid;      // -1 .. 1
            h = BASE_H + PEAK * (1 - t * t);                // extremos baixos, centro alto
        }
        pts.push({ x, y: groundY - h });
    }
    return pts;
}
