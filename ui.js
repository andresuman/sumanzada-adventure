// Utilidades de interface compartilhadas pelas cenas.
const UI = {
    // Crédito do rodapé, igual em todas as telas
    CREDIT: 'Desenvolvido por Andre Suman  |  @andresuman',

    // Devolve txt(x, y, texto, estilo): texto centralizado em monospace, nítido em telas de alta densidade
    textFactory(scene) {
        return (x, y, str, style) =>
            scene.add.text(x, y, str, { fontFamily: 'monospace', resolution: 3, ...style })
                .setOrigin(0.5);
    },

    addCredit(scene) {
        UI.textFactory(scene)(scene.scale.width / 2, 252, UI.CREDIT, {
            fontSize: '11px',
            color: '#cccccc',
            stroke: '#000000',
            strokeThickness: 3,
        });
    },
};
