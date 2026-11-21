# Sumanzada Adventure

Jogo 2D de plataforma em **Phaser 3** (HTML/JS puro), feito para a família. Roda direto no navegador, no
computador ou no celular, sem instalação e sem etapa de build.

Escolha um personagem, corra pelas ruas de Águas de Lindóia, pule por cima das capivaras, junte os itens do
seu personagem e chegue até a garrafa de água antes que o tempo acabe.

## Jogar online

**https://andresuman.github.io/sumanzada-adventure/**

## Como jogar

| Ação | Teclado | Celular |
|------|---------|---------|
| Andar | ← / → ou A / D | ◄ ► |
| Pular | ↑, W ou Espaço | ▲ |
| Escolher personagem | ← / → / ↑ / ↓ e Enter | toque no card e em COMEÇAR AVENTURA |

- **Objetivo:** chegar à garrafa de água no fim da fase antes de 60 segundos. Ao terminar (vencendo ou perdendo),
  **JOGAR NOVAMENTE** volta à escolha de personagem, já com o último que você usou selecionado.
- **Capivaras:** pule por cima. Cada passagem limpa (você no ar quando ela passa) vale **+100 × combo**, e o
  combo cresce a cada acerto seguido. Capivaras aparecem sem parar e ficam mais rápidas com o tempo.
- **Pisar em cima de uma capivara** perde os pontos do combo atual e zera o multiplicador.
- **Encostar de lado** custa uma vida e zera o multiplicador.
- **Itens:** flutuam no ar e só dá para pegar pulando. Cada item vale **+50**, e pegar todos de um grupo dá
  **+100** de bônus. Os pontos de itens não se perdem ao pisar em capivara.
- Você tem **5 vidas**. O jogo acaba ao perdê-las todas ou quando o tempo se esgota; nos últimos 10 segundos o
  cronômetro fica vermelho e faz um bip por segundo.
- O **recorde** é salvo no navegador (e vale só na sessão se o navegador bloquear o armazenamento).
- A música começa desligada: ligue pelo botão **MÚSICA** na tela inicial.

## Personagens e itens

A escolha muda o personagem e o item que ele coleta; o jogo é o mesmo para todos.

| Personagem | Item |
|---|---|
| Dedé | sanfona |
| Tatá | tênis |
| Rafinha (vai de carrinho) | rosto do Ray Conniff |
| Pitu | cabeça da Hello Kitty |
| Pitcha | novelo de lã |
| Gê | ás de espadas |
| Caco | bola de futebol |

## Rodar localmente

Qualquer servidor HTTP estático serve (o jogo carrega imagens, então abrir o `index.html` direto do disco não funciona):

```bash
python3 -m http.server 8000   # abra http://localhost:8000
```

Requisitos: um navegador moderno com Web Audio API (Chrome, Firefox, Safari ou Edge). Se algo não atualizar,
faça recarga forçada (`Ctrl+F5` / `Cmd+Shift+R`).

## Estrutura

```
sumanzada-adventure/
├── index.html               # Ponto de entrada
├── game.js                  # Configuração do Phaser (480×270) e GAME_SETTINGS
├── Characters.js            # Lista única dos personagens (nome, item) e nomes das texturas
├── Collectibles.js          # Catálogo dos itens coletáveis e layout deles na fase
├── HighScore.js             # Recorde em localStorage (com proteção contra falha do armazenamento)
├── ui.js                    # Helper de texto e crédito compartilhados pelas cenas
├── scenes/
│   ├── BootScene.js             # Carrega imagens e cria as animações
│   ├── TitleScene.js            # Tela inicial e botão de música
│   ├── CharacterSelectScene.js  # Escolha do personagem
│   ├── GameScene.js             # Loop principal: física, capivaras, itens, pontuação e sons
│   ├── HUDScene.js              # Pontos, vidas, tempo, combo e contador de itens
│   ├── ResultScene.js           # Base das telas de fim de partida
│   ├── WinScene.js              # Vitória
│   └── GameOverScene.js         # Fim de jogo
├── audio/
│   ├── AudioUnlock.js       # Desbloqueio do WebAudio no celular
│   ├── MusicManager.js      # Motor de música chiptune (WebAudio puro, sem arquivos de áudio)
│   └── GameTheme.js         # Tema do jogo: valsa original em Fá maior
├── assets/                  # Imagens (PNG): personagens, capivara, cenário, itens
├── vendor/                  # Phaser 3.60.0 copiado para o repositório (sem CDN)
├── tests/                   # Teste de navegador (só desenvolvimento)
├── tools/                   # Ferramenta que prepara os PNGs de um personagem novo
└── .github/                 # CI: roda o teste a cada push
```

## Adicionar um personagem

1. **Imagens:** `assets/<chave>_idle.png` e `assets/<chave>_walk1.png` … `walk4.png`, todas com a mesma altura
   (302 px) e fundo transparente. Se vierem de uma folha gerada por IA, use `tools/sheet_to_sprites.py`
   (ver o `CLAUDE.md`): ele alinha o corpo e iguala o tamanho entre os frames.
2. **Item:** `assets/item_<nome>.png` com 96 px de largura e um tipo novo em `COLLECTIBLE_TYPES`
   (`Collectibles.js`).
3. **Lista:** uma linha em `Characters.js` com a chave, o nome do card e o item.
4. Rode o teste. Cards, animações e tela de seleção se ajustam sozinhos.

## Teste

O teste fica em `tests/` e é só de desenvolvimento: o jogo em si continua sem build e sem npm. Ele abre o jogo no
Chromium, percorre os cinco personagens, coleta, vitória e game over, e falha em qualquer erro ou arquivo faltando.

```bash
cd tests && npm install && npx playwright install chromium
npm test
```

Roda automaticamente no GitHub Actions a cada push e pull request.

## Licença

[MIT](LICENSE), apenas para o código. As imagens em `assets/` retratam pessoas e **não** são licenciadas para reuso.

## Créditos

- Engine: [Phaser 3](https://phaser.io/) v3.60.0 (licença MIT, copiado em `vendor/`)
- Música: tema original em valsa (Fá maior, 3/4), gerado por código com a Web Audio API
- Desenvolvido por Andre Suman, [@andresuman](https://github.com/andresuman)
