#!/usr/bin/env python3
"""Converte uma folha de frames (JPEG/PNG gerada por IA) nos PNGs de um personagem.

Resolve o que costuma dar errado com esse tipo de folha:
  * fundo (liso ou em degradê) com ruído de JPEG  -> removido por flood fill a partir das bordas
  * halo claro nas bordas                          -> descascado
  * frames recortados com larguras diferentes      -> o corpo "balança" no jogo; aqui todos os
    frames saem com o MESMO tamanho de canvas, o eixo do corpo no centro e os pés na base
  * sola do sapato cortada pela borda da folha     -> o contorno preto inferior é refeito

Uso (da raiz do repo, precisa de Pillow e numpy):
  python3 tools/sheet_to_sprites.py folha.jpg --name marilia --cols 2 --rows 2 \\
      --idle-from 3 --out assets --preview /tmp/preview.png

Saída: assets/<name>_walk1..N.png e assets/<name>_idle.png (alpha só 0 ou 255).
A ordem dos frames é a de leitura (esquerda->direita, cima->baixo).
Para uma pose parada vinda de outra imagem, use --idle-image (se já tiver fundo transparente é usada como está).
Dependências só do desenvolvimento: o jogo continua sem build e sem npm/pip.
"""
import argparse
import json
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

GREEN = (40, 200, 60, 255)


def find_split(probe, fallback):
    """Posição onde o fundo muda bruscamente (ex.: cinza em cima, branco embaixo); senão, `fallback`.
    `probe` é o brilho médio de uma linha/coluna de referência ao longo do eixo a dividir."""
    diff = np.abs(np.diff(probe.astype(int)))
    i = int(np.argmax(diff))
    return i + 1 if diff[i] >= 6 else fallback


def background_mask(rgb, seed_bottom, tol=60, peel=150):
    """True onde é fundo. Flood fill de 4 vizinhos a partir das bordas."""
    h, w, _ = rgb.shape
    edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(int)
    bg = np.median(edge, axis=0)
    dist = np.abs(rgb.astype(int) - bg).sum(axis=2)
    near = dist <= tol
    seen = np.zeros((h, w), bool)
    dq = deque()

    def seed(y, x):
        if near[y, x] and not seen[y, x]:
            seen[y, x] = True
            dq.append((y, x))

    for x in range(w):
        seed(0, x)
        # Borda inferior: se a figura foi cortada aqui, os sapatos encostam nela. Só semeia pixels
        # praticamente iguais ao fundo (o branco/lilás dos sapatos fica de fora), o que limpa o
        # vão entre as pernas sem "vazar" para dentro dos sapatos.
        if seed_bottom or dist[h - 1, x] <= 12:
            seed(h - 1, x)
    for y in range(h):
        seed(y, 0)
        seed(y, w - 1)
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                dq.append((ny, nx))
    # Descasca o halo: pixels de borda ainda claros (longe do preto do contorno) viram fundo
    for _ in range(2):
        pad = np.pad(seen, 1)
        touching = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
        halo = (~seen) & touching & (dist <= peel)
        seen |= halo
    return seen


def largest_component(fg):
    """Mantém só o maior componente conexo (4 vizinhos) da máscara: a personagem, sem respingos do fundo."""
    h, w = fg.shape
    seen = np.zeros_like(fg)
    best = []
    for y in range(h):
        for x in range(w):
            if fg[y, x] and not seen[y, x]:
                st, pts = [(y, x)], []
                seen[y, x] = True
                while st:
                    cy, cx = st.pop()
                    pts.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            st.append((ny, nx))
                if len(pts) > len(best):
                    best = pts
    out = np.zeros_like(fg)
    for y, x in best:
        out[y, x] = True
    return out


def extract_frame(quad, is_bottom_row, outline_px):
    """Recorta a figura de um quadrante. Retorna (RGBA no tamanho original, sola_refeita)."""
    rgb = np.array(quad.filter(ImageFilter.MedianFilter(3)))     # tira o ruído do JPEG
    bg = background_mask(rgb, seed_bottom=not is_bottom_row)
    fg = largest_component(~bg)
    h, w = fg.shape
    rebuilt = False
    if is_bottom_row:
        # A sola encostou na borda da folha e foi cortada: refaz o contorno preto embaixo
        cols = np.nonzero(fg[h - 3:].any(axis=0))[0]
        if len(cols):
            ext = np.zeros((h + outline_px, w, 3), np.uint8)
            ext[:h] = rgb
            fgx = np.zeros((h + outline_px, w), bool)
            fgx[:h] = fg
            for x in cols:
                last = np.nonzero(fg[:, x])[0].max()
                if last >= h - 3:
                    fgx[last + 1:last + 1 + outline_px, x] = True
                    ext[last + 1:last + 1 + outline_px, x] = (15, 15, 15)
            rgb, fg, rebuilt = ext, fgx, True
    rgba = np.dstack([rgb, np.where(fg, 255, 0).astype(np.uint8)])
    ys, xs = np.nonzero(fg)
    return Image.fromarray(rgba, 'RGBA').crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)), rebuilt


def body_anchor_x(img):
    """Eixo horizontal do corpo = centro de massa dos pixels opacos entre 12% e 88% da altura.

    Foi o critério que menos deixa o personagem "balançar" ao animar (cabeça, tronco e massa total
    ficam a ~1–2 px entre os frames). Só o balanço natural da saia/braços varia. Não depende da cor
    da roupa, então vale para qualquer personagem.
    """
    a = np.array(img)[..., 3] > 0
    h = a.shape[0]
    ys, xs = np.nonzero(a[int(h * 0.12):int(h * 0.88)])
    return float(xs.mean())


def clear_gap_strips(img, max_width=8, min_rows=12, min_black_run=3):
    """Torna transparentes as faixas verticais de 1–8 px de pixels CLAROS entre dois contornos pretos
    (≥ min_rows linhas seguidas): é o vão entre braço e corpo que sobrou opaco (restos do fundo/pele).
    Cabelo escuro e sombras são ignorados. Mesmo critério do teste tests/lib/sprites.js."""
    a = np.array(img)
    h, w, _ = a.shape
    black = (a[..., 3] > 0) & (a[..., :3].max(axis=2) < 45)
    light = (a[..., 3] > 0) & (a[..., :3].astype(int).sum(axis=2) > 270)
    rows = []
    for y in range(h):
        gaps, x, runs = [], 0, []
        while x < w:
            if black[y, x]:
                j = x
                while j + 1 < w and black[y, j + 1]:
                    j += 1
                runs.append((x, j)); x = j + 1
            else:
                x += 1
        for (s0, e0), (s1, e1) in zip(runs, runs[1:]):
            g0, g1 = e0 + 1, s1 - 1
            if e0 - s0 + 1 >= min_black_run and e1 - s1 + 1 >= min_black_run and 1 <= g1 - g0 + 1 <= max_width \
                    and light[y, g0:g1 + 1].any():
                gaps.append((g0, g1))
        rows.append(gaps)
    strips, open_ = [], []
    for y in range(h):
        nxt = []
        for g0, g1 in rows[y]:
            prev = next((s for s in open_ if s['y1'] == y - 1 and g0 <= s['x1'] and g1 >= s['x0']), None)
            if prev:
                prev['y1'] = y; prev['x0'] = min(prev['x0'], g0); prev['x1'] = max(prev['x1'], g1); prev['rows'].append((y, g0, g1)); nxt.append(prev)
            else:
                st = {'x0': g0, 'x1': g1, 'y0': y, 'y1': y, 'rows': [(y, g0, g1)]}; strips.append(st); nxt.append(st)
        open_ = nxt
    cleared = 0
    for st in strips:
        if len(st['rows']) < min_rows:
            continue
        for y, g0, g1 in st['rows']:
            for x in range(g0, g1 + 1):
                if a[y, x, 3] > 0 and int(a[y, x, :3].astype(int).sum()) > 270:   # só o claro; preserva o contorno escuro
                    a[y, x] = (0, 0, 0, 0); cleared += 1
    return Image.fromarray(a, 'RGBA'), cleared


def _blobs(mask, min_area=12):
    """Componentes conexos de uma máscara booleana: [(área, x0, x1, y0, y1)]."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not seen[y, x]:
                st, pts = [(y, x)], []
                seen[y, x] = True
                while st:
                    cy, cx = st.pop()
                    pts.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            st.append((ny, nx))
                if len(pts) >= min_area:
                    ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
                    out.append((len(pts), min(xs), max(xs), min(ys), max(ys)))
    return out


def detect_landmarks(img):
    """Pontos de referência de uma figura (RGBA recortada, topo = linha 0), em px da própria imagem:
       eye_y  = linha dos olhos (centro das duas manchas escuras cercadas de pele)
       neck_y = 3 px acima da 1ª linha de roupa (azul, listra vermelha ou branco do colarinho) abaixo do rosto
       hem_y  = última listra vermelha acima dos sapatos (barra da saia)
    Pensado para a roupa com listras vermelhas e vestido azul da Pitcha; para outro personagem passe
    --landmarks com os valores medidos à mão."""
    a = np.array(img).astype(int)
    h, w = a.shape[:2]
    op = a[..., 3] > 0
    skin = op & (a[..., 0] > 190) & (a[..., 1] > 130) & (a[..., 2] > 100) & (a[..., 0] > a[..., 2] + 25)
    dark = op & (a[..., 0] < 95) & (a[..., 1] < 80) & (a[..., 2] < 80)
    band = np.zeros_like(dark)
    lo, hi = int(h * 0.12), int(h * 0.45)
    band[lo:hi] = dark[lo:hi]
    eyes = [c for c in _blobs(band) if (c[4] - c[3]) <= 30
            and skin[(c[3] + c[4]) // 2, :c[1]].any() and skin[(c[3] + c[4]) // 2, c[2] + 1:].any()]
    eyes = sorted(sorted(eyes, key=lambda c: -c[0])[:2], key=lambda c: c[1])
    if len(eyes) != 2:
        raise SystemExit('não achei os 2 olhos; passe --landmarks')
    eye_y = sum((c[3] + c[4]) / 2 for c in eyes) / 2
    red = op & (a[..., 0] > 150) & (a[..., 1] < 95) & (a[..., 2] < 95)
    navy = op & (a[..., 2] > a[..., 0] + 25) & (a[..., 2] > a[..., 1] + 10) & (a[..., 0] < 110)
    white = op & (a[..., :3].min(axis=2) > 200)
    cloth = navy | red | white
    # +34 pula boca e dentes. A roupa (azul/listras do colarinho) começa logo abaixo do pescoço;
    # o corte fica 3 px acima dela para não passar por dentro das listras do colarinho.
    first_cloth = next(r for r in range(int(eye_y) + 34, h) if cloth[r].sum() >= 6)
    reds = [r for r in np.nonzero(red[:int(h * 0.86)].any(axis=1))[0] if r >= int(eye_y) + 34]
    return {'eye_y': float(eye_y), 'neck_y': int(first_cloth - 3), 'hem_y': int(reds[-1])}


def normalize_parts(img, lm, head_target, legs_target, hem_pad=7, hair_ext=30):
    """Refaz a figura em 3 faixas para que cabeça e pernas tenham o mesmo tamanho em todos os frames
    (o tronco fica como está). Frames gerados por IA derivam: a cabeça encolhe e as pernas crescem.
      cabeça = topo do cabelo→pescoço (head_target)   pernas = barra da saia→pés (legs_target)
    (medir só até os olhos faz o queixo crescer nos frames de cabeça pequena e estoura o canvas)
    Camadas empilhadas: pernas, tronco, cabeça (a cabeça fica por cima dos ombros).
    Uns pixels de cabelo logo abaixo do pescoço (ponta do rabo de cavalo) vão junto com a cabeça."""
    a = np.array(img)
    h, w = a.shape[:2]
    neck, hem_cut = lm['neck_y'], lm['hem_y'] + hem_pad
    k_head = head_target / neck          # cabeça = topo do cabelo → pescoço
    legs_i = (h - 1) - lm['hem_y']
    k_legs = (legs_target - hem_pad) / (legs_i - hem_pad)
    cx = body_anchor_x(img)

    # Ponta do rabo de cavalo: pixels escuros (cabelo + contorno) à esquerda do corpo que continuam,
    # sem interrupção, a partir da cabeça para baixo do corte. Só o que está ligado entra (nada de pixels soltos).
    op = a[..., 3] > 0
    navy = op & (a[..., 2] > a[..., 0] + 25) & (a[..., 2] > a[..., 1] + 10) & (a[..., 0] < 110)
    dark = op & ~navy & (a[..., :3].astype(int).sum(axis=2) < 330)
    xlim = int(cx - 22)
    ext = np.zeros((h, w), bool)
    stack = [(neck - 1, x) for x in range(xlim) if dark[neck - 1, x]]
    for y, x in stack:
        ext[y, x] = True
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if neck <= ny < neck + hair_ext and 0 <= nx < xlim and dark[ny, nx] and not ext[ny, nx]:
                ext[ny, nx] = True
                stack.append((ny, nx))
    ext[:neck] = False                    # acima do corte tudo já é cabeça
    head_rows = neck + hair_ext
    head = a.copy(); head[:, :, 3] = 0
    head[:neck] = a[:neck]
    head[ext] = a[ext]
    head = head[:head_rows]
    torso = a.copy(); torso[ext] = (0, 0, 0, 0); torso = torso[neck:hem_cut]
    legs = a[hem_cut:]

    def scaled(layer, k):
        lw, lh = layer.shape[1], layer.shape[0]
        im = Image.fromarray(layer, 'RGBA')
        if abs(k - 1) < 1e-3 or lh == 0:
            return im
        size = (max(1, round(lw * k)), max(1, round(lh * k)))
        return binarize_alpha(im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA'))

    # centro do pescoço (pele na linha do corte) e do quadril (massa do corpo) como âncoras horizontais
    skin_row = np.nonzero(((a[neck - 1, :, 3] > 0) & (a[neck - 1, :, 0] > 190)))[0]
    cx_neck = float(skin_row.mean()) if len(skin_row) else cx
    y_torso = round(neck * k_head)                       # a cabeça tem altura neck*k_head acima do tronco
    total_h = y_torso + (hem_cut - neck) + round(legs.shape[0] * k_legs)
    pad = 80
    canvas = Image.new('RGBA', (w + 2 * pad, total_h), (0, 0, 0, 0))
    lg = scaled(legs, k_legs)
    canvas.alpha_composite(lg, (round(pad + cx * (1 - k_legs)), y_torso + (hem_cut - neck)))
    canvas.alpha_composite(Image.fromarray(torso, 'RGBA'), (pad, y_torso))
    hd = scaled(head, k_head)
    canvas.alpha_composite(hd, (round(pad + cx_neck * (1 - k_head)), 0))
    return canvas.crop(canvas.getbbox())


def binarize_alpha(img):
    """Alpha só 0 ou 255 (pixel art não tem semitransparência): metade para cima vira opaco."""
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return Image.fromarray(a, 'RGBA')


def build_parser():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet')
    ap.add_argument('--name', required=True, help='prefixo dos arquivos (ex.: marilia)')
    ap.add_argument('--cols', type=int, default=2)
    ap.add_argument('--rows', type=int, default=2)
    ap.add_argument('--split-y', type=int, help='linha que separa as fileiras (padrão: detecta pela mudança de fundo)')
    ap.add_argument('--trim-edge', type=int, default=2, help='px descartados nas bordas externas da folha (artefato de borda)')
    ap.add_argument('--inset', type=int, default=3, help='px descartados junto às costuras entre quadrantes')
    ap.add_argument('--height', type=int, default=302, help='altura do canvas e do frame mais alto (igual aos outros personagens)')
    ap.add_argument('--outline-px', type=int, default=6, help='espessura (px da folha) do contorno refeito na sola cortada')
    ap.add_argument('--idle-from', type=int, help='índice (0..N-1) do frame usado como parado (idle) provisório')
    ap.add_argument('--idle-image', help='imagem separada da pose parada. Com fundo transparente é usada como está '
                    '(já na escala do jogo, ver --idle-scale); sem transparência passa pela remoção de fundo e usa a escala dos frames')
    ap.add_argument('--idle-scale', type=float, default=1.0,
                    help='fator aplicado a um --idle-image transparente (1.0 = já está na escala do jogo; confira comparando a largura do rosto)')
    ap.add_argument('--normalize-parts', action='store_true',
                    help='iguala o tamanho da cabeça e das pernas entre os frames (frames de IA derivam); exige --head-target e --legs-target')
    ap.add_argument('--head-target', type=float, help='altura desejada topo do cabelo→pescoço, em px do canvas (ex.: 130)')
    ap.add_argument('--legs-target', type=float, help='altura desejada barra da saia→pés, em px do canvas (ex.: 72)')
    ap.add_argument('--landmarks', help='JSON com {"idle"|"1".."N": {"eye_y","neck_y","hem_y"}} para sobrepor a detecção automática')
    ap.add_argument('--no-clean-gaps', dest='clean_gaps', action='store_false', help='não limpa vãos opacos entre braço e corpo')
    ap.add_argument('--out', default='assets')
    ap.add_argument('--preview', help='grava uma folha de conferência sobre fundo verde')
    return ap


def read_sheet(args):
    """Abre a folha em RGB e descarta o artefato de borda externa (1–2 px de linha cinza/escura)."""
    sheet = Image.open(args.sheet).convert('RGB')
    if args.trim_edge:
        t = args.trim_edge
        sheet = sheet.crop((t, t, sheet.width - t, sheet.height - t))
    return sheet


def grid_lines(sheet, args):
    """Coordenadas (xs, ys) das linhas que dividem a folha em colunas × fileiras."""
    W, H = sheet.size
    if args.rows == 2:
        if args.split_y:
            sy = args.split_y - args.trim_edge          # --split-y é medido na folha original
        else:
            sy = find_split(np.array(sheet)[:, 3, :].mean(axis=1), H // 2)
        ys = [0, sy, H]
    else:
        ys = [round(i * H / args.rows) for i in range(args.rows + 1)]
    xs = [round(i * W / args.cols) for i in range(args.cols + 1)]
    return xs, ys


def extract_frames(sheet, args):
    """Recorta e limpa cada quadrante, na ordem de leitura: ([figura RGBA], [sola_refeita])."""
    xs, ys = grid_lines(sheet, args)
    frames, rebuilt_flags = [], []
    for r in range(args.rows):
        for c in range(args.cols):
            x0, x1, y0, y1 = xs[c], xs[c + 1], ys[r], ys[r + 1]
            # Recua junto às costuras (não nas bordas externas da folha)
            if c > 0:
                x0 += args.inset
            if c < args.cols - 1:
                x1 -= args.inset
            if r > 0:
                y0 += args.inset
            if r < args.rows - 1:
                y1 -= args.inset
            img, rebuilt = extract_frame(sheet.crop((x0, y0, x1, y1)), r == args.rows - 1, args.outline_px)
            frames.append(img)
            rebuilt_flags.append(rebuilt)
    return frames, rebuilt_flags


def load_idle(args):
    """Pose parada vinda de outra imagem: (figura, já_pronta). (None, False) se não houver --idle-image.
    Com fundo transparente a imagem é usada como está (já_pronta=True); sem, passa pela remoção de fundo."""
    if not args.idle_image:
        return None, False
    src = Image.open(args.idle_image)
    if src.mode in ('RGBA', 'LA') and np.array(src.convert('RGBA'))[..., 3].min() == 0:
        idle = src.convert('RGBA')
        return idle.crop(idle.getchannel('A').getbbox()), True
    idle, _ = extract_frame(src.convert('RGB'), True, args.outline_px)
    return idle, False


def scale_figures(frames, idle, idle_ready, args):
    """Reduz cada figura à escala do jogo. Escala única: o frame mais alto da folha fica com a altura do canvas.
    Um idle já pronto entra na escala que ele tem (--idle-scale). Retorna (figuras, escala)."""
    scale = args.height / max(f.height for f in frames)
    allf = frames + ([idle] if idle is not None else [])
    scales = [scale] * len(frames) + ([args.idle_scale if idle_ready else scale] if idle is not None else [])
    figs = []
    for f, sc in zip(allf, scales):
        size = (max(1, round(f.width * sc)), max(1, round(f.height * sc)))
        # RGBa (alpha pré-multiplicado): evita franja escura/clara nas bordas ao reduzir
        g = binarize_alpha(f.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA'))
        figs.append(g.crop(g.getbbox()))
    return figs, scale


def normalize_figures(figs, has_idle, args):
    """Etapa opcional (--normalize-parts): iguala cabeça e pernas entre os frames. Imprime os pontos achados."""
    if args.head_target is None or args.legs_target is None:
        raise SystemExit('--normalize-parts exige --head-target e --legs-target')
    override = {}
    if args.landmarks:
        with open(args.landmarks, encoding='utf-8') as fh:
            override = json.load(fh)
    n_walk = len(figs) - (1 if has_idle else 0)
    labels = [str(i) for i in range(1, n_walk + 1)] + (['idle'] if has_idle else [])
    new_figs, report = [], []
    for lab, g in zip(labels, figs):
        lm = detect_landmarks(g)
        lm.update(override.get(lab, {}))
        report.append((lab, dict(lm), g.height))
        new_figs.append(normalize_parts(g, lm, args.head_target, args.legs_target))
    for lab, lm, height_before in report:
        print(f'  [{lab}] olhos y={lm["eye_y"]:.0f} pescoço y={lm["neck_y"]} barra y={lm["hem_y"]} (altura antes {height_before})')
    return new_figs


def compose_canvases(figs, args):
    """Coloca cada figura num canvas de largura única: eixo do corpo no centro, pés na base.
    Retorna (canvases, largura, eixos, pixels_limpos_por_frame)."""
    if any(g.height > args.height for g in figs):
        raise SystemExit(f'figura mais alta que o canvas ({max(g.height for g in figs)} > {args.height}); ajuste os alvos')
    anchors = [body_anchor_x(g) for g in figs]
    half = int(np.ceil(max(max(a, g.width - a) for g, a in zip(figs, anchors)))) + 1
    canvas_w = half * 2
    outs, cleaned = [], []
    for g, anchor in zip(figs, anchors):
        canvas = Image.new('RGBA', (canvas_w, args.height), (0, 0, 0, 0))
        canvas.alpha_composite(g, (int(round(half - anchor)), args.height - g.height))
        if args.clean_gaps:
            canvas, n = clear_gap_strips(canvas)
            cleaned.append(n)
        outs.append(canvas)
    return outs, canvas_w, anchors, cleaned


def write_preview(outs, canvas_w, args):
    """Folha de conferência: todos os frames lado a lado sobre fundo verde."""
    sheet = Image.new('RGBA', (canvas_w * len(outs) + 8 * (len(outs) - 1), args.height), GREEN)
    for i, im in enumerate(outs):
        sheet.alpha_composite(im, (i * (canvas_w + 8), 0))
    sheet.save(args.preview)


def main():
    args = build_parser().parse_args()
    sheet = read_sheet(args)
    frames, rebuilt_flags = extract_frames(sheet, args)
    idle, idle_ready = load_idle(args)
    figs, scale = scale_figures(frames, idle, idle_ready, args)
    if args.normalize_parts:
        figs = normalize_figures(figs, idle is not None, args)
    outs, canvas_w, anchors, cleaned = compose_canvases(figs, args)

    walk = outs[:len(frames)]
    idle_out = outs[-1] if idle is not None else (walk[args.idle_from] if args.idle_from is not None else None)
    for i, im in enumerate(walk, 1):
        im.save(f'{args.out}/{args.name}_walk{i}.png')
    if idle_out is not None:
        idle_out.save(f'{args.out}/{args.name}_idle.png')

    print(f'escala {scale:.3f} | canvas {canvas_w}x{args.height} | frames {len(walk)}')
    if args.clean_gaps and any(cleaned):
        print('  vãos opacos entre braço e corpo limpos (pixels por frame): ' + ', '.join(str(n) for n in cleaned))
    sizes = [f.size for f in frames + ([idle] if idle is not None else [])]
    for i, ((w, h), a, rb) in enumerate(zip(sizes, anchors, rebuilt_flags + [False]), 1):
        print(f'  frame {i}: figura {w}x{h}px na folha, eixo do corpo x={a:.0f}' + (' (sola refeita)' if rb else ''))
    if args.preview:
        write_preview(outs, canvas_w, args)


if __name__ == '__main__':
    main()
