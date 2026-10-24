// The `≤ N chars` comments in ./en.ts as data (#141, Text expansion), so
// i18n/__tests__/budgets.test.ts can hold every catalog to them. One group per
// comment, in file order; the test fails if the two drift. A function is
// measured at its longest realistic call. A key is the catalog path, with the
// sample in parentheses when one path is measured twice.
import type { Messages } from './en';
import { LANGUAGE_NAMES } from './names';

export interface LengthBudget {
  budget: number;
  texts: Readonly<Record<string, (m: Messages) => string>>;
}

/** "Match phone · Italiano": the longest name the row can show. */
const LONGEST_LANGUAGE_NAME = Object.values(LANGUAGE_NAMES).reduce((a, b) =>
  b.length > a.length ? b : a,
);

export const LENGTH_BUDGETS: readonly LengthBudget[] = [
  { budget: 8, texts: { 'common.back': (m) => m.common.back } },
  { budget: 14, texts: { 'common.outdated': (m) => m.common.outdated } },
  { budget: 24, texts: { 'home.continueMeta': (m) => m.home.continueMeta(3, 10, 10) } },
  { budget: 18, texts: { 'home.startTraining': (m) => m.home.startTraining } },
  { budget: 24, texts: { 'home.headline': (m) => m.home.headline } },
  { budget: 24, texts: { 'home.continueTeam': (m) => m.home.continueTeam('Spain') } },
  { budget: 18, texts: { 'home.allTeams': (m) => m.home.allTeams } },
  { budget: 52, texts: { 'home.starHint': (m) => m.home.starHint } },
  { budget: 22, texts: { 'tips.kicker': (m) => m.tips.kicker(3, 3) } },
  { budget: 26, texts: { 'tips.kickerLevel': (m) => m.tips.kickerLevel(3) } },
  { budget: 10, texts: { 'tips.next': (m) => m.tips.next } },
  { budget: 12, texts: { 'tips.gotIt': (m) => m.tips.gotIt } },
  { budget: 14, texts: { 'tips.skip': (m) => m.tips.skip } },
  {
    budget: 32,
    texts: {
      'tips.picker.switch.heading': (m) => m.tips.picker.switch.heading,
      'tips.picker.pick.heading': (m) => m.tips.picker.pick.heading,
      'tips.difficulty.start.heading': (m) => m.tips.difficulty.start.heading,
      'tips.difficulty.star.heading': (m) => m.tips.difficulty.star.heading,
      'tips.difficulty.study.heading': (m) => m.tips.difficulty.study.heading,
      'tips.study.hide.heading': (m) => m.tips.study.hide.heading,
      'tips.study.positions.heading': (m) => m.tips.study.positions.heading,
      'tips.question.clues.heading': (m) => m.tips.question.clues.heading,
      'tips.question.answer.heading': (m) => m.tips.question.answer.heading,
      'tips.question.level2.heading': (m) => m.tips.question.level2.heading,
      'tips.question.level3.heading': (m) => m.tips.question.level3.heading,
      'tips.results.missed.heading': (m) => m.tips.results.missed.heading,
      'tips.results.again.heading': (m) => m.tips.results.again.heading,
      'tips.results.next.heading': (m) => m.tips.results.next.heading,
    },
  },
  {
    budget: 120,
    texts: {
      'tips.picker.switch.body': (m) => m.tips.picker.switch.body,
      'tips.picker.pick.body': (m) => m.tips.picker.pick.body,
      'tips.difficulty.start.body': (m) => m.tips.difficulty.start.body,
      'tips.difficulty.star.body': (m) => m.tips.difficulty.star.body,
      'tips.difficulty.study.body': (m) => m.tips.difficulty.study.body,
      'tips.study.hide.body': (m) => m.tips.study.hide.body,
      'tips.study.positions.body': (m) => m.tips.study.positions.body,
      'tips.question.clues.body': (m) => m.tips.question.clues.body,
      'tips.question.clues.bodyClub': (m) => m.tips.question.clues.bodyClub,
      'tips.question.answer.body': (m) => m.tips.question.answer.body,
      'tips.question.level2.body': (m) => m.tips.question.level2.body,
      'tips.question.level3.body': (m) => m.tips.question.level3.body,
      'tips.results.missed.body': (m) => m.tips.results.missed.body,
      'tips.results.again.body': (m) => m.tips.results.again.body,
      'tips.results.next.body': (m) => m.tips.results.next.body,
    },
  },
  { budget: 16, texts: { 'languageSheet.title': (m) => m.languageSheet.title } },
  {
    budget: 28,
    texts: { 'languageSheet.matchPhone': (m) => m.languageSheet.matchPhone(LONGEST_LANGUAGE_NAME) },
  },
  { budget: 16, texts: { 'settings.title': (m) => m.settings.title } },
  {
    budget: 16,
    texts: {
      'settings.sections.play': (m) => m.settings.sections.play,
      'settings.sections.privacy': (m) => m.settings.sections.privacy,
      'settings.sections.support': (m) => m.settings.sections.support,
      'settings.sections.comingNext': (m) => m.settings.sections.comingNext,
      'settings.sections.about': (m) => m.settings.sections.about,
      'settings.sections.yourData': (m) => m.settings.sections.yourData,
    },
  },
  { budget: 20, texts: { 'settings.language': (m) => m.settings.language } },
  { budget: 20, texts: { 'settings.appearance': (m) => m.settings.appearance } },
  {
    budget: 12,
    texts: {
      'settings.appearanceOptions.system': (m) => m.settings.appearanceOptions.system,
      'settings.appearanceOptions.dark': (m) => m.settings.appearanceOptions.dark,
      'settings.appearanceOptions.light': (m) => m.settings.appearanceOptions.light,
    },
  },
  { budget: 20, texts: { 'settings.vibration': (m) => m.settings.vibration } },
  { budget: 28, texts: { 'settings.usageStatistics': (m) => m.settings.usageStatistics } },
  { budget: 56, texts: { 'settings.usageNote': (m) => m.settings.usageNote } },
  { budget: 24, texts: { 'settings.rate.title': (m) => m.settings.rate.title } },
  { budget: 48, texts: { 'settings.rate.line': (m) => m.settings.rate.line } },
  { budget: 10, texts: { 'settings.rate.button': (m) => m.settings.rate.button } },
  {
    budget: 24,
    texts: {
      'settings.aboutEscuadra': (m) => m.settings.aboutEscuadra,
      'settings.privacy': (m) => m.settings.privacy,
      'settings.licences': (m) => m.settings.licences,
    },
  },
  { budget: 20, texts: { 'examMode.title': (m) => m.examMode.title } },
  { budget: 56, texts: { 'examMode.line': (m) => m.examMode.line } },
  { budget: 8, texts: { 'examMode.soon': (m) => m.examMode.soon } },
  { budget: 16, texts: { 'reset.clears': (m) => m.reset.clears } },
  { budget: 16, texts: { 'reset.keeps': (m) => m.reset.keeps } },
  { budget: 32, texts: { 'reset.team.title': (m) => m.reset.team.title('Spain') } },
  { budget: 20, texts: { 'reset.team.bestScores': (m) => m.reset.team.bestScores } },
  { budget: 8, texts: { 'reset.team.levelScore': (m) => m.reset.team.levelScore(3, 10) } },
  { budget: 56, texts: { 'reset.team.keepsStar': (m) => m.reset.team.keepsStar } },
  { budget: 20, texts: { 'reset.team.confirm': (m) => m.reset.team.confirm } },
  { budget: 24, texts: { 'reset.all.row': (m) => m.reset.all.row } },
  { budget: 56, texts: { 'reset.all.note': (m) => m.reset.all.note } },
  { budget: 28, texts: { 'reset.all.title': (m) => m.reset.all.title } },
  { budget: 20, texts: { 'reset.all.count': (m) => m.reset.all.count(99, 12) } },
  { budget: 56, texts: { 'reset.all.keepsLine': (m) => m.reset.all.keepsLine } },
  {
    budget: 22,
    texts: {
      'reset.all.confirm (1)': (m) => m.reset.all.confirm(1),
      'reset.all.confirm (99)': (m) => m.reset.all.confirm(99),
    },
  },
  { budget: 24, texts: { 'reset.app.row': (m) => m.reset.app.row } },
  { budget: 56, texts: { 'reset.app.note': (m) => m.reset.app.note } },
  { budget: 24, texts: { 'reset.app.title': (m) => m.reset.app.title } },
  {
    budget: 40,
    texts: {
      'reset.app.scores': (m) => m.reset.app.scores,
      'reset.app.starred': (m) => m.reset.app.starred,
      'reset.app.tips': (m) => m.reset.app.tips,
      'reset.app.photos': (m) => m.reset.app.photos,
    },
  },
  { budget: 48, texts: { 'reset.app.preferences': (m) => m.reset.app.preferences } },
  {
    budget: 3,
    texts: {
      'positionCodes.GK': (m) => m.positionCodes.GK,
      'positionCodes.DF': (m) => m.positionCodes.DF,
      'positionCodes.MF': (m) => m.positionCodes.MF,
      'positionCodes.FW': (m) => m.positionCodes.FW,
    },
  },
  {
    budget: 11,
    texts: {
      'positions.GK': (m) => m.positions.GK,
      'positions.DF': (m) => m.positions.DF,
      'positions.MF': (m) => m.positions.MF,
      'positions.FW': (m) => m.positions.FW,
    },
  },
  {
    budget: 6,
    texts: {
      'slotCodes.NAME': (m) => m.slotCodes.NAME,
      'slotCodes.POS': (m) => m.slotCodes.POS,
      'slotCodes.AGE': (m) => m.slotCodes.AGE,
      'slotCodes.CLUB': (m) => m.slotCodes.CLUB,
      'slotCodes.NAT': (m) => m.slotCodes.NAT,
    },
  },
  { budget: 12, texts: { 'round.correct': (m) => m.round.correct } },
  { budget: 12, texts: { 'round.missed': (m) => m.round.missed } },
  { budget: 14, texts: { 'round.seeResults': (m) => m.round.seeResults } },
  { budget: 8, texts: { 'round.next': (m) => m.round.next } },
  { budget: 18, texts: { 'round.nextQuestion': (m) => m.round.nextQuestion } },
  { budget: 18, texts: { 'round.gotItNext': (m) => m.round.gotItNext } },
  {
    budget: 26,
    texts: {
      'round.tapToSkip (next)': (m) => m.round.tapToSkip(m.round.next),
      'round.tapToSkip (seeResults)': (m) => m.round.tapToSkip(m.round.seeResults),
    },
  },
  { budget: 20, texts: { 'round.tapYourAnswer': (m) => m.round.tapYourAnswer } },
  { budget: 8, texts: { 'round.answerTag': (m) => m.round.answerTag } },
  {
    budget: 12,
    texts: {
      'study.hideNames': (m) => m.study.hideNames,
      'study.showNames': (m) => m.study.showNames,
    },
  },
  { budget: 6, texts: { 'study.all': (m) => m.study.all } },
  { budget: 14, texts: { 'study.tapToReveal': (m) => m.study.tapToReveal } },
  { budget: 8, texts: { 'credits.photo': (m) => m.credits.photo } },
  { budget: 20, texts: { 'credits.button': (m) => m.credits.button(10) } },
  { budget: 22, texts: { 'results.studySquad': (m) => m.results.studySquad } },
  { budget: 22, texts: { 'results.retry': (m) => m.results.retry } },
  { budget: 22, texts: { 'results.playLevel': (m) => m.results.playLevel(3) } },
  { budget: 22, texts: { 'results.chooseTeam': (m) => m.results.chooseTeam } },
  {
    budget: 24,
    texts: {
      'results.missedCount (1)': (m) => m.results.missedCount(1),
      'results.missedCount (10)': (m) => m.results.missedCount(10),
    },
  },
  { budget: 14, texts: { 'results.swipeForAll': (m) => m.results.swipeForAll } },
  { budget: 24, texts: { 'results.nothingMissed': (m) => m.results.nothingMissed(10) } },
  { budget: 8, texts: { 'share.image': (m) => m.share.image, 'share.text': (m) => m.share.text } },
  { budget: 10, texts: { 'share.preview': (m) => m.share.preview } },
  {
    budget: 16,
    texts: {
      'share.shareImage': (m) => m.share.shareImage,
      'share.shareText': (m) => m.share.shareText,
    },
  },
  {
    budget: 18,
    texts: {
      'ladder.levels.1.title': (m) => m.ladder.levels[1].title,
      'ladder.levels.2.title': (m) => m.ladder.levels[2].title,
      'ladder.levels.3.title': (m) => m.ladder.levels[3].title,
    },
  },
  { budget: 20, texts: { 'ladder.studySquad': (m) => m.ladder.studySquad } },
  { budget: 20, texts: { 'ladder.heading': (m) => m.ladder.heading } },
  { budget: 16, texts: { 'ladder.nationalTeam': (m) => m.ladder.nationalTeam } },
  { budget: 14, texts: { 'ladder.cleared': (m) => m.ladder.cleared } },
  { budget: 22, texts: { 'ladder.notPlayed': (m) => m.ladder.notPlayed } },
  { budget: 22, texts: { 'ladder.yourBest': (m) => m.ladder.yourBest(10, 10) } },
  { budget: 16, texts: { 'ladder.playLevel': (m) => m.ladder.playLevel(3) } },
  { budget: 24, texts: { 'ladder.bestOutdated': (m) => m.ladder.bestOutdated(10, 10) } },
  {
    budget: 80,
    texts: {
      'ladder.squadUpdated': (m) =>
        m.ladder.squadUpdated(m.formats.date({ day: 28, month: 9, year: 2026 })),
    },
  },
  { budget: 6, texts: { 'picker.allLeagues': (m) => m.picker.allLeagues } },
  { budget: 22, texts: { 'picker.title': (m) => m.picker.title } },
  { budget: 14, texts: { 'picker.squadCount': (m) => m.picker.squadCount(253) } },
  {
    budget: 12,
    texts: {
      'picker.clubs': (m) => m.picker.clubs,
      'picker.nations': (m) => m.picker.nations,
    },
  },
  { budget: 16, texts: { 'picker.allClubs': (m) => m.picker.allClubs } },
  { budget: 6, texts: { 'picker.allConfederations': (m) => m.picker.allConfederations } },
  { budget: 22, texts: { 'picker.allNations': (m) => m.picker.allNations } },
  { budget: 22, texts: { 'picker.yourSquads': (m) => m.picker.yourSquads } },
  { budget: 16, texts: { 'about.licences.label': (m) => m.about.licences.label } },
  {
    budget: 24,
    texts: {
      'about.licences.countryNames': (m) => m.about.licences.countryNames,
      'about.licences.fonts': (m) => m.about.licences.fonts,
      'about.licences.software': (m) => m.about.licences.software,
    },
  },
];
