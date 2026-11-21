// ESLint (flat config): só desenvolvimento, o jogo continua sem build e sem npm.
// Rodar: cd tests && npm install && npm run lint
//
// Os scripts do jogo são carregados por <script> e compartilham o escopo global. Os nomes abaixo
// são os que um arquivo usa e outro declara; se `no-undef` acusar um nome novo, acrescente aqui.

const browser = {
    window: 'readonly', document: 'readonly', localStorage: 'readonly', console: 'readonly',
    setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
    Event: 'readonly', Image: 'readonly',
};

const sharedByScripts = {
    Phaser: 'readonly',
    BootScene: 'readonly', TitleScene: 'readonly', CharacterSelectScene: 'readonly', GameScene: 'readonly',
    HUDScene: 'readonly', ResultScene: 'readonly', GameOverScene: 'readonly', WinScene: 'readonly',
    CHARACTERS: 'readonly', COLLECTIBLE_TYPES: 'readonly', COLLECTIBLE_LAYOUT: 'readonly',
    collectibleLayoutPoints: 'readonly', LIVES_START: 'readonly',
    characterById: 'readonly', characterTextures: 'readonly', UI: 'readonly',
};

const node = {
    require: 'readonly', module: 'writable', process: 'readonly', __dirname: 'readonly', console: 'readonly',
    setTimeout: 'readonly', clearTimeout: 'readonly', Buffer: 'readonly',
    URL: 'readonly',
    // Dentro de page.evaluate() o código roda no navegador, onde estas globais existem
    window: 'readonly', localStorage: 'readonly', GROUND_Y: 'readonly',
    COLLECTIBLE_TYPES: 'readonly', characterById: 'readonly',
};

const rules = {
    'no-undef': 'error',
    'no-unused-vars': ['error', { vars: 'local', args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'all' }],
    'no-redeclare': ['error', { builtinGlobals: false }],
    'no-empty': 'error',              // catch vazio precisa de um comentário explicando por que ignorar
    'no-var': 'error',
    'prefer-const': 'error',
    eqeqeq: ['error', 'always'],
    'no-throw-literal': 'error',
    'no-self-assign': 'error',
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-fallthrough': 'error',
};

export default [
    { ignores: ['node_modules/**', 'tests/node_modules/**', 'vendor/**', 'assets/**', 'tools/**'] },
    {
        files: ['*.js', 'scenes/**/*.js', 'audio/**/*.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...browser, ...sharedByScripts } },
        rules,
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: node },
        rules,
    },
];
