// The Deutsch catalog (#145), typed against ./en.ts: same keys, same order,
// same parameters. Drafted by Claude; a native speaker reviews it before it
// merges (#145). The store tagline is English until #147 translates it with
// the listing copy.
// Escuadra and a la escuadra come from ./names and are never translated.
import { en, type CalendarDate, type Messages } from './en';
import { A_LA_ESCUADRA, ESCUADRA } from './names';

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
const MONTHS_LONG = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

const PHOTO_CREDITS = 'Bildnachweise';
const CROPPED = 'zugeschnitten';
const USAGE_STATISTICS = 'Nutzungsstatistiken';

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
    settings: 'Einstellungen',
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
  settings: {
    title: 'Einstellungen',
    sections: {
      play: 'Spiel',
      privacy: 'Datenschutz',
      // The section holds only the Rate card: backing the app, not a help desk
      // ("Hilfe", as the web pages' nav says).
      support: 'Unterstützen',
      comingNext: 'Demnächst',
      // "Info", as the About screen's title says.
      about: 'Info',
    },
    language: 'Sprache',
    languageSpoken: (name: string) => `Sprache: ${name}`,
    // "Darstellung", the iOS setting for light and dark.
    appearance: 'Darstellung',
    // "System", as "Systemsprache" says for the language.
    appearanceOptions: { system: 'System', dark: 'Dunkel', light: 'Hell' },
    vibration: 'Vibration',
    usageStatistics: USAGE_STATISTICS,
    usageNote: 'Anonym. Was genau gesendet wird, steht unter „Info“.',
    rate: {
      title: `${ESCUADRA} bewerten`,
      // "So": the title above says how.
      line: 'So finden andere Fans die App leichter.',
      button: 'Bewerten',
    },
    examMode: {
      title: 'Prüfungsmodus',
      line: 'Der ganze Kader, nur anhand der Rückennummern.',
      soon: 'Bald',
    },
    aboutEscuadra: `Über ${ESCUADRA}`,
    privacy: 'Datenschutz',
    licences: 'Lizenzen',
    version: (version: string) => `Version ${version}`,
    builtIn: 'integriert',
  },
  formats: {
    /** "21. Aug. 2026". */
    date: ({ day, month, year }: CalendarDate) => `${day}. ${MONTHS[month - 1] ?? ''} ${year}`,
    /** "21. August 2026". */
    longDate: ({ day, month, year }: CalendarDate) =>
      `${day}. ${MONTHS_LONG[month - 1] ?? ''} ${year}`,
  },
  // TW Torwart, ABW Abwehr ("Abw." in squad lists; a bare "AB" reads as the
  // word "ab"), MF Mittelfeld, ST Sturm.
  positionCodes: { GK: 'TW', DF: 'ABW', MF: 'MF', FW: 'ST' },
  positions: { GK: 'Torwart', DF: 'Abwehr', MF: 'Mittelfeld', FW: 'Sturm' },
  slots: { NAME: 'Name', POS: 'Position', AGE: 'Alter', CLUB: 'Verein', NAT: 'Nationalität' },
  slotCodes: { NAME: 'NAME', POS: 'POS', AGE: 'ALTER', CLUB: 'VEREIN', NAT: 'NAT' },
  round: {
    // "Treffer" / "Daneben": a shot on goal, hit or wide.
    correct: 'Treffer',
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
    leave: 'Runde abbrechen',
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
    streak: (count: number) => `Serie: ${count} richtig in Folge`,
  },
  study: {
    // "Spieler" is both singular and plural.
    players: (count: number) => `${count} Spieler`,
    shownOf: (shown: number, total: number) => `${shown} von ${total}`,
    noNumber: 'ohne Rückennummer',
    nameHidden: 'Name verborgen',
    title: 'Kader',
    // "Namen ausblenden" is 16 chars against 12. As a switch, it is spoken
    // "Ohne Namen, ein" or "…, aus"; "Mit Namen" is its pair.
    hideNames: 'Ohne Namen',
    showNames: 'Mit Namen',
    showAsList: 'Als Liste zeigen',
    showAsCards: 'Als Karten zeigen',
    all: 'Alle',
    tapToReveal: 'Aufdecken',
    revealsName: 'Zeigt den Namen',
  },
  credits: {
    cropped: CROPPED,
    photo: 'Foto:',
    title: PHOTO_CREDITS,
    button: (count: number) => `${PHOTO_CREDITS} · ${count}`,
  },
  results: {
    flawlessVerdict: (team: string, season: string, level: number) =>
      `${team} · ${season}, Level ${level}. Kein Fehler.`,
    clearedTitle: (level: number) => `Level ${level} geschafft`,
    clearedVerdict: 'Du kennst schon fast die ganze Startelf.',
    failTitle: 'Die hier solltest du dir merken',
    toClear: (target: string, level: number) => `Mit ${target} schaffst du Level ${level}.`,
    toUnlock: (target: string, level: number) => `Mit ${target} schaltest du Level ${level} frei.`,
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
    // Not "Lerne noch", which reads as telling the receiver to learn more.
    stillLearning: 'Noch am Lernen',
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
    // "Ab 8/10": how German states a threshold.
    unlockHint: (target: string, level: number) => `Ab ${target} in L${level}`,
    rungLocked: (title: string, correct: number, total: number, level: number) =>
      `${title}, gesperrt, ab ${correct} von ${total} in Level ${level}`,
    rungBest: (title: string, correct: number, total: number) =>
      `${title}, Rekord ${correct} von ${total}`,
    title: 'Schwierigkeit wählen',
    levels: {
      1: {
        title: 'Name zur Nummer',
        description: 'Du siehst die Rückennummer und wählst den Spieler aus 4 Namen.',
      },
      2: {
        title: 'Name und Position',
        description: 'Erst den Namen, dann die Position – TW, ABW, MF oder ST.',
      },
      3: {
        // A player's Steckbrief: name, position, club, country.
        title: 'Ganzer Steckbrief',
        description: '6 Namen zur Wahl, dann Position, dann Verein oder Nationalität.',
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
  about: {
    // "Info", as the home screen's link to it says.
    title: 'Info',
    intro: [
      `${ESCUADRA} ist eine unabhängige, inoffizielle App. Sie ist weder mit der FIFA, der UEFA, einer Liga, einem nationalen Fußballverband noch mit einem Verein verbunden oder assoziiert und wird von keinem von ihnen befürwortet. Die Namen von Vereinen und Nationalteams werden nur zur Identifizierung verwendet und bleiben Eigentum ihrer jeweiligen Inhaber. ${ESCUADRA} ist außerdem weder mit der Wikimedia Foundation noch mit einem auf einem Foto gezeigten Spieler verbunden und wird von keinem von ihnen befürwortet.`,
      `${ESCUADRA} kennzeichnet Teams mit ihren Namen und Farben und zeigt selbst nie Vereinswappen, Embleme oder Logos. Auf einem Spielerfoto kann trotzdem eines zu sehen sein, auf einem Trikot oder im Hintergrund, weil es zum Originalfoto gehört. Diese Zeichen gehören ihren Inhabern, und dass sie zu sehen sind, bedeutet nicht, dass ein Verein, ein Sponsor oder eine Marke ${ESCUADRA} befürwortet.`,
    ],
    credits: {
      heading: 'Daten- und Bildnachweise',
      sections: [
        {
          heading: 'Kaderdaten',
          paragraphs: [
            'Die Kaderdaten sind aus Wikipedia und Wikidata zusammengestellt und geben die Saison wieder, die bei jedem Team angegeben ist. Die Inhalte von Wikipedia sind unter CC BY-SA verfügbar. Wikidata ist unter CC0 verfügbar.',
          ],
        },
        {
          heading: 'Spielerfotos',
          paragraphs: [
            'Die Spielerfotos stammen von Wikimedia Commons. Jedes ist entweder gemeinfrei oder wird unter der Lizenz verwendet, unter der es auf Commons steht: CC BY-SA, CC BY, CC0 oder die Commons-eigene Lizenz „Attribution“. Die Fotos werden so zugeschnitten, dass sie die Fläche ausfüllen, auf der sie erscheinen. In der Frageansicht wird ein Foto, das zu klein ist, um die Fläche auszufüllen, stattdessen vollständig gezeigt, über einer vergrößerten, abgedunkelten Kopie seiner selbst, die die Fläche ausfüllt. Wo Text der App über einem Foto liegt, legt die App einen Schatten über diesen Teil des Bildschirms, und nach einer falschen Antwort dimmt sie das Foto. Die Fotodateien selbst werden nicht bearbeitet. Nicht jeder Spieler hat ein Foto.',
            `Urheber, Lizenz und das Wort „${CROPPED}“ stehen unter der Frage, solange ein Foto zu sehen ist, und noch einmal unter „${PHOTO_CREDITS}“: in der Ergebnisansicht für die ganze Runde und am Ende der Kaderansicht für jeden Spieler, den sie aufführt. Tippe auf den Urheber, um die Seite des Fotos auf Wikimedia Commons zu öffnen, oder auf die Lizenz, um ihre Bedingungen zu lesen.`,
          ],
        },
        {
          heading: 'Flaggen und Schriften',
          paragraphs: [
            'Die Flaggenbilder stammen von flagpedia.net und sind gemeinfrei. Die Schriften Inter, IBM Plex Mono und Archivo werden unter der SIL Open Font License 1.1 verwendet.',
          ],
        },
        {
          heading: 'Ländernamen',
          paragraphs: [
            `Die meisten Ländernamen in anderen Sprachen als Englisch stammen aus dem Projekt Unicode CLDR und werden unter der Unicode License v3 verwendet. Die übrigen wurden für ${ESCUADRA} verfasst.`,
          ],
        },
      ],
    },
    licences: {
      label: 'Lizenzen',
      originalLanguage: 'Lizenztexte werden im Original angezeigt, auf Englisch.',
      countryNames: 'Ländernamen',
      fonts: 'Schriften',
      software: 'Software',
    },
    privacy: {
      heading: 'Datenschutz',
      lead: `Bei ${ESCUADRA} gibt es kein Konto, keine Anmeldung und keine Werbung, und die App fragt nie nach deinem Namen, deiner E-Mail-Adresse oder Kontaktdaten jeglicher Art.`,
      paragraphs: [
        'Deine Ergebnisse und Einstellungen werden auf deinem Gerät gespeichert. Nur das, was unten beschrieben ist, verlässt dein Gerät, und nichts davon ist mit deiner Person verknüpft.',
      ],
      sections: [
        {
          heading: 'Spielerfotos',
          paragraphs: [
            `${ESCUADRA} liefert keine Spielerfotos mit. Sie werden von Wikimedia Commons geladen, das die Wikimedia Foundation betreibt: die Fotos einer Runde, wenn die Runde beginnt, und die Fotos eines Kaders in der Kaderansicht, während du scrollst. Wie jede Website erhält Wikimedia die IP-Adresse deines Geräts und die Details jeder Anfrage, darunter, welche Fotos abgerufen wurden, und damit, welche Spieler in deiner Runde oder deinem Kader sind. ${ESCUADRA} sendet sonst nichts an Wikimedia, und für das, was Wikimedia erhält, gilt die Datenschutzerklärung von Wikimedia.`,
            'Bereits geladene Fotos können im Cache der App auf deinem Gerät gespeichert bleiben, damit sie schneller erscheinen. Ohne Verbindung funktioniert das Quiz wie gewohnt und zeigt die Farben des Teams und die Rückennummer anstelle jedes Fotos, das nicht bereits in diesem Cache gespeichert ist.',
            `Wenn du auf einen Bildnachweis tippst, öffnet sich die Seite des Fotos auf Wikimedia Commons oder seine Lizenz auf der Website von Creative Commons in einem In-App-Browser. Diese Websites haben eigene Datenschutzerklärungen, und ${ESCUADRA} kann nicht sehen, was du dort tust.`,
          ],
        },
        {
          heading: 'Teilen',
          paragraphs: [
            `Wenn du ein Ergebnis teilst, wird auf deinem Gerät ein Bild oder ein kurzer Text erstellt und an die App übergeben, die du im Teilen-Menü deines Smartphones auswählst. ${ESCUADRA} sieht, sendet und speichert nichts von dem, was du teilst.`,
          ],
        },
        {
          heading: 'Anonyme Nutzungsstatistiken',
          paragraphs: [
            `${ESCUADRA} sendet anonyme Nutzungsstatistiken an TelemetryDeck, einen Analysedienst, es sei denn, du schaltest „${USAGE_STATISTICS}“ in der App unter „Einstellungen“ aus. Jede davon enthält eine gehashte Form einer zufälligen Kennung, die für diese Statistiken erstellt wurde (getrennt von der Kennung, die die Update-Prüfung der App verwendet), und einen zufälligen Sitzungscode, der bei jedem Start der App neu erstellt wird. Wie jeder Onlinedienst erhält TelemetryDeck außerdem die IP-Adresse deines Geräts und die üblichen technischen Details jeder Anfrage, zu denen unter iOS die Build-Nummer der App und die Systemversion deines Geräts gehören. Für das, was TelemetryDeck erhält, gilt die Datenschutzerklärung von TelemetryDeck. Die Kennung der Statistiken und der Sitzungscode sind zufällig, nicht von deinem Gerät abgeleitet und weder mit dir noch mit deinen Konten verknüpft. Weder ${ESCUADRA} noch der Entwickler gibt sie oder die Statistiken an Dritte weiter.`,
            `Gesendet werden diese Statistiken: die App wurde geöffnet, mit ihrer Sprache und der Angabe, ob diese der Sprache deines Smartphones folgt oder in der App gewählt wurde; eine Runde wurde gestartet, mit der Angabe, ob das Team ein Verein oder ein Nationalteam ist, und dem Level; eine Runde wurde beendet, mit denselben beiden Angaben, der Punktzahl und der Angabe, ob sie ${A_LA_ESCUADRA} war; die Kaderansicht wurde geöffnet, mit der Angabe, ob das Team ein Verein oder ein Nationalteam ist; und ein Ergebnis wurde an das Teilen-Menü deines Smartphones übergeben, mit dem Level, der Punktzahl und der Angabe, ob es als Bild oder als Text übergeben wurde. Sie enthalten nie Teamnamen, Spielernamen, deine Antworten oder etwas, das du eingibst.`,
          ],
        },
        {
          heading: 'App-Updates',
          paragraphs: [
            `Wenn ${ESCUADRA} startet, prüft die App, ob bei Expo, dem Dienst, der ihre Updates ausliefert, eine neuere Version verfügbar ist. Die Prüfung sendet das, was nötig ist, um das richtige Update auszuliefern: das Betriebssystem deines Geräts, die Version und das Projekt der App sowie eine zufällige Kennung, die für diese Installation erstellt wurde. ${ESCUADRA} verknüpft die Kennung weder mit dir noch mit irgendetwas, das du in der App tust. Wenn die App beim Starten abgestürzt ist oder dabei ein Update nicht laden konnte, sendet die nächste Prüfung außerdem die zugehörige technische Fehlermeldung an Expo. Wie jeder Onlinedienst erhält Expo bei jeder Prüfung auch die IP-Adresse deines Geräts. Ohne Verbindung überspringt die App die Prüfung und funktioniert wie gewohnt.`,
          ],
        },
        {
          heading: 'Was auf deinem Gerät gespeichert wird',
          paragraphs: [
            `${ESCUADRA} speichert neun Dinge lokal auf deinem Gerät: deinen Rekord für jedes Team und jedes Level, anhand dessen die App ermittelt, welche Level du abgeschlossen hast; das letzte Team und Level, das du gespielt hast; deine Einstellung für helles oder dunkles Design; deine Sprachwahl; ob die Vibration eingeschaltet ist; ob die Kaderansicht Karten oder eine Liste zeigt; welche Version der App zuletzt dein Smartphone gebeten hat, eine Bewertungsanfrage anzuzeigen; deine Entscheidung zu den Nutzungsstatistiken; und die zufällige Kennung, die diese Statistiken verwenden. Die Update-Prüfung der App speichert außerdem eine eigene zufällige Kennung auf deinem Gerät.`,
            `Diese Daten liegen im eigenen, privaten Speicher der App. ${ESCUADRA} selbst sendet nur zwei dieser neun Dinge von deinem Gerät aus, und nur, solange die Nutzungsstatistiken eingeschaltet sind: die Kennung, die in gehashter Form mit jeder Statistik gesendet wird, und deine Sprachwahl, die in der Statistik enthalten ist, die beim Öffnen der App gesendet wird. Wenn du die App löschst, werden all diese Daten von deinem Gerät gelöscht, ebenso alle zwischengespeicherten Fotos. ${ESCUADRA} hat kein eigenes Backup und keine eigene Synchronisierung, aber die Backups deines Geräts (unter iOS in iCloud oder auf einem Computer; unter Android bei Google) können diese Daten enthalten. Der Entwickler hat keinen Zugriff auf diesen Speicher.`,
          ],
        },
        {
          heading: 'Absturzberichte',
          paragraphs: [
            `Wenn du erlaubst, dass dein Gerät Diagnosedaten teilt, kann Apple (unter iOS) oder Google (unter Android) anonymisierte Absturzberichte mit dem Entwickler teilen. Das wird von Apple oder Google abgewickelt und in den Einstellungen deines Geräts gesteuert. Abgesehen von der Fehlermeldung, die die Update-Prüfung der App nach einem fehlgeschlagenen Start senden kann, sendet ${ESCUADRA} selbst keine Absturzberichte.`,
          ],
        },
        {
          heading: 'Kinder',
          paragraphs: [
            `Bei ${ESCUADRA} gibt es kein Konto, und die App fragt niemanden nach persönlichen Angaben, auch keine Kinder. Nutzungsstatistiken sind anonym und können jederzeit ausgeschaltet werden.`,
          ],
        },
      ],
    },
    site: {
      title: 'Datenschutzerklärung',
      // "Stand:", as the team ladder dates its squad data.
      updated: (date: string) => `Stand: ${date}`,
      appliesTo: (version: string) =>
        `Diese Datenschutzerklärung gilt für ${ESCUADRA} ab Version ${version}.`,
      earlierVersions: 'Datenschutzerklärung für frühere Versionen',
      home: `Startseite von ${ESCUADRA}`,
      languages: 'Sprache',
      nav: {
        home: 'Startseite',
        support: 'Hilfe',
        // The German web term for a site's utility links.
        utility: 'Servicenavigation',
        footer: 'Fußzeile',
      },
      theme: {
        light: 'Hell',
        dark: 'Dunkel',
        toLight: 'Zum hellen Design wechseln',
        toDark: 'Zum dunklen Design wechseln',
      },
      releaseStatus: 'Jetzt im App Store',
    },
  },
};
