#!/usr/bin/env python3
"""Gera o PNG do novelo de lã (assets/item_yarn.png) em pixel art.

Grade de 24x24 "pixels de arte" ampliada 4x (96x96, igual aos outros itens): no jogo o item é
desenhado a 0,25, então cada pixel de arte vira 1 pixel na tela e fica nítido.

  python3 tools/make_item_yarn.py --palette pink --out assets/item_yarn.png
  python3 tools/make_item_yarn.py --preview /tmp/novelos.png      # compara as paletas

Só desenvolvimento (Pillow + numpy).
"""
import argparse
import math

import numpy as np
from PIL import Image

N = 24            # grade de arte
ZOOM = 4          # 24 * 4 = 96 px, como os outros itens

# contorno, tom escuro (fios/sombra), base, claro, brilho
PALETTES = {
    'pink':  ['#5a1240', '#c2307a', '#ff5fa2', '#ff9ccb', '#ffe0ef'],
    'coral': ['#521420', '#b8283f', '#f0505f', '#ff8f93', '#ffd9d6'],
    'teal':  ['#0c3b3f', '#1f8f93', '#35c4b8', '#7fe3d2', '#d4fbf2'],
    'violet': ['#2d1457', '#6a3fc2', '#9b6df0', '#c4a6ff', '#efe5ff'],
}


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def make(palette):
    outline, dark, base, light, spark = [hexrgb(c) for c in PALETTES[palette]]
    img = np.zeros((N, N, 4), np.uint8)
    cx, cy, r = 11.0, 10.5, 9.4
    inside = np.zeros((N, N), bool)
    for y in range(N):
        for x in range(N):
            inside[y, x] = ((x - cx) / r) ** 2 + ((y - cy) / r) ** 2 <= 1.0

    # Fios: linhas curvas paralelas = círculos grandes concêntricos, centrados fora da bola (embaixo à esquerda),
    # o que dá faixas diagonais que se curvam como lã enrolada. Um 2º conjunto, noutra direção, cruza só na sombra.
    P1 = (cx - 15.0, cy + 15.0)
    P2 = (cx + 15.0, cy + 16.0)
    SP1, SP2 = 3.6, 4.2
    for y in range(N):
        for x in range(N):
            if not inside[y, x]:
                continue
            u, v = (x - cx) / r, (y - cy) / r
            lit = -0.6 * u - 0.75 * v                     # luz de cima à esquerda
            col = light if lit > 0.42 else base if lit > -0.12 else dark
            d1 = math.hypot(x - P1[0], y - P1[1]) % SP1
            d2 = math.hypot(x - P2[0], y - P2[1]) % SP2
            if d1 < 0.95:                                   # fio principal (1 px de linha mais escura)
                col = outline if col == dark else dark if col == base else base
            elif lit < 0.0 and d2 < 0.8:                    # fios cruzando na parte de baixo/direita
                col = outline if col == dark else dark
            img[y, x] = col
    # brilho no alto à esquerda
    for (x, y) in [(6, 5), (7, 4), (5, 6), (6, 6)]:
        if inside[y, x]:
            img[y, x] = spark
    # contorno
    out = img.copy()
    for y in range(N):
        for x in range(N):
            if inside[y, x]:
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if not (0 <= ny < N and 0 <= nx < N) or not inside[ny, nx]:
                        out[y, x] = outline
                        break
    img = out
    # Ponta solta: sai da base da bola, desce e faz uma curva para a direita (fio de 2 px com contorno)
    strand = [(13, 20), (14, 21), (15, 21), (16, 21), (17, 21), (18, 20), (19, 19)]
    body = set()
    for (x, y) in strand:
        body.add((x, y)); body.add((x, y + 1))
    for (x, y) in body:
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < N and 0 <= ny < N and (nx, ny) not in body and img[ny, nx, 3] == 0:
                    img[ny, nx] = outline
    for (x, y) in body:
        img[y, x] = base
    for (x, y) in strand:
        img[y, x] = light if (x + y) % 2 == 0 else base
    return img


def to_png(grid):
    return Image.fromarray(grid, 'RGBA').resize((N * ZOOM, N * ZOOM), Image.NEAREST)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--palette', default='pink', choices=PALETTES)
    ap.add_argument('--out', help='caminho do PNG final (96x96)')
    ap.add_argument('--preview', help='folha comparando todas as paletas, em 3 tamanhos, sobre fundo verde')
    args = ap.parse_args()
    if args.out:
        to_png(make(args.palette)).save(args.out)
        print('gravado', args.out)
    if args.preview:
        bg = (52, 120, 52, 255)
        names = list(PALETTES)
        sheet = Image.new('RGBA', (len(names) * 150 + 10, 260), bg)
        for i, nm in enumerate(names):
            im = to_png(make(nm))
            sheet.alpha_composite(im.resize((N * 5, N * 5), Image.NEAREST), (10 + i * 150, 10))   # grande
            sheet.alpha_composite(im.resize((N, N), Image.LANCZOS), (10 + i * 150, 150))           # tamanho no jogo (24 px)
            sheet.alpha_composite(im.resize((N * 2, N * 2), Image.LANCZOS), (50 + i * 150, 150))   # 2x
        sheet.save(args.preview)
        print('preview', args.preview)


if __name__ == '__main__':
    main()
