// The site's English words, the source every other language follows (#280).
// Values are HTML fragments, inserted as they are; {slots} are filled by the
// template. `teaser` is plain text: site.mjs speaks and shows it.
export default {
  meta: {
    homeTitle: 'Escuadra — learn football squads by shirt number',
    homeDescription:
      'Who wears number 7? Learn every club in Europe’s top five leagues and over 150 national teams in quick rounds, then see exactly who you missed.',
    supportTitle: 'Support — Escuadra',
  },
  layout: {
    homeLabel: 'Escuadra home',
    utilityNav: 'Utility',
    footerNav: 'Footer',
    language: 'Language',
    languageCurrent: 'Language: {name}',
    nav: {
      try: 'Try a question',
      how: 'How it works',
      squads: 'Squads',
      support: 'Support',
      privacy: 'Privacy',
      privacyPolicy: 'Privacy policy',
      privacy1x: 'Privacy policy for Escuadra 1.x',
      home: 'Home',
      report: 'Report a problem',
    },
    getApp: 'Get the app',
    theme: {
      light: 'Light',
      dark: 'Dark',
      toLight: 'Switch to light theme',
      toDark: 'Switch to dark theme',
    },
    releaseStatus: 'Now on the App Store and Google Play',
    badges: { appStore: 'Download on the App Store', googlePlay: 'Get it on Google Play' },
  },
  home: {
    hero: {
      eyebrow: 'Football squad trainer · iPhone &amp; Android',
      title: 'Know every<br />number.',
      lead: 'Who wears number 7? Learn every club in Europe’s top five leagues and over 150 national teams in quick rounds, then see exactly who you missed.',
      tryLink: 'Or try a question right here',
    },
    try: {
      eyebrow: 'Try one · Level 1',
      title: 'One number.<br />Four names.',
      body: 'This is how the app plays: a shirt number and a few clues, then you pick the player. Three questions here; ten in a round, for any squad you choose.',
      steps: [
        'Read the number and the clues: position, age, and club or nationality.',
        'Tap a name. Right or wrong, you know at once.',
        'At the end, see exactly who you missed.',
      ],
      level: 'Level 1',
      nameKey: 'Name',
      positionKey: 'Pos',
      ageKey: 'Age',
      resultEyebrow: 'Your round · 3 questions',
      playAgain: 'Play again',
    },
    credits: {
      title: 'Photo credits · 3',
      cropped: 'cropped',
      wikimedia:
        'These photos load from Wikimedia Commons, so Wikimedia receives your IP address and the details of each request, as any website does.',
    },
    how: {
      eyebrow: 'The ladder',
      title: 'Three levels.<br />Climb them squad by squad.',
      startHere: 'Start here',
      lockedSpoken: 'Locked: score 8 of 10 on level {level}',
      locked: 'Score 8/10 on L{level}',
      levels: [
        { title: 'Name from Number', body: 'Given a shirt number, pick the player from 4 options.' },
        { title: 'Name + Position', body: 'Pick the name, then the position — GK, DF, MF, or FW.' },
        {
          title: 'Full Profile',
          body: 'Name from 6 options, then position, then nationality — or club, for a national team.',
        },
      ],
      note: 'Each question is worth one point. On levels 2 and 3, you get the point only if every part is right: no partial credit.',
    },
    misses: {
      eyebrow: 'Results and Study',
      title: 'The misses are the point.',
      body: [
        'After every round, Results lays out each player you got wrong as a card to swipe through, so you can go over them before the next round.',
        'Study shows the whole squad as cards or a list. Switch on Hide names and test yourself.',
      ],
      stackLabel: 'Real Madrid · 2026/27 · Level 2 · 7/10',
      missedOf: 'Missed {n} of 3',
      missedPart: { name: 'Missed · name', position: 'Missed · position' },
    },
    squads: {
      eyebrow: 'What’s inside',
      title: 'From Arsenal<br />to Armenia.',
      stats: [
        { title: 'Clubs', body: 'Every club in Europe’s top five leagues.' },
        { title: 'National teams', body: 'From all six confederations.' },
        { title: 'Languages', body: 'English, Español, Français, Italiano and Deutsch.' },
      ],
      clubsLabel: 'Some of the clubs in Escuadra',
      nationsLabel: 'Some of the national teams in Escuadra',
      refreshed: 'Squads are refreshed each season — new teams arrive without an app update.',
    },
    share: {
      pictureLabel:
        'Escuadra’s share picture: Barcelona, 2026/27, level 1, 10 out of 10, a la escuadra. The ten shirt numbers, and “Can you name Barcelona’s squad?”',
      meta: 'Barcelona · 2026/27 · Level 1',
      question: 'Can you name Barcelona’s squad?',
      eyebrow: 'Ten out of ten',
      title: 'A flawless round has a name.',
      body: [
        'Spanish for a shot into the top corner of the goal. Go ten for ten and Escuadra says so.',
        'Then share the round as a picture or as text. No player photos, no names — friends can still play it.',
      ],
    },
    promises: {
      eyebrow: 'Made for short sessions',
      title: 'Nothing between you<br />and the squad.',
      items: [
        { title: 'No account. No ads.', body: 'Nothing to sign up for and nothing in the way. Open it and play.' },
        {
          title: 'Plays offline',
          body: 'Every squad lives on your phone. Photos load from Wikimedia Commons when you’re online; the team’s colours stand in when you’re not.',
        },
        {
          title: 'Credited photos',
          body: 'Player photos from Wikimedia Commons where one is available, each with its author and licence.',
        },
        {
          title: 'Five languages',
          body: 'English, Español, Français, Italiano and Deutsch. It follows your phone’s language, or you can pick one in Settings.',
        },
        { title: 'Light and dark', body: 'It follows your phone’s appearance, or you can choose one yourself.' },
        {
          title: 'Anonymous statistics you can switch off',
          body: 'Escuadra sends anonymous usage statistics unless you switch them off in Settings. <a href="{privacy}">The privacy policy</a> lists everything that leaves your device.',
        },
      ],
    },
    get: {
      title: 'Know the squad.<br />Cold.',
      body: 'Escuadra is on iPhone and Android.',
    },
    footer: {
      escuadraHeading: 'Escuadra',
      helpHeading: 'Help',
      affiliation:
        'Escuadra is an independent, unofficial study tool. It is not affiliated with, endorsed by, or connected to any confederation, league or competition, any national football association, any club, or the Wikimedia Foundation, and no player shown in a photo endorses it. Club, national team and confederation names are used for identification only and remain the property of their owners, as do any club marks visible in player photos.',
    },
  },
  support: {
    eyebrow: 'Support',
    title: 'Something<br />not right?',
    lead: 'A bug, a wrong shirt number, a squad you’d like added? The best place to reach the developer is GitHub Issues. Say what happened, on which phone, and with which team.',
    cta: 'Open an issue on GitHub',
    ctaNote: 'Opening an issue needs a free GitHub account.',
    kinds: [
      { title: 'Report a bug', sub: 'What you tapped, and what happened' },
      { title: 'Fix a squad', sub: 'The team, the player, the right number' },
      { title: 'Suggest a squad or a feature', sub: 'What would help you learn' },
    ],
    faqEyebrow: 'Questions',
    faqTitle: 'Before you write',
    faq: [
      {
        q: 'How do I unlock levels 2 and 3?',
        a: 'Score 8 out of 10 on level 1 to unlock level 2, and 8 out of 10 on level 2 to unlock level 3. Each team keeps its own ladder.',
      },
      {
        q: 'Why do some players have no photo?',
        a: 'Photos come from Wikimedia Commons, and only where Commons has one under a licence Escuadra can use. Without one, or offline before a photo has loaded, the question shows the team’s colours and the shirt number instead.',
      },
      {
        q: 'Does Escuadra work offline?',
        a: 'Yes. Every squad is stored on your phone, so the quiz works without a connection. Photos load from Wikimedia Commons when you’re online.',
      },
      {
        q: 'A shirt number or a player looks wrong.',
        a: 'Squads are compiled from Wikipedia and Wikidata, and each team shows when it was last updated. If something is out of date, open an issue naming the team and the player.',
      },
      {
        q: 'How do I change the language?',
        a: 'Escuadra follows your phone’s language. To pick another, open <b>Settings</b> and then <b>Language</b>: English, Español, Français, Italiano or Deutsch.',
      },
      {
        q: 'How do I switch off usage statistics?',
        a: 'Open <b>Settings</b> and switch off <b>Usage statistics</b>. About, in the app, lists everything that leaves your device, and so does the <a href="{privacy}">privacy policy</a>.',
      },
      {
        q: 'How do I start over?',
        a: 'On a team’s screen, the eraser button opens <b>Start over</b>, which sends that team back to unplayed. In Settings, <b>Clear all scores</b> does it for every team, and <b>Reset Escuadra</b> puts everything back to how it was on first launch.',
      },
    ],
  },
  countries: {
    ESP: 'Spain', ARG: 'Argentina', BRA: 'Brazil', FRA: 'France', ENG: 'England',
    JPN: 'Japan', GER: 'Germany', SEN: 'Senegal', ITA: 'Italy', MEX: 'Mexico',
    POR: 'Portugal', KOR: 'South Korea', NED: 'Netherlands', NGA: 'Nigeria',
    USA: 'United States', CRO: 'Croatia', URU: 'Uruguay', EGY: 'Egypt', COL: 'Colombia',
    AUS: 'Australia', CAN: 'Canada', GHA: 'Ghana', ARM: 'Armenia',
  },
  teaser: {
    positions: { GK: 'Keeper', DF: 'Defender', MF: 'Midfield', FW: 'Forward' },
    positionCodes: { GK: 'GK', DF: 'DF', MF: 'MF', FW: 'FW' },
    clueCodes: { club: 'Club', nat: 'Nat' },
    clueSpoken: { club: 'Club', nat: 'Nationality' },
    spoken: {
      name: 'Name: {name}.',
      beingAsked: 'being asked',
      clues: 'Position: {position}. Age: {age}. {clueLabel}: {clue}.',
      question: 'Question {n} of {total}. {team}. Who wears {number}? {clues}',
      score: 'Score: {score} of {answered}',
      result: '{score} of {total}',
    },
    whoWears: 'Who wears {number}?',
    hint: {
      tap: 'Tap your answer',
      right: 'Right. Next one coming…',
      rightLast: 'Right. Your round is next…',
    },
    next: 'Next',
    seeRound: 'See your round',
    live: {
      right: 'Right: {answer}.',
      wrong: 'Not quite. Number {number} is {answer}.',
      round: 'Your round: {score} of {total}. {title}.',
    },
    titles: { perfect: 'A la escuadra', learning: 'Still learning' },
    resultCopy: {
      perfect: 'Three for three. The app plays ten a round, across 96 clubs and 157 national teams.',
      learning:
        'Those are the ones to go over. The app plays ten questions a round, across 96 clubs and 157 national teams, and every miss waits for you on Results.',
    },
  },
};
