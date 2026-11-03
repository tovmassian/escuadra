// site.mjs
import { THEME_STORAGE_KEY, nextTheme, resolveTheme } from './theme.mjs';
import {
  QUESTIONS,
  advance,
  ageOn,
  photoSources,
  pick,
  spokenClues,
  spokenQuestion,
  startRound,
  summary,
} from './quiz.mjs';

const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let hasSavedPreference = false;

function setTheme(theme, persist) {
  root.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      hasSavedPreference = true;
    } catch {
      hasSavedPreference = false;
    }
  }
  for (const toggle of document.querySelectorAll('[data-theme-toggle]')) {
    // The label already says what a press does, so a pressed state would contradict it
    // ("Switch to light theme, pressed"). Pages generated on main still carry one.
    toggle.removeAttribute('aria-pressed');
    // Translated pages carry their own labels in data-label-*; the others keep English.
    const labels = toggle.dataset;
    const next = nextTheme(theme);
    toggle.setAttribute(
      'aria-label',
      (next === 'dark' ? labels.labelToDark : labels.labelToLight) ?? `Switch to ${next} theme`,
    );
    const label = toggle.querySelector('[data-theme-toggle-label]');
    if (label) {
      label.textContent =
        (theme === 'dark' ? labels.labelDark : labels.labelLight) ??
        (theme === 'dark' ? 'Dark' : 'Light');
    }
  }
}

function initialiseTheme() {
  let savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_STORAGE_KEY); } catch {}
  hasSavedPreference = savedTheme === 'light' || savedTheme === 'dark';
  setTheme(resolveTheme(savedTheme, media.matches), false);
  for (const toggle of document.querySelectorAll('[data-theme-toggle]')) {
    toggle.addEventListener('click', () => setTheme(nextTheme(root.dataset.theme), true));
  }
  media.addEventListener('change', (event) => {
    if (!hasSavedPreference) setTheme(resolveTheme(null, event.matches), false);
  });
}

function initialiseReveals() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || reducedMotion.matches) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries, currentObserver) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      }
    }
  }, { threshold: 0.15 });
  items.forEach((item) => observer.observe(item));
}

// The home page's teaser. The page carries the first question as plain markup, so
// it reads the same without JavaScript; this makes it playable.
function initialiseQuiz() {
  const card = document.querySelector('[data-quiz]');
  if (!card) return;
  const part = (name) => card.querySelector(`[data-quiz-${name}]`);
  const stage = part('stage');
  const photo = part('photo');
  const number = part('number');
  const tiles = [...card.querySelectorAll('[data-quiz-option]')];
  const segments = [...card.querySelectorAll('[data-quiz-segment]')];
  const nextButton = part('next');
  // A right answer moves on by itself after this pause, as the app's does.
  const AUTO_ADVANCE_MS = 1200;
  let state = startRound();
  let timer = null;
  // The first question is on the page when it loads; after Play again it is announced.
  let restarted = false;

  // The round's photos load when it starts, as the app's do, so none waits on Next.
  // Until one has loaded, or if it never does, the stage shows the team's bands.
  for (const question of QUESTIONS.slice(1)) {
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    image.sizes = photo.sizes;
    Object.assign(image, photoSources(question.photo));
  }
  const showPhoto = () => stage.classList.toggle('has-photo', photo.naturalWidth > 0);
  photo.addEventListener('load', showPhoto);
  photo.addEventListener('error', showPhoto);
  if (photo.complete) showPhoto();

  function go(nextState) {
    clearTimeout(timer);
    state = nextState;
    render();
  }

  function render() {
    const question = QUESTIONS[state.index];
    const { score, answered, total, perfect, missed } = summary(state);
    part('play').hidden = state.done;
    part('result').hidden = !state.done;
    stage.style.setProperty('--bands', question.bands);
    stage.style.setProperty('--veil', String(question.veil));
    const { src, srcset } = photoSources(question.photo);
    if (photo.getAttribute('src') !== src) {
      stage.classList.remove('has-photo');
      Object.assign(photo, { srcset, src });
    }
    photo.style.objectPosition = question.photo.focus;
    part('team').textContent = question.team;
    part('score').textContent = `${score}/${answered}`;
    part('score-spoken').textContent = `Score: ${score} of ${answered}`;
    segments.forEach((segment, i) => {
      const result = state.results[i];
      segment.className = result
        ? `seg ${result.right ? 'is-right' : 'is-wrong'}`
        : `seg${i === state.index && !state.done ? ' is-now' : ''}`;
    });

    if (state.done) {
      part('result-score').textContent = String(score);
      part('result-score').classList.toggle('is-perfect', perfect);
      part('result-total').textContent = `/${total}`;
      part('result-title').textContent = perfect ? 'A la escuadra' : 'Still learning';
      part('result-title').classList.toggle('is-perfect', perfect);
      const list = part('missed');
      list.replaceChildren(
        ...missed.map((miss) => {
          const row = document.createElement('li');
          for (const [className, text] of [
            ['miss-no', `#${miss.number}`],
            ['miss-name', miss.name],
            ['miss-team', miss.team],
          ]) {
            const span = document.createElement('span');
            span.className = className;
            span.textContent = text;
            row.append(span);
          }
          return row;
        }),
      );
      list.hidden = missed.length === 0;
      part('result-copy').textContent = perfect
        ? 'Three for three. The app plays ten a round, across 96 clubs and 157 national teams.'
        : 'Those are the ones to go over. The app plays ten questions a round, across 96 clubs and 157 national teams, and every miss waits for you on Results.';
      part('result-spoken').textContent = `${score} of ${total}`;
      part('live').textContent =
        `Your round: ${score} of ${total}. ${perfect ? 'A la escuadra' : 'Still learning'}.`;
      return;
    }

    const right = state.picked === question.answer;
    const today = new Date();
    const age = ageOn(question.birth, today);
    part('spoken').textContent =
      `Name: ${state.picked === null ? 'being asked' : question.answer}. ` +
      spokenClues(question, today);
    const isLast = state.index === QUESTIONS.length - 1;
    if (number.firstChild.nodeValue !== String(question.number)) {
      number.firstChild.nodeValue = String(question.number);
      number.classList.remove('is-entering');
      void number.offsetWidth;
      number.classList.add('is-entering');
    }
    const name = part('name');
    name.className = state.picked
      ? `chip chip-name ${right ? 'is-right' : 'is-wrong'}`
      : 'chip chip-name';
    part('name-value').textContent = state.picked ? question.answer : '?';
    part('position').textContent = question.position;
    part('age').textContent = String(age);
    part('clue-label').textContent = question.clue.label;
    part('clue').textContent = question.clue.value;
    const flag = part('flag');
    flag.hidden = !question.clue.flag;
    if (question.clue.flag) flag.src = question.clue.flag;
    part('title').textContent = `Who wears ${question.number}?`;
    question.options.forEach((option, i) => {
      const tile = tiles[i];
      tile.textContent = option;
      tile.disabled = state.picked !== null;
      tile.className = 'tile';
      if (state.picked !== null) {
        if (option === question.answer) tile.classList.add('is-right');
        else if (option === state.picked) tile.classList.add('is-wrong');
        else tile.classList.add('is-dim');
      }
    });
    const hint = part('hint');
    hint.hidden = state.picked !== null && !right;
    hint.textContent =
      state.picked === null
        ? 'Tap your answer'
        : isLast
          ? 'Right. Your round is next…'
          : 'Right. Next one coming…';
    hint.classList.toggle('is-right', right);
    nextButton.hidden = state.picked === null || right;
    nextButton.textContent = isLast ? 'See your round' : 'Next';
    // Focus lands on the first name when a question opens, so the question itself is
    // announced.
    part('live').textContent =
      state.picked !== null
        ? right
          ? `Right: ${question.answer}.`
          : `Not quite. Number ${question.number} is ${question.answer}.`
        : state.results.length > 0 || restarted
          ? spokenQuestion(state.index, today)
          : '';
  }

  // Keeps keyboard focus in the card as the round moves on, or into its result.
  function moveOn() {
    go(advance(state));
    (state.done ? part('restart') : tiles[0]).focus({ preventScroll: true });
  }

  tiles.forEach((tile) => {
    tile.addEventListener('click', () => {
      go(pick(state, tile.textContent));
      if (state.picked === QUESTIONS[state.index].answer) {
        timer = setTimeout(moveOn, AUTO_ADVANCE_MS);
      } else {
        nextButton.focus({ preventScroll: true });
      }
    });
  });
  nextButton.addEventListener('click', moveOn);
  part('restart').addEventListener('click', () => {
    restarted = true;
    go(startRound());
    tiles[0].focus({ preventScroll: true });
  });
  render();
}

initialiseTheme();
initialiseReveals();
initialiseQuiz();
