# CLAUDE.md — Guia de Implementação para Sumanzada Adventure

Arquivo de referência para o Claude Code em futuras sessões de desenvolvimento.
Leia antes de qualquer modificação no projeto.

---

## Visão Geral

Jogo 2D de plataforma em **Phaser 3.60** (HTML/JS puro, sem build step).
O jogador escolhe um personagem, corre por Águas de Lindóia, desvia de capivaras, junta os itens do seu
personagem e chega à garrafa de água antes de o tempo acabar. Existe **uma única fase**.
Deploy via GitHub Pages: `https://andresuman.github.io/sumanzada-adventure/`

---

## Convenções obrigatórias

| O quê | Idioma |
|---|---|
| Variáveis, funções, classes | Inglês |
| Comentários no código | PT-BR |
| Commits | PT-BR |
| Strings visíveis ao jogador | PT-BR |

- Comentários explicam o **porquê** (decisão, limitação, workaround), não o que. `catch` vazio sempre leva um
  comentário dizendo por que o erro pode ser ignorado (o lint exige).
- Sem build step. Sem transpiler. HTML/JS puro. Sem npm **no jogo**: `tests/` tem um `package.json` só de
  desenvolvimento (lint e testes) e `tools/` tem scripts Python de apoio.
- Todo arquivo JS novo do jogo é carregado no `index.html` com cache-bust `?v=AAAAMMDD`; ao modificar um `.js`,
  atualize o `?v=` dele (o teste de cache-bust falha se ficar para trás).
- Scripts compartilham o escopo global (sem módulos). Um nome usado em outro arquivo precisa estar em
  `sharedByScripts` no `eslint.config.mjs`.

---

## Estrutura de arquivos

```
sumanzada-adventure/
├── index.html              # Entrada; carrega os scripts com ?v=AAAAMMDD
├── game.js                 # Config Phaser (480×270), GAME_SETTINGS e window.__game (gancho dos testes)
├── Characters.js           # CHARACTERS (lista única), characterById(), characterTextures()
├── Collectibles.js         # COLLECTIBLE_TYPES (catálogo), COLLECTIBLE_LAYOUT, collectibleLayoutPoints()
├── HighScore.js            # Recorde em localStorage (chave 'sumanzada-highscore'), com fallback em memória
├── ui.js                   # UI.textFactory() e UI.addCredit()
├── scenes/
│   ├── BootScene.js            # Carrega imagens e cria animações (em laço sobre CHARACTERS) → TitleScene
│   ├── TitleScene.js           # Tela inicial; botão de música; recorde
│   ├── CharacterSelectScene.js # Escolha de personagem (cards calculados pela quantidade)
│   ├── GameScene.js            # Loop principal; física; capivaras; itens; SFX; controles touch
│   ├── HUDScene.js             # Pontos/vidas/tempo/combo/itens (cena paralela)
│   ├── ResultScene.js          # Base de WinScene e GameOverScene (recorde, botão, crédito)
│   ├── WinScene.js             # Só define textos e cores da vitória
│   └── GameOverScene.js        # Só define textos e cores do fim de jogo
├── audio/
│   ├── AudioUnlock.js      # Cria window.SFX_AUDIO_CONTEXT; método unlock()
│   ├── MusicManager.js     # Motor chiptune WebAudio; window.MusicManager
│   └── GameTheme.js        # Tema original: valsa em Fá maior, 3/4, 80 BPM, 24 compassos
├── assets/                 # PNGs (ver tabela de assets abaixo)
├── vendor/                 # Phaser 3.60.0 local + licença + README (origem, SHA-256, como atualizar)
├── tests/                  # Lint, testes estáticos e de navegador (dev only)
├── tools/                  # sheet_to_sprites.py (prepara os PNGs de um personagem)
├── eslint.config.mjs       # Regras do lint
└── .github/                # workflows/testes.yml (CI), dependabot.yml, pull_request_template.md
```

**localStorage é compartilhado por origem.** Este jogo e qualquer outro em `andresuman.github.io` dividem o mesmo
storage; por isso a chave do recorde é própria (`sumanzada-highscore`). Chaves novas devem ter prefixo `sumanzada-`.

---

## Constantes globais (GameScene.js — topo do arquivo)

```js
const GROUND_Y     = 248;   // Y do chão (topo do tile)
const TILE_W       = 64;    // Largura do tile de chão
const TILE_H       = 48;    // Altura do tile de chão
const PLAYER_SCALE = 0.28;  // Escala do sprite do personagem
const CAPY_SCALE   = 0.22;  // Escala do sprite da capivara (276×200 px original)
const PLAYER_SPEED = 140;   // Velocidade horizontal (px/s)
const JUMP_VY      = -440;  // Velocidade vertical do pulo
const LIVES_START  = 5;     // Vidas iniciais (usado também em HUDScene — dependência global)
const CAPY_SPEED   = 85;    // Velocidade base das capivaras (px/s)
const WORLD_WIDTH  = 2972;  // Largura exata do background2.png (largura do mundo)
const TIME_START   = 60;    // Tempo de jogo em segundos

const BOTTLE_SCALE = 0.48;  // Escala da garrafa (objetivo)
const BOTTLE_SINK  = 3;     // Quanto os pés da garrafa afundam no chão (px)

const SPAWN_DELAY_MAX    = 3500; // intervalo inicial entre spawns (ms)
const SPAWN_DELAY_MIN    = 1500; // intervalo mínimo ao fim da fase (ms)
const SPAWN_DELAY_JITTER = 400;  // variação aleatória ±400ms
const SPAWN_SPEED_RAMP   = 0.8;  // aceleração máxima (80% acima da base)

const STOMP_TOLERANCE     = 14;  // px de tolerância para pisada no topo da capivara
const GAMEOVER_DELAY      = 700; // ms antes de exibir GameOverScene
const WIN_DELAY           = 600; // ms antes da tela de vitória
const INVINCIBLE_REPEAT   = 10;  // repetições do piscar após dano
const INVINCIBLE_DURATION = 90;  // duração de cada piscar (ms)
```

`LIVES_START` é global de script-tag e é referenciado em `HUDScene.js`. Se renomear, atualizar nos dois.

---

## Configuração Phaser (game.js)

- Dimensões canônicas 480×270 — nunca alterar sem revisar todas as cenas.
- Física arcade com `gravity.y = 700`; scale mode `FIT + CENTER_BOTH`.
- `window.GAME_SETTINGS.musicEnabled` começa `false`; o usuário ativa no toggle da TitleScene.
- `window.__game` expõe o jogo para os testes de navegador lerem o estado das cenas. Não remover.
- O Phaser vem de `vendor/` (sem CDN). Para atualizar, siga `vendor/README.md`.

---

## Fluxo de cenas

```
BootScene → TitleScene → CharacterSelectScene → GameScene + HUDScene (paralela)
                                                     ↓
                                        WinScene  ou  GameOverScene
                                                     ↓
                                   GameScene (restart direto, mesmo personagem)
```

- A escolha do personagem fica em `this.registry.get('character')` para sobreviver ao restart de Vitória/Game Over,
  que voltam direto à `GameScene` (sem passar `character`).
- `HUDScene` é lançada com `this.scene.launch('HUDScene', { gameScene: this })` e escuta eventos da `GameScene`.
- Ao terminar: `this.scene.stop('HUDScene')` antes de iniciar Vitória/Game Over.
- O emissor de eventos da `GameScene` sobrevive ao reinício: **todo `on` no HUD tem `off` no shutdown**.

---

## Personagens (Characters.js)

`CHARACTERS` é a **fonte única**: `BootScene` (carrega e anima em laço), `GameScene` e `CharacterSelectScene`
leem dela. Cada entrada: `key`, `name` (nome do card), `feminine` (rótulo SELECIONADA/SELECIONADO) e `collectible`.
`characterTextures(key)` devolve os nomes das texturas e animações (`<key>_idle`, `<key>_walk1..4`,
`<key>-idle`, `<key>-walk`).

As chaves vêm do início do projeto e **não foram renomeadas** (arquivos e chaves seguem iguais):

| Chave (prefixo dos arquivos) | Nome no jogo | Item |
|---|---|---|
| `andre` | Dedé | sanfona |
| `thais` | Tatá | tênis |
| `rafinha` | Rafinha | rosto do Ray Conniff |
| `marcela` | Pitu | cabeça da Hello Kitty |
| `marilia` | Pitcha | novelo de lã |

- A hitbox é proporcional ao frame idle (`0.55 × 0.80` da largura/altura). Isso exige canvases centrados no
  corpo e de largura uniforme entre os frames do personagem.
- Adicionar um personagem: PNGs em `assets/` + item em `COLLECTIBLE_TYPES` + uma linha em `CHARACTERS`. Posições
  dos cards, escala do sprite, setas do teclado, animações e testes se ajustam sozinhos.

---

## Itens coletáveis (Collectibles.js)

Dados e código separados para trocar o item por personagem sem mexer na lógica:

- `COLLECTIBLE_TYPES`: um tipo por item (`texture`, `label`, `value`, `groupBonus`, `color`, `spin`, `sfx` e `draw`
  **ou** `image`). `draw(g, size)` desenha por código (textura gerada em `BootScene.makeCollectibles`); `image`
  carrega um PNG sob a chave `texture`. O tipo `coin` não é de nenhum personagem hoje: é o item padrão (fallback).
- `CHARACTERS[x].collectible` escolhe o tipo do personagem.
- `COLLECTIBLE_LAYOUT`: grupos `{ x, shape: 'arc'|'line', count, h? }`, iguais para todos os personagens. Alturas
  ficam a 95–140px do chão: o corpo em pé chega a ~68px e o pulo a ~138px, então só dá para pegar pulando.
- Pontos entram direto no `score` (não passam pelo combo); pisar em capivara só devolve `comboPoints`.
  Completar um grupo soma `groupBonus`.
- O HUD usa a textura do tipo como ícone do contador e escuta `collectedChanged`.

---

## Eventos GameScene → HUDScene

| Evento | Payload | Quando |
|---|---|---|
| `scoreChanged` | `(number)` | Pontuação muda |
| `livesChanged` | `(number)` | Vida perdida |
| `timeChanged` | `(number)` | A cada segundo |
| `comboChanged` | `(number)` | Combo muda |
| `collectedChanged` | `(number)` | Item coletado (total) |

Emit: `this.events.emit('nome', valor)`. Escuta no HUD: `on('nome', cb)` (helper local que guarda o handler para
remover no shutdown).

---

## Sistema de pontuação

```
Passagem limpa (capivara passa pelo jogador, que está no ar):
  → score += 100 × combo ; comboPoints += pts ; combo++

Pisar na capivara:
  → score = max(0, score - comboPoints) ; combo = 1 ; comboPoints = 0

Encosto lateral (loseLife()):
  → perde 1 vida ; combo = 1 ; comboPoints = 0 (pontos já ganhos são mantidos)

Item coletado: score += value ; grupo completo: score += groupBonus
```

- `combo` começa em 1; o HUD mostra `★N` com N = combo - 1.
- Cores do combo: `#aaaaaa` (0), `#ffdd00` (1–2), `#ff9900` (3–5), `#ff4444` (6+).
- Se o jogador está no chão quando a capivara o cruza, marca `capy._missed = true` (sem pontos, sem nova tentativa).

---

## Sistema de áudio

### Dois AudioContext separados — nunca misturar

| Contexto | Onde criado | Para quê |
|---|---|---|
| `window.SFX_AUDIO_CONTEXT` | `AudioUnlock.js` | SFX inline da GameScene (via `this._sfx(fn)`) |
| `MusicManager._ac` | `MusicManager.js` | Música de fundo (chiptune) |

### SFX em GameScene

`sndJump`, `sndStomp`, `sndCleanPass(combo)`, `sndHurt`, `sndTick`, `sndVictory`, `sndGameOver` e `_sndCollectible`
(o som vem do catálogo, `type.sfx`). Todos usam o helper `_tone(ac, opts)`. Novo SFX:

```js
sndMeuSom() {
    this._sfx(ac => this._tone(ac, { type: 'square', freq: 440, sweepTo: 880, sweepTime: 0.10, gain: 0.18, decay: 0.12 }));
}
```

O volume cai com `exponentialRampToValueAtTime` até `0.001` (nunca 0: não aceita zero e gera clique de áudio).

### MusicManager

```js
window.MusicManager.registerSong('chave', {
    bpm: 80, totalBeats: 72,           // totalBeats múltiplo de beatsPerMeasure
    lead: [ { note: 'C4', startBeat: 0, beats: 1 }, ... ],
    bass: [ ... ],
    leadWave: 'square', bassWave: 'triangle',
    leadAmp: 0.10, bassAmp: 0.055,
});
```

Notas aceitas: `C4`, `F#5`, `Bb3`, `R` (silêncio). `window.MusicUtils.durationTokenToBeats(tok)` converte notação
de pauta. O tema é **original** (valsa em Fá maior, 3/4, 80 BPM, seções A · A' · B) e é registrado com a chave
`'game-theme'`. O jogo não usa nenhuma obra de terceiros.

---

## Colisão jogador × capivara

```js
onContact(player, capy) {
    // OBRIGATÓRIO: guard contra overlap pós-gameover (senão triggerGameOver() roda várias vezes)
    if (this.dead || this.invincible) return;
    if (playerFeet <= capyTop + STOMP_TOLERANCE && player.body.velocity.y > 0) { /* pisou */ }
    else { this.loseLife(); }
}
```

Hitbox da capivara: `setSize(276*0.72, 200*0.68)` / `setOffset(276*0.14, 200*0.22)`. Ao mudar escala, recalcular e
testar com `debug: true`.

---

## Câmera, controles e UI

- Câmera limitada ao mundo (`setBounds(0, 0, WORLD_WIDTH, H)`) e segue o jogador com lerp horizontal; o jogador
  não sai da câmera à esquerda.
- Capivaras fora da tela à esquerda são destruídas. Spawn por timer em `_scheduleNextCapy()`: intervalo cai de 3500ms
  para 1500ms e a velocidade cresce até 80% ao longo dos 60s.
- Touch: botões ◄ ► ▲ com `setScrollFactor(0)`; cada um rastreia `pointerId` para multi-touch; `this.input.addPointer(2)`.
- Texto: `const txt = UI.textFactory(this)` (monospace, `resolution: 3`) e `UI.addCredit(this)` para o rodapé.
- Paleta: título `#ffe040`, subtítulo `#66ccff`, texto `#ffffff`, inativo `#888888`, positivo `#44ff88`,
  alerta `#ff4444`, botão `#ffe040` (hover `#ffffff`), stroke `#000000` (3–6).

---

## Assets (carregados em BootScene)

| Chave | Arquivo | Uso |
|---|---|---|
| `<chave>_idle`, `<chave>_walk1–4` | `<chave>_idle.png`, `<chave>_walk1–4.png` (5 personagens) | Personagens jogáveis (altura 302 px) |
| `capy_walk1–3`, `capy_flat1–2` | `capy_*.png` | Capivara andando / pisada |
| `ground2` | `ground2.png` | Tile de chão (exibido a 64×48) |
| `bottle2` | `bottle2.png` | Objetivo — garrafa Lindóia |
| `background2` | `background2.png` | Cenário (2972 px) e fundo das telas |
| `item_accordion`, `item_shoe`, `item_kitty`, `item_yarn`, `item_rayconniff` | `item_*.png` (96 px de largura) | Itens coletáveis (carregados via `COLLECTIBLE_TYPES`) |
| `item_coin` | gerado por código | Item padrão (fallback) |
| `heart` | gerado via canvas em BootScene | Ícone de vida no HUD |

As imagens dos personagens retratam pessoas: não são licenciadas para reuso (ver README).

---

## Armadilhas conhecidas (já corrigidas — não reverter)

1. **triggerGameOver() duplo:** `onContact()` sem o guard `this.dead || this.invincible`.
2. **MusicManager memory leak:** `_scheduled` crescia sem limite; corrigido com filtro em `_scheduleLoop()`.
3. **MusicManager.stop() travava:** usava `Math.max(now, _stopAt)`; corrigido para `n.stop(now)`.
4. **Ouvintes do HUD acumulavam a cada reinício** (1 → 2 → …) e atualizavam textos destruídos; agora saem no shutdown.
   Há teste de navegador para isso.
5. **`localStorage` pode lançar** (Safari em modo privado, armazenamento bloqueado): `HighScore` protege com
   `try/catch` e guarda em memória. Valor corrompido vira 0, nunca `NaN`.
6. **Altura da garrafa fixa em um número** que não batia com a imagem: agora vem de `displayHeight`.
7. **Duas listas de personagens** (GameScene e CharacterSelectScene) divergiram e quebraram a tela de seleção:
   existe uma só, em `Characters.js`.

---

## Testes (tests/)

```bash
cd tests && npm ci
npm run lint        # ESLint (config na raiz: eslint.config.mjs)
npm test            # estáticos (node --test): assets, sprites, index.html/cache-bust, música, itens, localStorage, vendor, documentos
npm run test:smoke  # Chromium via Playwright: fluxo de cenas, itens de cada personagem, reinício, game over, vitória
npm run test:all    # os três em sequência
```

- **CI:** `.github/workflows/testes.yml` roda lint, estáticos e fumaça a cada push e pull request.
- **Sprites:** `tests/lib/sprites.js` detecta alpha parcial, buracos no rosto e faixas opacas entre contornos pretos
  (vão braço/corpo). Faixas ainda não revisadas (cabelo escuro entre contornos é ignorado) estão em
  `tests/static/sprite-baseline.json`; qualquer faixa nova falha. Ao corrigir um sprite, rode
  `UPDATE_BASELINE=1 npm test` para encolher a linha de base.
- **PNG sem uso:** só gera aviso no log (imagens sobem pelo GitHub antes do código). `STRICT_UNUSED=1 npm test` torna bloqueante.
- **Cache-bust:** falha se o `?v=` de um script no `index.html` for mais antigo que a última alteração dele
  (tolerância de 1 dia). Scripts de `vendor/` levam a versão no nome do arquivo.
- **Vendor:** o `index.html` não pode ter script externo; o hash do Phaser precisa bater com `vendor/README.md`.
- **Documentos:** README e CLAUDE.md precisam citar cada personagem, item, arquivo de código e constante do jogo, e
  não podem creditar uma música diferente da do `GameTheme.js`.
- **Jogo antigo:** nenhum arquivo rastreado pode mencionar o jogo anterior (teste `legacy`).
- Novo personagem/item/música: os testes de `tests/static` cobrem as referências cruzadas; o teste de fumaça já
  percorre todos os personagens de `Characters.js`.

---

## Ferramentas (tools/)

`tools/sheet_to_sprites.py` transforma uma folha de frames (JPEG/PNG gerada por IA) nos PNGs de um personagem
(`<nome>_idle.png` + `<nome>_walk1..N.png`). Só desenvolvimento (precisa de Pillow e numpy); o jogo segue sem build.

```bash
python3 tools/sheet_to_sprites.py folha.jpg --name marilia --cols 2 --rows 2 --idle-from 3 --out assets --preview /tmp/preview.png
python3 tools/sheet_to_sprites.py folha.jpg --name marilia --idle-image pose_parada.png --out assets   # idle separado, mesma escala
```

Por que existe: recortar cada frame "rente ao desenho" dá canvas de larguras diferentes e o personagem balança ao andar
(a Pitcha chegou a variar ~24 px no vestido). O script remove o fundo (com ruído de JPEG e halo), usa **uma escala
única**, alinha o **centro de massa do corpo** no centro de um canvas de largura única, põe os pés na base (altura
302, como os demais) e refaz a sola do sapato quando ela foi cortada pela borda da folha. Resultado medido: variação de
~1,5 px entre frames.

`--normalize-parts --head-target 130 --legs-target 72` iguala **cabeça** (topo do cabelo→pescoço) e **pernas** (barra
da saia→pés) entre os frames, mantendo o tronco. Existe porque frames gerados por IA derivam de proporção: na Pitcha a
cabeça encolhia 22% e as pernas cresciam 27% do idle ao último frame de caminhada (o tronco era igual), e nenhuma
escala única corrige isso. Os pontos de referência (olhos, pescoço, barra) são detectados pela roupa/rosto dela (vestido
azul, listras vermelhas); para outro personagem passe `--landmarks arquivo.json` com `eye_y`, `neck_y`, `hem_y`
medidos à mão. Comando usado na Pitcha:

```bash
python3 tools/sheet_to_sprites.py folha.jpg --name marilia --idle-image pose_parada.png \
    --normalize-parts --head-target 130 --legs-target 72 --out assets
```

---

## Padrões úteis

**Invencibilidade após dano**
```js
this.invincible = true;
this.tweens.add({
    targets: this.player, alpha: 0.25, duration: INVINCIBLE_DURATION,
    yoyo: true, repeat: INVINCIBLE_REPEAT,
    onComplete: () => { this.player.setAlpha(1); this.invincible = false; }
});
```

**Reiniciar:** `this.scene.start('GameScene')` — `init()` reseta todo o estado.

**Rodar localmente**
```bash
python3 -m http.server 8000   # http://localhost:8000
```
Hard refresh se o JS não atualizar: `Cmd+Shift+R` / `Ctrl+F5`.
