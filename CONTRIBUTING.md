# Guia de Contribuição

Obrigado pelo interesse em contribuir com **Sumanzada Adventure**!

## Convenções de código

### Idioma

| O quê | Idioma |
|---|---|
| Nomes de variáveis, funções, classes | Inglês |
| Comentários no código | Português (PT-BR) |
| Mensagens de commit | Português (PT-BR) |
| Strings visíveis ao jogador | Português (PT-BR) |

### Comentários — explique o porquê, não o quê

Comentários devem registrar a **razão** de uma decisão, limitação do browser ou workaround — não parafrasear o código.

```js
// BOM: documenta a razão da existência da linha
// Phaser pode acionar overlap mesmo após game over — evita triggerGameOver() duplo.
if (this.dead || this.invincible) return;

// EVITE: apenas repete o que o código diz
// Verifica se está morto
if (this.dead) return;
```

```js
// BOM: explica por que 0.001 e não 0
// exponentialRamp não aceita zero como destino — usamos 0.001 para evitar clique de áudio.
g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);

// EVITE: sem contexto
g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12); // fade out
```

Use separadores visuais `// ── Título ───` para demarcar seções dentro de um arquivo longo (padrão já adotado no projeto).

### Sem build step

O **jogo** é HTML/JS puro — sem npm, sem bundler, sem transpiler. Não adicione dependências de build.
Todo novo arquivo `.js` deve ser carregado diretamente no `index.html` via `<script src="...">`.
Os scripts compartilham o escopo global: um nome usado em outro arquivo precisa constar em `sharedByScripts`
no `eslint.config.mjs`. O `package.json` de `tests/` e os scripts de `tools/` são só de desenvolvimento.
O Phaser fica em `vendor/` (ver `vendor/README.md`); não carregue nada de CDN.

### Cache-bust obrigatório

Ao modificar qualquer arquivo `.js`, atualize o parâmetro `?v=YYYYMMDD` correspondente no `index.html`:

```html
<!-- Antes -->
<script src="scenes/GameScene.js?v=20261121"></script>

<!-- Depois (data da modificação) -->
<script src="scenes/GameScene.js?v=20261205"></script>
```

Sem isso o navegador pode servir a versão antiga do cache. O teste `npm test` falha se o `?v=` ficar para trás.

## Como rodar localmente

Na raiz do projeto:

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000` no navegador.

> **Hard refresh** se as mudanças em `.js` não aparecerem: `Cmd+Shift+R` (macOS) / `Ctrl+F5` (Windows/Linux).

## Testes

Antes de abrir o PR, rode:

```bash
cd tests && npm ci
npm run lint          # ESLint
npm test              # verificações estáticas (assets, sprites, index.html, música, itens, documentos)
npm run test:smoke    # percorre o jogo no Chromium (se mexeu no fluxo, nas cenas ou nos personagens)
```

O CI (`.github/workflows/testes.yml`) roda os mesmos três passos a cada push e pull request. Se mudar o
comportamento ou a estrutura do projeto, atualize o `README.md` e o `CLAUDE.md`: há testes que conferem que a
documentação cita os personagens, itens e arquivos de código.

Para um personagem novo, siga **Adicionar um personagem** no `README.md`.

## Como abrir um pull request

1. Faça um fork do repositório.
2. Crie uma branch descritiva: `git checkout -b minha-feature`.
3. Faça as alterações, atualize o `?v=YYYYMMDD` nos arquivos modificados e commit em PT-BR:
   ```bash
   git commit -m "Adiciona suporte a ..."
   ```
4. Abra um Pull Request descrevendo **o que** mudou e **por que** (o modelo de PR traz o checklist). O CI precisa
   ficar verde antes do merge.
