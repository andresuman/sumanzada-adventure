# vendor/

Bibliotecas de terceiros copiadas para o repositório: o jogo não busca nada em CDN e abre offline.

| Arquivo | Origem | Licença |
|---|---|---|
| `phaser-3.60.0.min.js` | pacote npm [`phaser@3.60.0`](https://www.npmjs.com/package/phaser/v/3.60.0), `dist/phaser.min.js` | MIT (`PHASER-LICENSE.md`) |

Para atualizar: `npm pack phaser@<versão>`, extrair `package/dist/phaser.min.js` e `package/LICENSE.md`, salvar como
`vendor/phaser-<versão>.min.js`, apagar o antigo e trocar o caminho no `index.html`. Não edite o arquivo minificado.
