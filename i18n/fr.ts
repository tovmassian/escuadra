// The Français catalog (#145), typed against ./en.ts: same keys, same order,
// same parameters. Drafted by Claude; a native speaker reviews it before it
// merges (#145). About and the store tagline are English until #146 and #147
// translate them with their legal and listing copy.
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

const PHOTO_CREDITS = 'Crédits photo';

export const fr: Messages = {
  common: {
    level: (level: number) => `Niveau ${level}`,
    back: 'Retour',
    close: 'Fermer',
    scoreSpoken: (correct: number, attempted: number) => `Score : ${correct} sur ${attempted}`,
  },
  home: {
    aboutLink: 'À propos',
    darkTheme: 'Thème sombre',
    languageLabel: (name: string) => `Langue : ${name}`,
    // "Record" for the best score, here, on the ladder pill and in the picker.
    continueMeta: (level: number, best: number | undefined, total: number) =>
      best === undefined ? `NIVEAU ${level}` : `NIVEAU ${level} · RECORD ${best}/${total}`,
    startTraining: 'S’entraîner',
    // "Voir toutes les équipes" is 23 chars against 20.
    browseAllTeams: 'Toutes les équipes',
  },
  languageSheet: {
    title: 'Langue',
    // "Langue du téléphone · Italiano" is 30 chars against 28.
    matchPhone: (name: string) => `Langue du système · ${name}`,
  },
  formats: {
    /** "21 août 2026", and "1er août 2026" on the first of the month. */
    date: ({ day, month, year }: CalendarDate) =>
      `${day === 1 ? '1er' : day} ${MONTHS[month - 1] ?? ''} ${year}`,
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
    // Feminine: it is the photo that is cropped.
    cropped: 'recadrée',
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
    play: 'Jouer',
    playAgain: 'Rejouer',
    // No verb: "Fais 8/10 au niveau 1" wraps the rung titles beside it.
    unlockHint: (target: string, level: number) => `${target} au niveau ${level}`,
    rungLocked: (title: string, correct: number, total: number, level: number) =>
      `${title}, verrouillé, ${correct} sur ${total} au niveau ${level}`,
    rungBest: (title: string, correct: number, total: number) =>
      `${title}, record ${correct} sur ${total}`,
    title: 'Choisis la difficulté',
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
        description: 'Le nom parmi 6 choix, puis le poste, puis le club ou la nationalité.',
      },
    },
    studySquad: 'Réviser l’effectif',
    updated: (date: string) => `Mis à jour le ${date} · Wikipédia`,
    best: (correct: number, total: number) => `RECORD ${correct}/${total}`,
  },
  picker: {
    allLeagues: 'TOUS',
    notPlayed: (season: string) => `${season} · PAS ENCORE JOUÉ`,
    played: (season: string, level: number, correct: number, total: number) =>
      `${season} · NIVEAU ${level} · RECORD ${correct}/${total}`,
    home: 'Accueil',
    title: 'Choisis une équipe',
    count: (count: number) =>
      count <= 1 ? `${count} équipe · appuie pour jouer` : `${count} équipes · appuie pour jouer`,
    clubs: 'Clubs',
    nationalTeams: 'Sélections',
    search: 'Chercher une équipe',
    clearSearch: 'Effacer la recherche',
    noTeams: 'Aucune équipe trouvée',
    noResults: (query: string) => `Aucun résultat pour « ${query} »`,
  },
  // English until #147 localises the feature graphic with the store listing.
  store: en.store,
  // English until #146 translates About with the privacy policy.
  about: en.about,
};
