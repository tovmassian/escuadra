---
paths:
  - "assets/**"
  - "scripts/*licence*"
  - "scripts/__tests__/*licence*"
  - "scripts/licence-texts/**"
  - "lib/licences*.ts"
  - "lib/__tests__/licences*.ts"
  - "i18n/UNICODE-LICENSE.txt"
  - "app/licences.tsx"
---

# Licences

Asset licensing is a legal guardrail (`CLAUDE.md`, guardrail 2): never worked around.
Every shipped asset's licence, the photo licences accepted and refused, and how to
change either list: `docs/license.md`.

- A new kind of asset names its licence and source where it lives, as
  `assets/flags/README.md` does, and joins `docs/license.md`'s table.
- **Licence notices are generated and curated.** `lib/licences.generated.ts` (About →
  Licences) is written by `npm run gen:licences`. Bundled and autolinked packages come from
  the bundle's own source maps and Expo's autolinking (generated); native libraries are
  curated in `scripts/native-licences.json` and drift-checked. `npm run check` fails when
  either is stale. Their rules, and why widening a licence allowlist is the owner's call:
  `docs/license.md`.
- Widening `ALLOWED_LICENCES` (`scripts/licences.ts`) is the owner's decision, never a way to make the check pass.
- Widening `NATIVE_ALLOWED_LICENCES` (`scripts/native-licences.ts`) is the owner's decision too.
