# Sumanzada Adventure

Jogo 2D de plataforma em **Phaser 3** (HTML/JS puro), rodando direto no navegador — sem instalação, sem dependências de build.

Escolha seu personagem, corra pelas ruas de Águas de Lindóia, desvie das capivaras e chegue até a garrafa de água antes que o tempo acabe.

## Jogar online

**https://andresuman.github.io/sumanzada-adventure/**

## Como jogar

| Ação | Teclado | Mobile |
|------|---------|--------|
| Andar | ← / → ou A / D | ◄ ► |
| Pular | ↑ ou W ou Espaço | ▲ |
| Trocar personagem | ← / → | toque no card |
| Começar | Enter | botão COMEÇAR AVENTURA |

- **Objetivo:** chegue até a garrafa de água no fim da fase antes do tempo acabar (60 segundos).
- Desvie das capivaras pulando por cima — cada passagem limpa (no ar) vale **+100 × combo**.
- Capivaras aparecem continuamente e ficam mais rápidas com o passar do tempo.
- Moedas flutuam no ar: **pule para pegar** (+50 cada; completar um grupo dá +100 de bônus). Pisar em capivara não tira pontos de moeda.
- Pisar em uma capivara perde os pontos acumulados no combo atual e zera o multiplicador.
- Encostar de lado em uma capivara custa uma vida e zera o multiplicador.
- Nos últimos 10 segundos o cronômetro fica vermelho e um bip soa a cada segundo.
- O jogo tem **5 vidas**; termina ao perdê-las todas ou ao esgotar o tempo.
- O **recorde** é salvo automaticamente no navegador (localStorage).

## Personagens

Dedé, Tatá e Rafinha. A escolha é só visual: o jogo é o mesmo para todos.

## Requisitos

- Qualquer navegador moderno com suporte à Web Audio API (Chrome, Firefox, Safari, Edge).
- Para rodar localmente, um servidor HTTP simples (ex.: `python3 -m http.server`).

## Estrutura

```
sumanzada-adventure/
├── index.html              # Ponto de entrada
├── game.js                 # Configuração do Phaser e GAME_SETTINGS
├── HighScore.js            # Persistência de recorde (localStorage)
├── Collectibles.js         # Catálogo e layout dos itens coletáveis
├── scenes/
│   ├── BootScene.js            # Carregamento de assets e animações
│   ├── TitleScene.js           # Tela inicial e toggle de música
│   ├── CharacterSelectScene.js # Escolha do personagem
│   ├── GameScene.js            # Loop principal, capivaras e controles
│   ├── HUDScene.js             # Pontos, vidas, tempo e combo
│   ├── GameOverScene.js        # Tela de fim de jogo
│   └── WinScene.js             # Tela de vitória
├── audio/
│   ├── AudioUnlock.js      # Desbloqueio da Web Audio API no mobile
│   ├── MusicManager.js     # Motor de música chiptune (WebAudio puro)
│   └── GameTheme.js        # Valsa "Tardes em Lindóia" (Zequinha de Abreu, domínio público)
└── assets/                 # Sprites e cenário (PNG)
```

## Licença

[MIT](LICENSE) — apenas para o código. As imagens em `assets/` retratam pessoas e **não** são licenciadas para reuso.

## Créditos

- Engine: [Phaser 3](https://phaser.io/) v3.60
- Música: "Tardes em Lindóia", de Zequinha de Abreu (1930), domínio público
- Desenvolvido por Andre Suman — [@andresuman](https://github.com/andresuman)
