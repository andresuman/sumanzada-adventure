// Validação dos dados da música: notas parseáveis, durações coerentes e loop limpo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('../lib/project');

const { window } = loadScripts(['audio/MusicManager.js', 'audio/GameTheme.js']);
const song = window.MusicManager._songs.get('game-theme');
const { noteToFreq, durationTokenToBeats } = window.MusicUtils;

test('o tema "game-theme" está registrado', () => {
    assert.ok(song, 'GameTheme.js deve registrar a chave "game-theme" (TitleScene toca essa chave)');
});

test('andamento e duração fazem sentido para uma valsa em 3/4', () => {
    assert.ok(song.bpm >= 40 && song.bpm <= 200, `bpm fora do esperado: ${song.bpm}`);
    assert.ok(Number.isInteger(song.totalBeats) && song.totalBeats > 0);
    assert.equal(song.totalBeats % 3, 0, 'totalBeats deve ser múltiplo de 3 (compassos completos, loop limpo)');
});

for (const voice of ['lead', 'bass']) {
    test(`voz "${voice}": notas válidas e eventos dentro do tema`, () => {
        const events = song[voice];
        assert.ok(events.length > 0, `${voice} está vazio`);
        const problems = [];
        for (const e of events) {
            const isRest = String(e.note).toUpperCase() === 'R';
            if (!isRest && noteToFreq(e.note) == null) problems.push(`nota inválida: ${e.note}`);
            if (!(e.beats > 0)) problems.push(`duração inválida em ${e.note}: ${e.beats}`);
            if (!(e.startBeat >= 0)) problems.push(`início inválido em ${e.note}: ${e.startBeat}`);
            if (e.startBeat + e.beats > song.totalBeats + 1e-9) problems.push(`${e.note} em ${e.startBeat} passa do fim (${song.totalBeats})`);
        }
        assert.deepEqual(problems, []);
    });
}

test('a melodia preenche o tema inteiro (sem buraco no fim que quebre o loop)', () => {
    const end = Math.max(...song.lead.map(e => e.startBeat + e.beats));
    assert.ok(end >= song.totalBeats - 1, `a melodia termina em ${end} de ${song.totalBeats} beats`);
});

test('durationTokenToBeats: notação de pauta', () => {
    assert.equal(durationTokenToBeats('4'), 1);
    assert.equal(durationTokenToBeats('2'), 2);
    assert.equal(durationTokenToBeats('2.'), 3);
    assert.equal(durationTokenToBeats('8'), 0.5);
});
