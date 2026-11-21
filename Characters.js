// Fonte única dos personagens jogáveis. BootScene, GameScene e CharacterSelectScene leem daqui,
// então um personagem novo é uma linha nesta lista (mais os PNGs em assets/).
//
//   key          prefixo dos arquivos: assets/<key>_idle.png e assets/<key>_walk1..4.png
//   name         nome mostrado no card (as chaves são anteriores aos nomes atuais e não foram renomeadas)
//   collectible  tipo do item que o personagem coleta (chave de COLLECTIBLE_TYPES em Collectibles.js)
//
// A ordem da lista é a ordem dos cards; o primeiro é o padrão.
const CHARACTERS = [
    { key: 'andre',   name: 'DEDÉ',    collectible: 'accordion' },
    { key: 'thais',   name: 'TATÁ',    collectible: 'shoe' },
    { key: 'rafinha', name: 'RAFINHA', collectible: 'conniff' },
    { key: 'marcela', name: 'PITU',    collectible: 'kitty' },
    { key: 'marilia', name: 'PITCHA',  collectible: 'yarn' },
    { key: 'solange', name: 'GÊ',      collectible: 'spade' },
    { key: 'texaco',  name: 'CACO',    collectible: 'ball' }
];

const WALK_FRAMES = 4;

// Personagem pela chave; se a chave for desconhecida (ou vazia) cai no primeiro da lista
function characterById(key) {
    return CHARACTERS.find(c => c.key === key) || CHARACTERS[0];
}

// Nomes das texturas e das animações de um personagem (criadas em BootScene)
function characterTextures(key) {
    return {
        idle: `${key}_idle`,
        walk: Array.from({ length: WALK_FRAMES }, (_, i) => `${key}_walk${i + 1}`),
        idleAnim: `${key}-idle`,
        walkAnim: `${key}-walk`,
    };
}
