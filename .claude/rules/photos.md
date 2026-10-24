---
paths:
  - "lib/photos.ts"
  - "components/Photo*.tsx"
  - "components/SpotlightStage.tsx"
  - "components/QuestionFooter.tsx"
  - "components/PlayerCard.tsx"
  - "components/StudyListRow.tsx"
  - "app/team/*/study.tsx"
  - "app/play/*/*/*.tsx"
  - "lib/studyView.ts"
  - "lib/stageView.ts"
  - "scripts/commons.ts"
  - "tools/squadctl/src/lib/photo-credit.ts"
  - "tools/squadctl/src/lib/enrich*.ts"
  - "tools/squadctl/src/lib/__tests__/enrich*.ts"
---

# Player photos (guardrail 1)

**Player photos are hotlinked Wikimedia Commons thumbnails, always
credited.** The photo fills the top of the question screen behind the shirt
number; with no photo, or while it loads, the team's colours and the number
show.
`player.photo` is a `PhotoCredit` written only by `squadctl enrich`, which
refuses any photo without an accepted licence, a Wikimedia thumbnail and
its Commons page — the asset-licensing rule (`CLAUDE.md`, guardrail 2), enforced in code and in
`lib/__tests__/dataIntegrity.test.ts` — and any with no original size, which the
layout needs. Every shown photo shows its credit; never put the Commons
file name or caption in visible text or a label, as they name the player.
The credit sits under the question's action button for as long as the
question is on screen, never as part of the answer reveal. On Results and
Study the credits sit under "Photo credits · N"; Study names each photo by
shirt number only, so Hide names is not spoiled. Each photo load
reaches Wikimedia, so photos ship in a store build with the privacy
disclosures (guardrail 4), never over the air:
`docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md`.

Licences, the credit's parts and how the rule is enforced: `docs/license.md`, Player photos.
The store listing screenshots show photos too, as the owner decided; the Study and
Results captures show them without a visible credit (`docs/license.md`, In the store
listings).
