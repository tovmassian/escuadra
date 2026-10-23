// The Español catalog (#145), typed against ./en.ts: same keys, same order,
// same parameters. Drafted by Claude; a native speaker reviews it before it
// merges (#145). The store tagline is English until #147 translates it with
// the listing copy.
// Escuadra and a la escuadra come from ./names and are never translated.
//
// UI copy in neutral Spanish, for Spain and Latin America alike: the player is
// "tú", and "teléfono", never "móvil" or "celular". Where the regions differ,
// Spain's form wins, as most players are there: "plantilla", not "plantel";
// CLDR's Spain country names (Arabia Saudí, Rumanía). Every
// question and exclamation opens with ¿ or ¡. A team's name sits before a
// colon or alone, never after "de", "del", "el" or "la": the data gives no
// gender or article ("del Real Madrid").
import { en, type CalendarDate, type Messages } from './en';
import { A_LA_ESCUADRA, ESCUADRA } from './names';

// Three letters each: "sep", as Latin America writes it, not Spain's CLDR "sept".
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const PHOTO_CREDITS = 'Créditos de las fotos';
// Feminine: it is the photo that is cropped.
const CROPPED = 'recortada';
const USAGE_STATISTICS = 'Estadísticas de uso';

export const es: Messages = {
  common: {
    level: (level: number) => `Nivel ${level}`,
    back: 'Volver',
    close: 'Cerrar',
    scoreSpoken: (correct: number, attempted: number) => `Puntuación: ${correct} de ${attempted}`,
    outdated: 'Desfasado',
  },
  home: {
    // "Ajustes", as iOS and Spain's Android name the screen; Latin America's
    // Android says "Configuración".
    settings: 'Ajustes',
    // "Récord" for the best score, here, on the ladder pill and in the picker.
    continueMeta: (level: number, best: number | undefined, total: number) =>
      best === undefined ? `NIVEL ${level}` : `NIVEL ${level} · RÉCORD ${best}/${total}`,
    startTraining: 'Entrenar',
    // "Ver todos los equipos" is 21 chars against 20.
    headline: 'Conoce cada dorsal.',
    continueTeam: (team: string) => `Seguir con ${team}`,
    allTeams: 'Todos los equipos',
    starHint: 'Marca un equipo con la estrella y te esperará aquí.',
  },
  languageSheet: {
    title: 'Idioma',
    // Under the title "Idioma": follow the phone. "Idioma del teléfono ·
    // Italiano" is 30 chars against 28.
    matchPhone: (name: string) => `Como el teléfono · ${name}`,
  },
  settings: {
    title: 'Ajustes',
    sections: {
      play: 'Juego',
      privacy: 'Privacidad',
      // The section holds only the Rate card: backing the app, not a help desk
      // ("Soporte", as the web pages' nav says).
      support: 'Apoyo',
      comingNext: 'Próximamente',
      // "Info", as the About screen's title says.
      about: 'Info',
    },
    language: 'Idioma',
    languageSpoken: (name: string) => `Idioma: ${name}`,
    // "Aspecto", the iOS setting for light and dark.
    appearance: 'Aspecto',
    // "Como el teléfono" is 16 chars against 12. "Sistema", the system's own
    // setting, as other apps' theme pickers say.
    appearanceOptions: { system: 'Sistema', dark: 'Oscuro', light: 'Claro' },
    // "Vibración", the setting's name on iOS and Android in Spanish.
    vibration: 'Vibración',
    usageStatistics: USAGE_STATISTICS,
    // Feminine plural: the statistics.
    usageNote: 'Anónimas. En “Info” verás exactamente qué se envía.',
    rate: {
      title: `Valora ${ESCUADRA}`,
      // "Así": the title above says how.
      line: 'Así ayudas a otros aficionados a encontrarla.',
      button: 'Valorar',
    },
    aboutEscuadra: `Acerca de ${ESCUADRA}`,
    privacy: 'Privacidad',
    licences: 'Licencias',
    version: (version: string) => `Versión ${version}`,
    // Feminine: it is the version that is built in.
    builtIn: 'integrada',
  },
  examMode: {
    title: 'Modo examen',
    line: 'Toda la plantilla, solo con los dorsales.',
    soon: 'Pronto',
  },
  formats: {
    /** "21 ago 2026". */
    date: ({ day, month, year }: CalendarDate) => `${day} ${MONTHS[month - 1] ?? ''} ${year}`,
    /** "21 de agosto de 2026". */
    longDate: ({ day, month, year }: CalendarDate) =>
      `${day} de ${MONTHS_LONG[month - 1] ?? ''} de ${year}`,
  },
  // POR portero, DEF defensa, MED medio, DEL delantero.
  positionCodes: { GK: 'POR', DF: 'DEF', MF: 'MED', FW: 'DEL' },
  // "Portero" in Spain, "arquero" in much of South America; "portero" is
  // understood everywhere. "Centrocampista" is 14 chars against 11.
  positions: { GK: 'Portero', DF: 'Defensa', MF: 'Medio', FW: 'Delantero' },
  slots: { NAME: 'Nombre', POS: 'Posición', AGE: 'Edad', CLUB: 'Club', NAT: 'Nacionalidad' },
  // "NOMBRE" whole: "NOM" is Catalan, not an abbreviation.
  slotCodes: { NAME: 'NOMBRE', POS: 'POS', AGE: 'EDAD', CLUB: 'CLUB', NAT: 'NAC' },
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
    // "Ver resultados" (14) would make the auto-next bar 27 chars against 26.
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
    // "Elige", not "Toca": it names the choice, as de and fr do.
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
    cropped: CROPPED,
    photo: 'Foto:',
    title: PHOTO_CREDITS,
    // "Créditos de las fotos · 10" is 26 chars against 20; the button sits
    // under the photos it credits.
    button: (count: number) => `Créditos · ${count}`,
  },
  results: {
    flawlessVerdict: (team: string, season: string, level: number) =>
      `${team} · ${season}, nivel ${level}. Sin fallos.`,
    clearedTitle: (level: number) => `Nivel ${level} superado`,
    clearedVerdict: 'Te sabes casi todo el once titular.',
    failTitle: 'Estos son los que te faltan',
    toClear: (target: string, level: number) =>
      `Consigue ${target} para superar el nivel ${level}.`,
    toUnlock: (target: string, level: number) =>
      `Consigue ${target} para desbloquear el nivel ${level}.`,
    // The words first: a long name truncates, the words must not.
    youPicked: (picked: string) => `Tu elección: ${picked}`,
    nameRight: 'Nombre correcto',
    nameAndPositionRight: 'Nombre y posición correctos',
    wrongPart: {
      // The values are the position codes (DEF, MED), as on the tiles, so
      // they keep their capitals.
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
    // The target first, as French does: "Nivel 1: 8/10" reads as a recorded
    // score. "8/10 en nivel 1" wraps "Nombre y posición" beside it.
    unlockHint: (target: string, level: number) => `${target} en niv. ${level}`,
    rungLocked: (title: string, correct: number, total: number, level: number) =>
      `${title}, bloqueado, consigue ${correct} de ${total} en el nivel ${level}`,
    rungBest: (title: string, correct: number, total: number) =>
      `${title}, récord ${correct} de ${total}`,
    levels: {
      1: {
        // The ladder reads Solo el nombre → Nombre y posición → Perfil
        // completo; the description says "dorsal".
        title: 'Solo el nombre',
        description: 'Con el dorsal, elige al jugador entre 4 opciones.',
      },
      2: {
        title: 'Nombre y posición',
        description: 'Elige el nombre y luego la posición: POR, DEF, MED o DEL.',
      },
      3: {
        title: 'Perfil completo',
        descriptionClub:
          'Elige el nombre entre 6 opciones, luego la posición y, por último, la nacionalidad.',
        descriptionNation:
          'Elige el nombre entre 6 opciones, luego la posición y, por último, el club.',
      },
    },
    studySquad: 'Repasar plantilla',
    updated: (date: string) => `Actualizado el ${date} · Wikipedia`,
    heading: 'La escalera',
    nationalTeam: 'Selección',
    cleared: 'Superado',
    notPlayed: 'Aún sin jugar',
    yourBest: (correct: number, total: number) => `Tu récord · ${correct}/${total}`,
    yourBestSpoken: (correct: number, total: number) => `Tu récord: ${correct} de ${total}`,
    playLevel: (level: number) => `Jugar nivel ${level}`,
    rungCleared: (title: string, correct: number, total: number) =>
      `${title}, récord ${correct} de ${total}, superado`,
    rungEscuadra: (title: string, correct: number, total: number) =>
      `${title}, récord ${correct} de ${total}, ${A_LA_ESCUADRA}`,
    star: 'Uno de tus equipos',
    bestOutdated: (correct: number, total: number) => `Récord ${correct}/${total} · Desfasado`,
    bestOutdatedSpoken: (correct: number, total: number) =>
      `Récord: ${correct} de ${total}, desfasado`,
    rungOutdated: (title: string, correct: number, total: number) =>
      `${title}, récord ${correct} de ${total}, desfasado`,
    squadUpdated: (date: string) =>
      `Plantilla actualizada el ${date}. Los récords en gris son anteriores.`,
  },
  picker: {
    // Feminine: the leagues.
    allLeagues: 'Todas',
    title: 'Elige tu equipo',
    squadCount: (count: number) => (count === 1 ? `${count} equipo` : `${count} equipos`),
    clubs: 'Clubes',
    // "Selecciones", the football word for national teams.
    nations: 'Selecciones',
    allClubs: 'Todos los clubes',
    // Feminine: the confederaciones.
    allConfederations: 'Todas',
    regions: {
      UEFA: 'Europa',
      CONMEBOL: 'Sudamérica',
      CONCACAF: 'Norteamérica, Centroamérica y el Caribe',
      CAF: 'África',
      AFC: 'Asia',
      OFC: 'Oceanía',
    },
    allNations: 'Todas las selecciones',
    nationsCaption: (name: string) => `${name} · A–Z`,
    listCaption: (name: string, count: number) => `${name} · ${count}`,
    bestSpoken: (level: number, correct: number, total: number) =>
      `Nivel ${level}, récord ${correct} de ${total}`,
    bestOutdatedSpoken: (level: number, correct: number, total: number) =>
      `Nivel ${level}, récord ${correct} de ${total}, desfasado`,
    search: 'Buscar equipos',
    clearSearch: 'Borrar la búsqueda',
    noTeams: 'No se encontraron equipos',
    noResults: (query: string) => `Sin resultados para “${query}”`,
    yourSquads: 'Tus equipos',
  },
  // English until #147 localises the feature graphic with the store listing.
  store: en.store,
  about: {
    // "Info" matches the screen's title and Settings' ABOUT label (settings.sections.about).
    title: 'Info',
    // Escuadra is "la aplicación", so feminine: "afiliada", "por sí misma".
    intro: [
      `${ESCUADRA} es una aplicación independiente y no oficial. No está afiliada ni asociada a la FIFA, a la UEFA ni a ninguna otra confederación, a ninguna liga, a ninguna federación nacional de fútbol ni a ningún club, y ninguno de ellos la respalda. Los nombres de los clubes, de las selecciones nacionales y de las confederaciones se usan solo con fines de identificación y siguen siendo propiedad de sus respectivos titulares. ${ESCUADRA} tampoco está afiliada a la Wikimedia Foundation ni a ningún jugador que aparezca en una foto, y ninguno de ellos la respalda.`,
      `${ESCUADRA} identifica a los equipos por sus nombres y colores, y nunca muestra por sí misma escudos, insignias ni logotipos de clubes. Aun así, una foto de un jugador puede mostrar alguno, en una camiseta o al fondo, porque forma parte de la foto original. Esos distintivos pertenecen a sus titulares, y su presencia no significa que ningún club, patrocinador o marca respalde a ${ESCUADRA}.`,
    ],
    credits: {
      heading: 'Créditos de datos e imágenes',
      sections: [
        {
          heading: 'Datos de las plantillas',
          paragraphs: [
            'Los datos de las plantillas se recopilan de Wikipedia y Wikidata y reflejan la temporada indicada en cada equipo. El contenido de Wikipedia está disponible bajo la licencia CC BY-SA. Wikidata está disponible bajo la licencia CC0.',
          ],
        },
        {
          heading: 'Fotos de los jugadores',
          paragraphs: [
            'Las fotos de los jugadores proceden de Wikimedia Commons. Cada una es de dominio público o se usa bajo la licencia con la que figura en Commons: CC BY-SA, CC BY, CC0 o la licencia “Attribution” propia de Commons. Las fotos se recortan para llenar el espacio en el que aparecen. En la pantalla de preguntas, una foto demasiado pequeña para llenar ese espacio se muestra entera, en lugar de recortada, sobre una copia ampliada y oscurecida de sí misma que lo llena. Donde el texto de la aplicación queda sobre una foto, la aplicación sombrea esa parte de la pantalla, y atenúa la foto tras una respuesta incorrecta. Los archivos de las fotos en sí no se modifican. No todos los jugadores tienen foto.',
            `El autor, la licencia y la palabra “${CROPPED}” aparecen bajo la pregunta mientras haya una foto en pantalla, y de nuevo bajo “${PHOTO_CREDITS}” en los resultados, para toda la ronda, y al final de la pantalla “Plantilla”, para cada jugador que figura en ella. Toca el nombre del autor para ver la página de la foto en Wikimedia Commons, o la licencia para ver sus condiciones.`,
          ],
        },
        {
          // "Fuentes" would also read as "sources" in a credits list.
          heading: 'Banderas y tipografías',
          paragraphs: [
            'Las imágenes de las banderas proceden de flagpedia.net y son de dominio público. Las tipografías Inter, IBM Plex Mono y Archivo se usan bajo la SIL Open Font License 1.1.',
          ],
        },
        {
          heading: 'Nombres de países',
          paragraphs: [
            `La mayoría de los nombres de países en idiomas distintos del inglés proceden del proyecto Unicode CLDR y se usan bajo la Unicode License v3. Los demás se escribieron para ${ESCUADRA}.`,
          ],
        },
      ],
    },
    licences: {
      label: 'Licencias',
      originalLanguage: 'Los textos de las licencias se muestran tal cual, en inglés.',
      countryNames: 'Nombres de países',
      fonts: 'Tipografías',
      software: 'Software',
    },
    privacy: {
      heading: 'Privacidad',
      lead: `${ESCUADRA} no tiene cuentas, inicio de sesión ni publicidad, y nunca te pide tu nombre, tu correo electrónico ni ningún dato de contacto.`,
      paragraphs: [
        'Tus puntuaciones y ajustes se guardan en tu dispositivo. Lo único que sale de él es lo que se describe a continuación, y nada de ello está vinculado a tu identidad.',
      ],
      sections: [
        {
          heading: 'Fotos de los jugadores',
          paragraphs: [
            `${ESCUADRA} no contiene fotos de jugadores. Se cargan desde Wikimedia Commons, gestionado por la Wikimedia Foundation: las fotos de una ronda, cuando empieza la ronda, y las fotos de una plantilla en la pantalla “Plantilla”, a medida que te desplazas por ella. Como cualquier sitio web, Wikimedia recibe la dirección IP de tu dispositivo y los detalles de cada solicitud, entre ellos qué fotos se pidieron y, por tanto, qué jugadores hay en tu ronda o en tu plantilla. ${ESCUADRA} no envía nada más a Wikimedia, y lo que Wikimedia recibe se rige por su propia política de privacidad.`,
            'Las fotos ya cargadas pueden conservarse en la caché de la aplicación en tu dispositivo para que aparezcan más rápido. Sin conexión, el juego funciona con normalidad y muestra los colores del equipo y el dorsal en lugar de cualquier foto que no esté ya en esa caché.',
            `Al tocar el crédito de una foto se abre la página de la foto en Wikimedia Commons, o su licencia en el sitio web de Creative Commons, en un navegador integrado en la aplicación. Esos sitios tienen sus propias políticas de privacidad, y ${ESCUADRA} no puede ver lo que haces en ellos.`,
          ],
        },
        {
          heading: 'Compartir',
          paragraphs: [
            `Al compartir un resultado, se crea una imagen o un texto breve en tu dispositivo y se pasa a la aplicación que elijas en el menú para compartir de tu teléfono. ${ESCUADRA} no ve, no envía ni guarda lo que compartes.`,
          ],
        },
        {
          heading: 'Estadísticas de uso anónimas',
          paragraphs: [
            `${ESCUADRA} envía estadísticas de uso anónimas a TelemetryDeck, un servicio de analítica, salvo que desactives “${USAGE_STATISTICS}” en la pantalla “Ajustes” de la aplicación. Cada una lleva un identificador aleatorio en forma de hash, creado para estas estadísticas (distinto del que usa la comprobación de actualizaciones de la aplicación), y un código de sesión aleatorio, nuevo cada vez que se inicia la aplicación. Como cualquier servicio en línea, TelemetryDeck también recibe la dirección IP de tu dispositivo y los detalles técnicos habituales de cada solicitud, que en iOS incluyen el número de compilación de la aplicación y la versión del sistema de tu dispositivo. Lo que TelemetryDeck recibe se rige por su propia política de privacidad. El identificador de las estadísticas y el código de sesión son aleatorios, no se derivan de tu dispositivo y no están vinculados a ti ni a tus cuentas. Ni ${ESCUADRA} ni el desarrollador los comparten con nadie más, ni tampoco las estadísticas.`,
            `Estas son las estadísticas: se abrió la aplicación, con su idioma y la indicación de si este sigue el idioma de tu teléfono o se eligió en la aplicación; empezó una ronda, con el tipo de equipo (club o selección) y el nivel de dificultad; terminó una ronda, con esos mismos dos datos, la puntuación y la indicación de si fue ${A_LA_ESCUADRA}; se abrió la pantalla “Plantilla”, con el tipo de equipo (club o selección); y se pasó un resultado al menú para compartir de tu teléfono, con el nivel, la puntuación y el formato (imagen o texto). Las estadísticas nunca incluyen nombres de equipos ni de jugadores, ni tus respuestas, ni nada de lo que escribas.`,
          ],
        },
        {
          heading: 'Actualizaciones de la aplicación',
          paragraphs: [
            `Cuando ${ESCUADRA} se inicia, comprueba si hay una versión más reciente de la aplicación disponible en Expo, el servicio que distribuye sus actualizaciones. La comprobación envía lo necesario para entregar la actualización correcta: el sistema operativo de tu dispositivo, la versión y el proyecto de la aplicación, y un identificador aleatorio creado para esta instalación. ${ESCUADRA} no vincula el identificador a ti ni a nada de lo que haces en la aplicación. Si la aplicación sufrió un fallo o no pudo cargar una actualización al iniciarse, la siguiente comprobación también envía a Expo el mensaje de error técnico correspondiente. Como cualquier servicio en línea, Expo recibe además la dirección IP de tu dispositivo con cada comprobación. Si no hay conexión, la aplicación omite la comprobación y funciona con normalidad.`,
          ],
        },
        {
          heading: 'Qué se guarda en tu dispositivo',
          paragraphs: [
            `${ESCUADRA} guarda diez datos localmente, en tu dispositivo: tu récord en cada equipo y nivel de dificultad, a partir del cual la aplicación deduce qué niveles has superado; el último equipo y nivel que has jugado; los equipos que has marcado con una estrella; tu preferencia de tema claro u oscuro; tu elección de idioma; si la vibración está activada; si la pantalla “Plantilla” muestra tarjetas o una lista; qué versión de la aplicación ha pedido por última vez a tu teléfono que muestre una invitación a valorarla; tu elección sobre las estadísticas de uso; y el identificador aleatorio que usan esas estadísticas. La comprobación de actualizaciones de la aplicación también guarda su propio identificador aleatorio en tu dispositivo.`,
            `Estos datos se guardan en el almacenamiento privado de la propia aplicación. ${ESCUADRA}, por sí misma, solo envía dos de esos diez datos fuera de tu dispositivo, y solo mientras las estadísticas de uso están activadas: el identificador, que se envía en forma de hash con cada estadística, y tu elección de idioma, que se incluye en la estadística que se envía al abrir la aplicación. Al eliminar la aplicación, se borran todos ellos de tu dispositivo, junto con las fotos que haya en caché. ${ESCUADRA} no tiene copia de seguridad ni sincronización propias, pero las copias de seguridad de tu dispositivo (en iOS, en iCloud o en un ordenador; en Android, en Google) pueden incluir estos datos. El desarrollador no tiene acceso a este almacenamiento.`,
          ],
        },
        {
          // "Fallos", the word iOS and Android use for crashes in Spanish.
          heading: 'Informes de fallos',
          paragraphs: [
            `Si permites que tu dispositivo comparta datos de diagnóstico, Apple (en iOS) o Google (en Android) pueden compartir informes de fallos anonimizados con el desarrollador. Eso lo gestionan Apple o Google, y se controla en los ajustes de tu dispositivo. Aparte del mensaje de error que la comprobación de actualizaciones de la aplicación puede enviar tras un inicio fallido, ${ESCUADRA}, por sí misma, no envía ningún informe de fallos.`,
          ],
        },
        {
          heading: 'Niños',
          paragraphs: [
            `${ESCUADRA} no tiene cuentas y no pide información personal a nadie, incluidos los niños. Las estadísticas de uso son anónimas y se pueden desactivar en cualquier momento.`,
          ],
        },
      ],
    },
    site: {
      title: 'Política de privacidad',
      updated: (date: string) => `Última actualización: ${date}`,
      appliesTo: (version: string) =>
        `Esta política se aplica a ${ESCUADRA} ${version} y a las versiones posteriores.`,
      earlierVersions: 'Política de privacidad de las versiones anteriores',
      home: `Página de inicio de ${ESCUADRA}`,
      languages: 'Idioma',
      nav: {
        home: 'Inicio',
        support: 'Soporte',
        utility: 'Accesos rápidos',
        footer: 'Pie de página',
      },
      theme: {
        light: 'Claro',
        dark: 'Oscuro',
        toLight: 'Cambiar al tema claro',
        toDark: 'Cambiar al tema oscuro',
      },
      // "el App Store", as Apple's Spanish badge says.
      releaseStatus: 'Ya disponible en el App Store',
    },
  },
};
