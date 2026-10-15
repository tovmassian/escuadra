# Archivo

Three static cuts of Archivo, the display face of the 2.0 play screens.
Registered in `theme/fonts.ts`; the type styles that use them are in
`theme/tokens.ts` (`typography`).

| file                                | cut                    | axes                  | used for                                |
| ----------------------------------- | ---------------------- | --------------------- | --------------------------------------- |
| `Archivo-ExtraCondensedBlack.ttf`   | ExtraCondensed Black   | `wdth=62.5 wght=900`  | shirt numbers, the results score, cards |
| `Archivo-SemiExpandedExtraBold.ttf` | SemiExpanded ExtraBold | `wdth=112.5 wght=800` | prompts, results titles, button labels  |
| `Archivo-Black.ttf`                 | Black                  | `wdth=100 wght=900`   | position codes on answer tiles          |

## Why static cuts

`@expo-google-fonts/archivo` ships normal width only, and React Native cannot
set a variable font's width axis. So each width is its own file, cut once
from the variable font.

## Licence

SIL Open Font License 1.1: `OFL.txt` beside these files, copied unchanged
from the source. Copyright 2020 The Archivo Project Authors
(https://github.com/Omnibus-Type/Archivo).

A cut is a Modified Version under the OFL. That is allowed, and it may keep
the name Archivo, because Archivo declares no Reserved Font Name (its
copyright line names none). The cuts stay under the OFL, and each file's
name table still carries the copyright notice and the licence. See
`docs/license.md`.

## Source

- [`google/fonts`](https://github.com/google/fonts) at commit
  `6c70c829f09ea345d3590406693220ea35c6553f` ("Archivo: Version 2.001
  added"), file `ofl/archivo/Archivo[wdth,wght].ttf`, Version 2.001,
  SHA-256 `0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053`.
- Cut with fontTools 4.67.0.

ExtraCondensed is `wdth=62.5`, the width the font's STAT table names, not
the axis floor of 62. `--update-name-table` needs a named width, and it is
what gives each file its own family and PostScript name
(`ArchivoRoman-ExtraCondensedBlack` and so on). Without it all three keep
the variable font's default `Archivo-SemiBold`, and iOS rejects a second font
registered under a PostScript name it already holds.

## Regenerating

```bash
python3 -m venv ft && ft/bin/pip install fonttools==4.67.0
SHA=6c70c829f09ea345d3590406693220ea35c6553f
curl -sSL -o "Archivo[wdth,wght].ttf" "https://github.com/google/fonts/raw/$SHA/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf"
curl -sSL -o OFL.txt "https://raw.githubusercontent.com/google/fonts/$SHA/ofl/archivo/OFL.txt"
shasum -a 256 "Archivo[wdth,wght].ttf"   # must match the hash above
ft/bin/fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=62.5 wght=900 --update-name-table -o Archivo-ExtraCondensedBlack.ttf
ft/bin/fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=112.5 wght=800 --update-name-table -o Archivo-SemiExpandedExtraBold.ttf
ft/bin/fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=100 wght=900 --update-name-table -o Archivo-Black.ttf
```

The output is not byte-for-byte reproducible: fontTools stamps the save time
into each file's `head` table. The source hash is what pins it.
