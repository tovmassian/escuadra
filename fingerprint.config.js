// SDK 58 made `balanced` the default, which leaves `version` in app.json out of
// the fingerprint. Escuadra needs each version on its own runtime: every shipped
// version's updates share the `production` channel, so two versions on one runtime
// would receive each other's OTAs (docs/release.md, "OTA or store build?").
/** @type {import('expo/fingerprint').Config} */
const config = {
  preset: 'strict',
};

module.exports = config;
