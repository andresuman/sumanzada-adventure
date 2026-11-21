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


def make(palette, needle=False):
    outline, dark, base, light, spark = [hexrgb(c) for c in PALETTES[palette]]
    img = np.zeros((N, N, 4), np.uint8)
    cx, cy, r = 11.0, 10.5, 10.0
    inside = np.zeros((N, N), bool)
    for y in range(N):
        for x in range(N):
            inside[y, x] = ((x - cx) / r) ** 2 + ((y - cy) / r) ** 2 <= 1.0

    # Uma só família de fios paralelos, bem marcados e curvos (círculos concêntricos com centro fora da bola):
    # linhas de 1 px, a cada 3,6 px, inclinadas para baixo à direita. Sem ruído: 2 tons de fundo + linha escura.
    P = (cx - 14.0, cy - 22.0)                      # fios escuros: arcos inclinados para baixo à direita
    Q = (cx + 15.0, cy - 19.0)                      # fios claros: cruzam no outro sentido, por cima
    SP, SQ = 3.9, 5.2
    for y in range(N):
        for x in range(N):
            if not inside[y, x]:
                continue
            u, v = (x - cx) / r, (y - cy) / r
            lit = -0.55 * u - 0.65 * v
            fill = light if lit > 0.28 else base if lit > -0.35 else dark
            on_dark = (math.hypot(x - P[0], y - P[1]) % SP) < 1.0
            on_light = (math.hypot(x - Q[0], y - Q[1]) % SQ) < 0.95
            if on_light and lit > -0.5:                       # fio claro por cima (some na sombra funda)
                img[y, x] = light
            elif on_dark:
                img[y, x] = dark if fill != dark else outline
            else:
                img[y, x] = fill
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
    # brilho
    for (x, y) in [(6, 4), (7, 4), (5, 5), (6, 5)]:
        if img[y, x, 3] and tuple(img[y, x][:3]) != tuple(outline[:3]) and tuple(img[y, x][:3]) != tuple(dark[:3]):
            img[y, x] = spark

    def stroke(points, color, edge=outline):
        body = set(points)
        for (x, y) in body:
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < N and 0 <= ny < N and (nx, ny) not in body and img[ny, nx, 3] == 0:
                        img[ny, nx] = edge
        for (x, y) in body:
            img[y, x] = color

    # Ponta do fio: sai pelo canto inferior direito e ondula para fora (marca registrada do novelo)
    thread = [(17, 18), (18, 19), (19, 19), (20, 18), (21, 18), (22, 19), (22, 20), (21, 21), (20, 21)]
    stroke(thread, light)
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
