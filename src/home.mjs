// src/home.mjs: Home's template. Text from the page's language; facts from quiz.mjs.
import {
  QUESTIONS,
  ageOn,
  clueValue,
  fill,
  photoPage,
  photoSources,
  spokenClues,
  teamName,
} from '../quiz.mjs';
import { block, themeScript, wordsScript } from './layout.mjs';

const APP_STORE_URL = 'https://apps.apple.com/us/app/escuadra/id6810705505';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.tovmassian.escuadra';

// Clubs are never translated: a name and the colours of its banded marker.
const CLUBS = [
  ['Real Madrid', '#ffffff 0% 100%'],
  ['Barcelona', '#a50044 0% 50%, #004d98 50% 100%'],
  ['Arsenal', '#ef0107 0% 100%'],
  ['Bayern Munich', '#dc052d 0% 100%'],
  ['Inter Milan', '#0068a8 0% 50%, #000000 50% 100%'],
  ['Paris Saint-Germain', '#004170 0% 40%, #da291c 40% 60%, #004170 60% 100%'],
  ['Liverpool', '#c8102e 0% 100%'],
  ['Borussia Dortmund', '#fde100 0% 50%, #000000 50% 100%'],
  ['Juventus', '#000000 0% 50%, #ffffff 50% 100%'],
  ['Atlético Madrid', '#cb3524 0% 50%, #ffffff 50% 100%'],
  ['Manchester City', '#6caddf 0% 100%'],
  ['AC Milan', '#fb090b 0% 50%, #000000 50% 100%'],
  ['Marseille', '#ffffff 0% 50%, #009ddc 50% 100%'],
  ['Chelsea', '#034694 0% 100%'],
  ['Bayer Leverkusen', '#e32219 0% 50%, #000000 50% 100%'],
  ['Napoli', '#12a0d7 0% 100%'],
  ['Athletic Bilbao', '#ee2523 0% 50%, #ffffff 50% 100%'],
  ['Manchester United', '#da291c 0% 100%'],
  ['Roma', '#8e1f2f 0% 75%, #f0bc42 75% 100%'],
  ['Lyon', '#ffffff 0% 50%, #0033a0 50% 100%'],
  ['Tottenham Hotspur', '#ffffff 0% 50%, #132257 50% 100%'],
  ['RB Leipzig', '#e2001a 0% 50%, #ffffff 50% 100%'],
  ['Aston Villa', '#670e36 0% 50%, #95bfe5 50% 100%'],
  ['Monaco', '#e51937 0% 50%, #ffffff 50% 100%'],
];

// The national teams of the second marquee, by flag file; their names are in the text.
const NATIONS = [
  'ESP', 'ARG', 'BRA', 'FRA', 'ENG', 'JPN', 'GER', 'SEN', 'ITA', 'MEX', 'POR', 'KOR',
  'NED', 'NGA', 'USA', 'CRO', 'URU', 'EGY', 'COL', 'AUS', 'CAN', 'GHA', 'ARM',
];

// The three players on the stack of Results cards: their photos and credits.
// `path` is the file's place under Commons' thumb/ folder, as in quiz.mjs.
const MISS_CARDS = [
  {
    number: 17,
    name: 'Marc Cucurella',
    position: 'DF',
    missed: 'name',
    path: '8/8a/Marc_Cucurella_Argentina_v_Spain_19_July_2026-064_%28cropped%29.jpg',
    author: 'Bryan Berlin',
  },
  {
    number: 10,
    name: 'Kylian Mbappé',
    position: 'FW',
    missed: 'name',
    path: '9/95/Kylian_Mbappe_France_v_Senegal_16_June_2026-391_%28cropped%29.jpg',
    author: 'Bryan Berlin / WikiPortraits',
  },
  {
    number: 5,
    name: 'Jude Bellingham',
    position: 'MF',
    missed: 'position',
    path: '2/23/Jude_Bellingham_England_v_Ghana_23_June_2026-061_%28cropped%29.jpg',
    author: 'Bryan Berlin / WikiPortraits',
  },
];
const MISS_LICENCE = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0' };
const COMMONS_FILE = 'https://commons.wikimedia.org/wiki/File:';

const LOCK_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>';

// One icon for each promise, in the order of `home.promises.items`.
const PROMISE_ICONS = [
  '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" /><path d="M3.5 3.5l17 17" /></svg>',
  '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M2.5 8.8a15 15 0 0 1 4-2.6" /><path d="M10.6 4.7A15 15 0 0 1 21.5 8.8" /><path d="M5.3 12.3a10 10 0 0 1 3.2-2" /><path d="M15.4 10.4a10 10 0 0 1 3.3 1.9" /><path d="M8.6 15.7a5 5 0 0 1 6.8 0" /><circle cx="12" cy="19.2" r=".9" fill="currentColor" /><path d="M3.5 3.5l17 17" /></svg>',
  '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5.2-5.2L7 19" /></svg>',
  '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9s1.3-6.4 3.8-9z" /></svg>',
  '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" /></svg>',
  '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></svg>',
];

/** The two store badges in a row, the black App Store badge first. */
function badges({ text, root }, indent, className) {
  const pad = ' '.repeat(indent);
  const label = text.layout.badges;
  return `${pad}<div class="${className}">
${pad}  <a
${pad}    href="${APP_STORE_URL}"
${pad}    aria-label="${label.appStore}"
${pad}    ><img class="badge" src="${root}assets/badges/app-store-badge-black.svg" alt=""
${pad}  /></a>
${pad}  <a
${pad}    href="${PLAY_STORE_URL}"
${pad}    aria-label="${label.googlePlay}"
${pad}    ><img class="badge" src="${root}assets/badges/google-play-badge.svg" alt=""
${pad}  /></a>
${pad}</div>`;
}

/** One credit under a photo: who it shows (as the caller words it), its author, licence. */
function credit(who, href, author, licence, cropped) {
  return `                <li>
                  <span class="photo-credits-player">${who}</span>
                  <a href="${href}">${author}</a>
                  · <a href="${licence.url}">${licence.name}</a> · ${cropped}
                </li>`;
}

/** A marquee of two identical lists, the second hidden from assistive technology. */
function marquee(className, label, items) {
  return `        <div class="marquee${className}">
          <div class="marquee-track">
            <ul aria-label="${label}">
${items}
            </ul>
            <ul aria-hidden="true">
${items}
            </ul>
          </div>
        </div>`;
}

export function home(page) {
  const { text, root } = page;
  const l = text.layout;
  const t = text.home;
  const tz = text.teaser;
  const privacy = `${root}privacy/2/`;

  // The teaser's first question stays in the markup: it reads the same without JavaScript.
  // The age is the first player's on the day the page was built; the script recounts it on
  // play, and the up-to-date test asks for a rebuild on his birthday.
  const q = QUESTIONS[0];
  const today = new Date();
  const age = ageOn(q.birth, today);
  const words = { ...tz, countries: text.countries };
  const spoken =
    `${fill(tz.spoken.name, { name: tz.spoken.beingAsked })} ` + spokenClues(q, today, words);
  const photo = photoSources(q.photo);
  const teaserCredits = QUESTIONS.map((question) => {
    const { number, photo: p } = question;
    return credit(
      `${teamName(question, words)} · ${number}`,
      photoPage(p),
      p.author,
      { name: p.licence, url: p.licenceUrl },
      t.credits.cropped,
    );
  }).join('\n');
  const missCredits = MISS_CARDS.map((card) =>
    credit(
      `${card.number} ${card.name}`,
      `${COMMONS_FILE}${decodeURIComponent(card.path.split('/').pop())}`,
      card.author,
      MISS_LICENCE,
      t.credits.cropped,
    ),
  ).join('\n');
  const wikimediaNote = block(14, '<p>', t.credits.wikimedia, '</p>');

  return `<!doctype html>
<html lang="${page.language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="${root}assets/favicon.ico" />
    <title>${text.meta.homeTitle}</title>
    <meta
      name="description"
      content="${text.meta.homeDescription}"
    />
${themeScript()}
    <link
      rel="preload"
      href="${root}assets/fonts/archivo/Archivo-SemiExpandedExtraBold.ttf"
      as="font"
      type="font/ttf"
      crossorigin
    />
    <link
      rel="preload"
      href="${root}assets/fonts/archivo/Archivo-ExtraCondensedBlack.ttf"
      as="font"
      type="font/ttf"
      crossorigin
    />
    <link rel="stylesheet" href="${root}site.css" />
    <script type="module" src="${root}site.mjs"></script>
${wordsScript(page)}
  </head>
  <body>
    <header class="site-header shell">
      <a class="brand" href="index.html" aria-label="${l.homeLabel}">
        <span class="brand-mark" aria-hidden="true">
          <img src="${root}assets/favicon.ico" alt="" />
        </span>
        <span>escuadra</span>
      </a>
      <nav aria-label="${l.utilityNav}">
        <a href="#try">${l.nav.try}</a><a href="#how">${l.nav.how}</a
        ><a href="#squads">${l.nav.squads}</a><a href="${root}support.html">${l.nav.support}</a
        ><a href="${privacy}">${l.nav.privacy}</a>
      </nav>
      <div class="header-actions">
        <button
          type="button"
          class="theme-toggle"
          data-theme-toggle
        >
          <span class="theme-toggle-icon" aria-hidden="true">◐</span
          ><span data-theme-toggle-label></span>
        </button>
        <a class="pill pill-small" href="#get">${l.getApp}</a>
      </div>
    </header>

    <main>
      <section class="hero" aria-labelledby="hero-title">
        <div class="wall" aria-hidden="true">
          <div class="wall-row">
            <span>1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23</span
            ><span>1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23</span>
          </div>
          <div class="wall-row">
            <span>5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27</span
            ><span>5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27</span>
          </div>
          <div class="wall-row">
            <span>16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38</span
            ><span>16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38</span>
          </div>
          <div class="wall-row">
            <span>17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39</span
            ><span>17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39</span>
          </div>
        </div>
        <div class="hero-fade" aria-hidden="true"></div>
        <div class="shell hero-grid">
          <div>
            <p class="eyebrow rise">
              <span class="corner"></span>${t.hero.eyebrow}
            </p>
            <h1 id="hero-title" class="display rise">${t.hero.title}</h1>
            <p class="lead rise">
              ${t.hero.lead}
            </p>
${badges(page, 12, 'badges rise')}
            <a class="try-link rise" href="#try">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
              ${t.hero.tryLink}
            </a>
          </div>
          <div class="hero-number" aria-hidden="true">
            <span class="lit numbers">7</span>
            <svg class="hero-mark" viewBox="0 0 64 64">
              <g class="mark-frame" fill="currentColor">
                <rect x="14" y="10" width="40" height="10" />
                <rect x="44" y="10" width="10" height="40" />
              </g>
              <circle class="mark-ball" cx="35" cy="31" r="9" fill="currentColor" />
              <rect class="mark-trail" x="16" y="44" width="7" height="7" fill="currentColor" opacity="0.55" />
              <rect class="mark-trail" x="5" y="53" width="5" height="5" fill="currentColor" opacity="0.3" />
            </svg>
          </div>
        </div>
      </section>

      <section class="section" id="try" aria-labelledby="try-title">
        <div class="shell try-grid">
          <div data-reveal>
            <p class="eyebrow"><span class="corner"></span>${t.try.eyebrow}</p>
            <h2 id="try-title" class="display section-title">${t.try.title}</h2>
            <p class="body-copy">
              ${t.try.body}
            </p>
            <ol class="steps">
${t.try.steps
  .map((step, i) => `              <li><span class="step-number">0${i + 1}</span><span>${step}</span></li>`)
  .join('\n')}
            </ol>
          </div>

          <div class="photo-col">
            <div class="quiz" data-quiz>
              <div class="stage" data-quiz-stage>
                <img
                  class="stage-photo"
                  src="${photo.src}"
                  srcset="${photo.srcset}"
                  sizes="(max-width: 560px) 100vw, 440px"
                  alt=""
                  decoding="async"
                  referrerpolicy="no-referrer"
                  data-quiz-photo
                />
                <div class="stage-top">
                  <div class="segments" aria-hidden="true">
                    <span class="seg is-now" data-quiz-segment></span
                    ><span class="seg" data-quiz-segment></span
                    ><span class="seg" data-quiz-segment></span>
                  </div>
                  <div class="stage-head">
                    <div>
                      <p class="stage-team" data-quiz-team>${teamName(q, words)}</p>
                      <p class="stage-level"><span class="stage-banner"></span>${t.try.level}</p>
                    </div>
                    <p class="stage-score" data-quiz-score aria-hidden="true">0/0</p>
                    <p class="sr-only" data-quiz-score-spoken>${fill(tz.spoken.score, { score: 0, answered: 0 })}</p>
                  </div>
                </div>
                <span class="stage-number numbers" data-quiz-number>${q.number}</span>
              </div>

              <div class="quiz-play" data-quiz-play>
                <p class="sr-only" data-quiz-spoken>
                  ${spoken}
                </p>
                <ul class="chips" aria-hidden="true">
                  <li class="chip chip-name" data-quiz-name>
                    <span class="chip-key">${t.try.nameKey}</span><span data-quiz-name-value>?</span>
                  </li>
                  <li class="chip">
                    <span class="chip-key">${t.try.positionKey}</span><span data-quiz-position>${tz.positionCodes[q.position]}</span>
                  </li>
                  <li class="chip">
                    <span class="chip-key">${t.try.ageKey}</span><span data-quiz-age>${age}</span>
                  </li>
                  <li class="chip">
                    <span class="chip-key" data-quiz-clue-label>${tz.clueCodes[q.clue.kind]}</span
                    ><img class="chip-flag" src="${root}assets/flags/ENG.png" alt="" data-quiz-flag hidden
                    /><span data-quiz-clue>${clueValue(q, words)}</span>
                  </li>
                </ul>
                <p class="display quiz-title" data-quiz-title>${fill(tz.whoWears, { number: q.number })}</p>
                <div class="tiles">
${q.options.map((name) => `                  <button type="button" class="tile" data-quiz-option>${name}</button>`).join('\n')}
                </div>
                <div class="quiz-foot">
                  <p class="quiz-hint" data-quiz-hint>${tz.hint.tap}</p>
                  <button type="button" class="pill" data-quiz-next hidden>${tz.next}</button>
                </div>
              </div>
              <p class="sr-only" aria-live="polite" data-quiz-live></p>

              <div class="quiz-result" data-quiz-result hidden>
                <p class="eyebrow"><span class="corner"></span>${t.try.resultEyebrow}</p>
                <p class="result-score numbers" aria-hidden="true">
                  <span class="result-n" data-quiz-result-score>0</span
                  ><span class="result-total" data-quiz-result-total>/3</span>
                </p>
                <p class="sr-only" data-quiz-result-spoken>${fill(tz.spoken.result, { score: 0, total: 3 })}</p>
                <p class="display result-title" data-quiz-result-title>${tz.titles.learning}</p>
                <ul class="missed" data-quiz-missed></ul>
                <p class="result-copy" data-quiz-result-copy></p>
                <div class="result-actions">
                  <a class="pill" href="#get">${l.getApp}</a>
                  <button type="button" class="pill pill-ghost" data-quiz-restart>${t.try.playAgain}</button>
                </div>
              </div>
            </div>
            <!-- The credits link each file's page by id: its name would give the answer away. -->
            <div class="photo-credits">
              <p class="photo-credits-title">${t.credits.title}</p>
              <ul>
${teaserCredits}
              </ul>
${wikimediaNote}
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="how" aria-labelledby="how-title">
        <div class="shell">
          <div data-reveal>
            <p class="eyebrow"><span class="corner"></span>${t.how.eyebrow}</p>
            <h2 id="how-title" class="display section-title">
              ${t.how.title}
            </h2>
          </div>
          <div class="ladder">
${t.how.levels
  .map((level, i) => {
    const tag =
      i === 0
        ? `              <p class="rung-tag">${t.how.startHere}</p>`
        : `              <p class="rung-tag">
                <span class="sr-only">${fill(t.how.lockedSpoken, { level: i })}</span>
                ${LOCK_ICON}
                <span aria-hidden="true">${fill(t.how.locked, { level: i })}</span>
              </p>`;
    return `            <article class="rung${i === 0 ? ' is-first' : ''}" data-reveal>
              <span class="rung-number numbers" aria-hidden="true">${i + 1}</span>
${tag}
              <h3 class="display">${level.title}</h3>
${block(14, '<p>', level.body, '</p>')}
            </article>`;
  })
  .join('\n')}
          </div>
          <p class="ladder-note" data-reveal>
            ${t.how.note}
          </p>
        </div>
      </section>

      <section class="section" aria-labelledby="misses-title">
        <div class="shell split">
          <div data-reveal>
            <p class="eyebrow"><span class="corner"></span>${t.misses.eyebrow}</p>
            <h2 id="misses-title" class="display section-title">${t.misses.title}</h2>
${t.misses.body
  .map(
    (paragraph) => `            <p class="body-copy">
              ${paragraph}
            </p>`,
  )
  .join('\n')}
          </div>
          <div class="photo-col">
            <div class="stack-wrap" aria-hidden="true">
              <p class="stack-label">${t.misses.stackLabel}</p>
              <div class="stack">
${MISS_CARDS.map((card, i) => {
  const { src, srcset } = photoSources(card);
  return `                <div class="miss-card">
                  <img
                    class="miss-card-photo"
                    src="${src}"
                    srcset="${srcset}"
                    sizes="300px"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerpolicy="no-referrer"
                  />
                  <span class="miss-card-number numbers">${card.number}</span>
                  <div class="miss-card-foot">
                    <p class="miss-card-count">${fill(t.misses.missedOf, { n: i + 1 })}</p>
                    <p class="miss-card-name">${card.name}</p>
                    <p class="miss-card-tags"><span>${tz.positionCodes[card.position]}</span><span class="is-miss">${t.misses.missedPart[card.missed]}</span></p>
                  </div>
                </div>`;
}).join('\n')}
              </div>
            </div>
            <!-- As on Results: the photos are Wikimedia's own, hotlinked and credited. -->
            <div class="photo-credits">
              <p class="photo-credits-title">${t.credits.title}</p>
              <ul>
${missCredits}
              </ul>
${wikimediaNote}
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="squads" aria-labelledby="squads-title">
        <div class="shell">
          <div data-reveal>
            <p class="eyebrow"><span class="corner"></span>${t.squads.eyebrow}</p>
            <h2 id="squads-title" class="display section-title">
              ${t.squads.title}
            </h2>
          </div>
          <div class="stats">
${t.squads.stats
  .map(
    (stat, i) => `            <div class="stat" data-reveal>
              <span class="stat-number numbers">${[96, 157, 5][i]}</span>
              <h3 class="display">${stat.title}</h3>
              <p>${stat.body}</p>
            </div>`,
  )
  .join('\n')}
          </div>
        </div>

${marquee(
  '',
  t.squads.clubsLabel,
  CLUBS.map(
    ([name, bands]) =>
      `              <li class="team"><span class="team-bands" style="--bands: linear-gradient(90deg, ${bands})"></span>${name}</li>`,
  ).join('\n'),
)}
${marquee(
  ' is-reverse',
  t.squads.nationsLabel,
  NATIONS.map(
    (code) =>
      `              <li class="team"><img src="${root}assets/flags/${code}.png" alt="" />${text.countries[code]}</li>`,
  ).join('\n'),
)}

        <div class="shell squads-note">
          <span class="leagues">Premier League · La Liga · Serie A · Bundesliga · Ligue 1</span>
          <span>${t.squads.refreshed}</span>
        </div>
      </section>

      <section class="section" aria-labelledby="escuadra-title">
        <div class="shell split">
          <div class="share-stage">
            <div class="share-glow" aria-hidden="true"></div>
            <div
              class="share"
              role="img"
              aria-label="${t.share.pictureLabel}"
            >
              <div class="share-band"></div>
              <div class="share-inner">
                <p class="share-lockup">
                  <svg width="18" height="18" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true"><rect x="14" y="10" width="40" height="10" /><rect x="44" y="10" width="10" height="40" /><circle cx="33.5" cy="31" r="7.5" /></svg>
                  escuadra
                </p>
                <p class="share-meta">${t.share.meta}</p>
                <p class="share-score numbers">
                  <span class="share-ten">10</span><span class="share-of">/10</span>
                  <svg class="share-mark" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true"><rect x="14" y="10" width="40" height="10" /><rect x="44" y="10" width="10" height="40" /><circle cx="35" cy="31" r="9" /><rect x="16" y="44" width="7" height="7" opacity="0.55" /><rect x="5" y="53" width="5" height="5" opacity="0.3" /></svg>
                </p>
                <p class="display share-title">A la escuadra</p>
                <p class="share-grid numbers">
                  <span>13</span><span>21</span><span>7</span><span>17</span><span>9</span
                  ><span>8</span><span>23</span><span>4</span><span>18</span><span>10</span>
                </p>
                <div class="share-foot">
                  <p class="share-question">${t.share.question}</p>
                  <p class="share-url">tovmassian.github.io/escuadra</p>
                </div>
              </div>
            </div>
          </div>
          <div class="copy-first" data-reveal>
            <p class="eyebrow"><span class="corner"></span>${t.share.eyebrow}</p>
            <h2 id="escuadra-title" class="display section-title">${t.share.title}</h2>
            <p class="display escuadra-word">A la escuadra</p>
${t.share.body
  .map(
    (paragraph) => `            <p class="body-copy">
              ${paragraph}
            </p>`,
  )
  .join('\n')}
          </div>
        </div>
      </section>

      <section class="section" style="padding-top: 40px" aria-labelledby="promises-title">
        <div class="shell">
          <div data-reveal>
            <p class="eyebrow"><span class="corner"></span>${t.promises.eyebrow}</p>
            <h2 id="promises-title" class="display section-title">
              ${t.promises.title}
            </h2>
          </div>
          <div class="promises">
${t.promises.items
  .map(
    (item, i) => `            <article class="promise" data-reveal>
              ${PROMISE_ICONS[i]}
              <h3>${item.title}</h3>
${block(14, '<p>', fill(item.body, { privacy }), '</p>')}
            </article>`,
  )
  .join('\n')}
          </div>
        </div>
      </section>

      <section class="final" id="get" aria-labelledby="get-title">
        <div class="wall" aria-hidden="true">
          <div class="wall-row">
            <span>4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21</span
            ><span>4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21</span>
          </div>
        </div>
        <div class="final-fade" aria-hidden="true"></div>
        <div class="shell final-inner" data-reveal>
          <h2 id="get-title" class="display">${t.get.title}</h2>
          <p>${t.get.body}</p>
${badges(page, 10, 'badges')}
        </div>
      </section>
    </main>

    <footer class="site-footer shell">
      <div class="footer-top">
        <div class="footer-brand">
          <a class="brand" href="index.html" aria-label="${l.homeLabel}">
            <span class="brand-mark" aria-hidden="true">
              <img src="${root}assets/favicon.ico" alt="" />
            </span>
            <span>escuadra</span>
          </a>
          <p class="eyebrow footer-tag">A la escuadra</p>
        </div>
        <nav aria-label="${t.footer.escuadraHeading}">
          <h2>${t.footer.escuadraHeading}</h2>
          <ul>
            <li><a href="#try">${l.nav.try}</a></li>
            <li><a href="#how">${l.nav.how}</a></li>
            <li><a href="#squads">${l.nav.squads}</a></li>
          </ul>
        </nav>
        <nav aria-label="${l.footerNav}">
          <h2>${t.footer.helpHeading}</h2>
          <ul>
            <li><a href="${root}support.html">${l.nav.support}</a></li>
            <li><a href="${privacy}">${l.nav.privacyPolicy}</a></li>
            <li><a href="https://github.com/tovmassian/escuadra/issues">${l.nav.report}</a></li>
          </ul>
        </nav>
      </div>
      <div class="footer-legal">
        <p class="release-status">${l.releaseStatus}</p>
        <p>
          ${t.footer.affiliation}
        </p>
        <p class="legal-credits">
          Apple and the Apple logo are trademarks of Apple Inc., registered in
          the U.S. and other countries. App Store is a service mark of Apple
          Inc., registered in the U.S. and other countries. Google Play and the
          Google Play logo are trademarks of Google LLC. Android is a trademark
          of Google LLC.
        </p>
        <p>&copy; Khachatur Tovmasyan</p>
      </div>
    </footer>
  </body>
</html>
`;
}
