// Detectores de defeitos típicos de sprites recortados de um fundo (remoção de fundo imperfeita).

const isOpaque = (p) => p[3] > 0;
// Contorno preto dos sprites; o limite foi calibrado nos sprites atuais.
const isBlack  = (p) => p[3] > 0 && p[0] < 45 && p[1] < 45 && p[2] < 45;

// Pixels com alpha parcial (o jogo usa pixel art: só 0 ou 255).
function semiTransparentCount(img) {
    let n = 0;
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
        const a = img.px(x, y)[3];
        if (a > 0 && a < 255) n++;
    }
    return n;
}

// Regiões transparentes que não tocam a borda da imagem (buracos dentro do desenho).
// Retorna [{ n, x0, x1, y0, y1 }].
function enclosedHoles(img) {
    const { w, h } = img;
    const transparent = (x, y) => img.px(x, y)[3] === 0;
    const outside = new Uint8Array(w * h);
    const stack = [];
    const push = (x, y) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const i = y * w + x;
        if (outside[i] || !transparent(x, y)) return;
        outside[i] = 1; stack.push([x, y]);
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
        const [x, y] = stack.pop();
        push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
    const seen = new Uint8Array(w * h);
    const holes = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!transparent(x, y) || outside[i] || seen[i]) continue;
        let n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
        const st = [[x, y]]; seen[i] = 1;
        while (st.length) {
            const [cx, cy] = st.pop(); n++;
            x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const j = ny * w + nx;
                if (seen[j] || outside[j] || !transparent(nx, ny)) continue;
                seen[j] = 1; st.push([nx, ny]);
            }
        }
        holes.push({ n, x0, x1, y0, y1 });
    }
    return holes;
}

// Faixas verticais de pixels opacos (não pretos) de 1 a `maxWidth` px de largura entre dois
// contornos pretos, com pelo menos `minRows` linhas seguidas. É o vão entre braço e corpo
// que deveria ser transparente. Dedos e detalhes de camisa são curtos e ficam abaixo de minRows.
// Retorna [{ x0, x1, y0, y1, rows }].
function opaqueGapStrips(img, { maxWidth = 8, minRows = 12, minBlackRun = 3 } = {}) {
    const rowsGaps = [];   // por linha: [{x0,x1}]
    for (let y = 0; y < img.h; y++) {
        const runs = [];
        let x = 0;
        while (x < img.w) {
            if (isBlack(img.px(x, y))) {
                let j = x;
                while (j + 1 < img.w && isBlack(img.px(j + 1, y))) j++;
                runs.push([x, j]); x = j + 1;
            } else x++;
        }
        const gaps = [];
        for (let k = 0; k + 1 < runs.length; k++) {
            const [s0, e0] = runs[k], [s1, e1] = runs[k + 1];
            const g0 = e0 + 1, g1 = s1 - 1, width = g1 - g0 + 1;
            if (e0 - s0 + 1 < minBlackRun || e1 - s1 + 1 < minBlackRun) continue;
            if (width < 1 || width > maxWidth) continue;
            let anyOpaque = false;
            for (let xx = g0; xx <= g1; xx++) if (isOpaque(img.px(xx, y))) { anyOpaque = true; break; }
            if (anyOpaque) gaps.push({ x0: g0, x1: g1 });
        }
        rowsGaps.push(gaps);
    }
    // Junta linhas consecutivas cujos vãos se sobrepõem em x
    const strips = [];
    let open = [];
    for (let y = 0; y < img.h; y++) {
        const next = [];
        for (const g of rowsGaps[y]) {
            const prev = open.find(s => s.y1 === y - 1 && g.x0 <= s.x1 && g.x1 >= s.x0);
            if (prev) { prev.y1 = y; prev.x0 = Math.min(prev.x0, g.x0); prev.x1 = Math.max(prev.x1, g.x1); prev.rows++; next.push(prev); }
            else { const s = { x0: g.x0, x1: g.x1, y0: y, y1: y, rows: 1 }; strips.push(s); next.push(s); }
        }
        open = next;
    }
    return strips.filter(s => s.rows >= minRows);
}

module.exports = { semiTransparentCount, enclosedHoles, opaqueGapStrips };
