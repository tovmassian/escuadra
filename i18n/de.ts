// The Deutsch catalog (#145), typed against ./en.ts: same keys, same order,
// same parameters. Drafted by Claude; a native speaker reviews it before it
// merges (#145). About and the store tagline are English until #146 and #147
// translate them with their legal and listing copy.
// Escuadra and a la escuadra come from ./names and are never translated.
import { en, type CalendarDate, type Messages } from './en';

const MONTHS = [
  'Jan.',
  'Feb.',
  'März',
  'Apr.',
  'Mai',
  'Juni',
  'Juli',
  'Aug.',
  'Sept.',
  'Okt.',
  'Nov.',
  'Dez.',
];

const PHOTO_CREDITS = 'Bildnachweise';

export const de: Messages = {
  common: {
    // "Level", not "Stufe": German players say Level, and it matches the
    // capitals in the meta lines ("LEVEL 3 · REKORD 10/10").
    level: (level: number) => `Level ${level}`,
    back: 'Zurück',
    close: 'Schließen',
    scoreSpoken: (correct: number, attempted: number) => `Ergebnis: ${correct} von ${attempted}`,
  },
  home: {
    aboutLink: 'Info',
    darkTheme: 'Dunkles Design',
    languageLabel: (name: string) => `Sprache: ${name}`,
    // "Rekord" for the best score, here, on the ladder pill and in the picker.
    continueMeta: (level: number, best: number | undefined, total: number) =>
      best === undefined ? `LEVEL ${level}` : `LEVEL ${level} · REKORD ${best}/${total}`,
    startTraining: 'Training starten',
    browseAllTeams: 'Alle Teams ansehen',
  },
  languageSheet: {
    title: 'Sprache',
    matchPhone: (name: string) => `Systemsprache · ${name}`,
  },
  formats: {
    /** "21. Aug. 2026". */
    date: ({ day, month, year }: CalendarDate) => `${day}. ${MONTHS[month - 1] ?? ''} ${year}`,
  },
  // TW Torwart, AB Abwehr, MF Mittelfeld, ST Sturm.
  positionCodes: { GK: 'TW', DF: 'AB', MF: 'MF', FW: 'ST' },
  positions: { GK: 'Torwart', DF: 'Abwehr', MF: 'Mittelfeld', FW: 'Sturm' },
  slots: { NAME: 'Name', POS: 'Position', AGE: 'Alter', CLUB: 'Verein', NAT: 'Nationalität' },
  slotCodes: { NAME: 'NAME', POS: 'POS', AGE: 'ALTER', CLUB: 'VEREIN', NAT: 'NAT' },
  round: {
    correct: 'Richtig',
    missed: 'Daneben',
    whoWears: (no: number) => `Wer trägt die ${no}?`,
    askPosition: 'Welche Position?',
    askClub: 'Welcher Verein?',
    askNationality: 'Welche Nation?',
    seeResults: 'Zum Ergebnis',
    next: 'Weiter',
    nextQuestion: 'Nächste Frage',
    gotItNext: 'Gemerkt – weiter',
    // "Zum Ergebnis · zum Überspringen tippen" is 37 chars against 26. The
    // ellipsis says it moves on in a moment; "oder tippen" says a tap is sooner.
    tapToSkip: (label: string) => `${label} … oder tippen`,
    slotSpoken: {
      given: (slot: string, value: string) => `${slot}: ${value}`,
      active: (slot: string) => `${slot}: wird gefragt`,
      pending: (slot: string) => `${slot}: kommt als Nächstes`,
      correct: (slot: string, value: string) => `${slot}: ${value}, richtig`,
      wrong: (slot: string, value: string) => `${slot}: ${value}, die richtige Antwort`,
      notAsked: (slot: string, value: string) => `${slot}: ${value}, nicht gefragt`,
    },
    leave: 'Runde verlassen',
    shirtNumber: (no: number) => `Rückennummer ${no}`,
    // "Wähle", not "Tippe": "Tippe deine Antwort" also reads "type your answer".
    tapYourAnswer: 'Wähle deine Antwort',
    movesOn: 'Geht gleich von selbst weiter',
    answerTag: 'Lösung',
    tileSpoken: {
      idle: '',
      'correct-picked': 'richtig',
      'correct-unpicked': 'die richtige Antwort',
      'incorrect-picked': 'deine Wahl, falsch',
      'incorrect-other': '',
    },
    questionOf: (n: number, total: number) => `Frage ${n} von ${total}`,
    streak: (count: number) => `Serie: ${count} in Folge`,
  },
  study: {
    // "Spieler" is both singular and plural.
    players: (count: number) => `${count} Spieler`,
    shownOf: (shown: number, total: number) => `${shown} von ${total}`,
    noNumber: 'ohne Rückennummer',
    nameHidden: 'Name verborgen',
    title: 'Kader',
    // "Namen ausblenden" is 16 chars against 12. As a switch, it is spoken
    // "Ohne Namen, ein" or "…, aus".
    hideNames: 'Ohne Namen',
    showNames: 'Namen zeigen',
    showAsList: 'Als Liste zeigen',
    showAsCards: 'Als Karten zeigen',
    all: 'Alle',
    tapToReveal: 'Aufdecken',
    revealsName: 'Zeigt den Namen',
  },
  credits: {
    cropped: 'zugeschnitten',
    photo: 'Foto:',
    title: PHOTO_CREDITS,
    button: (count: number) => `${PHOTO_CREDITS} · ${count}`,
  },
  results: {
    flawlessVerdict: (team: string, season: string, level: number) =>
      `${team} · ${season}, Level ${level}. Kein Fehler.`,
    clearedTitle: (level: number) => `Level ${level} geschafft`,
    clearedVerdict: 'Du kennst den Großteil der Startelf.',
    failTitle: 'Die hier solltest du dir merken',
    toClear: (target: string, level: number) => `Hol ${target}, um Level ${level} zu schaffen.`,
    toUnlock: (target: string, level: number) => `Hol ${target}, um Level ${level} freizuschalten.`,
    // The words first: a long name truncates, the words must not.
    youPicked: (picked: string) => `Deine Wahl: ${picked}`,
    nameRight: 'Name richtig',
    nameAndPositionRight: 'Name und Position richtig',
    wrongPart: {
      position: (right: string, picked: string) => `Position: ${right}, nicht ${picked}`,
      club: (right: string, picked: string) => `Verein: ${right}, nicht ${picked}`,
      nationality: (right: string, picked: string) => `Nationalität: ${right}, nicht ${picked}`,
    },
    close: 'Schließen, anderes Team wählen',
    studySquad: 'Kader lernen',
    retry: 'Runde wiederholen',
    playLevel: (level: number) => `Level ${level} spielen`,
    chooseTeam: 'Anderes Team wählen',
    // "Daneben", as the round says after a miss.
    missedCount: (count: number) => `DANEBEN · ${count} SPIELER`,
    swipeForAll: 'Wisch für mehr',
    nothingMissed: (count: number) => `ALLE ${count} · KEIN FEHLER`,
    roundSpoken: (right: number, total: number) => `Runde: ${right} von ${total} richtig`,
  },
  share: {
    title: 'Runde teilen',
    stillLearning: 'Lerne noch',
    // The name first, so it needs no article or case ending.
    question: (team: string) => `${team}: Kennst du den ganzen Kader?`,
    image: 'Bild',
    text: 'Text',
    preview: 'Vorschau',
    imageHint: 'Bild im Story-Format, ohne Fotos und Namen – so können Freunde mitraten.',
    textHint: 'Das Ergebnisraster für Gruppenchats, mit Link zur App.',
    shareImage: 'Bild teilen',
    shareText: 'Text teilen',
    pictureSpoken: (eyebrow: string, correct: number, total: number, title: string) =>
      `Bild zum Teilen: ${eyebrow}. ${correct} von ${total}. ${title}.`,
  },
  ladder: {
    play: 'Spielen',
    playAgain: 'Noch mal',
    unlockHint: (target: string, level: number) => `Hol ${target} in L${level}`,
    rungLocked: (title: string, hint: string) => `${title}, gesperrt, ${hint}`,
    rungBest: (title: string, correct: number, total: number) =>
      `${title}, Rekord ${correct} von ${total}`,
    title: 'Schwierigkeit wählen',
    levels: {
      1: {
        title: 'Name zur Nummer',
        description: 'Du siehst die Rückennummer und wählst den Spieler aus 4 Optionen.',
      },
      2: {
        title: 'Name und Position',
        description: 'Erst den Namen, dann die Position – TW, AB, MF oder ST.',
      },
      3: {
        title: 'Volles Profil',
        description: 'Name aus 6 Optionen, dann Position, dann Verein oder Nationalität.',
      },
    },
    studySquad: 'Kader lernen',
    updated: (date: string) => `Stand: ${date} · Wikipedia`,
    best: (correct: number, total: number) => `REKORD ${correct}/${total}`,
  },
  picker: {
    allLeagues: 'ALLE',
    notPlayed: (season: string) => `${season} · NICHT GESPIELT`,
    played: (season: string, level: number, correct: number, total: number) =>
      `${season} · LEVEL ${level} · REKORD ${correct}/${total}`,
    home: 'Start',
    title: 'Team wählen',
    count: (count: number) =>
      count === 1
        ? `${count} Team · zum Starten antippen`
        : `${count} Teams · zum Starten antippen`,
    clubs: 'Vereine',
    nationalTeams: 'Nationalteams',
    search: 'Teams suchen',
    clearSearch: 'Suche löschen',
    noTeams: 'Keine Teams gefunden',
    noResults: (query: string) => `Keine Ergebnisse für „${query}“`,
  },
  // English until #147 localises the feature graphic with the store listing.
  store: en.store,
  // English until #146 translates About with the privacy policy.
  about: en.about,
};
