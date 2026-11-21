// Recorde persistido em localStorage. O armazenamento pode falhar (Safari em modo privado, cookies
// bloqueados, cota cheia): nesse caso o recorde vale só para a sessão, em memória, e o jogo segue.
window.HighScore = (function () {
    const KEY = 'sumanzada-highscore';
    let memory = 0;

    function readStored() {
        try {
            const v = parseInt(localStorage.getItem(KEY) || '0', 10);
            return Number.isFinite(v) && v > 0 ? v : 0;   // lixo no storage vira 0 em vez de NaN
        } catch {
            return 0;   // storage indisponível: vale o que está em memória
        }
    }

    function store(score) {
        memory = score;
        try {
            localStorage.setItem(KEY, String(score));
        } catch {
            // Sem persistência: o recorde fica só em memória nesta sessão
        }
    }

    return {
        get() {
            return Math.max(readStored(), memory);
        },
        // Salva se for maior que o recorde atual. Retorna true se for novo recorde.
        check(score) {
            if (Number.isFinite(score) && score > this.get()) {
                store(score);
                return true;
            }
            return false;
        },
    };
})();
