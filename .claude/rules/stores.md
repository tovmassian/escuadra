---
paths:
  - "stores/**"
---

# State

- **Persisted vs ephemeral state.** `stores/progress.ts` is persisted via
  AsyncStorage — best scores, teams played, preferences. `stores/session.ts` is
  ephemeral — current round state. A half-finished round must not survive an
  app restart. Put new state in whichever of the two fits; add a third store
  only when neither does, and say why in the PR.
- Zustand's `persist` defaults to `localStorage`, which does not exist here. Use
  `createJSONStorage(() => AsyncStorage)`.
- `stores/progress.ts` also holds the theme preference (it is not a third store) and telemetry's random `installId`, next to the Settings opt-out.
