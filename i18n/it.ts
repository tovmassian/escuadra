// The Italiano catalog (#145), typed against ./en.ts: same keys, same order,
// same parameters. Drafted by Claude; a native speaker reviews it before it
// merges (#145). The store tagline is English until #147 translates it with
// the listing copy.
// Escuadra and a la escuadra come from ./names and are never translated.
//
// The player is "tu"; apostrophes are ’. A team's name sits before a colon or
// alone, never after an articulated preposition ("della Spagna", "del
// Brasile", "dell’Inter", "dei Paesi Bassi"): the data gives no gender or
// article. A round of ten questions is a "partita", the word Italian quiz apps
// use for one game; "turno" reads as whose turn it is, and nobody takes turns.
import { en, type CalendarDate, type Messages } from './en';
import { A_LA_ESCUADRA, ESCUADRA } from './names';

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MONTHS_LONG = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

const PHOTO_CREDITS = 'Crediti foto';
// Feminine: it is the photo that is cropped.
const CROPPED = 'ritagliata';
const USAGE_STATISTICS = 'Statistiche d’uso';

export const it: Messages = {
  common: {
    level: (level: number) => `Livello ${level}`,
    back: 'Indietro',
    close: 'Chiudi',
    scoreSpoken: (correct: number, attempted: number) => `Punteggio: ${correct} su ${attempted}`,
    outdated: 'Obsoleto',
  },
  home: {
    // "Impostazioni", as iOS and Android name the screen.
    settings: 'Impostazioni',
    // "Record" for the best score, here, on the ladder pill and in the picker:
    // Italian says "il mio record".
    continueMeta: (level: number, best: number | undefined, total: number) =>
      best === undefined ? `LIVELLO ${level}` : `LIVELLO ${level} · RECORD ${best}/${total}`,
    startTraining: 'Allenati',
    headline: 'Conosci ogni numero.',
    continueTeam: (team: string) => `Continua: ${team}`,
    allTeams: 'Tutte le squadre',
    starHint: 'Metti la stella a una squadra: ti aspetta qui.',
  },
  tips: {
    // "Come si gioca", as game menus say; About's stored list names the tips
    // ("consigli") the same way.
    kicker: (step: number, count: number) => `Come si gioca · ${step}/${count}`,
    spoken: (step: number, count: number) => `Come si gioca, consiglio ${step} di ${count}`,
    next: 'Avanti',
    // "Capito", as the round's "Capito, avanti" says.
    gotIt: 'Capito',
    // "Salta i consigli" is 16 chars against 14; Avanti already moves one tip on.
    skip: 'Salta',
    picker: {
      switch: {
        heading: 'Club o nazionali',
        body: 'Cambia qui, poi filtra per campionato o per confederazione.',
      },
      pick: {
        heading: 'Scegli una squadra',
        body: 'Tocca una squadra per vederne i livelli e iniziare.',
      },
    },
    difficulty: {
      start: {
        heading: 'Inizia da qui',
        body: 'Vedi un numero di maglia e qualche indizio, e scegli il nome. Fai 8/10 per sbloccare il livello 2.',
      },
      star: {
        // Feminine: the squadra.
        heading: 'Rendila tua',
        body: 'Metti la stella a una squadra: ti aspetta nella schermata principale dell’app.',
      },
      study: {
        heading: 'Oppure ripassa prima',
        body: 'Sfoglia tutta la rosa. Copri i nomi per metterti alla prova.',
      },
    },
    study: {
      hide: {
        heading: 'Mettiti alla prova',
        body: 'Copri i nomi, poi tocca una scheda per verificare.',
      },
      positions: {
        heading: 'Un ruolo alla volta',
        body: 'Impara prima i portieri, poi la difesa, il centrocampo e l’attacco.',
      },
    },
  },
  languageSheet: {
    title: 'Lingua',
    // "Lingua del telefono · Italiano" is 30 chars against 28.
    matchPhone: (name: string) => `Lingua di sistema · ${name}`,
  },
  settings: {
    title: 'Impostazioni',
    sections: {
      play: 'Gioco',
      privacy: 'Privacy',
      // The section holds only the Rate card: backing the app, not a help desk
      // ("Assistenza", as the web pages' nav says; "Supporto" reads the same).
      support: 'Sostieni l’app',
      comingNext: 'In arrivo',
      // "Info", as the About screen's title says.
      about: 'Info',
    },
    language: 'Lingua',
    languageSpoken: (name: string) => `Lingua: ${name}`,
    // "Aspetto", the iOS setting for light and dark.
    appearance: 'Aspetto',
    // "Sistema", as "Lingua di sistema" says for the language.
    appearanceOptions: { system: 'Sistema', dark: 'Scuro', light: 'Chiaro' },
    // "Vibrazione", the setting's name on iOS and Android in Italian.
    vibration: 'Vibrazione',
    usageStatistics: USAGE_STATISTICS,
    // Feminine plural: the statistics.
    usageNote: 'Anonime. In “Info” trovi esattamente cosa viene inviato.',
    rate: {
      title: `Valuta ${ESCUADRA}`,
      line: 'Il tuo voto aiuta altri tifosi a trovare l’app.',
      button: 'Valuta',
    },
    // "Info" is the About screen's short title; the row has room for the
    // usual "Informazioni su".
    aboutEscuadra: `Informazioni su ${ESCUADRA}`,
    privacy: 'Privacy',
    licences: 'Licenze',
    version: (version: string) => `Versione ${version}`,
    // Feminine: it is the version that is built in.
    builtIn: 'integrata',
  },
  examMode: {
    title: 'Modalità esame',
    line: 'Tutta la rosa, solo con i numeri di maglia.',
    soon: 'A breve',
  },
  formats: {
    /** "21 ago 2026". */
    date: ({ day, month, year }: CalendarDate) => `${day} ${MONTHS[month - 1] ?? ''} ${year}`,
    /** "21 ottobre 2026", and "1º ottobre 2026" on the first of the month. */
    longDate: ({ day, month, year }: CalendarDate) =>
      `${day === 1 ? '1º' : day} ${MONTHS_LONG[month - 1] ?? ''} ${year}`,
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
    // "il" elides before 8, 11 and 80–89 (l’8, l’11), so never put it
    // directly before a number.
    whoWears: (no: number) => `Chi ha il numero ${no}?`,
    askPosition: 'Che ruolo?',
    askClub: 'Quale club?',
    // Not "Che paese?": on a club squad that could mean the country the
    // player plays in. Nazionalità, as on the NAZ chip.
    askNationality: 'Nazionalità?',
    seeResults: 'Risultati',
    next: 'Avanti',
    nextQuestion: 'Prossima domanda',
    gotItNext: 'Capito, avanti',
    // The ellipsis says the round moves on by itself; "o tocca qui" says a tap
    // is sooner. Italian sets the ellipsis tight against the word before it.
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
    // "Scegli", not "Tocca": it names the choice, as de and fr do.
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
    cropped: CROPPED,
    photo: 'Foto:',
    title: PHOTO_CREDITS,
    button: (count: number) => `${PHOTO_CREDITS} · ${count}`,
  },
  results: {
    flawlessVerdict: (team: string, season: string, level: number) =>
      `${team} · ${season}, livello ${level}. Zero errori.`,
    clearedTitle: (level: number) => `Livello ${level} superato`,
    // "I titolari", the starting eleven.
    clearedVerdict: 'Conosci quasi tutti i titolari.',
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
    // "Errori", as "Zero errori" says below: a label with its count, which
    // stays the same for one. "Sbagliati · 8 giocatori" also reads as "the
    // wrong players".
    missedCount: (count: number) => `ERRORI · ${count}`,
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
    // Italian shares "il risultato", not the game.
    title: 'Condividi il risultato',
    // Speaks to whoever receives the picture: not there yet, but working on it.
    // "In allenamento" wraps the picture's title to two lines.
    stillLearning: 'Sto imparando',
    // The name first, so it needs no article ("della rosa dell’Inter").
    question: (team: string) => `${team}: conosci tutta la rosa?`,
    image: 'Immagine',
    text: 'Testo',
    preview: 'Anteprima',
    // "Storie", the word Instagram and Facebook use in Italian. No photos or
    // names give the answers away, so friends can still play.
    imageHint: 'Formato storie. Senza foto né nomi, così anche i tuoi amici possono giocare.',
    textHint: 'La griglia dei risultati per le chat di gruppo, con un link all’app.',
    // "Condividi immagine" is 18 chars against 16, so both say "Invia".
    shareImage: 'Invia immagine',
    shareText: 'Invia testo',
    pictureSpoken: (eyebrow: string, correct: number, total: number, title: string) =>
      `Immagine da condividere: ${eyebrow}. ${correct} su ${total}. ${title}.`,
  },
  ladder: {
    // The target first, as French does: "Livello 1: 8/10" reads as a
    // recorded score. "8/10 al livello 2" wraps "Profilo completo" beside it.
    unlockHint: (target: string, level: number) => `${target} al liv. ${level}`,
    rungLocked: (title: string, correct: number, total: number, level: number) =>
      `${title}, bloccato, ${correct} su ${total} al livello ${level}`,
    rungBest: (title: string, correct: number, total: number) =>
      `${title}, record ${correct} su ${total}`,
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
        descriptionClub: 'Scegli il nome tra 6 opzioni, poi il ruolo, poi la nazionalità.',
        descriptionNation: 'Scegli il nome tra 6 opzioni, poi il ruolo, poi il club.',
      },
    },
    studySquad: 'Ripassa la rosa',
    // Not "Aggiornato il": "il 8 set" and "il 11 set" need elision.
    updated: (date: string) => `Aggiornato: ${date} · Wikipedia`,
    heading: 'I livelli',
    nationalTeam: 'Nazionale',
    cleared: 'Superato',
    notPlayed: 'Non ancora giocato',
    yourBest: (correct: number, total: number) => `Il tuo record · ${correct}/${total}`,
    yourBestSpoken: (correct: number, total: number) => `Il tuo record: ${correct} su ${total}`,
    playLevel: (level: number) => `Gioca livello ${level}`,
    rungCleared: (title: string, correct: number, total: number) =>
      `${title}, record ${correct} su ${total}, superato`,
    rungEscuadra: (title: string, correct: number, total: number) =>
      `${title}, record ${correct} su ${total}, ${A_LA_ESCUADRA}`,
    star: 'Una delle tue squadre',
    bestOutdated: (correct: number, total: number) => `Record ${correct}/${total} · Obsoleto`,
    bestOutdatedSpoken: (correct: number, total: number) =>
      `Record: ${correct} su ${total}, obsoleto`,
    rungOutdated: (title: string, correct: number, total: number) =>
      `${title}, record ${correct} su ${total}, obsoleto`,
    squadUpdated: (date: string) => `Rosa aggiornata: ${date}. I record in grigio sono di prima.`,
  },
  picker: {
    // Masculine: the campionati.
    allLeagues: 'Tutti',
    // "Squadra", the team chosen, as Home and Results say; "rosa" is the list
    // of players, and "la tua rosa" reads as fantacalcio.
    title: 'Scegli la tua squadra',
    squadCount: (count: number) => (count === 1 ? `${count} squadra` : `${count} squadre`),
    // "Club" takes no plural in Italian.
    clubs: 'Club',
    nations: 'Nazionali',
    allClubs: 'Tutti i club',
    // Feminine: the confederazioni.
    allConfederations: 'Tutte',
    regions: {
      UEFA: 'Europa',
      CONMEBOL: 'Sudamerica',
      CONCACAF: 'Nord e Centro America e Caraibi',
      CAF: 'Africa',
      AFC: 'Asia',
      OFC: 'Oceania',
    },
    allNations: 'Tutte le nazionali',
    nationsCaption: (name: string) => `${name} · A–Z`,
    listCaption: (name: string, count: number) => `${name} · ${count}`,
    bestSpoken: (level: number, correct: number, total: number) =>
      `Livello ${level}, record ${correct} su ${total}`,
    bestOutdatedSpoken: (level: number, correct: number, total: number) =>
      `Livello ${level}, record ${correct} su ${total}, obsoleto`,
    search: 'Cerca squadre',
    clearSearch: 'Cancella la ricerca',
    noTeams: 'Nessuna squadra trovata',
    noResults: (query: string) => `Nessun risultato per “${query}”`,
    yourSquads: 'Le tue squadre',
  },
  // English until #147 localises the feature graphic with the store listing.
  store: en.store,
  about: {
    // "Info" matches the screen's title and Settings' ABOUT label (settings.sections.about).
    title: 'Info',
    // Escuadra is "l’app", so feminine: "affiliata", "approvata".
    intro: [
      `${ESCUADRA} è un’app indipendente e non ufficiale. Non è affiliata né associata alla FIFA, alla UEFA o ad altre confederazioni, ad alcuna lega, ad alcuna federazione calcistica nazionale o ad alcun club, e non è approvata da nessuno di essi. I nomi dei club, delle nazionali e delle confederazioni sono usati solo a scopo identificativo e restano di proprietà dei rispettivi titolari. Inoltre, ${ESCUADRA} non è affiliata alla Wikimedia Foundation né ad alcun giocatore che compare in una foto, e non è approvata da nessuno di essi.`,
      `${ESCUADRA} identifica le squadre con il loro nome e i loro colori, e di per sé non mostra mai stemmi, emblemi o loghi dei club. Una foto di un giocatore può comunque mostrarne uno, su una maglia o sullo sfondo, perché fa parte della foto originale. Quei segni distintivi appartengono ai rispettivi titolari, e la loro presenza non significa che un club, uno sponsor o un marchio approvi ${ESCUADRA}.`,
    ],
    credits: {
      heading: 'Crediti per dati e immagini',
      sections: [
        {
          heading: 'Dati delle rose',
          paragraphs: [
            'I dati delle rose sono raccolti da Wikipedia e Wikidata e rispecchiano la stagione indicata per ciascuna squadra. I contenuti di Wikipedia sono disponibili con licenza CC BY-SA. Wikidata è disponibile con licenza CC0.',
          ],
        },
        {
          heading: 'Foto dei giocatori',
          paragraphs: [
            'Le foto dei giocatori provengono da Wikimedia Commons. Ognuna è di pubblico dominio oppure è usata con la licenza riportata su Commons: CC BY-SA, CC BY, CC0 o la licenza “Attribution” propria di Commons. Le foto vengono ritagliate per riempire lo spazio in cui compaiono. Nella schermata delle domande, una foto troppo piccola per riempire quello spazio viene invece mostrata intera, sopra una copia ingrandita e scurita di sé stessa che lo riempie. Dove il testo dell’app si sovrappone a una foto, l’app ombreggia quella parte dello schermo, e scurisce la foto dopo una risposta sbagliata. I file delle foto in sé non vengono modificati. Non tutti i giocatori hanno una foto.',
            `L’autore, la licenza e la parola “${CROPPED}” compaiono sotto la domanda finché una foto è sullo schermo, e di nuovo sotto “${PHOTO_CREDITS}” nei risultati, per l’intera partita, e in fondo alla schermata “Rosa”, per ogni giocatore elencato. Tocca l’autore per aprire la pagina della foto su Wikimedia Commons, o la licenza per leggerne le condizioni.`,
          ],
        },
        {
          heading: 'Bandiere e font',
          paragraphs: [
            'Le immagini delle bandiere provengono da flagpedia.net e sono di pubblico dominio. I caratteri tipografici Inter, IBM Plex Mono e Archivo sono usati in base alla SIL Open Font License 1.1.',
          ],
        },
        {
          heading: 'Nomi dei paesi',
          paragraphs: [
            `I nomi dei paesi nelle lingue diverse dall’inglese provengono per la maggior parte dal progetto Unicode CLDR e sono usati in base alla Unicode License v3. Gli altri sono stati scritti per ${ESCUADRA}.`,
          ],
        },
      ],
    },
    licences: {
      label: 'Licenze',
      originalLanguage: 'I testi delle licenze sono riportati così come sono, in inglese.',
      countryNames: 'Nomi dei paesi',
      fonts: 'Font',
      software: 'Software',
    },
    privacy: {
      heading: 'Privacy',
      lead: `${ESCUADRA} non prevede account né login, non contiene pubblicità e non ti chiede mai il tuo nome, la tua email né alcun dato di contatto.`,
      paragraphs: [
        'I tuoi punteggi e le tue impostazioni vengono salvati sul tuo dispositivo. Dal dispositivo esce soltanto ciò che è descritto di seguito, e niente di tutto ciò è collegato alla tua identità.',
      ],
      sections: [
        {
          heading: 'Foto dei giocatori',
          paragraphs: [
            `${ESCUADRA} non contiene le foto dei giocatori. Vengono caricate da Wikimedia Commons, gestito dalla Wikimedia Foundation: le foto di una partita all’inizio della partita, e le foto di una rosa nella schermata “Rosa” man mano che scorri. Come qualsiasi sito web, Wikimedia riceve l’indirizzo IP del tuo dispositivo e i dettagli di ogni richiesta, tra cui quali foto sono state richieste e, di conseguenza, quali giocatori fanno parte della tua partita o della tua rosa. ${ESCUADRA} non invia nient’altro a Wikimedia, e a ciò che Wikimedia riceve si applica l’informativa sulla privacy di Wikimedia.`,
            'Le foto già caricate possono essere conservate nella cache dell’app sul tuo dispositivo, così da apparire più rapidamente. Senza connessione, il quiz funziona normalmente e mostra i colori della squadra e il numero di maglia al posto di qualsiasi foto che non sia già in quella cache.',
            `Se tocchi un credito foto, si apre la pagina della foto su Wikimedia Commons, o la sua licenza sul sito di Creative Commons, in un browser interno all’app. Quei siti hanno le proprie informative sulla privacy, ed ${ESCUADRA} non può vedere ciò che fai lì.`,
          ],
        },
        {
          heading: 'Condivisione',
          paragraphs: [
            `Condividere un risultato crea un’immagine o un breve testo sul tuo dispositivo e lo passa all’app che scegli nel menu di condivisione del tuo telefono. ${ESCUADRA} non vede, non invia e non conserva ciò che condividi.`,
          ],
        },
        {
          heading: 'Statistiche d’uso anonime',
          paragraphs: [
            `${ESCUADRA} invia statistiche d’uso anonime a TelemetryDeck, un servizio di analisi statistica, a meno che tu non disattivi “${USAGE_STATISTICS}” nella schermata “Impostazioni” dell’app. Ciascuna contiene un identificativo casuale sotto forma di hash, creato per queste statistiche (diverso da quello usato dal controllo degli aggiornamenti dell’app), e un codice di sessione casuale, nuovo a ogni avvio dell’app. Come qualsiasi servizio online, TelemetryDeck riceve anche l’indirizzo IP del tuo dispositivo e i dettagli tecnici standard di ogni richiesta, che su iOS includono il numero di build dell’app e la versione di sistema del tuo dispositivo. A ciò che TelemetryDeck riceve si applica l’informativa sulla privacy di TelemetryDeck. L’identificativo delle statistiche e il codice di sessione sono casuali, non derivati dal tuo dispositivo e non collegati a te né ai tuoi account. Né ${ESCUADRA} né lo sviluppatore condividono l’identificativo, il codice di sessione o le statistiche con nessun altro.`,
            `Le statistiche sono: l’apertura dell’app, con la sua lingua e l’indicazione se questa segue la lingua del tuo telefono o è stata scelta nell’app; l’inizio di una partita, con il tipo di squadra (club o nazionale) e il livello di difficoltà; la fine di una partita, con gli stessi due dati, il punteggio e l’indicazione se è stata ${A_LA_ESCUADRA}; l’apertura della schermata “Rosa”, con il tipo di squadra (club o nazionale); e il passaggio di un risultato al menu di condivisione del tuo telefono, con il livello, il punteggio e l’indicazione se si trattava di un’immagine o di un testo. Le statistiche non includono mai i nomi delle squadre o dei giocatori, le tue risposte né nulla di ciò che scrivi.`,
          ],
        },
        {
          heading: 'Aggiornamenti dell’app',
          paragraphs: [
            `Quando ${ESCUADRA} si avvia, controlla se su Expo, il servizio che ne distribuisce gli aggiornamenti, è disponibile una versione più recente dell’app. Il controllo invia ciò che serve per fornire l’aggiornamento giusto: il sistema operativo del tuo dispositivo, la versione e il progetto dell’app e un identificativo casuale creato per questa installazione. ${ESCUADRA} non collega questo identificativo a te né a nulla di ciò che fai nell’app. Se durante l’avvio l’app si è arrestata in modo anomalo o non è riuscita a caricare un aggiornamento, il controllo successivo invia a Expo anche il relativo messaggio di errore tecnico. Come qualsiasi servizio online, Expo riceve inoltre l’indirizzo IP del tuo dispositivo a ogni controllo. Se non c’è connessione, l’app salta il controllo e funziona normalmente.`,
          ],
        },
        {
          heading: 'Cosa viene salvato sul tuo dispositivo',
          paragraphs: [
            `${ESCUADRA} salva undici informazioni in locale, sul tuo dispositivo: il tuo record per ogni squadra e livello di difficoltà, da cui l’app ricava quali livelli hai superato; la squadra e il livello della tua ultima partita; le squadre che hai contrassegnato con una stella; la tua preferenza per il tema chiaro o scuro; la tua scelta della lingua; se la vibrazione è attiva; se la schermata “Rosa” mostra schede o un elenco; quali schermate ti hanno già mostrato i loro consigli di “Come si gioca” e se li hai saltati; quale versione dell’app ha chiesto per ultima al tuo telefono di mostrare un invito a valutarla; la tua scelta sulle statistiche d’uso; e l’identificativo casuale usato da queste statistiche. Anche il controllo degli aggiornamenti dell’app conserva un proprio identificativo casuale sul tuo dispositivo.`,
            `Questi dati si trovano nello spazio di archiviazione privato dell’app. ${ESCUADRA} di per sé invia fuori dal tuo dispositivo solo due di queste undici informazioni, e solo mentre le statistiche d’uso sono attive: l’identificativo, che viene inviato sotto forma di hash con ogni statistica, e la tua scelta della lingua, che è inclusa nella statistica inviata all’apertura dell’app. Se elimini l’app, tutti questi dati vengono cancellati dal tuo dispositivo, insieme alle eventuali foto nella cache. ${ESCUADRA} non crea backup propri e non sincronizza i dati, ma i backup del tuo dispositivo (su iOS, su iCloud o su un computer; su Android, su Google) possono includere questi dati. Lo sviluppatore non ha accesso a questo spazio di archiviazione.`,
          ],
        },
        {
          // "Arresto anomalo", the word iOS and Android use for a crash in Italian.
          heading: 'Report sugli arresti anomali',
          paragraphs: [
            `Se consenti al tuo dispositivo di condividere i dati di diagnostica, Apple (su iOS) o Google (su Android) possono condividere report anonimizzati sugli arresti anomali con lo sviluppatore. Questa condivisione è gestita da Apple o da Google e si controlla nelle impostazioni del tuo dispositivo. A parte il messaggio di errore che il controllo degli aggiornamenti dell’app può inviare dopo un avvio non riuscito, ${ESCUADRA} di per sé non invia alcun report sugli arresti anomali.`,
          ],
        },
        {
          heading: 'Bambini',
          paragraphs: [
            `${ESCUADRA} non prevede account e non chiede informazioni personali a nessuno, bambini compresi. Le statistiche d’uso sono anonime e si possono disattivare in qualsiasi momento.`,
          ],
        },
      ],
    },
    site: {
      title: 'Informativa sulla privacy',
      updated: (date: string) => `Ultimo aggiornamento: ${date}`,
      appliesTo: (version: string) =>
        `Questa informativa si applica a ${ESCUADRA} ${version} e alle versioni successive.`,
      earlierVersions: 'Informativa sulla privacy per le versioni precedenti',
      home: `Home page di ${ESCUADRA}`,
      languages: 'Lingua',
      nav: {
        home: 'Home',
        support: 'Assistenza',
        utility: 'Collegamenti rapidi',
        footer: 'Piè di pagina',
      },
      theme: {
        light: 'Chiaro',
        dark: 'Scuro',
        toLight: 'Passa al tema chiaro',
        toDark: 'Passa al tema scuro',
      },
      // "su App Store", without an article, as Apple's Italian badge says.
      releaseStatus: 'Ora disponibile su App Store',
    },
  },
};
