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
Para uma pose parada vinda de outra imagem, use --idle-image (processada com a mesma escala).
Dependências só do desenvolvimento: o jogo continua sem build e sem npm/pip.
"""
import argparse
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

GREEN = (40, 200, 60, 255)


def find_split(arr, axis_len, probe, fallback):
    """Posição onde o fundo muda bruscamente (ex.: cinza em cima, branco embaixo); senão, o meio."""
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


def binarize_alpha(img):
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return Image.fromarray(a, 'RGBA')


def main():
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
    ap.add_argument('--idle-image', help='imagem separada da pose parada (usa a mesma escala dos frames)')
    ap.add_argument('--out', default='assets')
    ap.add_argument('--preview', help='grava uma folha de conferência sobre fundo verde')
    args = ap.parse_args()

    sheet = Image.open(args.sheet).convert('RGB')
    # Folhas geradas por IA costumam ter 1–2 px de linha cinza/escura nas bordas externas (artefato)
    if args.trim_edge:
        t = args.trim_edge
        sheet = sheet.crop((t, t, sheet.width - t, sheet.height - t))
    W, H = sheet.size
    arr = np.array(sheet)
    ys = [0, H]
    if args.rows == 2:
        sy = (args.split_y - args.trim_edge) if args.split_y else find_split(arr, H, arr[:, 3, :].mean(axis=1), H // 2)
        ys = [0, sy, H]
    else:
        ys = [round(i * H / args.rows) for i in range(args.rows + 1)]
    xs = [round(i * W / args.cols) for i in range(args.cols + 1)]

    frames, rebuilt_flags = [], []
    for r in range(args.rows):
        for c in range(args.cols):
            x0, x1, y0, y1 = xs[c], xs[c + 1], ys[r], ys[r + 1]
            # Recua junto às costuras (não nas bordas externas da folha)
            if c > 0: x0 += args.inset
            if c < args.cols - 1: x1 -= args.inset
            if r > 0: y0 += args.inset
            if r < args.rows - 1: y1 -= args.inset
            img, rebuilt = extract_frame(sheet.crop((x0, y0, x1, y1)), r == args.rows - 1, args.outline_px)
            frames.append(img)
            rebuilt_flags.append(rebuilt)

    idle_extra = None
    if args.idle_image:
        idle_extra, _ = extract_frame(Image.open(args.idle_image).convert('RGB'), True, args.outline_px)
    allf = frames + ([idle_extra] if idle_extra else [])

    # Escala única: o frame mais alto fica com a altura do canvas
    scale = args.height / max(f.height for f in allf)
    anchors = [body_anchor_x(f) for f in allf]
    left = max(a for a in anchors)
    right = max(f.width - a for f, a in zip(allf, anchors))
    half = int(np.ceil(max(left, right) * scale)) + 1
    canvas_w = half * 2

    def compose(img, anchor):
        size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
        # RGBa (alpha pré-multiplicado): evita franja escura/clara nas bordas ao reduzir
        s = binarize_alpha(img.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA'))
        canvas = Image.new('RGBA', (canvas_w, args.height), (0, 0, 0, 0))
        x = int(round(half - anchor * scale))
        canvas.alpha_composite(s, (x, args.height - s.height))
        return canvas

    outs = [compose(f, a) for f, a in zip(allf, anchors)]
    walk = outs[:len(frames)]
    idle = outs[-1] if idle_extra else (walk[args.idle_from] if args.idle_from is not None else None)
    for i, im in enumerate(walk, 1):
        im.save(f'{args.out}/{args.name}_walk{i}.png')
    if idle is not None:
        idle.save(f'{args.out}/{args.name}_idle.png')

    print(f'escala {scale:.3f} | canvas {canvas_w}x{args.height} | frames {len(walk)}')
    for i, (f, a, rb) in enumerate(zip(allf, anchors, rebuilt_flags + [False]), 1):
        print(f'  frame {i}: figura {f.width}x{f.height}px na folha, eixo do corpo x={a:.0f}' + (' (sola refeita)' if rb else ''))
    if args.preview:
        sh = Image.new('RGBA', (canvas_w * len(outs) + 8 * (len(outs) - 1), args.height), GREEN)
        for i, im in enumerate(outs):
            sh.alpha_composite(im, (i * (canvas_w + 8), 0))
        sh.save(args.preview)


if __name__ == '__main__':
    main()
