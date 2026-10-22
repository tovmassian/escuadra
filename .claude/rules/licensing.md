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
- **Licence notices are generated.** `lib/licences.generated.ts` (About → Licences) is
  written by `npm run gen:licences` from the bundle's own source maps, and `npm run check`
  fails when it is stale. Its rules, and why widening the licence allowlist is the owner's
  call: `docs/license.md`.
- Widening `ALLOWED_LICENCES` (`scripts/licences.ts`) is the owner's decision, never a way to make the check pass.
