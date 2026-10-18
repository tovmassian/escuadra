// The Italiano catalog (#145), typed against ./en.ts: same keys, same order,
// same parameters. Drafted by Claude for native review (#145); 'it' stays in
// SUPPORTED_LANGUAGES only once a native speaker signs it off. About and the
// store tagline are English until #146 and #147 translate them with their
// legal and listing copy.
// Escuadra and a la escuadra come from ./names and are never translated.
//
// The player is "tu"; apostrophes are ’. A team's name sits before a colon or
// alone, never after an articulated preposition ("della Spagna", "del
// Brasile", "dell’Inter", "dei Paesi Bassi"): the data gives no gender or
// article. A round of ten questions is a "partita", the word Italian quiz apps
// use for one game; "turno" reads as whose turn it is, and nobody takes turns.
import { en, type CalendarDate, type Messages } from './en';

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const PHOTO_CREDITS = 'Crediti foto';

export const it: Messages = {
  common: {
    level: (level: number) => `Livello ${level}`,
    back: 'Indietro',
    close: 'Chiudi',
    scoreSpoken: (correct: number, attempted: number) => `Punteggio: ${correct} su ${attempted}`,
  },
  home: {
    // "Informazioni" is 12 chars against 8.
    aboutLink: 'Info',
    darkTheme: 'Tema scuro',
    languageLabel: (name: string) => `Lingua: ${name}`,
    // "Record" for the best score, here, on the ladder pill and in the picker:
    // Italian says "il mio record".
    continueMeta: (level: number, best: number | undefined, total: number) =>
      best === undefined ? `LIVELLO ${level}` : `LIVELLO ${level} · RECORD ${best}/${total}`,
    startTraining: 'Allenati',
    browseAllTeams: 'Tutte le squadre',
  },
  languageSheet: {
    title: 'Lingua',
    // "Lingua del telefono · Italiano" is 30 chars against 28.
    matchPhone: (name: string) => `Lingua di sistema · ${name}`,
  },
  formats: {
    /** "21 ago 2026". */
    date: ({ day, month, year }: CalendarDate) => `${day} ${MONTHS[month - 1] ?? ''} ${year}`,
  },
  // POR portiere, DIF difensore, CEN centrocampista, ATT attaccante.
  positionCodes: { GK: 'POR', DF: 'DIF', MF: 'CEN', FW: 'ATT' },
  // "Centrocampista" is 14 chars against 11, so the area, like "Midfield".
  positions: { GK: 'Portiere', DF: 'Difensore', MF: 'Centrocampo', FW: 'Attaccante' },
  // "Ruolo", the word Italian football uses for a player's position.
  slots: { NAME: 'Nome', POS: 'Ruolo', AGE: 'Età', CLUB: 'Club', NAT: 'Nazionalità' },
  slotCodes: { NAME: 'NOME', POS: 'RUOLO', AGE: 'ETÀ', CLUB: 'CLUB', NAT: 'NAZ' },
  round: {
    correct: 'Giusto',
    missed: 'Sbagliato',
    whoWears: (no: number) => `Chi ha il ${no}?`,
    askPosition: 'Che ruolo?',
    askClub: 'Quale club?',
    // Not "Che paese?": on a club squad that could mean the country the
    // player plays in. Nazionalità, as on the NAZ chip.
    askNationality: 'Nazionalità?',
    seeResults: 'Risultati',
    // The ellipsis says the round moves on by itself; "o tocca qui" says a tap
    // is sooner. Italian sets the ellipsis tight against the word before it.
    next: 'Avanti',
    nextQuestion: 'Prossima domanda',
    gotItNext: 'Capito, avanti',
    tapToSkip: (label: string) => `${label}… o tocca qui`,
    slotSpoken: {
      given: (slot: string, value: string) => `${slot}: ${value}`,
      active: (slot: string) => `${slot}: da indovinare`,
      pending: (slot: string) => `${slot}: da indovinare dopo`,
      correct: (slot: string, value: string) => `${slot}: ${value}, esatto`,
      wrong: (slot: string, value: string) => `${slot}: ${value}, la risposta giusta`,
      // Not "non richiesto": Età and Nazionalità are feminine, and the slot
      // comes in as a parameter with no gender.
      notAsked: (slot: string, value: string) => `${slot}: ${value}, non fa parte della domanda`,
    },
    leave: 'Esci dalla partita',
    shirtNumber: (no: number) => `Maglia numero ${no}`,
    // "Scegli", not "Tocca": the answer is picked, not typed.
    tapYourAnswer: 'Scegli la risposta',
    movesOn: 'Va avanti automaticamente tra un attimo',
    answerTag: 'Risposta',
    tileSpoken: {
      idle: '',
      'correct-picked': 'esatto',
      'correct-unpicked': 'la risposta giusta',
      'incorrect-picked': 'la tua scelta, sbagliata',
      'incorrect-other': '',
    },
    questionOf: (n: number, total: number) => `Domanda ${n} di ${total}`,
    // "Striscia", not "Serie": in Italian football Serie is a league.
    streak: (count: number) =>
      count === 1
        ? `Striscia: ${count} risposta giusta`
        : `Striscia: ${count} risposte giuste di fila`,
  },
  study: {
    players: (count: number) => (count === 1 ? `${count} giocatore` : `${count} giocatori`),
    shownOf: (shown: number, total: number) => `${shown} di ${total}`,
    noNumber: 'senza numero',
    nameHidden: 'nome nascosto',
    title: 'Rosa',
    // Actions, not states: the pill says what a tap does. "Nascondi i nomi"
    // (15) and "Mostra i nomi" (13) are over 12. "Copri i nomi" is the
    // flashcard gesture, covering the answers to test yourself.
    hideNames: 'Copri i nomi',
    showNames: 'Vedi i nomi',
    showAsList: 'Mostra come elenco',
    showAsCards: 'Mostra come schede',
    all: 'Tutti',
    // "Tocca per vedere" is 16 chars against 14.
    tapToReveal: 'Scopri il nome',
    revealsName: 'Mostra il nome',
  },
  credits: {
    // Feminine: it is the photo that is cropped.
    cropped: 'ritagliata',
    photo: 'Foto:',
    title: PHOTO_CREDITS,
    button: (count: number) => `${PHOTO_CREDITS} · ${count}`,
  },
  results: {
    flawlessVerdict: (team: string, season: string, level: number) =>
      `${team} · ${season}, livello ${level}. Zero errori.`,
    clearedTitle: (level: number) => `Livello ${level} superato`,
    // "L’undici titolare", the starting eleven.
    clearedVerdict: 'Conosci quasi tutto l’undici titolare.',
    failTitle: 'Ecco quelli da imparare',
    toClear: (target: string, level: number) => `Fai ${target} per superare il livello ${level}.`,
    toUnlock: (target: string, level: number) => `Fai ${target} per sbloccare il livello ${level}.`,
    // The words first: a long name truncates, the words must not.
    youPicked: (picked: string) => `La tua scelta: ${picked}`,
    nameRight: 'Nome giusto',
    nameAndPositionRight: 'Nome e ruolo giusti',
    wrongPart: {
      position: (right: string, picked: string) => `ruolo: ${right}, non ${picked}`,
      club: (right: string, picked: string) => `club: ${right}, non ${picked}`,
      nationality: (right: string, picked: string) => `nazionalità: ${right}, non ${picked}`,
    },
    close: 'Chiudi e scegli un’altra squadra',
    // "Ripassare": going over something before a test.
    studySquad: 'Ripassa la rosa',
    retry: 'Rigioca la partita',
    playLevel: (level: number) => `Gioca il livello ${level}`,
    chooseTeam: 'Cambia squadra',
    // "Sbagliato", as the round says after a miss.
    missedCount: (count: number) =>
      count === 1 ? `SBAGLIATO · ${count} GIOCATORE` : `SBAGLIATI · ${count} GIOCATORI`,
    // "Scorri per vederli tutti" is 24 chars against 14. Beside the missed
    // cards, the verb alone says it.
    swipeForAll: 'Scorri',
    // "Tutti e 10", the Italian idiom; "Zero errori", as the flawless verdict
    // says. "Nessun errore" would make the line 26 chars against 24.
    nothingMissed: (count: number) => `TUTTI E ${count} · ZERO ERRORI`,
    roundSpoken: (right: number, total: number) =>
      `Partita: ${right} ${right === 1 ? 'risposta giusta' : 'risposte giuste'} su ${total}`,
  },
  share: {
    title: 'Condividi la partita',
    // Speaks to whoever receives the picture: not there yet, but working on it.
    stillLearning: 'In allenamento',
    // The name first, so it needs no article ("della rosa dell’Inter").
    question: (team: string) => `${team}: conosci tutta la rosa?`,
    image: 'Immagine',
    text: 'Testo',
    preview: 'Anteprima',
    // "Storie", the word Instagram and Facebook use in Italian. No photos or
    // names give the answers away, so friends can still play.
    imageHint: 'Formato storie. Senza foto né nomi, così i tuoi amici possono giocare.',
    textHint: 'La griglia dei risultati per le chat di gruppo, con un link all’app.',
    // "Condividi immagine" is 18 chars against 16, so both say "Invia".
    shareImage: 'Invia immagine',
    shareText: 'Invia testo',
    pictureSpoken: (eyebrow: string, correct: number, total: number, title: string) =>
      `Immagine da condividere: ${eyebrow}. ${correct} su ${total}. ${title}.`,
  },
  ladder: {
    play: 'Gioca',
    playAgain: 'Gioca ancora',
    // No verb, as the rung titles beside it would wrap.
    unlockHint: (target: string, level: number) => `${target} al livello ${level}`,
    rungLocked: (title: string, hint: string) => `${title}, bloccato, ${hint}`,
    rungBest: (title: string, correct: number, total: number) =>
      `${title}, record ${correct} su ${total}`,
    title: 'Scegli la difficoltà',
    levels: {
      1: {
        title: 'Nome dal numero',
        description: 'Dato il numero di maglia, scegli il giocatore tra 4 opzioni.',
      },
      2: {
        title: 'Nome e ruolo',
        description: 'Scegli il nome, poi il ruolo: POR, DIF, CEN o ATT.',
      },
      3: {
        title: 'Profilo completo',
        description: 'Il nome tra 6 opzioni, poi il ruolo, poi il club o la nazionalità.',
      },
    },
    studySquad: 'Ripassa la rosa',
    updated: (date: string) => `Aggiornato il ${date} · Wikipedia`,
    best: (correct: number, total: number) => `RECORD ${correct}/${total}`,
  },
  picker: {
    // Masculine: the campionati.
    allLeagues: 'TUTTI',
    // "Da giocare" needs no gender: "mai giocato" would have to agree with a
    // club or a squadra.
    notPlayed: (season: string) => `${season} · DA GIOCARE`,
    played: (season: string, level: number, correct: number, total: number) =>
      `${season} · LIVELLO ${level} · RECORD ${correct}/${total}`,
    home: 'Home',
    title: 'Scegli una squadra',
    count: (count: number) =>
      count === 1
        ? `${count} squadra · tocca per iniziare`
        : `${count} squadre · tocca per iniziare`,
    // "Club" takes no plural in Italian.
    clubs: 'Club',
    nationalTeams: 'Nazionali',
    search: 'Cerca squadre',
    clearSearch: 'Cancella la ricerca',
    noTeams: 'Nessuna squadra trovata',
    noResults: (query: string) => `Nessun risultato per “${query}”`,
  },
  // English until #147 localises the feature graphic with the store listing.
  store: en.store,
  // English until #146 translates About with the privacy policy.
  about: en.about,
};
