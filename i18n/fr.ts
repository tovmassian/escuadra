// The Français catalog (#145), typed against ./en.ts: same keys, same order,
// same parameters. Drafted by Claude; a native speaker reviews it before it
// merges (#145). The store tagline is English until #147 translates it with
// the listing copy.
// Escuadra and a la escuadra come from ./names and are never translated.
// French as France speaks it and L’Équipe writes it: where Belgium, Switzerland
// or Québec differ (Nigéria, septante, magasiner), France wins.
//
// Typography: every space before ? ! : ; and inside « » is a no-break space
// (U+00A0, not the narrow U+202F), so the sign never wraps onto a line of its
// own; i18n/__tests__/translations.test.ts checks it. Apostrophes are ’.
// The player is "tu". A team's name sits before a colon or alone, never after
// an article ("du Brésil", "des Pays-Bas"): the data gives no gender.
import { en, type CalendarDate, type Messages } from './en';
import { A_LA_ESCUADRA, ESCUADRA } from './names';

const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];
const MONTHS_LONG = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const PHOTO_CREDITS = 'Crédits photo';
// Feminine: it is the photo that is cropped.
const CROPPED = 'recadrée';
const USAGE_STATISTICS = 'Statistiques d’utilisation';

export const fr: Messages = {
  common: {
    level: (level: number) => `Niveau ${level}`,
    back: 'Retour',
    close: 'Fermer',
    scoreSpoken: (correct: number, attempted: number) => `Score : ${correct} sur ${attempted}`,
    outdated: 'Obsolète',
  },
  home: {
    // "Réglages", as iOS names the screen and as this catalog says elsewhere.
    settings: 'Réglages',
    // "Record" for the best score, here, on the ladder pill and in the picker.
    continueMeta: (level: number, best: number | undefined, total: number) =>
      best === undefined ? `NIVEAU ${level}` : `NIVEAU ${level} · RECORD ${best}/${total}`,
    startTraining: 'S’entraîner',
    headline: 'Retiens chaque numéro.',
    continueTeam: (team: string) => `Continuer : ${team}`,
    allTeams: 'Toutes les équipes',
    starHint: 'Mets une étoile à une équipe, elle t’attendra ici.',
  },
  tips: {
    // "Comment jouer", as game menus say; About's stored list names the tips
    // ("astuces") the same way.
    kicker: (step: number, count: number) => `Comment jouer · ${step}/${count}`,
    kickerLevel: (level: number) => `Comment jouer · Niveau ${level}`,
    spoken: (step: number, count: number) => `Comment jouer, astuce ${step} sur ${count}`,
    spokenLevel: (level: number) => `Comment jouer, niveau ${level}`,
    next: 'Suivant',
    // "Compris", as the round's "Compris, suivant" says.
    gotIt: 'Compris',
    // "Passer les astuces" is 18 chars against 14; Suivant already moves one tip on.
    skip: 'Passer',
    picker: {
      switch: {
        heading: 'Clubs ou sélections',
        body: 'Bascule ici, puis affine par championnat ou par confédération.',
      },
      pick: {
        heading: 'Choisis une équipe',
        body: 'Appuie sur une équipe pour voir ses niveaux et commencer.',
      },
    },
    difficulty: {
      start: {
        heading: 'Commence ici',
        body: 'Tu vois un numéro de maillot et quelques indices, et tu choisis le nom. Fais 8/10 pour débloquer le niveau 2.',
      },
      star: {
        heading: 'Garde-la sous la main',
        body: 'Mets une étoile à une équipe, elle t’attendra sur l’écran principal de l’appli.',
      },
      study: {
        heading: 'Ou révise d’abord',
        body: 'Parcours tout l’effectif. Cache les noms pour te tester.',
      },
    },
    study: {
      hide: {
        heading: 'Teste-toi',
        body: 'Cache les noms, puis appuie sur une carte pour vérifier.',
      },
      positions: {
        heading: 'Un poste à la fois',
        body: 'Apprends d’abord les gardiens, puis la défense, le milieu et l’attaque.',
      },
    },
    question: {
      clues: {
        heading: 'Un numéro, quelques indices',
        body: 'Le numéro de maillot est la question. Le poste, l’âge et le club t’aident à trouver le joueur.',
        bodyClub:
          'Le numéro de maillot est la question. Le poste, l’âge et la nationalité t’aident à trouver le joueur.',
      },
      answer: {
        heading: 'Appuie sur celui qui le porte',
        body: 'Après une bonne réponse, la suite arrive seule. Après une erreur, tu vois qui c’était et la partie t’attend.',
      },
      level2: {
        heading: 'Maintenant, en deux temps',
        body: 'D’abord le nom, puis le poste. Ça ne compte que si les deux sont justes.',
      },
      level3: {
        heading: 'En trois temps',
        body: 'Le nom, le poste, puis le club. Pour une équipe de club, la nationalité à la place.',
      },
    },
    results: {
      missed: {
        heading: 'Les joueurs à retenir',
        body: 'Chaque erreur, avec le bon joueur et ton choix. Fais défiler pour tout voir.',
      },
      again: {
        heading: 'Rejoue ou révise',
        body: 'Fais 8/10 pour débloquer le niveau suivant. Rejoue la partie, ou révise d’abord l’effectif.',
      },
      next: {
        heading: 'Passe au niveau suivant',
        body: 'Joue le niveau suivant, ou révise d’abord l’effectif.',
      },
    },
  },
  languageSheet: {
    title: 'Langue',
    // "Langue du téléphone · Italiano" is 30 chars against 28.
    matchPhone: (name: string) => `Langue du système · ${name}`,
  },
  settings: {
    title: 'Réglages',
    sections: {
      play: 'Jeu',
      privacy: 'Confidentialité',
      // The section holds only the Rate card: backing the app, not a help desk
      // ("Assistance", as the web pages' nav says).
      support: 'Soutien',
      comingNext: 'À venir',
      // "À propos", as the About screen's title says.
      about: 'À propos',
      yourData: 'Tes données',
    },
    language: 'Langue',
    languageSpoken: (name: string) => `Langue : ${name}`,
    // "Apparence", the iOS setting for light and dark.
    appearance: 'Apparence',
    // "Système", as "Langue du système" says for the language.
    appearanceOptions: { system: 'Système', dark: 'Sombre', light: 'Clair' },
    // The usual French name for the setting.
    vibration: 'Vibrations',
    usageStatistics: USAGE_STATISTICS,
    // Feminine plural: the statistics.
    usageNote: 'Anonymes. « À propos » précise ce qui est envoyé.',
    rate: {
      title: `Noter ${ESCUADRA}`,
      line: 'Ta note aide d’autres fans à trouver l’appli.',
      button: 'Noter',
    },
    aboutEscuadra: `À propos d’${ESCUADRA}`,
    privacy: 'Confidentialité',
    licences: 'Licences',
    version: (version: string) => `Version ${version}`,
    // Feminine: it is the version that is built in.
    builtIn: 'intégrée',
  },
  examMode: {
    title: 'Mode examen',
    line: 'Tout l’effectif, rien qu’avec les numéros de maillot.',
    soon: 'Bientôt',
  },
  reset: {
    // Verbs, as the headings of the two lists: what the action does.
    clears: 'Efface',
    keeps: 'Conserve',
    team: {
      title: (team: string) => `Recommencer : ${team} ?`,
      line: (team: string) =>
        `${team} redevient « Pas encore joué », comme si tu n’avais jamais ouvert cette équipe.`,
      bestScores: 'Records',
      // N for Niveau.
      levelScore: (level: number, score: number) => `N${level} ${score}`,
      keepsStar: 'Ton étoile : l’équipe reste dans « Tes équipes ».',
      confirm: 'Recommencer',
    },
    all: {
      row: 'Effacer tous les records',
      note: 'Toutes les équipes, à zéro. Tes réglages restent.',
      title: 'Effacer tous les records ?',
      line: 'Toutes les équipes redeviennent « Pas encore joué ». Les paliers repartent du niveau 1.',
      count: (scores: number, teams: number) =>
        `${scores} · ${teams} ${teams <= 1 ? 'équipe' : 'équipes'}`,
      keepsLine: 'Tes équipes étoilées et tous tes réglages.',
      confirm: (count: number) =>
        count <= 1 ? `Effacer ${count} record` : `Effacer ${count} records`,
    },
    app: {
      row: `Réinitialiser ${ESCUADRA}`,
      note: 'Tout revient comme au premier lancement.',
      title: `Réinitialiser ${ESCUADRA} ?`,
      line: `Tout ce qu’${ESCUADRA} garde sur ce téléphone revient comme au premier lancement.`,
      scores: 'Records et « Continuer »',
      starred: 'Équipes étoilées',
      preferences: 'Langue, apparence, vibrations, vue Effectif',
      tips: 'Astuces « Comment jouer », à revoir',
      photos: 'Photos de joueurs en cache',
      keepsLine:
        'Ton choix sur les statistiques d’utilisation. Leur identifiant aléatoire est remplacé par un nouveau.',
    },
  },
  formats: {
    /** "21 août 2026", and "1er août 2026" on the first of the month. */
    date: ({ day, month, year }: CalendarDate) =>
      `${day === 1 ? '1er' : day} ${MONTHS[month - 1] ?? ''} ${year}`,
    /** "21 octobre 2026", and "1er octobre 2026" on the first of the month. */
    longDate: ({ day, month, year }: CalendarDate) =>
      `${day === 1 ? '1er' : day} ${MONTHS_LONG[month - 1] ?? ''} ${year}`,
  },
  // GB gardien de but, DÉF défenseur, MIL milieu, ATT attaquant.
  positionCodes: { GK: 'GB', DF: 'DÉF', MF: 'MIL', FW: 'ATT' },
  positions: { GK: 'Gardien', DF: 'Défenseur', MF: 'Milieu', FW: 'Attaquant' },
  slots: { NAME: 'Nom', POS: 'Poste', AGE: 'Âge', CLUB: 'Club', NAT: 'Nationalité' },
  // "POSTE" fits the chip; "POS" is the English code.
  slotCodes: { NAME: 'NOM', POS: 'POSTE', AGE: 'ÂGE', CLUB: 'CLUB', NAT: 'NAT' },
  round: {
    // "Bonne réponse" is 13 chars against 12.
    correct: 'Exact',
    missed: 'Raté',
    whoWears: (no: number) => `Qui porte le ${no} ?`,
    askPosition: 'Quel poste ?',
    askClub: 'Quel club ?',
    // Not "Quel pays ?": on a club squad that could mean the country the
    // player plays in. Nationalité, as on the NAT chip. Not "Quelle
    // nationalité ?" either: it wraps the prompt to two lines at 360 dp.
    askNationality: 'Nationalité ?',
    // "Voir les résultats" is 18 chars against 14.
    seeResults: 'Résultats',
    next: 'Suivant',
    nextQuestion: 'Question suivante',
    // A comma, not a dash: the dash reads as English UI.
    gotItNext: 'Compris, suivant',
    // "Résultats · appuie pour passer" is 30 chars against 26. The ellipsis
    // says it moves on in a moment; "ou appuie ici" says a tap is sooner.
    // French sets the ellipsis tight against the word before it.
    tapToSkip: (label: string) => `${label}… ou appuie ici`,
    slotSpoken: {
      given: (slot: string, value: string) => `${slot} : ${value}`,
      active: (slot: string) => `${slot} : à trouver`,
      // "À venir", not "à suivre": that is "to be continued".
      pending: (slot: string) => `${slot} : à venir`,
      correct: (slot: string, value: string) => `${slot} : ${value}, exact`,
      wrong: (slot: string, value: string) => `${slot} : ${value}, la bonne réponse`,
      // Spoken only: "demandé" and "demandée" sound the same.
      notAsked: (slot: string, value: string) => `${slot} : ${value}, non demandé`,
    },
    // "Partie": a manche is one round of several inside a match.
    leave: 'Quitter la partie',
    shirtNumber: (no: number) => `Numéro ${no}`,
    // "Choisis", not "Tape": "Tape ta réponse" reads "type your answer".
    tapYourAnswer: 'Choisis ta réponse',
    // Not "Passe…": with "tu" that reads as an order to the player.
    movesOn: 'La suite arrive dans un instant',
    answerTag: 'Réponse',
    tileSpoken: {
      idle: '',
      'correct-picked': 'exact',
      'correct-unpicked': 'la bonne réponse',
      'incorrect-picked': 'ton choix, faux',
      'incorrect-other': '',
    },
    questionOf: (n: number, total: number) => `Question ${n} sur ${total}`,
    streak: (count: number) => `Série : ${count} d’affilée`,
  },
  study: {
    // French takes the singular for 0 and 1.
    players: (count: number) => (count <= 1 ? `${count} joueur` : `${count} joueurs`),
    shownOf: (shown: number, total: number) => `${shown} sur ${total}`,
    noNumber: 'sans numéro',
    nameHidden: 'nom masqué',
    title: 'Effectif',
    // Actions, not states: the pill says what a tap does. "Cacher les noms"
    // (15) and "Voir les noms" (13) are over 12, so the article goes.
    hideNames: 'Cacher noms',
    showNames: 'Voir noms',
    showAsList: 'Afficher en liste',
    showAsCards: 'Afficher en cartes',
    all: 'Tous',
    tapToReveal: 'Voir le nom',
    revealsName: 'Affiche le nom',
  },
  credits: {
    cropped: CROPPED,
    photo: 'Photo :',
    title: PHOTO_CREDITS,
    button: (count: number) => `${PHOTO_CREDITS} · ${count}`,
  },
  results: {
    flawlessVerdict: (team: string, season: string, level: number) =>
      `${team} · ${season}, niveau ${level}. Sans faute.`,
    clearedTitle: (level: number) => `Niveau ${level} validé`,
    // "Onze" takes no elision: "du onze".
    clearedVerdict: 'Tu connais l’essentiel du onze titulaire.',
    failTitle: 'Voici les joueurs à retenir',
    toClear: (target: string, level: number) => `Fais ${target} pour valider le niveau ${level}.`,
    toUnlock: (target: string, level: number) =>
      `Fais ${target} pour débloquer le niveau ${level}.`,
    // The words first: a long name truncates, the words must not.
    youPicked: (picked: string) => `Ton choix : ${picked}`,
    // "Trouvé", the quiz word; "Bon nom" can read as "nice name".
    nameRight: 'Nom trouvé',
    nameAndPositionRight: 'Nom et poste trouvés',
    wrongPart: {
      position: (right: string, picked: string) => `poste : ${right}, pas ${picked}`,
      club: (right: string, picked: string) => `club : ${right}, pas ${picked}`,
      nationality: (right: string, picked: string) => `nationalité : ${right}, pas ${picked}`,
    },
    close: 'Fermer, choisir une autre équipe',
    // "Réviser": the word for studying before a test.
    studySquad: 'Réviser l’effectif',
    retry: 'Rejouer la partie',
    playLevel: (level: number) => `Jouer le niveau ${level}`,
    chooseTeam: 'Changer d’équipe',
    // "Raté", as the round says after a miss.
    missedCount: (count: number) =>
      count <= 1 ? `RATÉ · ${count} JOUEUR` : `RATÉS · ${count} JOUEURS`,
    // "Glisse pour tout voir" is 21 chars against 14; "Fais défiler" is the
    // usual word for moving a list along.
    swipeForAll: 'Fais défiler',
    // "Sans faute", as the flawless verdict says.
    nothingMissed: (count: number) => `TOUS LES ${count} · SANS FAUTE`,
    roundSpoken: (right: number, total: number) =>
      `Partie : ${right} ${right <= 1 ? 'bonne réponse' : 'bonnes réponses'} sur ${total}`,
  },
  share: {
    title: 'Partager ta partie',
    // Speaks to whoever receives the picture: working on it, as "Réviser"
    // says elsewhere. "Pas encore au point" sounded like a put-down.
    stillLearning: 'En pleine révision',
    // The name first, so it needs no article ("de l’Espagne", "du Brésil").
    // Not "nommer", which also means to appoint.
    question: (team: string) => `${team} : connais-tu tout l’effectif ?`,
    image: 'Image',
    text: 'Texte',
    preview: 'Aperçu',
    imageHint: 'Image au format story, sans photo ni nom : tes amis peuvent quand même y jouer.',
    textHint: 'La grille du score pour tes groupes, avec un lien vers l’appli.',
    // "Partager le texte" is 17 chars against 16, so both say "Envoyer".
    shareImage: 'Envoyer l’image',
    shareText: 'Envoyer le texte',
    pictureSpoken: (eyebrow: string, correct: number, total: number, title: string) =>
      `Image à partager : ${eyebrow}. ${correct} sur ${total}. ${title}.`,
  },
  ladder: {
    // No verb: "Fais 8/10 au niveau 1" wraps the rung titles beside it.
    unlockHint: (target: string, level: number) => `${target} au niveau ${level}`,
    rungLocked: (title: string, correct: number, total: number, level: number) =>
      `${title}, verrouillé, ${correct} sur ${total} au niveau ${level}`,
    rungBest: (title: string, correct: number, total: number) =>
      `${title}, record ${correct} sur ${total}`,
    levels: {
      1: {
        title: 'Du numéro au nom',
        description: 'Avec le numéro de maillot, trouve le joueur parmi 4 choix.',
      },
      2: {
        title: 'Nom et poste',
        description: 'Le nom, puis le poste : GB, DÉF, MIL ou ATT.',
      },
      3: {
        title: 'Profil complet',
        descriptionClub: 'Le nom parmi 6 choix, puis le poste, puis la nationalité.',
        descriptionNation: 'Le nom parmi 6 choix, puis le poste, puis le club.',
      },
    },
    studySquad: 'Réviser l’effectif',
    updated: (date: string) => `Mis à jour le ${date} · Wikipédia`,
    heading: 'Les paliers',
    nationalTeam: 'Sélection',
    cleared: 'Validé',
    notPlayed: 'Pas encore joué',
    yourBest: (correct: number, total: number) => `Ton record · ${correct}/${total}`,
    yourBestSpoken: (correct: number, total: number) => `Ton record : ${correct} sur ${total}`,
    // The article is dropped to fit the 16-char budget: "Jouer niveau 3", not
    // "Jouer le niveau 3".
    playLevel: (level: number) => `Jouer niveau ${level}`,
    rungCleared: (title: string, correct: number, total: number) =>
      `${title}, record ${correct} sur ${total}, validé`,
    rungEscuadra: (title: string, correct: number, total: number) =>
      `${title}, record ${correct} sur ${total}, ${A_LA_ESCUADRA}`,
    star: 'Une de tes équipes',
    bestOutdated: (correct: number, total: number) => `Record ${correct}/${total} · Obsolète`,
    bestOutdatedSpoken: (correct: number, total: number) =>
      `Record : ${correct} sur ${total}, obsolète`,
    rungOutdated: (title: string, correct: number, total: number) =>
      `${title}, record ${correct} sur ${total}, obsolète`,
    squadUpdated: (date: string) =>
      `Effectif mis à jour le ${date}. Les records en gris datent d’avant.`,
    startOver: (team: string) => `Recommencer : ${team}`,
  },
  picker: {
    // Masculine: the championnats.
    allLeagues: 'Tous',
    title: 'Choisis ton équipe',
    squadCount: (count: number) => (count <= 1 ? `${count} équipe` : `${count} équipes`),
    clubs: 'Clubs',
    nations: 'Sélections',
    allClubs: 'Tous les clubs',
    // Feminine: the confédérations.
    allConfederations: 'Toutes',
    regions: {
      UEFA: 'Europe',
      CONMEBOL: 'Amérique du Sud',
      CONCACAF: 'Amérique du Nord, centrale et Caraïbes',
      CAF: 'Afrique',
      AFC: 'Asie',
      OFC: 'Océanie',
    },
    allNations: 'Toutes les sélections',
    nationsCaption: (name: string) => `${name} · A–Z`,
    listCaption: (name: string, count: number) => `${name} · ${count}`,
    bestSpoken: (level: number, correct: number, total: number) =>
      `Niveau ${level}, record ${correct} sur ${total}`,
    bestOutdatedSpoken: (level: number, correct: number, total: number) =>
      `Niveau ${level}, record ${correct} sur ${total}, obsolète`,
    search: 'Rechercher une équipe',
    clearSearch: 'Effacer la recherche',
    noTeams: 'Aucune équipe trouvée',
    noResults: (query: string) => `Aucun résultat pour « ${query} »`,
    yourSquads: 'Tes équipes',
  },
  // English until #147 localises the feature graphic with the store listing.
  store: en.store,
  about: {
    // "À propos", also Settings' About section label (settings.sections.about).
    title: 'À propos',
    intro: [
      `${ESCUADRA} est une application indépendante et non officielle. Elle n’est ni affiliée ni associée à la FIFA, à l’UEFA ou à une autre confédération, à une ligue, à une fédération nationale de football ou à un club, et n’est approuvée par aucun d’entre eux. Les noms des clubs, des sélections nationales et des confédérations sont utilisés uniquement à des fins d’identification et restent la propriété de leurs détenteurs respectifs. ${ESCUADRA} n’est pas non plus affiliée à la Wikimedia Foundation ni à un joueur figurant sur une photo, et n’est approuvée par aucun d’entre eux.`,
      `${ESCUADRA} identifie les équipes par leur nom et leurs couleurs, et n’affiche jamais elle-même d’écussons, d’emblèmes ou de logos de club. Une photo de joueur peut tout de même en montrer un, sur un maillot ou à l’arrière-plan, car il fait partie de la photo d’origine. Ces signes appartiennent à leurs détenteurs, et leur présence ne signifie pas qu’un club, un sponsor ou une marque approuve ${ESCUADRA}.`,
    ],
    credits: {
      heading: 'Crédits des données et des images',
      sections: [
        {
          heading: 'Données des effectifs',
          paragraphs: [
            'Les données des effectifs sont compilées à partir de Wikipédia et de Wikidata et correspondent à la saison indiquée pour chaque équipe. Le contenu de Wikipédia est disponible sous licence CC BY-SA. Wikidata est disponible sous licence CC0.',
          ],
        },
        {
          heading: 'Photos des joueurs',
          paragraphs: [
            'Les photos des joueurs proviennent de Wikimedia Commons. Chacune relève du domaine public ou est utilisée sous la licence qui l’accompagne sur Commons : CC BY-SA, CC BY, CC0 ou la licence « Attribution » propre à Commons. Les photos sont recadrées pour remplir l’espace où elles apparaissent. Sur l’écran des questions, une photo trop petite pour remplir cet espace est alors affichée en entier, sur une copie agrandie et assombrie d’elle-même qui le remplit. Là où du texte de l’application se superpose à une photo, l’application applique un ombrage à cette partie de l’écran, et elle atténue la photo après une mauvaise réponse. Les fichiers des photos eux-mêmes ne sont pas modifiés. Tous les joueurs n’ont pas de photo.',
            `L’auteur, la licence et le mot « ${CROPPED} » s’affichent sous la question tant qu’une photo est à l’écran, et à nouveau sous « ${PHOTO_CREDITS} » dans les résultats, pour toute la partie, et à la fin de l’écran Effectif, pour chaque joueur qui y figure. Appuie sur l’auteur pour afficher la page de la photo sur Wikimedia Commons, ou sur la licence pour en voir les conditions.`,
          ],
        },
        {
          heading: 'Drapeaux et polices',
          paragraphs: [
            'Les images des drapeaux proviennent de flagpedia.net et relèvent du domaine public. Les polices de caractères Inter, IBM Plex Mono et Archivo sont utilisées sous la SIL Open Font License 1.1.',
          ],
        },
        {
          heading: 'Noms de pays',
          paragraphs: [
            `La plupart des noms de pays dans les langues autres que l’anglais proviennent du projet Unicode CLDR et sont utilisés sous l’Unicode License v3. Les autres ont été rédigés pour ${ESCUADRA}.`,
          ],
        },
      ],
    },
    licences: {
      label: 'Licences',
      originalLanguage: 'Les textes des licences sont affichés tels quels, en anglais.',
      countryNames: 'Noms de pays',
      fonts: 'Polices',
      software: 'Logiciels',
    },
    privacy: {
      heading: 'Confidentialité',
      lead: `${ESCUADRA} ne comporte ni compte, ni identification, ni publicité, et ne te demande jamais ton nom, ton adresse e-mail ni aucune coordonnée.`,
      paragraphs: [
        'Tes scores et tes réglages sont enregistrés sur ton appareil. Les seuls éléments qui le quittent sont ceux décrits ci-dessous, et aucun n’est lié à ton identité.',
      ],
      sections: [
        {
          heading: 'Photos des joueurs',
          paragraphs: [
            `Les photos des joueurs ne sont pas intégrées à ${ESCUADRA}. Elles sont chargées depuis Wikimedia Commons, géré par la Wikimedia Foundation : les photos d’une partie quand la partie commence, et les photos d’un effectif sur l’écran Effectif, à mesure que tu le fais défiler. Comme tout site web, Wikimedia reçoit l’adresse IP de ton appareil et les détails de chaque requête, y compris les photos demandées, et donc les joueurs de ta partie ou de ton effectif. ${ESCUADRA} n’envoie rien d’autre à Wikimedia, et ce que Wikimedia reçoit est soumis à sa propre politique de confidentialité.`,
            'Les photos déjà chargées peuvent être conservées dans le cache de l’application sur ton appareil, afin qu’elles s’affichent plus rapidement. Sans connexion, le quiz fonctionne normalement et affiche les couleurs de l’équipe et le numéro de maillot à la place de toute photo qui ne se trouve pas déjà dans ce cache.',
            `Appuyer sur un crédit photo ouvre la page de la photo sur Wikimedia Commons, ou sa licence sur le site de Creative Commons, dans un navigateur intégré à l’application. Ces sites ont leur propre politique de confidentialité, et ${ESCUADRA} ne peut pas voir ce que tu y fais.`,
          ],
        },
        {
          heading: 'Partage',
          paragraphs: [
            `Quand tu partages un résultat, une image ou un court texte est créé sur ton appareil et transmis à l’application que tu choisis dans le menu de partage de ton téléphone. ${ESCUADRA} ne voit pas, n’envoie pas et ne conserve pas ce que tu partages.`,
          ],
        },
        {
          heading: 'Statistiques d’utilisation anonymes',
          paragraphs: [
            `${ESCUADRA} envoie des statistiques d’utilisation anonymes à TelemetryDeck, un service de mesure d’audience, sauf si tu désactives « ${USAGE_STATISTICS} » sur l’écran « Réglages » de l’application. Chacune contient une forme hachée d’un identifiant aléatoire créé pour ces statistiques (distinct de celui qu’utilise la vérification des mises à jour de l’application) et un code de session aléatoire, renouvelé à chaque démarrage de l’application. Comme tout service en ligne, TelemetryDeck reçoit aussi l’adresse IP de ton appareil et les détails techniques habituels de chaque requête, qui, sous iOS, comprennent le numéro de build de l’application et la version du système de ton appareil. Ce que TelemetryDeck reçoit est soumis à sa propre politique de confidentialité. L’identifiant des statistiques et le code de session sont aléatoires, ne sont pas dérivés de ton appareil et ne sont liés ni à toi ni à tes comptes. Ni ${ESCUADRA} ni le développeur ne partagent l’identifiant, le code de session ou les statistiques avec qui que ce soit d’autre.`,
            `Ces statistiques sont les suivantes : l’application a été ouverte, avec sa langue et l’indication que cette langue suit celle de ton téléphone ou a été choisie dans l’application ; une partie a commencé, avec le type d’équipe (club ou sélection) et le niveau de difficulté ; une partie s’est terminée, avec ces deux mêmes informations, le score et l’indication qu’elle a été ou non ${A_LA_ESCUADRA} ; l’écran Effectif a été ouvert, avec le type d’équipe (club ou sélection) ; et un résultat a été transmis au menu de partage de ton téléphone, avec le niveau, le score et le format (image ou texte). Elles ne contiennent jamais de noms d’équipes ni de joueurs, ni tes réponses, ni rien de ce que tu saisis.`,
          ],
        },
        {
          heading: 'Mises à jour de l’application',
          paragraphs: [
            `Quand ${ESCUADRA} démarre, elle vérifie si une version plus récente de l’application est disponible auprès d’Expo, le service qui distribue ses mises à jour. Cette vérification envoie ce qui est nécessaire pour fournir la bonne mise à jour : le système d’exploitation de ton appareil, la version et le projet de l’application, et un identifiant aléatoire créé pour cette installation. ${ESCUADRA} n’associe cet identifiant ni à toi ni à rien de ce que tu fais dans l’application. Si l’application a planté ou n’a pas pu charger une mise à jour au démarrage, la vérification suivante envoie aussi à Expo le message d’erreur technique lié à cet échec. Comme tout service en ligne, Expo reçoit également l’adresse IP de ton appareil à chaque vérification. Sans connexion, l’application se passe de cette vérification et fonctionne normalement.`,
          ],
        },
        {
          heading: 'Ce qui est enregistré sur ton appareil',
          paragraphs: [
            `${ESCUADRA} enregistre onze éléments en local, sur ton appareil : ton record pour chaque équipe et chaque niveau de difficulté, dont l’application déduit les niveaux que tu as validés ; la dernière équipe et le dernier niveau joués ; les équipes que tu as marquées d’une étoile ; ta préférence de thème, clair ou sombre ; ton choix de langue ; si les vibrations sont activées ; si l’écran Effectif affiche des cartes ou une liste ; quels écrans t’ont déjà montré leurs astuces « Comment jouer », et si tu les as passées ; quelle version de l’application a demandé en dernier à ton téléphone d’afficher une invitation à l’évaluer ; ton choix concernant les statistiques d’utilisation ; et l’identifiant aléatoire qu’utilisent ces statistiques. La vérification des mises à jour de l’application conserve aussi son propre identifiant aléatoire sur ton appareil.`,
            `Ces données se trouvent dans l’espace de stockage privé propre à l’application. ${ESCUADRA} elle-même n’envoie que deux de ces onze éléments hors de ton appareil, et seulement tant que les statistiques d’utilisation sont activées : l’identifiant, envoyé sous forme hachée avec chaque statistique, et ton choix de langue, inclus dans la statistique envoyée à l’ouverture de l’application. Supprimer l’application efface toutes ces données de ton appareil, ainsi que les éventuelles photos en cache. Tu peux aussi les effacer dans « Réglages », sous « Tes données » : les records d’une équipe, tous tes records ou, avec « Réinitialiser ${ESCUADRA} », tout ce qui est listé ci-dessus et les éventuelles photos en cache, sauf ton choix concernant les statistiques d’utilisation, la version de l’application qui a demandé en dernier à ton téléphone d’afficher une invitation à l’évaluer et l’identifiant de la vérification des mises à jour de l’application. « Réinitialiser ${ESCUADRA} » donne aux statistiques d’utilisation un nouvel identifiant aléatoire. ${ESCUADRA} n’effectue aucune sauvegarde ni synchronisation de son côté, mais les sauvegardes de ton appareil (sous iOS, dans iCloud ou sur un ordinateur ; sous Android, chez Google) peuvent inclure ces données. Le développeur n’a pas accès à cet espace de stockage.`,
          ],
        },
        {
          heading: 'Rapports de plantage',
          paragraphs: [
            `Si tu autorises ton appareil à partager des données de diagnostic, Apple (sous iOS) ou Google (sous Android) peut partager des rapports de plantage anonymisés avec le développeur. Ce partage est géré par Apple ou Google et se contrôle dans les réglages de ton appareil. En dehors du message d’erreur que la vérification des mises à jour de l’application peut envoyer après un échec de démarrage, ${ESCUADRA} elle-même n’envoie aucun rapport de plantage.`,
          ],
        },
        {
          heading: 'Enfants',
          paragraphs: [
            `${ESCUADRA} ne comporte aucun compte et ne demande aucune information personnelle à qui que ce soit, y compris aux enfants. Les statistiques d’utilisation sont anonymes et peuvent être désactivées à tout moment.`,
          ],
        },
      ],
    },
    site: {
      title: 'Politique de confidentialité',
      updated: (date: string) => `Dernière mise à jour : ${date}`,
      appliesTo: (version: string) =>
        `Cette politique s’applique à ${ESCUADRA} ${version} et aux versions ultérieures.`,
      earlierVersions: 'Politique de confidentialité des versions antérieures',
      home: `Page d’accueil d’${ESCUADRA}`,
      languages: 'Langue',
      nav: {
        home: 'Accueil',
        support: 'Assistance',
        // What French sites call the header's tool links.
        utility: 'Accès rapide',
        footer: 'Pied de page',
      },
      theme: {
        light: 'Clair',
        dark: 'Sombre',
        toLight: 'Passer au thème clair',
        toDark: 'Passer au thème sombre',
      },
      releaseStatus: 'Désormais disponible sur l’App Store',
    },
  },
};
