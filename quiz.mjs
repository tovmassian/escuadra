// quiz.mjs: the home page's three-question teaser, played as the app plays level 1.
// Pure: site.mjs owns the page, this module only the round.
//
// The facts come from the app's squads (data/squads/ and data/players.json on main):
// re-check them when the squads are refreshed. `bands` is the team's marker as the
// in-round banner draws it, vertical bands in the team's real colours.

export const QUESTIONS = [
  {
    team: 'Spain',
    number: 19,
    position: 'FW',
    birth: '2007-07-13',
    clue: { label: 'Club', value: 'Barcelona', flag: null },
    bands: 'linear-gradient(90deg, #AA151B 0% 25%, #F1BF00 25% 75%, #AA151B 75% 100%)',
    veil: 0.42,
    answer: 'Lamine Yamal',
    options: ['Mikel Oyarzabal', 'Lamine Yamal', 'Yéremy Pino', 'Víctor Muñoz'],
  },
  {
    team: 'Arsenal',
    number: 7,
    position: 'FW',
    birth: '2001-09-05',
    clue: { label: 'Nat', value: 'England', flag: 'assets/flags/ENG.png' },
    bands: 'linear-gradient(90deg, #EF0107 0% 100%)',
    veil: 0.42,
    answer: 'Bukayo Saka',
    options: ['Kai Havertz', 'Noni Madueke', 'Bukayo Saka', 'Viktor Gyökeres'],
  },
  {
    team: 'Japan',
    number: 10,
    position: 'FW',
    birth: '1998-06-16',
    clue: { label: 'Club', value: 'Eintracht Frankfurt', flag: null },
    bands:
      'linear-gradient(90deg, #FFFFFF 0% 33.33%, #BC002D 33.33% 66.67%, #FFFFFF 66.67% 100%)',
    veil: 0.55,
    answer: 'Ritsu Doan',
    options: ['Daizen Maeda', 'Ayase Ueda', 'Keito Nakamura', 'Ritsu Doan'],
  },
];

// What a screen reader says in place of the card's codes, as the app's catalog does.
export const POSITION_NAMES = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' };
const CLUE_NAMES = { Club: 'Club', Nat: 'Nationality' };

/** The clues, spoken: "Position: Forward. Age: 19. Club: Barcelona." */
export function spokenClues(question, today) {
  return (
    `Position: ${POSITION_NAMES[question.position]}. Age: ${ageOn(question.birth, today)}. ` +
    `${CLUE_NAMES[question.clue.label]}: ${question.clue.value}.`
  );
}

/** A question as it opens: "Question 2 of 3. Arsenal. Who wears 7? Position: …" */
export function spokenQuestion(index, today, questions = QUESTIONS) {
  const question = questions[index];
  return (
    `Question ${index + 1} of ${questions.length}. ${question.team}. ` +
    `Who wears ${question.number}? ${spokenClues(question, today)}`
  );
}

/** Whole years from `birth` (YYYY-MM-DD) to `today`, as the app's age clue counts them. */
export function ageOn(birth, today) {
  const [year, month, day] = birth.split('-').map(Number);
  let age = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

export function startRound() {
  return { index: 0, picked: null, results: [], done: false };
}

/** Answers the current question. A second pick, or one after the end, changes nothing. */
export function pick(state, name, questions = QUESTIONS) {
  if (state.done || state.picked !== null) return state;
  const question = questions[state.index];
  return {
    ...state,
    picked: name,
    results: [...state.results, { question, right: name === question.answer }],
  };
}

/** Moves to the next question once the current one is answered, or ends the round. */
export function advance(state, questions = QUESTIONS) {
  if (state.done || state.picked === null) return state;
  if (state.index >= questions.length - 1) return { ...state, picked: null, done: true };
  return { ...state, index: state.index + 1, picked: null };
}

export function summary(state, questions = QUESTIONS) {
  const score = state.results.filter((result) => result.right).length;
  return {
    score,
    answered: state.results.length,
    total: questions.length,
    perfect: state.done && score === questions.length,
    missed: state.results
      .filter((result) => !result.right)
      .map(({ question }) => ({
        number: question.number,
        name: question.answer,
        team: question.team,
      })),
  };
}
