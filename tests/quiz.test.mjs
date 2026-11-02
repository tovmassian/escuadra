import assert from 'node:assert/strict';
import test from 'node:test';
import { QUESTIONS, advance, ageOn, pick, startRound, summary } from '../quiz.mjs';

test('counts age in whole years, as the app does', () => {
  assert.equal(ageOn('2007-07-13', new Date(2026, 6, 12)), 18);
  assert.equal(ageOn('2007-07-13', new Date(2026, 6, 13)), 19);
  assert.equal(ageOn('2001-09-05', new Date(2026, 10, 2)), 25);
});

test('every question offers its answer among four distinct names', () => {
  for (const question of QUESTIONS) {
    assert.equal(question.options.length, 4, `${question.team} has four options`);
    assert.equal(new Set(question.options).size, 4, `${question.team}'s options are distinct`);
    assert.ok(question.options.includes(question.answer), `${question.team} offers its answer`);
  }
});

test('a pick is scored once, and only advancing moves the round on', () => {
  let state = startRound();
  state = pick(state, 'Lamine Yamal');
  assert.equal(state.picked, 'Lamine Yamal');
  assert.equal(pick(state, 'Mikel Oyarzabal'), state, 'a second pick changes nothing');
  assert.equal(state.index, 0);
  state = advance(state);
  assert.equal(state.index, 1);
  assert.equal(state.picked, null);
  assert.equal(advance(state), state, 'an unanswered question does not advance');
});

test('the round ends after the last question, and the summary lists the misses', () => {
  let state = startRound();
  for (const name of ['Lamine Yamal', 'Kai Havertz', 'Ritsu Doan']) {
    state = advance(pick(state, name));
  }
  assert.equal(state.done, true);
  assert.equal(pick(state, 'Ritsu Doan'), state, 'no pick after the end');
  assert.deepEqual(summary(state), {
    score: 2,
    answered: 3,
    total: 3,
    perfect: false,
    missed: [{ number: 7, name: 'Bukayo Saka', team: 'Arsenal' }],
  });
});

test('three right is a round a la escuadra', () => {
  let state = startRound();
  for (const question of QUESTIONS) state = advance(pick(state, question.answer));
  assert.equal(summary(state).perfect, true);
  assert.deepEqual(summary(state).missed, []);
});
