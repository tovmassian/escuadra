# Share cards

`<language>.png` is the picture a link to the site shows when it is shared (Open Graph
`og:image`), one per language, 1200 × 630. Each page's tags come from `src/share.mjs`.

**Source:** drawn for Escuadra by `node src/share-images.mjs` (Chrome, headless) from
`shareCard()` in `src/share.mjs` and the site's own `site.css`. It shows Escuadra's mark,
Home's eyebrow, headline and release status, and the number wall: no player, photo,
flag, crest or store badge.

**Licence:** Escuadra's own artwork. Its text is set in Archivo and IBM Plex Mono, under
the SIL Open Font License 1.1 (`assets/fonts/`); the OFL places no condition on images
made with a font.

`cards.json` holds the hash of the card each image was drawn from:
`tests/share.test.mjs` fails when the card or its words change and the images were not
redrawn.
