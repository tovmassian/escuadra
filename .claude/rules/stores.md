---
paths:
  - "stores/**"
---

# State

- **Persisted vs ephemeral state.** `stores/progress.ts` is persisted via
  AsyncStorage — best scores, teams played, starred teams, which screens have
  shown their How to play tips, and whether they were skipped, preferences.
  `stores/session.ts` is ephemeral — current round state. A half-finished round
  must not survive an app restart. Put new state in whichever of the two fits;
  add a third store only when neither does, and say why in the PR.
- Three resets (#197): `resetSquad` drops one squad's scores, `reset()` clears every score
  and Continue, `factoryReset` returns every field to `INITIAL` but the usage statistics
  choice and `reviewAskedVersion`. A new field joins `INITIAL`, and
  `stores/__tests__/progress.test.ts` fails until it does.
- Zustand's `persist` defaults to `localStorage`, which does not exist here. Use
  `createJSONStorage(() => AsyncStorage)`.
- `stores/progress.ts` also holds the theme preference (it is not a third store), and
  telemetry's random `installId` and its queue of statistics waiting to be sent
  (`telemetryQueue`), next to the Settings opt-out. Switching usage statistics off empties
  the queue. `stores/session.ts` holds the round's active time (`activeMs`), which a new
  round starts at 0.
