# vendor/

Bibliotecas de terceiros copiadas para o repositório. O jogo não busca nada em CDN: abre offline e os
testes usam exatamente o mesmo arquivo de produção.

| Arquivo | Origem | Licença | SHA-256 |
|---|---|---|---|
| `phaser-3.60.0.min.js` | pacote npm [`phaser@3.60.0`](https://www.npmjs.com/package/phaser/v/3.60.0), `dist/phaser.min.js` | MIT (`PHASER-LICENSE.md`) | `d16aca3f36470e2d1eac3a37ba708261e2a496bfad896f8c0172597df42f3455` |

## Como atualizar o Phaser

1. `npm pack phaser@<versão>` e extrair `package/dist/phaser.min.js` (e `package/LICENSE.md`).
2. Salvar como `vendor/phaser-<versão>.min.js`, apagar o arquivo antigo e atualizar a tabela acima
   (`sha256sum vendor/phaser-<versão>.min.js`).
3. Trocar o caminho no `index.html` e rodar `cd tests && npm test && npm run test:smoke`.
   O teste `vendor` confere que o nome do arquivo, a versão embutida e o hash batem com esta tabela.

Não edite o arquivo minificado à mão.
