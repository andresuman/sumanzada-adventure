# CLAUDE.md — Sumanzada Adventure

Referência rápida para sessões futuras. Projeto pessoal e pequeno: **não adicionar infraestrutura além do necessário**
(sem build, sem lint, sem testes que verificam documentos ou arquivos).

## Visão geral

Jogo 2D de plataforma em **Phaser 3.60** (HTML/JS puro, sem build). O jogador escolhe um personagem, corre por
Águas de Lindóia, desvia de capivaras, junta os itens do personagem e chega à garrafa de água em 60 s.
Uma única fase. Deploy: GitHub Pages (`https://andresuman.github.io/sumanzada-adventure/`).

## Convenções

- Código (variáveis, funções, classes) em **inglês**; comentários, commits e textos do jogo em **PT-BR**.
- Comentários explicam o **porquê**, não o quê.
- Sem módulos: os scripts compartilham o escopo global e são carregados em ordem no `index.html`. Arquivo JS novo
  precisa entrar lá. Sem `?v=` nos scripts (o GitHub Pages revalida em ~10 min; para forçar, Ctrl+F5).
- O Phaser vem de `vendor/` (sem CDN). Para atualizar: `npm pack phaser@<versão>`, copiar `dist/phaser.min.js` e
  trocar o nome no `index.html`.
- As imagens dos personagens retratam pessoas e não são licenciadas para reuso (ver README).

## Estrutura

`game.js` (config 480×270, física arcade `gravity.y = 700`, FIT + CENTER_BOTH; expõe `window.__game` para o teste —
não remover) · `Characters.js` (fonte única dos personagens) · `Collectibles.js` (itens e layout) · `HighScore.js`
(recorde em localStorage, com fallback em memória) · `ui.js` (helper de texto e crédito) · `audio/` (WebAudio puro) ·
`scenes/` (Boot, Title, CharacterSelect, Game, HUD, Result + Win/GameOver) · `assets/` (PNGs) · `tests/` ·
`tools/sheet_to_sprites.py`.

## Fluxo de cenas

```
BootScene → TitleScene → CharacterSelectScene → GameScene + HUDScene (paralela)
                                                     ↓
                                        WinScene  ou  GameOverScene
                                                     ↓
                               CharacterSelectScene (JOGAR NOVAMENTE; último personagem pré-selecionado)
```

- A última escolha fica em `this.registry.get('character')`.
- Enter na seleção e qualquer tecla nas telas de fim **ignoram `event.repeat`**: tecla segurada não pode pular a
  escolha de personagem.
- `HUDScene` escuta eventos da `GameScene` (`scoreChanged`, `livesChanged`, `timeChanged`, `comboChanged`,
  `collectedChanged`). O emissor sobrevive ao reinício: **todo `on` no HUD tem `off` no shutdown**.

## Personagens e itens

- `CHARACTERS` (`Characters.js`): `key`, `name`, `collectible`. `BootScene`, `GameScene` e a seleção leem
  daí. As chaves dos arquivos são antigas e não foram renomeadas: `andre`=Dedé, `thais`=Tatá, `rafinha`,
  `marcela`=Pitu, `marilia`=Pitcha, `solange`=Gê, `texaco`=Caco, `gianluca`=Gianluca (bicicleta: o "andar" é a pedalada; canvas de 250 px de altura).
- `COLLECTIBLE_TYPES` (`Collectibles.js`): um tipo por item (`texture`, `value`, `groupBonus`, `color`, `sfx` e `draw`
  **ou** `image`). `coin` é o item padrão (fallback). `COLLECTIBLE_LAYOUT` é igual para todos.
- **Personagem novo:** PNGs `assets/<chave>_idle.png` + `<chave>_walk1..4.png` (altura 302 px, fundo transparente,
  mesmo canvas entre frames, porque a hitbox é proporcional ao idle) + item em `COLLECTIBLE_TYPES` + uma linha em
  `CHARACTERS`. Cards (grade em 2 linhas; ↑/↓ trocam de linha), animações e teste se ajustam sozinhos.

## Constantes e pontuação (topo de `GameScene.js`)

Chão `GROUND_Y=248`, `PLAYER_SPEED=140`, `JUMP_VY=-440`, `LIVES_START=5` (também usado em `HUDScene.js`),
`TIME_START=60`, `WORLD_WIDTH=2972` (largura do `background2.png`), `STOMP_TOLERANCE=14`. Spawn de capivaras: intervalo
de 3500 ms → 1500 ms e velocidade até +80% ao longo da fase.

- Passagem limpa (capivara cruza o jogador no ar): `+100 × combo`, depois `combo++`.
- Pisar na capivara: devolve os pontos do combo atual (`comboPoints`) e zera o combo.
- Encosto lateral: perde 1 vida e zera o combo (pontos já ganhos ficam).
- Item: `+value`; grupo completo: `+groupBonus`. Não passa pelo combo.

## Colisão jogador × capivara

`onContact` **precisa** do guard `if (this.dead || this.invincible) return;` (senão `triggerGameOver()` roda várias
vezes). Pisou = pés acima do topo da capivara + `STOMP_TOLERANCE` com velocidade vertical > 0. Hitbox da capivara
reduzida de propósito; ao mudar escala, recalcular e testar com `debug: true`.

## Áudio

Dois `AudioContext` **nunca misturados**: `window.SFX_AUDIO_CONTEXT` (`AudioUnlock.js`; SFX da `GameScene` via
`this._sfx(fn)` e `_tone(ac, opts)`) e `MusicManager._ac` (música). A música começa desligada. O tema é original
(valsa em Fá maior, 80 BPM), registrado como `'game-theme'` em `audio/GameTheme.js`. O volume cai com
`exponentialRampToValueAtTime` até `0.001` (nunca 0: gera clique).

## Armadilhas já corrigidas (não reverter)

1. Ouvintes do HUD acumulavam a cada reinício → saem no shutdown.
2. `localStorage` pode lançar (Safari privado): `HighScore` usa `try/catch` e memória; valor corrompido vira 0.
3. A altura da garrafa vem de `displayHeight` (não um número fixo).
4. Não duplicar a lista de personagens: só `Characters.js`.
5. `MusicManager`: `_scheduled` é filtrado em `_scheduleLoop()` (vazamento) e `stop()` usa `n.stop(now)`.

## Testes

```bash
cd tests && npm install && npx playwright install chromium
npm test        # abre o jogo no Chromium, percorre os 5 personagens, coleta, vitória e game over (~25 s)
```

Falha em qualquer erro de página, `console.error` ou arquivo 404 (o que mais quebra ao subir uma imagem ou trocar um
nome). O GitHub Actions roda isso a cada push e PR. Música e botões de toque são conferidos à mão.

## Ferramenta de sprites (opcional)

`tools/sheet_to_sprites.py` (Pillow + numpy) converte uma folha de frames gerada por IA nos PNGs de um personagem:
remove o fundo, usa escala única e alinha o centro de massa para o personagem não balançar ao andar.
`--normalize-parts` iguala cabeça e pernas entre frames (referências detectadas pela roupa da Pitcha; para outro
personagem use `--landmarks arquivo.json` com `eye_y`, `neck_y`, `hem_y`). Poses de larguras diferentes na folha:
`--col-bounds x1,x2,…` (cortes no meio dos vãos de fundo). `--key-bg 40` tira também o fundo dentro de vãos fechados (raios de roda). Vãos fechados entre braço e corpo que
sobrarem em cinza devem ser limpos à mão (acontece em poses com o braço colado ao corpo).

```bash
python3 tools/sheet_to_sprites.py folha.jpg --name marilia --cols 2 --rows 2 --idle-from 3 --out assets --preview /tmp/preview.png
```

## Rodar localmente

```bash
python3 -m http.server 8000   # http://localhost:8000
```
