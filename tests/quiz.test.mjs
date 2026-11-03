import assert from 'node:assert/strict';
import test from 'node:test';
import en from '../src/text/en.mjs';
import {
  QUESTIONS,
  advance,
  ageOn,
  fill,
  photoPage,
  photoSources,
  pick,
  spokenQuestion,
  startRound,
  summary,
  teamName,
} from '../quiz.mjs';

const words = { ...en.teaser, countries: en.countries };

test('a question is spoken in words, never in the card’s codes', () => {
  assert.equal(
    spokenQuestion(1, new Date(2026, 10, 2), words),
    'Question 2 of 3. Arsenal. Who wears 7? Position: Forward. Age: 25. Nationality: England.',
  );
  for (const question of QUESTIONS) {
    assert.ok(words.positions[question.position], `${question.team}'s position has a spoken name`);
  }
});

test('fills slots, and leaves an unknown one as it is', () => {
  assert.equal(fill('Who wears {number}?', { number: 7 }), 'Who wears 7?');
  assert.equal(fill('{a} and {b}', { a: 1 }), '1 and {b}');
});

test('a nation is named in the page’s language, a club as it is', () => {
  const es = { countries: { ESP: 'España' } };
  assert.equal(teamName(QUESTIONS[0], es), 'España');
  assert.equal(teamName(QUESTIONS[1], es), 'Arsenal');
});

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
  for (const name of ['Lamine Yamal', 'Kai Havertz', 'Takefusa Kubo']) {
    state = advance(pick(state, name));
  }
  assert.equal(state.done, true);
  assert.equal(pick(state, 'Takefusa Kubo'), state, 'no pick after the end');
  assert.deepEqual(summary(state), {
    score: 2,
    answered: 3,
    total: 3,
    perfect: false,
    missed: [{ number: 7, name: 'Bukayo Saka', team: 'Arsenal', country: null }],
  });
});

test('three right is a round a la escuadra', () => {
  let state = startRound();
  for (const question of QUESTIONS) state = advance(pick(state, question.answer));
  assert.equal(summary(state).perfect, true);
  assert.deepEqual(summary(state).missed, []);
});

test('every question has its photo, as the app stores it, and a credit that names no player', () => {
  for (const question of QUESTIONS) {
    const { photo } = question;
    assert.match(photo.path, /^[0-9a-f]\/[0-9a-f]{2}\/[^/]+$/, `${question.team}'s photo is a Commons file`);
    assert.ok(photo.author && photo.licence && photo.licenceUrl, `${question.team}'s photo is credited`);
    for (const name of question.options) {
      const words = name.split(' ');
      for (const text of [photo.author, photoPage(photo)]) {
        assert.ok(!words.some((word) => text.includes(word)), `${question.team}'s credit names no option`);
      }
    }
  }
  assert.deepEqual(photoSources({ path: 'e/ea/Takefusa_Kubo.jpg' }), {
    src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Takefusa_Kubo.jpg/500px-Takefusa_Kubo.jpg',
    srcset:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Takefusa_Kubo.jpg/500px-Takefusa_Kubo.jpg 500w, ' +
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Takefusa_Kubo.jpg/960px-Takefusa_Kubo.jpg 960w',
  });
});
