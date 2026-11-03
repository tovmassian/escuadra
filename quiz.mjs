// quiz.mjs: the home page's three-question teaser, played as the app plays level 1.
// Pure: site.mjs owns the page, this module only the round.
//
// A team's `country` names a nation by its FIFA code, so each page shows it in its
// language; a club has none, and its name is never translated. A clue is
// `{ kind: 'club', value }` (the club's name) or `{ kind: 'nat', country }`.
//
// The facts come from the app's squads (data/squads/ and data/players.json on main):
// re-check them when the squads are refreshed. `bands` is the team's marker as the
// in-round banner draws it, vertical bands in the team's real colours, under `veil`;
// they show until the photo loads, or if it never does.
//
// `photo` is the player's photo as the app stores it (`player.photo`): Wikimedia's
// thumbnail, hotlinked, and its credit. `path` is the file's place under Commons'
// thumb/ folder. `page` is its Commons page id, so the credit links the file's page
// without its name, which would give the answer away. `focus` frames the face clear
// of the shirt number.

export const QUESTIONS = [
  {
    team: 'Spain',
    country: 'ESP',
    number: 19,
    position: 'FW',
    birth: '2007-07-13',
    clue: { kind: 'club', value: 'Barcelona' },
    bands: 'linear-gradient(90deg, #AA151B 0% 25%, #F1BF00 25% 75%, #AA151B 75% 100%)',
    veil: 0.42,
    photo: {
      path: '1/13/Lamine_Yamal_France_v_Spain_7.24.26-142.jpg',
      page: 195780204,
      author: 'Bryan Berlin / WikiPortraits',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      focus: '50% 18%',
    },
    answer: 'Lamine Yamal',
    options: ['Mikel Oyarzabal', 'Lamine Yamal', 'Yéremy Pino', 'Víctor Muñoz'],
  },
  {
    team: 'Arsenal',
    country: null,
    number: 7,
    position: 'FW',
    birth: '2001-09-05',
    clue: { kind: 'nat', country: 'ENG' },
    bands: 'linear-gradient(90deg, #EF0107 0% 100%)',
    veil: 0.42,
    photo: {
      path: '2/2f/Bukayo_Saka_England_v_Ghana_23_June_2026-057_%28cropped%29.jpg',
      page: 194965322,
      author: 'Bryan Berlin',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      focus: '50% 18%',
    },
    answer: 'Bukayo Saka',
    options: ['Kai Havertz', 'Noni Madueke', 'Bukayo Saka', 'Viktor Gyökeres'],
  },
  {
    team: 'Japan',
    country: 'JPN',
    number: 20,
    position: 'MF',
    birth: '2001-06-04',
    clue: { kind: 'club', value: 'Real Sociedad' },
    bands:
      'linear-gradient(90deg, #FFFFFF 0% 33.33%, #BC002D 33.33% 66.67%, #FFFFFF 66.67% 100%)',
    veil: 0.55,
    photo: {
      path: 'e/ea/Takefusa_Kubo.jpg',
      page: 201066029,
      author: 'Ali Mohammed Mahdi',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      focus: '50% 0%',
    },
    answer: 'Takefusa Kubo',
    options: ['Daichi Kamada', 'Ao Tanaka', 'Junya Ito', 'Takefusa Kubo'],
  },
];

const COMMONS_THUMB = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/';

/** The photo's thumbnail at Commons' 500 and 960 px steps: `src` and `srcset`. */
export function photoSources({ path }) {
  const at = (width) => `${COMMONS_THUMB}${path}/${width}px-${path.split('/').pop()}`;
  return { src: at(500), srcset: `${at(500)} 500w, ${at(960)} 960w` };
}

/** The photo's Commons page, by id: the link names no player. */
export function photoPage({ page }) {
  return `https://commons.wikimedia.org/w/index.php?curid=${page}`;
}

/** Fills a page's {slots}: fill('Who wears {number}?', { number: 7 }). */
export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (slot, key) => (key in values ? String(values[key]) : slot));
}

/** A team as the page names it: a nation in the page's language, a club as it is. */
export function teamName({ team, country }, words) {
  return country ? words.countries[country] : team;
}

/** The club or nationality clue, in the page's language. */
export function clueValue({ clue }, words) {
  return clue.kind === 'nat' ? words.countries[clue.country] : clue.value;
}

/** The clues, spoken: "Position: Forward. Age: 19. Club: Barcelona." */
export function spokenClues(question, today, words) {
  return fill(words.spoken.clues, {
    position: words.positions[question.position],
    age: ageOn(question.birth, today),
    clueLabel: words.clueSpoken[question.clue.kind],
    clue: clueValue(question, words),
  });
}

/** A question as it opens: "Question 2 of 3. Arsenal. Who wears 7? Position: …" */
export function spokenQuestion(index, today, words, questions = QUESTIONS) {
  const question = questions[index];
  return fill(words.spoken.question, {
    n: index + 1,
    total: questions.length,
    team: teamName(question, words),
    number: question.number,
    clues: spokenClues(question, today, words),
  });
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
        country: question.country,
      })),
  };
}
