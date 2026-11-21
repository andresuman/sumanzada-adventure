class GameOverScene extends ResultScene {
    constructor() { super({ key: 'GameOverScene' }); }

    getLook() {
        return {
            overlay: 0x001030,
            title: 'FIM DE JOGO', titleColor: '#ff4444',
            subtitle: 'Você não chegou à água desta vez...', subtitleColor: '#ff8844',
        };
    }
}
