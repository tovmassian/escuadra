// The site's Spanish words (#280): en.mjs's shape. Reused word for word from main:
// store/listing/es.md (the promotional text, the description's sentences, the
// affiliation line), i18n/es.ts (positions and their codes, Settings' labels, level
// names, Hide names, Still learning, Who wears, Tap your answer) and i18n/countries.ts.
// The FRESH lines (fresh.mjs) are written afresh; the owner picks them.
export default {
  meta: {
    homeTitle: 'Escuadra — aprende las plantillas de fútbol dorsal a dorsal',
    homeDescription:
      '¿Quién lleva el 7? Aprende las plantillas de los clubes de las cinco grandes ligas europeas y de más de 150 selecciones en rondas rápidas, y mira quién se te escapó.',
    supportTitle: 'Soporte — Escuadra',
  },
  layout: {
    homeLabel: 'Página de inicio de Escuadra',
    utilityNav: 'Accesos rápidos',
    footerNav: 'Pie de página',
    language: 'Idioma',
    languageCurrent: 'Idioma: {name}',
    nav: {
      try: 'Prueba una pregunta',
      how: 'Cómo funciona',
      squads: 'Equipos',
      support: 'Soporte',
      privacy: 'Privacidad',
      privacyPolicy: 'Política de privacidad',
      privacy1x: 'Política de privacidad de Escuadra 1.x',
      home: 'Inicio',
      report: 'Informar de un problema',
    },
    getApp: 'Descarga la app',
    theme: {
      light: 'Claro',
      dark: 'Oscuro',
      toLight: 'Cambiar al tema claro',
      toDark: 'Cambiar al tema oscuro',
    },
    releaseStatus: 'Ya disponible en el App Store y en Google Play',
    badges: { appStore: 'Consíguelo en el App Store', googlePlay: 'Descargar en Google Play' },
  },
  home: {
    hero: {
      eyebrow: 'Plantillas de fútbol, de memoria',
      title: '¿Quién lleva el 7?',
      lead: 'Conoce cada dorsal. Aprende las plantillas de los clubes de las cinco grandes ligas europeas y de más de 150 selecciones en rondas relámpago.',
      tryLink: 'O prueba una pregunta aquí mismo',
    },
    try: {
      eyebrow: 'Pruébalo · Nivel 1',
      title: 'Un dorsal.<br />Tú eliges.',
      body: 'Así se juega: un dorsal y algunas pistas, y eliges al jugador. Aquí hay tres preguntas; en la app, diez por ronda, con el equipo que quieras.',
      level: 'Nivel 1',
      nameKey: 'Nombre',
      positionKey: 'Pos',
      ageKey: 'Edad',
      resultEyebrow: 'Tu ronda · 3 preguntas',
      playAgain: 'Repetir la ronda',
    },
    credits: {
      title: 'Créditos · 3',
      cropped: 'recortada',
    },
    how: {
      eyebrow: 'La escalera',
      title: 'Tres niveles.<br />Súbelos equipo a equipo.',
      startHere: 'Empieza aquí',
      lockedSpoken: 'Bloqueado: consigue 8 de 10 en el nivel {level}',
      locked: '8/10 en niv. {level}',
      levels: [
        { title: 'Solo el nombre', body: 'Con el dorsal, elige al jugador entre 4 opciones.' },
        { title: 'Nombre y posición', body: 'Elige el nombre y luego la posición: portero, defensa, medio o delantero.' },
        {
          title: 'Perfil completo',
          body: 'Elige el nombre entre 6 opciones, luego la posición y, por último, la nacionalidad o, en una selección, el club.',
        },
      ],
      note: 'Cada pregunta vale un punto. En los niveles 2 y 3 solo sumas el punto si aciertas todas las partes.',
    },
    misses: {
      eyebrow: 'Resultados y Plantilla',
      title: 'De los fallos se aprende.',
      body: [
        'Tras cada ronda, repasa a los jugadores que has fallado o estudia la plantilla entera. Luego vuelve a jugar y bórdalo.',
      ],
      stackLabel: 'Real Madrid · 2026/27 · Nivel 2 · 7/10',
      missedOf: 'Fallo {n} de 3',
      missedPart: { name: 'Fallo · nombre', position: 'Fallo · posición' },
    },
    squads: {
      eyebrow: 'Qué incluye',
      title: 'De tu club<br />a tu selección.',
      stats: [
        { title: 'Clubes', body: 'Todos los clubes de las cinco grandes ligas europeas.' },
        { title: 'Selecciones', body: 'De las seis confederaciones.' },
        { title: 'Idiomas', body: 'English, Español, Français, Italiano y Deutsch.' },
      ],
      clubsLabel: 'Algunos de los clubes que incluye Escuadra',
      nationsLabel: 'Algunas de las selecciones que incluye Escuadra',
    },
    share: {
      pictureLabel:
        'Imagen para compartir de Escuadra: Barcelona, 2026/27, nivel 1, 10 de 10, a la escuadra. Los diez dorsales y “Barcelona: ¿te sabes la plantilla?”',
      meta: 'Barcelona · 2026/27 · Nivel 1',
      question: 'Barcelona: ¿te sabes la plantilla?',
      eyebrow: 'Diez de diez',
      title: 'Una ronda sin fallos tiene nombre.',
      body: [
        'Como el tiro que se cuela por la escuadra de la portería. Acierta las diez y Escuadra lo canta.',
        'Luego comparte tu ronda y demuestra que te sabes la plantilla de carrerilla.',
      ],
    },
    promises: {
      eyebrow: 'Juega donde quieras',
      title: 'Tu plantilla,<br />en el bolsillo.',
      items: ['Sin anuncios', 'Funciona sin conexión', 'Disponible en 5 idiomas'],
    },
    get: {
      title: 'La plantilla,<br />de carrerilla.',
    },
    footer: {
      escuadraHeading: 'Escuadra',
      helpHeading: 'Ayuda',
      affiliation:
        'Escuadra es una herramienta de estudio independiente y no oficial. No está afiliada ni vinculada a ninguna confederación, liga o competición, a ninguna federación nacional de fútbol, a ningún club ni a la Wikimedia Foundation, ni respaldada por ninguno de ellos, y ningún jugador que aparezca en una foto la respalda. Los nombres de clubes, selecciones y confederaciones se usan solo para identificarlos. Pertenecen a sus respectivos propietarios, al igual que cualquier distintivo de club visible en las fotos de los jugadores.',
    },
  },
  support: {
    eyebrow: 'Soporte',
    title: '¿Algo<br />no va bien?',
    lead: '¿Un error, un dorsal equivocado, un equipo que te gustaría ver en la app? La mejor forma de contactar con el desarrollador es a través de GitHub Issues. Cuenta qué pasó, en qué teléfono y con qué equipo.',
    cta: 'Abre una incidencia en GitHub',
    ctaNote: 'Para abrir una incidencia necesitas una cuenta gratuita de GitHub.',
    kinds: [
      { title: 'Informar de un error', sub: 'Qué tocaste y qué pasó' },
      { title: 'Corregir una plantilla', sub: 'El equipo, el jugador y el dorsal correcto' },
      { title: 'Proponer un equipo o una función', sub: 'Lo que te ayudaría a aprender' },
    ],
    faqEyebrow: 'Preguntas',
    faqTitle: 'Antes de escribir',
    faq: [
      {
        q: '¿Cómo desbloqueo los niveles 2 y 3?',
        a: 'Consigue 8 de 10 en el nivel 1 para desbloquear el nivel 2, y 8 de 10 en el nivel 2 para desbloquear el nivel 3. Cada equipo tiene su propia escalera.',
      },
      {
        q: '¿Por qué algunos jugadores no tienen foto?',
        a: 'Las fotos proceden de Wikimedia Commons, y solo se muestran si Commons tiene alguna con una licencia que Escuadra pueda usar. Si no hay ninguna, o si no tienes conexión y la foto aún no se ha cargado, la pregunta muestra los colores del equipo y el dorsal.',
      },
      {
        q: '¿Funciona Escuadra sin conexión?',
        a: 'Sí. Todas las plantillas se guardan en tu teléfono, así que el quiz funciona sin conexión. Las fotos se cargan desde Wikimedia Commons cuando estás conectado.',
      },
      {
        q: 'Hay un dorsal o un jugador que no cuadra.',
        a: 'Las plantillas se recopilan de Wikipedia y Wikidata, y cada equipo indica cuándo se actualizó por última vez. Si algo está desfasado, abre una incidencia y di de qué equipo y de qué jugador se trata.',
      },
      {
        q: '¿Cómo cambio el idioma?',
        a: 'Escuadra sigue el idioma de tu teléfono. Para elegir otro, abre <b>Ajustes</b> y luego <b>Idioma</b>: English, Español, Français, Italiano o Deutsch.',
      },
      {
        q: '¿Cómo desactivo las estadísticas de uso?',
        a: 'Abre <b>Ajustes</b> y desactiva <b>Estadísticas de uso</b>. Todo lo que sale de tu dispositivo se detalla en Info, dentro de la app, y en la <a href="{privacy}">política de privacidad</a>.',
      },
      {
        q: '¿Cómo empiezo de cero?',
        a: 'En la pantalla de un equipo, el botón de la goma abre <b>Empezar de cero</b>, con el que ese equipo vuelve a estar sin jugar. En Ajustes, <b>Borrar todos los récords</b> hace lo mismo con todos los equipos, y <b>Restablecer Escuadra</b> lo deja todo como al abrir la app por primera vez.',
      },
    ],
  },
  countries: {
    ESP: 'España', ARG: 'Argentina', BRA: 'Brasil', FRA: 'Francia', ENG: 'Inglaterra',
    JPN: 'Japón', GER: 'Alemania', SEN: 'Senegal', ITA: 'Italia', MEX: 'México',
    POR: 'Portugal', KOR: 'Corea del Sur', NED: 'Países Bajos', NGA: 'Nigeria',
    USA: 'Estados Unidos', CRO: 'Croacia', URU: 'Uruguay', EGY: 'Egipto', COL: 'Colombia',
    AUS: 'Australia', CAN: 'Canadá', GHA: 'Ghana', ARM: 'Armenia', SVN: 'Eslovenia', DEN: 'Dinamarca',
  },
  teaser: {
    positions: { GK: 'Portero', DF: 'Defensa', MF: 'Medio', FW: 'Delantero' },
    positionCodes: { GK: 'POR', DF: 'DEF', MF: 'MED', FW: 'DEL' },
    clueCodes: { club: 'Club', nat: 'Nac' },
    clueSpoken: { club: 'Club', nat: 'Nacionalidad' },
    spoken: {
      name: 'Nombre: {name}.',
      beingAsked: 'se pregunta ahora',
      clues: 'Posición: {position}. Edad: {age}. {clueLabel}: {clue}.',
      question: 'Pregunta {n} de {total}. {team}. ¿Quién lleva el {number}? {clues}',
      score: 'Puntuación: {score} de {answered}',
      result: '{score} de {total}',
    },
    whoWears: '¿Quién lleva el {number}?',
    hint: {
      tap: 'Elige tu respuesta',
      right: '¡Acierto! Seguimos…',
      rightLast: '¡Acierto! Ahora, tu ronda…',
    },
    next: 'Siguiente',
    seeRound: 'Ver tu ronda',
    live: {
      right: 'Acierto: {answer}.',
      wrong: 'Fallo. El {number} es {answer}.',
      round: 'Tu ronda: {score} de {total}. {title}.',
    },
    titles: { perfect: 'A la escuadra', learning: 'Aprendiendo' },
    resultCopy: {
      perfect: 'Tres de tres. En la app, eliges entre 96 clubes y 157 selecciones, y cada ronda tiene diez preguntas.',
      learning:
        'Estos son los que te faltan. En la app, eliges entre 96 clubes y 157 selecciones, cada ronda tiene diez preguntas y cada fallo te espera en la pantalla de resultados.',
    },
  },
};
