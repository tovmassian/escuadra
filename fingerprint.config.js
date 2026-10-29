// SDK 58 made `balanced` the default, which leaves `version` in app.json out of
// the fingerprint. Escuadra needs each version on its own runtime: every shipped
// version's updates share the `production` channel, so two versions on one runtime
// would receive each other's OTAs (docs/release.md, "OTA or store build?").
//
// Two inputs that change no native code here are skipped: package.json's `scripts`,
// because none but husky's `prepare`, which only writes git hooks, runs during a native
// build (scripts/__tests__/fingerprint-config.test.ts fails the day another does), and the
// text of `.gitignore`. Whether `ios/` or `android/` is ignored is still checked, through
// git, whatever the skips. A `sourceSkips` list replaces the preset's, so it repeats
// `strict`'s own.
/** @type {import('expo/fingerprint').Config} */
const config = {
  preset: 'strict',
  sourceSkips: [
    'PackageJsonAndroidAndIosScriptsIfNotContainRun',
    'PackageJsonScriptsAll',
    'GitIgnore',
  ],
};

module.exports = config;
