class WinScene extends ResultScene {
    constructor() { super({ key: 'WinScene' }); }

    getLook() {
        return {
            overlay: 0x002210,
            title: 'VOCÊ VENCEU!', titleColor: '#aaff44',
            subtitle: 'Você chegou à água!', subtitleColor: '#ffe040',
        };
    }
}
