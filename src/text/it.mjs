// The site's Italian words (#280): en.mjs's shape. Reused word for word from main:
// store/listing/it.md (the promotional text, the description's sentences, the
// affiliation line), i18n/it.ts (positions and their codes, Settings' labels, level
// names, Copri i nomi, Sto imparando, Chi ha il numero, Scegli la risposta, the site's
// labels) and i18n/countries.ts. The FRESH lines (fresh.mjs) are written afresh; the
// owner picks them.
// Italian as i18n/it.ts writes it: the player is "tu", a round is a "partita", the
// squad is the "rosa", Escuadra is "l’app" (feminine); apostrophes are ’, quotes “ ”.
export default {
  meta: {
    homeTitle: 'Escuadra — impara le rose del calcio numero per numero',
    homeDescription:
      'Chi ha il numero 7? Impara le rose di tutti i club dei cinque principali campionati europei e di oltre 150 nazionali in partite veloci, poi scopri chi hai sbagliato.',
    supportTitle: 'Assistenza — Escuadra',
  },
  layout: {
    homeLabel: 'Home page di Escuadra',
    utilityNav: 'Collegamenti rapidi',
    footerNav: 'Piè di pagina',
    language: 'Lingua',
    languageCurrent: 'Lingua: {name}',
    nav: {
      try: 'Prova una domanda',
      how: 'Come funziona',
      squads: 'Squadre',
      support: 'Assistenza',
      privacy: 'Privacy',
      privacyPolicy: 'Informativa sulla privacy',
      privacy1x: 'Informativa sulla privacy di Escuadra 1.x',
      home: 'Home',
      report: 'Segnala un problema',
    },
    getApp: 'Scarica l’app',
    theme: {
      light: 'Chiaro',
      dark: 'Scuro',
      toLight: 'Passa al tema chiaro',
      toDark: 'Passa al tema scuro',
    },
    releaseStatus: 'Ora disponibile su App Store e Google Play',
    badges: { appStore: 'Scarica su App Store', googlePlay: 'Disponibile su Google Play' },
  },
  home: {
    hero: {
      eyebrow: 'Impara le rose del calcio · iPhone e Android',
      title: 'Conosci ogni<br />numero.',
      lead: 'Chi ha il numero 7? Impara le rose di tutti i club dei cinque principali campionati europei e di oltre 150 nazionali in partite veloci, poi scopri chi hai sbagliato.',
      tryLink: 'Oppure prova una domanda qui',
    },
    try: {
      eyebrow: 'Provane una · Livello 1',
      title: 'Un numero.<br />Quattro nomi.',
      body: 'Nell’app si gioca così: un numero di maglia e qualche indizio, poi scegli il giocatore. Qui le domande sono tre; nell’app, dieci a partita, con la squadra che vuoi.',
      steps: [
        'Leggi il numero e gli indizi: ruolo, età e club o nazionalità.',
        'Tocca un nome. Giusto o sbagliato, lo sai subito.',
        'Alla fine, scopri esattamente chi hai sbagliato.',
      ],
      level: 'Livello 1',
      nameKey: 'Nome',
      positionKey: 'Ruolo',
      ageKey: 'Età',
      resultEyebrow: 'La tua partita · 3 domande',
      playAgain: 'Rigioca la partita',
    },
    credits: {
      title: 'Crediti foto · 3',
      cropped: 'ritagliata',
      wikimedia:
        'Queste foto vengono caricate da Wikimedia Commons: come qualsiasi sito web, Wikimedia riceve il tuo indirizzo IP e i dettagli di ogni richiesta.',
    },
    how: {
      eyebrow: 'I livelli',
      title: 'Tre livelli.<br />Da scalare squadra per squadra.',
      startHere: 'Inizia da qui',
      lockedSpoken: 'Bloccato: fai 8 su 10 al livello {level}',
      locked: '8/10 al liv. {level}',
      levels: [
        { title: 'Nome dal numero', body: 'Dato il numero di maglia, scegli il giocatore tra 4 opzioni.' },
        { title: 'Nome e ruolo', body: 'Scegli il nome, poi il ruolo: POR, DIF, CEN o ATT.' },
        {
          title: 'Profilo completo',
          body: 'Scegli il nome tra 6 opzioni, poi il ruolo, poi la nazionalità o, per una nazionale, il club.',
        },
      ],
      note: 'Ogni domanda vale un punto. Ai livelli 2 e 3 prendi il punto solo se tutte le parti sono giuste: niente punteggi parziali.',
    },
    misses: {
      eyebrow: 'Risultati e Rosa',
      title: 'Sbagliando s’impara.',
      body: [
        'Dopo ogni partita, la schermata dei risultati ti mostra ogni giocatore che hai sbagliato, ognuno su una scheda da scorrere, così puoi ripassarli prima della partita successiva.',
        'La schermata “Rosa” mostra tutta la rosa come schede o come elenco. Tocca “Copri i nomi” e mettiti alla prova.',
      ],
      stackLabel: 'Real Madrid · 2026/27 · Livello 2 · 7/10',
      missedOf: 'Errore {n} di 3',
      missedPart: { name: 'Sbagliato · nome', position: 'Sbagliato · ruolo' },
    },
    squads: {
      eyebrow: 'Cosa contiene',
      title: 'Dall’Arsenal<br />all’Armenia.',
      stats: [
        { title: 'Club', body: 'Tutti i club dei cinque principali campionati europei.' },
        { title: 'Nazionali', body: 'Da tutte e sei le confederazioni.' },
        { title: 'Lingue', body: 'English, Español, Français, Italiano e Deutsch.' },
      ],
      clubsLabel: 'Alcuni dei club di Escuadra',
      nationsLabel: 'Alcune delle nazionali di Escuadra',
      refreshed: 'Le rose si aggiornano ogni stagione: le nuove squadre arrivano senza aggiornare l’app.',
    },
    share: {
      pictureLabel:
        'Immagine da condividere di Escuadra: Barcelona, 2026/27, livello 1, 10 su 10, a la escuadra. I dieci numeri di maglia e “Barcelona: conosci tutta la rosa?”',
      meta: 'Barcelona · 2026/27 · Livello 1',
      question: 'Barcelona: conosci tutta la rosa?',
      eyebrow: 'Dieci su dieci',
      title: 'Una partita senza errori ha un nome.',
      body: [
        'In spagnolo, un tiro all’incrocio dei pali. Fai dieci su dieci ed Escuadra te lo dice.',
        'Poi condividi il risultato come immagine o come testo. Senza foto né nomi, così anche i tuoi amici possono giocare.',
      ],
    },
    promises: {
      eyebrow: 'Pensata per sessioni brevi',
      title: 'Tu e la rosa.<br />Nient’altro.',
      items: [
        {
          title: 'Nessun account. Nessuna pubblicità.',
          body: 'Nessuna registrazione, niente che ti rallenti. Apri l’app e gioca.',
        },
        {
          title: 'Funziona offline',
          body: 'Tutte le rose sono salvate sul tuo telefono. Le foto si caricano da Wikimedia Commons quando sei online; offline, al loro posto compaiono i colori della squadra.',
        },
        {
          title: 'Foto con i crediti',
          body: 'Foto dei giocatori da Wikimedia Commons, dove disponibili, ognuna con il suo autore e la sua licenza.',
        },
        {
          title: 'Cinque lingue',
          body: 'English, Español, Français, Italiano e Deutsch. L’app segue la lingua del tuo telefono, oppure puoi sceglierne una in Impostazioni.',
        },
        { title: 'Chiaro e scuro', body: 'L’app segue l’aspetto del tuo telefono, oppure puoi sceglierlo tu.' },
        {
          title: 'Statistiche anonime, disattivabili',
          body: 'Escuadra invia statistiche d’uso anonime, a meno che tu non le disattivi in Impostazioni. <a href="{privacy}">L’informativa sulla privacy</a> elenca tutto ciò che esce dal tuo dispositivo.',
        },
      ],
    },
    get: {
      title: 'Conosci la rosa<br />a menadito.',
      body: 'Escuadra è disponibile su iPhone e Android.',
    },
    footer: {
      escuadraHeading: 'Escuadra',
      helpHeading: 'Aiuto',
      affiliation:
        'Escuadra è uno strumento di studio indipendente e non ufficiale. Non è affiliato né collegato ad alcuna confederazione, lega o competizione, ad alcuna federazione calcistica nazionale, ad alcun club o alla Wikimedia Foundation, né è approvato da nessuno di essi, e nessun giocatore mostrato in una foto lo approva. I nomi di club, nazionali e confederazioni sono usati solo per identificarli. Appartengono ai rispettivi proprietari, come gli eventuali segni distintivi dei club visibili nelle foto dei giocatori.',
    },
  },
  support: {
    eyebrow: 'Assistenza',
    title: 'Qualcosa<br />non va?',
    lead: 'Un bug, un numero di maglia sbagliato, una squadra che vorresti trovare nell’app? Il modo migliore per contattare lo sviluppatore è GitHub Issues. Racconta cosa è successo, su quale telefono e con quale squadra.',
    cta: 'Apri una segnalazione su GitHub',
    ctaNote: 'Per aprire una segnalazione serve un account GitHub gratuito.',
    kinds: [
      { title: 'Segnala un bug', sub: 'Cosa hai toccato e cosa è successo' },
      { title: 'Correggi una rosa', sub: 'La squadra, il giocatore, il numero giusto' },
      { title: 'Proponi una squadra o una funzione', sub: 'Quello che ti aiuterebbe a imparare' },
    ],
    faqEyebrow: 'Domande',
    faqTitle: 'Prima di scrivere',
    faq: [
      {
        q: 'Come sblocco i livelli 2 e 3?',
        a: 'Fai 8 su 10 al livello 1 per sbloccare il livello 2, e 8 su 10 al livello 2 per sbloccare il livello 3. Ogni squadra ha i suoi livelli.',
      },
      {
        q: 'Perché alcuni giocatori non hanno la foto?',
        a: 'Le foto provengono da Wikimedia Commons, e solo se Commons ne ha una con una licenza che Escuadra può usare. Se non c’è, o se sei offline prima che la foto sia stata caricata, la domanda mostra invece i colori della squadra e il numero di maglia.',
      },
      {
        q: 'Escuadra funziona offline?',
        a: 'Sì. Tutte le rose sono salvate sul tuo telefono, quindi il quiz funziona anche senza connessione. Le foto si caricano da Wikimedia Commons quando sei online.',
      },
      {
        q: 'Un numero di maglia o un giocatore sembra sbagliato.',
        a: 'Le rose sono raccolte da Wikipedia e Wikidata, e ogni squadra indica quando è stata aggiornata l’ultima volta. Se qualcosa non è aggiornato, apri una segnalazione indicando la squadra e il giocatore.',
      },
      {
        q: 'Come cambio la lingua?',
        a: 'Escuadra segue la lingua del tuo telefono. Per sceglierne un’altra, apri <b>Impostazioni</b> e poi <b>Lingua</b>: English, Español, Français, Italiano o Deutsch.',
      },
      {
        q: 'Come disattivo le statistiche d’uso?',
        a: 'Apri <b>Impostazioni</b> e disattiva <b>Statistiche d’uso</b>. In Info, nell’app, trovi tutto ciò che esce dal tuo dispositivo, e lo trovi anche nell’<a href="{privacy}">informativa sulla privacy</a>.',
      },
      {
        q: 'Come ricomincio da zero?',
        a: 'Nella schermata di una squadra, il pulsante con la gomma apre <b>Ricomincia da zero</b>, che riporta quella squadra a “Non ancora giocato”. In Impostazioni, <b>Cancella tutti i record</b> fa lo stesso per tutte le squadre, e <b>Ripristina Escuadra</b> fa tornare tutto com’era al primo avvio.',
      },
    ],
  },
  countries: {
    ESP: 'Spagna', ARG: 'Argentina', BRA: 'Brasile', FRA: 'Francia', ENG: 'Inghilterra',
    JPN: 'Giappone', GER: 'Germania', SEN: 'Senegal', ITA: 'Italia', MEX: 'Messico',
    POR: 'Portogallo', KOR: 'Corea del Sud', NED: 'Paesi Bassi', NGA: 'Nigeria',
    USA: 'Stati Uniti', CRO: 'Croazia', URU: 'Uruguay', EGY: 'Egitto', COL: 'Colombia',
    AUS: 'Australia', CAN: 'Canada', GHA: 'Ghana', ARM: 'Armenia',
  },
  teaser: {
    positions: { GK: 'Portiere', DF: 'Difensore', MF: 'Centrocampo', FW: 'Attaccante' },
    positionCodes: { GK: 'POR', DF: 'DIF', MF: 'CEN', FW: 'ATT' },
    clueCodes: { club: 'Club', nat: 'Naz' },
    clueSpoken: { club: 'Club', nat: 'Nazionalità' },
    spoken: {
      name: 'Nome: {name}.',
      beingAsked: 'da indovinare',
      clues: 'Ruolo: {position}. Età: {age}. {clueLabel}: {clue}.',
      question: 'Domanda {n} di {total}. {team}. Chi ha il numero {number}? {clues}',
      score: 'Punteggio: {score} su {answered}',
      result: '{score} su {total}',
    },
    whoWears: 'Chi ha il numero {number}?',
    hint: {
      tap: 'Scegli la risposta',
      right: 'Giusto. Arriva la prossima…',
      rightLast: 'Giusto. Ora il tuo risultato…',
    },
    next: 'Avanti',
    seeRound: 'Vedi il tuo risultato',
    live: {
      right: 'Giusto: {answer}.',
      wrong: 'Sbagliato. Il numero {number} è {answer}.',
      round: 'La tua partita: {score} su {total}. {title}.',
    },
    titles: { perfect: 'A la escuadra', learning: 'Sto imparando' },
    resultCopy: {
      perfect: 'Tre su tre. Nell’app, ogni partita ha dieci domande, con 96 club e 157 nazionali.',
      learning:
        'Ecco quelli da imparare. Nell’app, ogni partita ha dieci domande, con 96 club e 157 nazionali, e ogni errore ti aspetta nella schermata dei risultati.',
    },
  },
};

// Italian says "Privacy" and "Home" too, as i18n/it.ts and privacy/2/it.html do.
export const SAME_AS_ENGLISH = ['layout.nav.privacy', 'layout.nav.home'];
