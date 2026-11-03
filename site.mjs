// site.mjs
import { LANGUAGE_STORAGE_KEY } from './language.mjs';
import { THEME_STORAGE_KEY, nextTheme, resolveTheme } from './theme.mjs';
import {
  QUESTIONS,
  advance,
  ageOn,
  clueValue,
  fill,
  photoSources,
  pick,
  spokenClues,
  spokenQuestion,
  startRound,
  summary,
  teamName,
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

// A language picked here outlasts the browser's: the English pages read it before
// they redirect, so picking English stops the redirect for good.
function initialiseLanguageMenu() {
  // The generated pages' links carry data-language; the privacy pages' carry only
  // hreflang. A link opened in a new tab (middle click) counts as a pick too.
  for (const link of document.querySelectorAll('[data-language], .language-nav a[hreflang]')) {
    const remember = () => {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, link.dataset.language ?? link.hreflang);
      } catch {}
    };
    link.addEventListener('click', remember);
    link.addEventListener('auxclick', remember);
  }
  const menus = [...document.querySelectorAll('[data-language-menu]')];
  // Keyboard focus that moves out of a menu closes it, as a click outside does. Focus
  // that goes nowhere stays open: WebKit focuses the summary on a press but not a link,
  // so a press on a language blurs the summary with no relatedTarget, and closing then
  // would swallow the click. The document's click listener closes it on a press outside.
  for (const menu of menus) {
    menu.addEventListener('focusout', (event) => {
      if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
    });
  }
  document.addEventListener('click', (event) => {
    for (const menu of menus) if (!menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    for (const menu of menus) {
      if (menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    }
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
  const wordsBlock = document.getElementById('site-words');
  if (!card || !wordsBlock) return;
  const words = JSON.parse(wordsBlock.textContent);
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
    part('team').textContent = teamName(question, words);
    part('score').textContent = `${score}/${answered}`;
    part('score-spoken').textContent = fill(words.spoken.score, { score, answered });
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
      const title = perfect ? words.titles.perfect : words.titles.learning;
      const resultTitle = part('result-title');
      resultTitle.textContent = title;
      resultTitle.classList.toggle('is-perfect', perfect);
      // "A la escuadra" is Spanish on every page; English and Spanish read it as their own.
      if (perfect && !['es', 'en'].includes(root.lang)) resultTitle.lang = 'es';
      else resultTitle.removeAttribute('lang');
      const list = part('missed');
      list.replaceChildren(
        ...missed.map((miss) => {
          const row = document.createElement('li');
          for (const [className, text] of [
            ['miss-no', `#${miss.number}`],
            ['miss-name', miss.name],
            ['miss-team', teamName(miss, words)],
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
        ? words.resultCopy.perfect
        : words.resultCopy.learning;
      part('result-spoken').textContent = fill(words.spoken.result, { score, total });
      part('live').textContent = fill(words.live.round, { score, total, title });
      return;
    }

    const right = state.picked === question.answer;
    const today = new Date();
    const age = ageOn(question.birth, today);
    part('spoken').textContent =
      fill(words.spoken.name, {
        name: state.picked === null ? words.spoken.beingAsked : question.answer,
      }) +
      ' ' +
      spokenClues(question, today, words);
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
    part('position').textContent = words.positionCodes[question.position];
    part('age').textContent = String(age);
    part('clue-label').textContent = words.clueCodes[question.clue.kind];
    part('clue').textContent = clueValue(question, words);
    const flag = part('flag');
    const flagSrc =
      question.clue.kind === 'nat' ? `${words.root}assets/flags/${question.clue.country}.png` : null;
    flag.hidden = !flagSrc;
    if (flagSrc) flag.src = flagSrc;
    part('title').textContent = fill(words.whoWears, { number: question.number });
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
        ? words.hint.tap
        : isLast
          ? words.hint.rightLast
          : words.hint.right;
    hint.classList.toggle('is-right', right);
    nextButton.hidden = state.picked === null || right;
    nextButton.textContent = isLast ? words.seeRound : words.next;
    // Focus lands on the first name when a question opens, so the question itself is
    // announced.
    part('live').textContent =
      state.picked !== null
        ? right
          ? fill(words.live.right, { answer: question.answer })
          : fill(words.live.wrong, { number: question.number, answer: question.answer })
        : state.results.length > 0 || restarted
          ? spokenQuestion(state.index, today, words)
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
initialiseLanguageMenu();
initialiseReveals();
initialiseQuiz();
