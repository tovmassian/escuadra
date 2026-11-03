// The site's German words (#280): en.mjs's shape. Reused word for word from main:
// store/listing/de.md (the promotional text, the description's sentences, the
// affiliation line), i18n/de.ts (positions and their codes, Settings' labels, level
// names, Ohne Namen, Noch am Lernen, Wer trägt die, Wähle deine Antwort, the site's
// labels) and i18n/countries.ts. The FRESH lines (fresh.mjs) are written afresh; the
// owner picks them.
// German as i18n/de.ts writes it: the player is "du", a round is a "Runde", the squad
// is the "Kader", a club a "Verein", a level a "Level"; quotes „ “, dashes –.
export default {
  meta: {
    homeTitle: 'Escuadra – Fußballkader nach Rückennummer lernen',
    homeDescription:
      'Wer trägt die Nummer 7? Lerne die Kader aller Vereine der fünf Topligen Europas und von über 150 Nationalteams in kurzen Runden und sieh genau, bei wem du falschlagst.',
    supportTitle: 'Hilfe – Escuadra',
  },
  layout: {
    homeLabel: 'Startseite von Escuadra',
    utilityNav: 'Servicenavigation',
    footerNav: 'Fußzeile',
    language: 'Sprache',
    languageCurrent: 'Sprache: {name}',
    nav: {
      try: 'Frage ausprobieren',
      how: 'So funktioniert’s',
      squads: 'Teams',
      support: 'Hilfe',
      privacy: 'Datenschutz',
      privacyPolicy: 'Datenschutzerklärung',
      privacy1x: 'Datenschutzerklärung für Escuadra 1.x',
      home: 'Startseite',
      report: 'Problem melden',
    },
    getApp: 'Hol dir die App',
    theme: {
      light: 'Hell',
      dark: 'Dunkel',
      toLight: 'Zum hellen Design wechseln',
      toDark: 'Zum dunklen Design wechseln',
    },
    releaseStatus: 'Jetzt im App Store und bei Google Play',
    badges: { appStore: 'Laden im App Store', googlePlay: 'Jetzt bei Google Play' },
  },
  home: {
    hero: {
      eyebrow: 'Fußballkader lernen',
      title: 'Wer trägt die 7?',
      lead: 'Kenne jede Nummer. Lerne die Kader aller Vereine der fünf Topligen Europas und von über 150 Nationalteams in blitzschnellen Runden.',
      tryLink: 'Oder probier gleich hier eine Frage aus',
    },
    try: {
      eyebrow: 'Probier’s aus · Level 1',
      title: 'Eine Nummer.<br />Vier Namen.',
      body: 'So spielt sich die App: eine Rückennummer und ein paar Hinweise, dann wählst du den Spieler. Hier sind es drei Fragen; in der App zehn pro Runde, mit dem Team deiner Wahl.',
      level: 'Level 1',
      nameKey: 'Name',
      positionKey: 'Pos',
      ageKey: 'Alter',
      resultEyebrow: 'Deine Runde · 3 Fragen',
      playAgain: 'Noch mal spielen',
    },
    credits: {
      title: 'Bildnachweise · 3',
      cropped: 'zugeschnitten',
    },
    how: {
      eyebrow: 'Die Leiter',
      title: 'Drei Level.<br />Kader für Kader nach oben.',
      startHere: 'Hier fängst du an',
      lockedSpoken: 'Gesperrt: ab 8 von 10 in Level {level}',
      locked: 'Ab 8/10 in L{level}',
      levels: [
        { title: 'Name zur Nummer', body: 'Du siehst die Rückennummer und wählst den Spieler aus 4 Namen.' },
        { title: 'Name und Position', body: 'Erst den Namen, dann die Position – TW, ABW, MF oder ST.' },
        {
          title: 'Ganzer Steckbrief',
          body: '6 Namen zur Wahl, dann Position, dann Nationalität – bei einem Nationalteam stattdessen der Verein.',
        },
      ],
      note: 'Jede Frage ist einen Punkt wert. In Level 2 und 3 gibt es den Punkt nur, wenn alle Teile stimmen.',
    },
    misses: {
      eyebrow: 'Ergebnis- und Kaderansicht',
      title: 'Aus Fehlern lernt man.',
      body: [
        'Geh nach jeder Runde die Spieler durch, die du falsch hattest, oder lern den ganzen Kader – und dann hol dir die volle Punktzahl.',
      ],
      stackLabel: 'Real Madrid · 2026/27 · Level 2 · 7/10',
      missedOf: 'Fehler {n} von 3',
      missedPart: { name: 'Daneben · Name', position: 'Daneben · Position' },
    },
    squads: {
      eyebrow: 'Das steckt drin',
      title: 'Dein Verein.<br />Dein Land.',
      stats: [
        { title: 'Vereine', body: 'Alle Vereine der fünf großen europäischen Ligen.' },
        { title: 'Nationalteams', body: 'Aus allen sechs Kontinentalverbänden.' },
        { title: 'Sprachen', body: 'English, Español, Français, Italiano und Deutsch.' },
      ],
      clubsLabel: 'Einige der Vereine in Escuadra',
      nationsLabel: 'Einige der Nationalteams in Escuadra',
    },
    share: {
      pictureLabel:
        'Bild zum Teilen aus Escuadra: Barcelona, 2026/27, Level 1, 10 von 10, a la escuadra. Die zehn Rückennummern und „Barcelona: Kennst du den ganzen Kader?“',
      meta: 'Barcelona · 2026/27 · Level 1',
      question: 'Barcelona: Kennst du den ganzen Kader?',
      eyebrow: 'Zehn von zehn',
      title: 'Kein Fehler? Dafür gibt’s ein Wort.',
      body: [
        'Spanisch für einen Schuss in den Winkel. Schaffst du zehn von zehn, sagt Escuadra es dir.',
        'Dann teil deine Runde und zeig allen, dass du den Kader im Schlaf kennst.',
      ],
    },
    promises: {
      eyebrow: 'Überall spielen',
      title: 'Dein Kader<br />in der Tasche.',
      items: ['Keine Werbung', 'Funktioniert offline', 'In 5 Sprachen verfügbar'],
    },
    get: {
      title: 'Kenne den Kader.<br />Im Schlaf.',
    },
    footer: {
      escuadraHeading: 'Escuadra',
      helpHeading: 'Hilfe',
      affiliation:
        'Escuadra ist ein unabhängiges, inoffizielles Lernwerkzeug. Es ist weder mit einem Kontinentalverband, einer Liga, einem Wettbewerb, einem nationalen Fußballverband, einem Verein noch mit der Wikimedia Foundation verbunden oder assoziiert und wird von keinem von ihnen befürwortet, ebenso wenig von einem auf einem Foto gezeigten Spieler. Namen von Vereinen, Nationalmannschaften und Kontinentalverbänden dienen nur der Identifikation. Sie gehören ihren jeweiligen Inhabern, ebenso wie Vereinszeichen, die auf Spielerfotos zu sehen sind.',
    },
  },
  support: {
    eyebrow: 'Hilfe',
    title: 'Stimmt was<br />nicht?',
    lead: 'Ein Bug, eine falsche Rückennummer, ein Team, das dir fehlt? Am besten erreichst du den Entwickler über GitHub Issues. Schreib, was passiert ist, auf welchem Smartphone und bei welchem Team.',
    cta: 'Issue auf GitHub erstellen',
    ctaNote: 'Für ein Issue brauchst du ein kostenloses GitHub-Konto.',
    kinds: [
      { title: 'Bug melden', sub: 'Was du angetippt hast und was passiert ist' },
      { title: 'Kader korrigieren', sub: 'Das Team, der Spieler, die richtige Nummer' },
      { title: 'Team oder Funktion vorschlagen', sub: 'Was dir beim Lernen helfen würde' },
    ],
    faqEyebrow: 'Fragen',
    faqTitle: 'Bevor du schreibst',
    faq: [
      {
        q: 'Wie schalte ich Level 2 und 3 frei?',
        a: 'Level 2 schaltest du mit 8 von 10 in Level 1 frei, Level 3 mit 8 von 10 in Level 2. Jedes Team hat seine eigene Leiter.',
      },
      {
        q: 'Warum haben manche Spieler kein Foto?',
        a: 'Die Fotos stammen von Wikimedia Commons, und zwar nur, wenn Commons eines unter einer Lizenz hat, die Escuadra verwenden darf. Ohne Foto – oder offline, solange noch keins geladen ist – zeigt die Frage stattdessen die Teamfarben und die Rückennummer.',
      },
      {
        q: 'Funktioniert Escuadra offline?',
        a: 'Ja. Alle Kader sind auf deinem Smartphone gespeichert, deshalb funktioniert das Quiz ohne Verbindung. Fotos werden von Wikimedia Commons geladen, wenn du online bist.',
      },
      {
        q: 'Eine Rückennummer oder ein Spieler stimmt nicht.',
        a: 'Die Kader sind aus Wikipedia und Wikidata zusammengestellt, und bei jedem Team steht, wann es zuletzt aktualisiert wurde. Ist etwas veraltet, erstelle ein Issue mit dem Team und dem Spieler.',
      },
      {
        q: 'Wie ändere ich die Sprache?',
        a: 'Escuadra folgt der Sprache deines Smartphones. Für eine andere öffne <b>Einstellungen</b> und dann <b>Sprache</b>: English, Español, Français, Italiano oder Deutsch.',
      },
      {
        q: 'Wie schalte ich die Nutzungsstatistiken aus?',
        a: 'Öffne <b>Einstellungen</b> und schalte <b>Nutzungsstatistiken</b> aus. In der App steht unter „Info“ alles, was dein Gerät verlässt, ebenso in der <a href="{privacy}">Datenschutzerklärung</a>.',
      },
      {
        q: 'Wie fange ich von vorn an?',
        a: 'Auf dem Bildschirm eines Teams öffnet der Radiergummi <b>Von vorn beginnen</b>: Danach ist das Team wieder ungespielt. In den Einstellungen macht <b>Alle Rekorde löschen</b> das für alle Teams, und <b>Escuadra zurücksetzen</b> stellt alles wieder so ein wie beim ersten Start.',
      },
    ],
  },
  countries: {
    ESP: 'Spanien', ARG: 'Argentinien', BRA: 'Brasilien', FRA: 'Frankreich', ENG: 'England',
    JPN: 'Japan', GER: 'Deutschland', SEN: 'Senegal', ITA: 'Italien', MEX: 'Mexiko',
    POR: 'Portugal', KOR: 'Südkorea', NED: 'Niederlande', NGA: 'Nigeria',
    USA: 'USA', CRO: 'Kroatien', URU: 'Uruguay', EGY: 'Ägypten', COL: 'Kolumbien',
    AUS: 'Australien', CAN: 'Kanada', GHA: 'Ghana', ARM: 'Armenien', SVN: 'Slowenien',
  },
  teaser: {
    positions: { GK: 'Torwart', DF: 'Abwehr', MF: 'Mittelfeld', FW: 'Sturm' },
    positionCodes: { GK: 'TW', DF: 'ABW', MF: 'MF', FW: 'ST' },
    clueCodes: { club: 'Verein', nat: 'Nat' },
    clueSpoken: { club: 'Verein', nat: 'Nationalität' },
    spoken: {
      name: 'Name: {name}.',
      beingAsked: 'wird gefragt',
      clues: 'Position: {position}. Alter: {age}. {clueLabel}: {clue}.',
      question: 'Frage {n} von {total}. {team}. Wer trägt die {number}? {clues}',
      score: 'Ergebnis: {score} von {answered}',
      result: '{score} von {total}',
    },
    whoWears: 'Wer trägt die {number}?',
    hint: {
      tap: 'Wähle deine Antwort',
      right: 'Treffer. Gleich kommt die nächste …',
      rightLast: 'Treffer. Gleich kommt dein Ergebnis …',
    },
    next: 'Weiter',
    seeRound: 'Zum Ergebnis',
    live: {
      right: 'Treffer: {answer}.',
      wrong: 'Daneben. Die {number} ist {answer}.',
      round: 'Deine Runde: {score} von {total}. {title}.',
    },
    titles: { perfect: 'A la escuadra', learning: 'Noch am Lernen' },
    resultCopy: {
      perfect: 'Drei von drei. In der App hat jede Runde zehn Fragen, mit 96 Vereinen und 157 Nationalteams zur Wahl.',
      learning:
        'Die hier solltest du dir merken. In der App hat jede Runde zehn Fragen, mit 96 Vereinen und 157 Nationalteams zur Wahl, und jeder Fehler wartet in der Ergebnisansicht auf dich.',
    },
  },
};

// German says "Level" and "Name" too, as i18n/de.ts does (common.level, slots.NAME).
export const SAME_AS_ENGLISH = ['home.try.level', 'teaser.spoken.name'];
