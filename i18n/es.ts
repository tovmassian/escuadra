// The Español catalog (#145), typed against ./en.ts: same keys, same order,
// same parameters. Drafted by Claude for native review (#145); 'es' stays in
// SUPPORTED_LANGUAGES only once a native speaker signs it off. About and the
// store tagline are English until #146 and #147 translate them with their
// legal and listing copy.
// Escuadra and a la escuadra come from ./names and are never translated.
//
// Neutral Spanish, for Spain and Latin America alike: the player is "tú", and
// "teléfono", never "móvil" or "celular". Every question and exclamation opens
// with ¿ or ¡. A team's name sits before a colon or alone, never after "de",
// "del", "el" or "la": the data gives no gender or article ("del Real Madrid").
import { en, type CalendarDate, type Messages } from './en';

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sept',
  'oct',
  'nov',
  'dic',
];

export const es: Messages = {
  common: {
    level: (level: number) => `Nivel ${level}`,
    back: 'Volver',
    close: 'Cerrar',
    scoreSpoken: (correct: number, attempted: number) => `Puntuación: ${correct} de ${attempted}`,
  },
  home: {
    // "Acerca de" is 9 chars against 8.
    aboutLink: 'Info',
    darkTheme: 'Tema oscuro',
    languageLabel: (name: string) => `Idioma: ${name}`,
    // "Récord" for the best score, here, on the ladder pill and in the picker.
    continueMeta: (level: number, best: number | undefined, total: number) =>
      best === undefined ? `NIVEL ${level}` : `NIVEL ${level} · RÉCORD ${best}/${total}`,
    startTraining: 'Entrenar',
    // "Ver todos los equipos" is 21 chars against 20.
    browseAllTeams: 'Todos los equipos',
  },
  languageSheet: {
    title: 'Idioma',
    // Under the title "Idioma", so "[idioma] del teléfono". "Idioma del
    // teléfono · Italiano" is 30 chars against 28.
    matchPhone: (name: string) => `Del teléfono · ${name}`,
  },
  formats: {
    /** "21 ago 2026". */
    date: ({ day, month, year }: CalendarDate) => `${day} ${MONTHS[month - 1] ?? ''} ${year}`,
  },
  // POR portero, DEF defensa, MED medio, DEL delantero.
  positionCodes: { GK: 'POR', DF: 'DEF', MF: 'MED', FW: 'DEL' },
  // "Portero" in Spain, "arquero" in much of South America; "portero" is
  // understood everywhere. "Centrocampista" is 14 chars against 11.
  positions: { GK: 'Portero', DF: 'Defensa', MF: 'Medio', FW: 'Delantero' },
  slots: { NAME: 'Nombre', POS: 'Posición', AGE: 'Edad', CLUB: 'Club', NAT: 'Nacionalidad' },
  slotCodes: { NAME: 'NOM', POS: 'POS', AGE: 'EDAD', CLUB: 'CLUB', NAT: 'NAC' },
  round: {
    // "Acierto" and "fallo": the words a quiz keeps score with.
    correct: 'Acierto',
    missed: 'Fallo',
    whoWears: (no: number) => `¿Quién lleva el ${no}?`,
    askPosition: '¿Qué posición?',
    askClub: '¿Qué club?',
    // Not "¿Qué país?": on a club squad that could mean the country the
    // player plays in. Nacionalidad, as on the NAC chip. Not "¿Qué
    // nacionalidad?" either: it wraps the prompt to two lines at 360 dp.
    askNationality: '¿Nacionalidad?',
    // "Ver resultados" (14) would make the auto-next bar 28 chars against 26.
    seeResults: 'Resultados',
    // "Siguiente" is 9 chars against 8. "Seguimos…" says the round moves on
    // by itself; "o toca aquí" says a tap is sooner.
    next: 'Seguimos',
    nextQuestion: 'Siguiente pregunta',
    // "Entendido, siguiente" is 20 chars against 18; "Vale, siguiente" is
    // Spain's. Not "Anotado": in Latin America it also means "scored".
    gotItNext: 'OK, siguiente',
    // Spanish sets the ellipsis tight against the word before it.
    tapToSkip: (label: string) => `${label}… o toca aquí`,
    slotSpoken: {
      given: (slot: string, value: string) => `${slot}: ${value}`,
      active: (slot: string) => `${slot}: se pregunta ahora`,
      pending: (slot: string) => `${slot}: se pregunta después`,
      correct: (slot: string, value: string) => `${slot}: ${value}, correcto`,
      wrong: (slot: string, value: string) => `${slot}: ${value}, la respuesta correcta`,
      notAsked: (slot: string, value: string) => `${slot}: ${value}, no se pregunta`,
    },
    leave: 'Salir de la ronda',
    // "Dorsal", the word for the number on the shirt.
    shirtNumber: (no: number) => `Dorsal ${no}`,
    // "Elige", not "Toca": the answer is picked, not typed.
    tapYourAnswer: 'Elige tu respuesta',
    movesOn: 'Avanza automáticamente en un momento',
    answerTag: 'Solución',
    tileSpoken: {
      idle: '',
      'correct-picked': 'correcto',
      'correct-unpicked': 'la respuesta correcta',
      'incorrect-picked': 'tu elección, incorrecta',
      'incorrect-other': '',
    },
    questionOf: (n: number, total: number) => `Pregunta ${n} de ${total}`,
    streak: (count: number) =>
      count === 1 ? `Racha: ${count} acierto` : `Racha: ${count} aciertos seguidos`,
  },
  study: {
    players: (count: number) => (count === 1 ? `${count} jugador` : `${count} jugadores`),
    shownOf: (shown: number, total: number) => `${shown} de ${total}`,
    noNumber: 'sin dorsal',
    nameHidden: 'nombre oculto',
    title: 'Plantilla',
    // "Ocultar nombres" is 15 chars against 12. As a switch, it is spoken
    // "Sin nombres, activado" or "…, desactivado". "Ver nombres" is the action
    // on the pill while names are hidden.
    hideNames: 'Sin nombres',
    showNames: 'Ver nombres',
    showAsList: 'Ver como lista',
    showAsCards: 'Ver como tarjetas',
    all: 'Todos',
    tapToReveal: 'Toca para ver',
    revealsName: 'Muestra el nombre',
  },
  credits: {
    // Feminine: it is the photo that is cropped.
    cropped: 'recortada',
    photo: 'Foto:',
    title: 'Créditos de las fotos',
    // "Créditos de las fotos · 10" is 26 chars against 20; the button sits
    // under the photos it credits.
    button: (count: number) => `Créditos · ${count}`,
  },
  results: {
    flawlessVerdict: (team: string, season: string, level: number) =>
      `${team} · ${season}, nivel ${level}. Sin fallos.`,
    clearedTitle: (level: number) => `Nivel ${level} superado`,
    clearedVerdict: 'Te sabes casi todo el once titular.',
    failTitle: 'Estos son los que debes aprender',
    toClear: (target: string, level: number) =>
      `Consigue ${target} para superar el nivel ${level}.`,
    toUnlock: (target: string, level: number) =>
      `Consigue ${target} para desbloquear el nivel ${level}.`,
    // The words first: a long name truncates, the words must not.
    youPicked: (picked: string) => `Tu elección: ${picked}`,
    nameRight: 'Nombre correcto',
    nameAndPositionRight: 'Nombre y posición correctos',
    wrongPart: {
      position: (right: string, picked: string) => `posición: ${right}, no ${picked}`,
      club: (right: string, picked: string) => `club: ${right}, no ${picked}`,
      nationality: (right: string, picked: string) => `nacionalidad: ${right}, no ${picked}`,
    },
    close: 'Cerrar y elegir otro equipo',
    // "Repasar": the word for going over something before a test. "Repasar
    // la plantilla" wraps the outline button beside the retry icon.
    studySquad: 'Repasar plantilla',
    retry: 'Repetir la ronda',
    playLevel: (level: number) => `Jugar el nivel ${level}`,
    chooseTeam: 'Elegir otro equipo',
    // "Fallo", as the round says after a miss.
    missedCount: (count: number) =>
      count === 1 ? `FALLO · ${count} JUGADOR` : `FALLOS · ${count} JUGADORES`,
    // "Desliza para ver más" is 20 chars against 14. Beside the missed
    // cards, the verb alone says it.
    swipeForAll: 'Desliza',
    // "Sin fallos", as the flawless verdict says.
    nothingMissed: (count: number) => `LOS ${count} · SIN FALLOS`,
    roundSpoken: (right: number, total: number) => `Ronda: ${right} de ${total} correctas`,
  },
  share: {
    title: 'Comparte tu ronda',
    // Speaks to whoever receives the picture: not there yet, but working on it.
    // "Sigo aprendiendo" wraps the picture's title to two lines.
    stillLearning: 'Aprendiendo',
    // The name first, so it needs no article ("de la plantilla del Barça").
    question: (team: string) => `${team}: ¿te sabes la plantilla?`,
    image: 'Imagen',
    text: 'Texto',
    // "Vista previa" is 12 chars against 10.
    preview: 'Así queda',
    // "Historias", the word Instagram and Facebook use in Spanish. No photos
    // or names give the answers away, so friends can still play.
    imageHint: 'Imagen para historias. Sin fotos ni nombres, para que tus amigos puedan jugar.',
    textHint: 'La cuadrícula de aciertos para tus grupos, con un enlace a la app.',
    shareImage: 'Compartir imagen',
    shareText: 'Compartir texto',
    pictureSpoken: (eyebrow: string, correct: number, total: number, title: string) =>
      `Imagen para compartir: ${eyebrow}. ${correct} de ${total}. ${title}.`,
  },
  ladder: {
    play: 'Jugar',
    playAgain: 'Jugar otra vez',
    // The target first, as French does: "Nivel 1: 8/10" reads as a recorded
    // score. "8/10 en nivel 1" wraps "Nombre y posición" beside it.
    unlockHint: (target: string, level: number) => `${target} en niv. ${level}`,
    rungLocked: (title: string, hint: string) => `${title}, bloqueado, ${hint}`,
    rungBest: (title: string, correct: number, total: number) =>
      `${title}, récord ${correct} de ${total}`,
    title: 'Elige la dificultad',
    levels: {
      1: {
        // "Del dorsal al nombre" is 20 chars against 18.
        title: 'Nombre por dorsal',
        description: 'Con el dorsal, elige al jugador entre 4 opciones.',
      },
      2: {
        title: 'Nombre y posición',
        description: 'Elige el nombre y luego la posición: POR, DEF, MED o DEL.',
      },
      3: {
        title: 'Perfil completo',
        description:
          'El nombre entre 6 opciones, luego la posición y luego el club o la nacionalidad.',
      },
    },
    studySquad: 'Repasar plantilla',
    updated: (date: string) => `Actualizado el ${date} · Wikipedia`,
    best: (correct: number, total: number) => `RÉCORD ${correct}/${total}`,
  },
  picker: {
    // Feminine: the leagues.
    allLeagues: 'TODAS',
    notPlayed: (season: string) => `${season} · SIN JUGAR`,
    played: (season: string, level: number, correct: number, total: number) =>
      `${season} · NIVEL ${level} · RÉCORD ${correct}/${total}`,
    home: 'Inicio',
    title: 'Elige un equipo',
    count: (count: number) =>
      count === 1 ? `${count} equipo · toca para empezar` : `${count} equipos · toca para empezar`,
    clubs: 'Clubes',
    nationalTeams: 'Selecciones',
    search: 'Buscar equipos',
    clearSearch: 'Borrar la búsqueda',
    noTeams: 'No se encontraron equipos',
    noResults: (query: string) => `Sin resultados para “${query}”`,
  },
  // English until #147 localises the feature graphic with the store listing.
  store: en.store,
  // English until #146 translates About with the privacy policy.
  about: en.about,
};
