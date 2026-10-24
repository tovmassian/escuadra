// Seeds the app's language before a page loads (#145). The app reads `languagePreference`
// from its persisted progress store, so the value is merged into whatever the store
// already holds: a best score written earlier on the page survives the next navigation.
// Shared by capture-screens.mjs and generate-play-listing-assets.mjs.
export async function seedLanguage(page, language) {
  await page.addInitScript((code) => {
    const key = 'escuadra-progress';
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
      stored = null;
    }
    const next = stored ?? { state: {}, version: 0 };
    next.state = { ...next.state, languagePreference: code };
    localStorage.setItem(key, JSON.stringify(next));
  }, language);
}
