// The site's French words (#280): en.mjs's shape. Reused word for word from main:
// store/listing/fr.md (the promotional text, the description's sentences, the
// affiliation line), i18n/fr.ts (positions and their codes, Settings' labels, level
// names, Cacher noms, En pleine révision, Qui porte, Choisis ta réponse) and
// i18n/countries.ts. The FRESH lines (fresh.mjs) are written afresh; the owner picks them.
// French as France speaks it, to "tu", set as i18n/fr.ts sets it: a no-break space
// (U+00A0) before each question mark, exclamation mark, colon and semicolon, and
// inside the guillemets.
export default {
  meta: {
    homeTitle: 'Escuadra — apprends les effectifs de foot numéro par numéro',
    homeDescription:
      'Qui porte le numéro 7 ? Apprends les effectifs de tous les clubs du top 5 européen et de plus de 150 sélections en parties rapides, puis vois qui tu as raté.',
    supportTitle: 'Assistance — Escuadra',
  },
  layout: {
    homeLabel: 'Page d’accueil d’Escuadra',
    utilityNav: 'Accès rapide',
    footerNav: 'Pied de page',
    language: 'Langue',
    languageCurrent: 'Langue : {name}',
    nav: {
      try: 'Essayer une question',
      how: 'Comment ça marche',
      squads: 'Équipes',
      support: 'Assistance',
      privacy: 'Confidentialité',
      privacyPolicy: 'Politique de confidentialité',
      privacy1x: 'Politique de confidentialité d’Escuadra 1.x',
      home: 'Accueil',
      report: 'Signaler un problème',
    },
    getApp: 'Télécharger',
    theme: {
      light: 'Clair',
      dark: 'Sombre',
      toLight: 'Passer au thème clair',
      toDark: 'Passer au thème sombre',
    },
    releaseStatus: 'Désormais disponible sur l’App Store et sur Google Play',
    badges: { appStore: 'Télécharger dans l’App Store', googlePlay: 'Disponible sur Google Play' },
  },
  home: {
    hero: {
      eyebrow: 'Quiz d’effectifs de foot',
      title: 'Qui porte le 7 ?',
      lead: 'Les numéros, par cœur. Apprends les effectifs de tous les clubs du top 5 européen et de plus de 150 sélections en parties éclair.',
      tryLink: 'Ou essaie une question ici même',
    },
    try: {
      eyebrow: 'À toi de jouer · Niveau 1',
      title: 'Un numéro.<br />Quatre noms.',
      body: 'Voilà le principe : un numéro de maillot et quelques indices, puis tu choisis le joueur. Ici, trois questions ; dans l’appli, dix par partie, avec l’équipe de ton choix.',
      level: 'Niveau 1',
      nameKey: 'Nom',
      positionKey: 'Poste',
      ageKey: 'Âge',
      resultEyebrow: 'Ta partie · 3 questions',
      playAgain: 'Rejouer la partie',
    },
    credits: {
      title: 'Crédits photo · 3',
      cropped: 'recadrée',
    },
    how: {
      eyebrow: 'Les paliers',
      title: 'Trois niveaux.<br />À gravir équipe par équipe.',
      startHere: 'Commence ici',
      lockedSpoken: 'Verrouillé : 8 sur 10 au niveau {level}',
      locked: '8/10 au niveau {level}',
      levels: [
        { title: 'Du numéro au nom', body: 'Avec le numéro de maillot, trouve le joueur parmi 4 choix.' },
        { title: 'Nom et poste', body: 'Le nom, puis le poste : GB, DÉF, MIL ou ATT.' },
        {
          title: 'Profil complet',
          body: 'Le nom parmi 6 choix, puis le poste, puis la nationalité, ou le club pour une sélection.',
        },
      ],
      note: 'Chaque question compte pour un point. Aux niveaux 2 et 3, tu ne marques le point que si tu réussis chaque étape.',
    },
    misses: {
      eyebrow: 'Résultats et Effectif',
      title: 'C’est en ratant qu’on apprend.',
      body: [
        'Après chaque partie, revois les joueurs ratés ou révise tout l’effectif, puis reviens faire un sans-faute.',
      ],
      stackLabel: 'Real Madrid · 2026/27 · Niveau 2 · 7/10',
      missedOf: 'Erreur {n} sur 3',
      missedPart: { name: 'Raté · nom', position: 'Raté · poste' },
    },
    squads: {
      eyebrow: 'Au programme',
      title: 'De ton club<br />à ta sélection.',
      stats: [
        { title: 'Clubs', body: 'Tous les clubs des cinq grands championnats européens.' },
        { title: 'Sélections', body: 'Issues des six confédérations.' },
        { title: 'Langues', body: 'English, Español, Français, Italiano et Deutsch.' },
      ],
      clubsLabel: 'Quelques-uns des clubs d’Escuadra',
      nationsLabel: 'Quelques-unes des sélections d’Escuadra',
    },
    share: {
      pictureLabel:
        'Image à partager d’Escuadra : Barcelona, 2026/27, niveau 1, 10 sur 10, a la escuadra. Les dix numéros de maillot, et « Barcelona : connais-tu tout l’effectif ? »',
      meta: 'Barcelona · 2026/27 · Niveau 1',
      question: 'Barcelona : connais-tu tout l’effectif ?',
      eyebrow: 'Dix sur dix',
      title: 'Le sans-faute a un nom.',
      body: [
        'En espagnol, une frappe en pleine lucarne. Fais dix sur dix, et Escuadra te l’annonce.',
        'Partage ensuite ta partie et montre à tout le monde que tu connais l’effectif les yeux fermés.',
      ],
    },
    promises: {
      eyebrow: 'Joue où tu veux',
      title: 'Tous les effectifs,<br />dans ta poche.',
      items: ['Sans pub', 'Jouable hors connexion', 'Disponible en 5 langues'],
    },
    get: {
      title: 'Ton effectif,<br />les yeux fermés.',
    },
    footer: {
      escuadraHeading: 'Escuadra',
      helpHeading: 'Aide',
      affiliation:
        'Escuadra est un outil d’apprentissage indépendant et non officiel. Il n’est ni affilié ni associé à une confédération, une ligue ou une compétition, à une fédération nationale de football, à un club ou à la Wikimedia Foundation, et n’est approuvé par aucun d’entre eux. Aucun joueur figurant sur une photo ne le cautionne. Les noms des clubs, des équipes nationales et des confédérations ne servent qu’à les identifier. Ils appartiennent à leurs propriétaires respectifs, tout comme les éventuels emblèmes de club visibles sur les photos des joueurs.',
    },
  },
  support: {
    eyebrow: 'Assistance',
    title: 'Quelque chose<br />cloche ?',
    lead: 'Un bug, un numéro de maillot erroné, une équipe que tu aimerais voir ajoutée ? Le meilleur moyen de contacter le développeur, c’est GitHub Issues. Dis ce qui s’est passé, sur quel téléphone et avec quelle équipe.',
    cta: 'Ouvrir un ticket sur GitHub',
    ctaNote: 'Pour ouvrir un ticket, il te faut un compte GitHub gratuit.',
    kinds: [
      { title: 'Signaler un bug', sub: 'Où tu as appuyé et ce qui s’est passé' },
      { title: 'Corriger un effectif', sub: 'L’équipe, le joueur, le bon numéro' },
      { title: 'Proposer une équipe ou une fonctionnalité', sub: 'Ce qui t’aiderait à apprendre' },
    ],
    faqEyebrow: 'Questions fréquentes',
    faqTitle: 'Avant d’écrire',
    faq: [
      {
        q: 'Comment débloquer les niveaux 2 et 3 ?',
        a: 'Fais 8/10 au niveau 1 pour débloquer le niveau 2, et 8/10 au niveau 2 pour débloquer le niveau 3. Chaque équipe a ses propres paliers.',
      },
      {
        q: 'Pourquoi certains joueurs n’ont-ils pas de photo ?',
        a: 'Les photos viennent de Wikimedia Commons, et seulement quand Commons en a une sous une licence qu’Escuadra peut utiliser. Sinon, ou sans connexion avant qu’une photo ait été chargée, la question affiche à la place les couleurs de l’équipe et le numéro de maillot.',
      },
      {
        q: 'Escuadra fonctionne-t-elle sans connexion ?',
        a: 'Oui. Tous les effectifs sont enregistrés sur ton téléphone, donc le quiz fonctionne sans connexion. Les photos se chargent depuis Wikimedia Commons quand tu es en ligne.',
      },
      {
        q: 'Une erreur sur un numéro de maillot ou un joueur ?',
        a: 'Les effectifs sont compilés à partir de Wikipédia et de Wikidata, et chaque équipe indique la date de sa dernière mise à jour. Si quelque chose n’est plus à jour, ouvre un ticket en précisant l’équipe et le joueur.',
      },
      {
        q: 'Comment changer de langue ?',
        a: 'Escuadra suit la langue de ton téléphone. Pour en choisir une autre, ouvre <b>Réglages</b>, puis <b>Langue</b> : English, Español, Français, Italiano ou Deutsch.',
      },
      {
        q: 'Comment désactiver les statistiques d’utilisation ?',
        a: 'Ouvre <b>Réglages</b> et désactive <b>Statistiques d’utilisation</b>. La page À propos, dans l’appli, détaille tout ce qui quitte ton appareil, tout comme la <a href="{privacy}">politique de confidentialité</a>.',
      },
      {
        q: 'Comment tout recommencer ?',
        a: 'Sur l’écran d’une équipe, le bouton en forme de gomme ouvre <b>Recommencer</b>, qui remet cette équipe à « Pas encore joué ». Dans Réglages, <b>Effacer tous les records</b> fait de même pour toutes les équipes, et <b>Réinitialiser Escuadra</b> remet tout comme au premier lancement.',
      },
    ],
  },
  countries: {
    ESP: 'Espagne', ARG: 'Argentine', BRA: 'Brésil', FRA: 'France', ENG: 'Angleterre',
    JPN: 'Japon', GER: 'Allemagne', SEN: 'Sénégal', ITA: 'Italie', MEX: 'Mexique',
    POR: 'Portugal', KOR: 'Corée du Sud', NED: 'Pays-Bas', NGA: 'Nigeria',
    USA: 'États-Unis', CRO: 'Croatie', URU: 'Uruguay', EGY: 'Égypte', COL: 'Colombie',
    AUS: 'Australie', CAN: 'Canada', GHA: 'Ghana', ARM: 'Arménie', SVN: 'Slovénie',
  },
  teaser: {
    positions: { GK: 'Gardien', DF: 'Défenseur', MF: 'Milieu', FW: 'Attaquant' },
    positionCodes: { GK: 'GB', DF: 'DÉF', MF: 'MIL', FW: 'ATT' },
    clueCodes: { club: 'Club', nat: 'Nat' },
    clueSpoken: { club: 'Club', nat: 'Nationalité' },
    spoken: {
      name: 'Nom : {name}.',
      beingAsked: 'à trouver',
      clues: 'Poste : {position}. Âge : {age}. {clueLabel} : {clue}.',
      question: 'Question {n} sur {total}. {team}. Qui porte le {number} ? {clues}',
      score: 'Score : {score} sur {answered}',
      result: '{score} sur {total}',
    },
    whoWears: 'Qui porte le {number} ?',
    hint: {
      tap: 'Choisis ta réponse',
      right: 'Exact. La suite arrive…',
      rightLast: 'Exact. Ton résultat arrive…',
    },
    next: 'Suivant',
    seeRound: 'Voir ton résultat',
    live: {
      right: 'Exact : {answer}.',
      wrong: 'Raté. Le {number}, c’est {answer}.',
      round: 'Ta partie : {score} sur {total}. {title}.',
    },
    titles: { perfect: 'A la escuadra', learning: 'En pleine révision' },
    resultCopy: {
      perfect: 'Trois sur trois. Dans l’appli, une partie compte dix questions, avec 96 clubs et 157 sélections au choix.',
      learning:
        'Voici les joueurs à retenir. Dans l’appli, une partie compte dix questions, avec 96 clubs et 157 sélections au choix, et chaque erreur t’attend sur l’écran Résultats.',
    },
  },
};

// French says "Clubs" too.
export const SAME_AS_ENGLISH = ['home.squads.stats.0.title'];
