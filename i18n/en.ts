// The English catalog, the source every other language is typed against:
// `Messages = typeof en`. Deliberately not `as const` — its strings widen to
// `string`, so a translation can hold different words while a missing or extra
// key, or a parameter of the wrong type, fails `npm run typecheck`; a dropped
// trailing parameter fails i18n/__tests__/catalogs.test.ts. Each "≤ N chars"
// budget below is also in ./budgets.ts, which the tests hold every catalog to.
// Values are strings, or functions when they take parameters; each function
// writes its own plural. No `Intl`: dates and plurals are written out here.
// Escuadra and a la escuadra come from ./names and are never translated.
// Short labels carry a length budget ("≤ N chars: where") that translators
// write to (#141, Text expansion). Spec: #141.

import { A_LA_ESCUADRA, ESCUADRA } from './names';

/** A squad's `lastUpdated`, split so each language orders it its own way. */
export interface CalendarDate {
  day: number;
  /** 1–12. */
  month: number;
  year: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Spain's", but "Netherlands'". English only: each catalog writes its own. */
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

const PHOTO_CREDITS = 'Photo credits';
const CROPPED = 'cropped';
const USAGE_STATISTICS = 'Share anonymous usage statistics';

export const en = {
  common: {
    /** "Level 2": the round header, results, the share text and picture. */
    level: (level: number) => `Level ${level}`,
    /** ≤ 8 chars: the back link, after "‹ ". */
    back: 'Back',
    /** A sheet's close button, spoken. */
    close: 'Close',
    /** A score, spoken. */
    scoreSpoken: (correct: number, attempted: number) => `Score: ${correct} of ${attempted}`,
  },
  home: {
    /** ≤ 8 chars: the top-left link. */
    aboutLink: 'About',
    /** Spoken name of the theme switch. */
    darkTheme: 'Dark theme',
    /** Spoken name of the language chip, with the current language in its own name: "Language: English". */
    languageLabel: (name: string) => `Language: ${name}`,
    /** ≤ 24 chars: the continue card's meta line, in IBM Plex Mono capitals. */
    continueMeta: (level: number, best: number | undefined, total: number) =>
      best === undefined ? `LEVEL ${level}` : `LEVEL ${level} · BEST ${best}/${total}`,
    /** ≤ 18 chars: the main button. */
    startTraining: 'Start Training',
    /** ≤ 20 chars: the text button. */
    browseAllTeams: 'Browse All Teams',
  },
  languageSheet: {
    /** ≤ 16 chars: the sheet's title. */
    title: 'Language',
    /** ≤ 28 chars: the first row, with the language the phone resolves to in its own name. */
    matchPhone: (name: string) => `Match phone · ${name}`,
  },
  formats: {
    /** "21 Aug 2026". */
    date: ({ day, month, year }: CalendarDate) => `${day} ${MONTHS[month - 1] ?? ''} ${year}`,
  },
  /** ≤ 3 chars: a position's code on an answer tile, a slot chip, a Study filter pill and a card badge. */
  positionCodes: { GK: 'GK', DF: 'DF', MF: 'MF', FW: 'FW' },
  /** ≤ 11 chars: the word under a position tile's code, and in Study's spoken label. */
  positions: { GK: 'Keeper', DF: 'Defender', MF: 'Midfield', FW: 'Forward' },
  /** Slot names, spoken before a slot's value. */
  slots: { NAME: 'Name', POS: 'Position', AGE: 'Age', CLUB: 'Club', NAT: 'Nationality' },
  /** ≤ 6 chars: a slot chip's label above its value, in capitals. */
  slotCodes: { NAME: 'NAME', POS: 'POS', AGE: 'AGE', CLUB: 'CLUB', NAT: 'NAT' },
  round: {
    /** ≤ 12 chars: the prompt row once a question is scored. */
    correct: 'Correct',
    /** ≤ 12 chars: the prompt row once a question is scored. */
    missed: 'Missed',
    whoWears: (no: number) => `Who wears ${no}?`,
    askPosition: 'Position?',
    askClub: 'Which club?',
    askNationality: 'Nationality?',
    /** ≤ 14 chars: the footer button on the last question. */
    seeResults: 'See results',
    /** ≤ 8 chars: the auto-next bar's label before "· tap to skip". */
    next: 'Next',
    /** ≤ 18 chars: the footer button after a right answer with a screen reader on. */
    nextQuestion: 'Next question',
    /** ≤ 18 chars: the footer button after a miss. */
    gotItNext: 'Got it — next',
    /** The auto-next bar: one line of `ctaLabel` at 360 dp, ≤ 26 chars in all. */
    tapToSkip: (label: string) => `${label} · tap to skip`,
    /** A slot chip's screen-reader label, by slot state. */
    slotSpoken: {
      given: (slot: string, value: string) => `${slot}: ${value}`,
      active: (slot: string) => `${slot}: being asked`,
      pending: (slot: string) => `${slot}: asked next`,
      correct: (slot: string, value: string) => `${slot}: ${value}, right`,
      wrong: (slot: string, value: string) => `${slot}: ${value}, the right answer`,
      notAsked: (slot: string, value: string) => `${slot}: ${value}, not asked`,
    },
    /** The close button's spoken name. */
    leave: 'Leave the round',
    shirtNumber: (no: number) => `Shirt number ${no}`,
    /** ≤ 20 chars: the footer before a tap. */
    tapYourAnswer: 'Tap your answer',
    /** The auto-next bar's spoken hint. */
    movesOn: 'Moves on by itself in a moment',
    /** ≤ 8 chars: the tag over the right answer after a miss, in capitals. */
    answerTag: 'Answer',
    /** What a tile adds to its spoken name once answered; '' adds nothing. */
    tileSpoken: {
      idle: '',
      'correct-picked': 'correct',
      'correct-unpicked': 'the right answer',
      'incorrect-picked': 'your pick, wrong',
      'incorrect-other': '',
    },
    questionOf: (n: number, total: number) => `Question ${n} of ${total}`,
    streak: (count: number) => `Streak: ${count} in a row`,
  },
  study: {
    /** The header's count, unfiltered. */
    players: (count: number) => (count === 1 ? `${count} player` : `${count} players`),
    /** The header's count, filtered. */
    shownOf: (shown: number, total: number) => `${shown} of ${total}`,
    /** Spoken for a member with no shirt number yet. */
    noNumber: 'no number',
    /** Spoken in place of a name while Hide names is on. */
    nameHidden: 'name hidden',
    /** The screen's title. */
    title: 'Squad',
    /** ≤ 12 chars: the toggle, and the switch's constant spoken name. */
    hideNames: 'Hide names',
    showNames: 'Show names',
    /** Spoken labels for the view toggle: no visible budget. */
    showAsList: 'Show as list',
    showAsCards: 'Show as cards',
    /** ≤ 6 chars: the filter pill for every position. */
    all: 'All',
    /** ≤ 14 chars: the dashed pill over a hidden name. */
    tapToReveal: 'Tap to reveal',
    /** A hidden name's spoken hint. */
    revealsName: 'Reveals the name',
  },
  credits: {
    /** The licence's change note, after the author and licence. */
    cropped: CROPPED,
    /** ≤ 8 chars: before the credit under the question. */
    photo: 'Photo:',
    /** The credits sheet's title. */
    title: PHOTO_CREDITS,
    /** ≤ 20 chars: the button that opens it. */
    button: (count: number) => `${PHOTO_CREDITS} · ${count}`,
  },
  results: {
    /** The flawless round's title. */
    flawlessVerdict: (team: string, season: string, level: number) =>
      `${team} · ${season}, level ${level}. Nothing missed.`,
    /** Also the share picture's title for a pass. */
    clearedTitle: (level: number) => `Level ${level} cleared`,
    clearedVerdict: 'You knew most of the starting XI.',
    failTitle: 'These are the ones to learn',
    /** `target` is "8/10". */
    toClear: (target: string, level: number) => `Score ${target} to clear level ${level}.`,
    toUnlock: (target: string, level: number) => `Score ${target} to unlock level ${level}.`,
    /** A missed card's line when the name was wrong. */
    youPicked: (picked: string) => `You picked ${picked}`,
    nameRight: 'Name right',
    nameAndPositionRight: 'Name and position right',
    /** A missed card's line after a later part, following "Name right · ". */
    wrongPart: {
      position: (right: string, picked: string) => `position is ${right}, you said ${picked}`,
      club: (right: string, picked: string) => `club is ${right}, you said ${picked}`,
      nationality: (right: string, picked: string) => `nationality is ${right}, you said ${picked}`,
    },
    /** The close button's spoken name. */
    close: 'Close, choose a different team',
    /** ≤ 22 chars: the outline button. */
    studySquad: 'Study this squad',
    /** ≤ 22 chars: the main button, and the retry icon's spoken name. */
    retry: 'Retry this round',
    /** ≤ 22 chars: the main button after a pass. */
    playLevel: (level: number) => `Play level ${level}`,
    /** ≤ 22 chars: the main button after level 3. */
    chooseTeam: 'Choose different team',
    /** ≤ 24 chars: the missed list's eyebrow, in capitals. */
    missedCount: (count: number) =>
      count === 1 ? `MISSED · ${count} PLAYER` : `MISSED · ${count} PLAYERS`,
    /** ≤ 14 chars: beside that eyebrow. */
    swipeForAll: 'Swipe for all',
    /** ≤ 24 chars: the flawless roster's eyebrow, in capitals. */
    nothingMissed: (count: number) => `ALL ${count} · NOTHING MISSED`,
    /** The round strip, spoken. */
    roundSpoken: (right: number, total: number) => `Round: ${right} of ${total} right`,
  },
  share: {
    /** The share sheet's title, the results Share button's label, Android's share dialog. */
    title: 'Share your round',
    /** The share picture's title below a pass: it speaks to whoever receives it. */
    stillLearning: 'Still learning',
    /** The share picture's question to its receiver. */
    question: (team: string) => `Can you name ${possessive(team)} squad?`,
    /** ≤ 8 chars each: the format switch. */
    image: 'Image',
    text: 'Text',
    /** ≤ 10 chars: under the chat-bubble preview. */
    preview: 'Preview',
    /** ≤ 2 lines at 360 dp: the hint under the preview (its slot is two lines tall). */
    imageHint: 'Story-sized picture. No player photos, no names — friends can still play it.',
    /** ≤ 2 lines at 360 dp: the hint under the preview (its slot is two lines tall). */
    textHint: 'The score grid for group chats, with a link to the app.',
    /** ≤ 16 chars: the submit button. */
    shareImage: 'Share image',
    shareText: 'Share text',
    /** The share picture, spoken. */
    pictureSpoken: (eyebrow: string, correct: number, total: number, title: string) =>
      `Share picture: ${eyebrow}. ${correct} of ${total}. ${title}.`,
  },
  ladder: {
    /** ≤ 14 chars: the Play card's button. */
    play: 'Play',
    /** ≤ 14 chars: the Play card's button once the level has a score. */
    playAgain: 'Play Again',
    /** Under a locked rung. `target` is "8/10". */
    unlockHint: (target: string, level: number) => `Score ${target} on L${level}`,
    /** Spoken, so the numbers are words: no "8/10" (read as a date) or "L2". */
    rungLocked: (title: string, correct: number, total: number, level: number) =>
      `${title}, locked, score ${correct} of ${total} on level ${level}`,
    rungBest: (title: string, correct: number, total: number) =>
      `${title}, best ${correct} of ${total}`,
    title: 'Choose Difficulty',
    /** Titles ≤ 18 chars: a rung's title. Descriptions wrap. */
    levels: {
      1: {
        title: 'Name from Number',
        description: 'Given a shirt number, pick the player from 4 options.',
      },
      2: {
        title: 'Name + Position',
        // The codes GK, DF, MF and FW must match the position chips' codes in
        // each language (#144 makes the codes translatable; #145 writes them).
        description: 'Pick the name, then the position — GK, DF, MF, or FW.',
      },
      3: {
        title: 'Full Profile',
        description: 'Name from 6 options, then position, then club or nationality.',
      },
    },
    /** ≤ 20 chars: the Study button or link. */
    studySquad: 'Study This Squad',
    /** The staleness footnote; `date` from `formatLastUpdated`. */
    updated: (date: string) => `Updated ${date} · Wikipedia`,
    /** ≤ 12 chars: a rung's best-score pill, in capitals. */
    best: (correct: number, total: number) => `BEST ${correct}/${total}`,
  },
  picker: {
    /** ≤ 6 chars: the league pill that clears the filter. */
    allLeagues: 'ALL',
    /** A team row's mono meta line, never played. */
    notPlayed: (season: string) => `${season} · NOT PLAYED`,
    /** A team row's mono meta line, with its best score. */
    played: (season: string, level: number, correct: number, total: number) =>
      `${season} · LEVEL ${level} · BEST ${correct}/${total}`,
    /** ≤ 8 chars: the back link, after "‹ ". The picker always returns Home. */
    home: 'Home',
    title: 'Choose a Team',
    count: (count: number) =>
      count === 1 ? `${count} team · tap to start` : `${count} teams · tap to start`,
    /** ≤ 14 chars each: the segmented control. */
    clubs: 'Clubs',
    nationalTeams: 'National Teams',
    /** The search field's placeholder and spoken name. */
    search: 'Search teams',
    clearSearch: 'Clear search',
    noTeams: 'No teams found',
    noResults: (query: string) => `No results for "${query}"`,
  },
  store: {
    /** The Play Store feature graphic's tagline (#147 localises the graphic). */
    tagline: 'Learn every squad',
  },
  about: {
    version: (version: string) => `Version ${version}`,
    /** In brackets after the version on a build's own bundle. */
    builtIn: 'built-in',
    title: 'About',
    /** Affiliation, then crests. */
    intro: [
      `${ESCUADRA} is an independent, unofficial app. It is not affiliated with, endorsed by, or associated with FIFA, UEFA, any league, any national football association, or any club. Club and national team names are used for identification only and remain the property of their respective owners. ${ESCUADRA} is also not affiliated with or endorsed by the Wikimedia Foundation, or by any player shown in a photo.`,
      `${ESCUADRA} identifies teams by their names and colours, and never shows club crests, badges or logos itself. A player photo can still show one, on a shirt or in the background, because it is part of the original photo. Those marks belong to their owners, and their appearance does not mean that any club, sponsor or brand endorses ${ESCUADRA}.`,
    ],
    credits: {
      heading: 'Data and image credits',
      sections: [
        {
          heading: 'Squad data',
          paragraphs: [
            'Squad data is compiled from Wikipedia and Wikidata and reflects the season shown on each team. Wikipedia content is available under CC BY-SA. Wikidata is available under CC0.',
          ],
        },
        {
          heading: 'Player photos',
          paragraphs: [
            "Player photos come from Wikimedia Commons. Each one is either in the public domain or used under the licence it carries on Commons: CC BY-SA, CC BY, CC0 or Commons' own Attribution licence. Photos are cropped to fill the space they appear in. On the question screen, a photo too small to fill the space is shown whole instead, over an enlarged, darkened copy of itself that fills it. Where the app's text sits over a photo, the app shades that part of the screen, and it dims the photo after a wrong answer. The photo files themselves are not edited. Not every player has a photo.",
            `The author, the licence and the word "${CROPPED}" appear under the question for as long as a photo is on screen, and again under "${PHOTO_CREDITS}" in the results, for the whole round, and at the end of the Study screen, for every player it lists. Tap the author for the photo's page on Wikimedia Commons, or the licence for its terms.`,
          ],
        },
        {
          heading: 'Flags and fonts',
          paragraphs: [
            'Flag images are from flagpedia.net and are in the public domain. The Inter, IBM Plex Mono and Archivo typefaces are used under the SIL Open Font License 1.1.',
          ],
        },
        {
          heading: 'Country names',
          paragraphs: [
            `Most country names in languages other than English come from the Unicode CLDR project and are used under the Unicode License v3. The rest were written for ${ESCUADRA}.`,
          ],
        },
      ],
    },
    /** The setting row's label and the switch's spoken name. */
    vibration: 'Vibration',
    usageStatistics: USAGE_STATISTICS,
    privacy: {
      heading: 'Privacy',
      /** Set in emphasis. */
      lead: `${ESCUADRA} has no account, no sign-in and no advertising, and it never asks for your name, email or any contact details.`,
      paragraphs: [
        'Your scores and settings are saved on your device. The only things that leave it are the ones described below, and none of them is linked to who you are.',
      ],
      sections: [
        {
          heading: 'Player photos',
          paragraphs: [
            `${ESCUADRA} does not ship player photos. They are loaded from Wikimedia Commons, run by the Wikimedia Foundation: a round's photos when the round starts, and a squad's photos on the Study screen as you scroll. Like any website, Wikimedia receives your device's IP address and the details of each request, including which photos were asked for, and so which players are in your round or squad. ${ESCUADRA} sends nothing else to Wikimedia, and Wikimedia's own privacy policy applies to what it receives.`,
            "Photos already loaded may be kept in the app's cache on your device so that they appear faster. Without a connection the quiz works as usual and shows the team's colours and the shirt number in place of any photo not already in that cache.",
            `Tapping a photo credit opens the photo's Wikimedia Commons page, or its licence on the Creative Commons website, in an in-app browser. Those sites have their own privacy policies, and ${ESCUADRA} cannot see what you do there.`,
          ],
        },
        {
          heading: 'Sharing',
          paragraphs: [
            `Sharing a result creates a picture or a short text on your device and passes it to the app you pick in your phone's share menu. ${ESCUADRA} does not see, send or keep what you share.`,
          ],
        },
        {
          heading: 'Anonymous usage statistics',
          paragraphs: [
            `${ESCUADRA} sends anonymous usage statistics to TelemetryDeck, an analytics service, unless you switch "${USAGE_STATISTICS}" off on the app's About screen. Each one carries a hashed form of a random identifier created for these statistics (separate from the one the app-update check uses) and a random session code that is new each time the app starts. Like any online service, TelemetryDeck also receives your device's IP address with each one, and TelemetryDeck's own privacy policy applies to what it receives. The identifier and the session code are random, not derived from your device, and not linked to you or your accounts. Neither ${ESCUADRA} nor the developer shares them or the statistics with anyone else.`,
            `The statistics are: the app was opened, with its language and whether that language follows your phone's language or was chosen in the app; a round started, with whether the team is a club or a nation and the difficulty level; a round finished, with the same two details, the score, and whether it was ${A_LA_ESCUADRA}; the Study screen was opened, with whether the team is a club or a nation; and a result was passed to your phone's share menu, with the level, the score and whether it was a picture or text. They never include team names, player names, your answers or anything you type.`,
          ],
        },
        {
          heading: 'App updates',
          paragraphs: [
            `When ${ESCUADRA} starts, it checks whether a newer version of the app is available from Expo, the service that delivers its updates. The check sends what is needed to deliver the right update: your device's operating system, the app's version and project, and a random identifier created for this installation. If the app crashed or failed to load an update as it last started, the check also sends Expo the technical error message from that failure. Like any online service, Expo also receives your device's IP address with each check. The identifier is not linked to you or to anything you do in the app. Without a connection, the app skips the check and works as usual.`,
          ],
        },
        {
          heading: 'What is stored on your device',
          paragraphs: [
            `${ESCUADRA} saves eight things locally, on your device: your best score for each team and difficulty level, from which it works out which levels you have completed; the last team and level you played; your light or dark appearance preference; your language choice; whether vibration is on; whether the Study screen shows cards or a list; your choice about usage statistics; and the random identifier those statistics use. The app-update check also keeps its own random identifier on your device.`,
            `This data lives in the app's own private storage. ${ESCUADRA} itself sends only two of those eight things off your device, and only while usage statistics are on: the identifier, which is sent in hashed form with each statistic, and your language choice, which is included in the statistic sent when the app is opened. Deleting the app deletes all of it from your device, along with any cached photos. ${ESCUADRA} keeps no backup or sync of its own, but your device's backups (on iOS, to iCloud or a computer; on Android, to Google) may include this data. The developer has no access to this storage.`,
          ],
        },
        {
          heading: 'Crash reports',
          paragraphs: [
            `If you allow your device to share diagnostics, Apple (on iOS) or Google (on Android) may share anonymised crash reports with the developer. That is handled by Apple or Google and controlled in your device settings. Apart from the error message the app-update check may send after a failed start, ${ESCUADRA} itself sends no crash reports.`,
          ],
        },
        {
          heading: 'Children',
          paragraphs: [
            `${ESCUADRA} has no account and asks for no personal information from anyone, including children. Usage statistics are anonymous and can be switched off at any time.`,
          ],
        },
      ],
    },
    /** The web privacy pages (#146), rendered by scripts/privacy-pages.ts.
     *  Never shown in the app. The page's nav uses `privacy.heading`. */
    site: {
      /** The page's title and heading. */
      title: 'Privacy policy',
      updated: (date: string) => `Last updated: ${date}`,
      /** Under the date: the app versions this page covers, as "2.0". */
      appliesTo: (version: string) => `This policy applies to ${ESCUADRA} ${version} and later.`,
      /** The link after it, to the 1.x policy at privacy.html. */
      earlierVersions: 'Privacy policy for earlier versions',
      /** The spoken name of the Escuadra link in the header. */
      home: `${ESCUADRA} home`,
      /** The spoken name of the list of languages. */
      languages: 'Language',
      nav: {
        home: 'Home',
        support: 'Support',
        /** The spoken name of the list of links in the header. */
        utility: 'Utility',
        /** The spoken name of the list of links in the footer. */
        footer: 'Footer',
      },
      theme: {
        light: 'Light',
        dark: 'Dark',
        toLight: 'Switch to light theme',
        toDark: 'Switch to dark theme',
      },
      releaseStatus: 'Now on the App Store',
    },
  },
};

export type Messages = typeof en;
