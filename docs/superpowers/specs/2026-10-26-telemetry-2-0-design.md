# Telemetry 2.0 — design and data dictionary

Issue: #221 · Milestone: v2.0.0 · Branch: `feat/221-telemetry-2-0` → `main`
Supersedes the allowlist and the "offline signals are dropped" tradeoff of
[`2026-09-17-telemetry-design.md`](2026-09-17-telemetry-design.md). Its gate, test mode and
App ID stand.

## Goal

2.0.0 is the first store build to send usage statistics (#55). Before the schema reaches
anyone, it has to answer the issue's questions (Q1–Q11): whether rounds are finished,
whether repetition works, how each level is calibrated, how 2.0's Home, picker, ladder,
Study and tips are used, which squads are learned. Every answer has to be comparable across
versions, platforms and over-the-air updates, and has to count rounds played offline.

## Decisions

**The owner's (2026-10-25):** statistics carry the squad id. About's "never include team
names" goes. Nothing about a player, an answer or anything typed ever leaves the device.

**Taken on the owner's behalf, each with a cheap reversal:**

- **The build number is iOS's only** (`expo-constants`' `platform.ios.buildNumber`, the
  embedded value). `expo-constants` leaves Android's platform constants empty, and
  `expo-application`, which reads the version code, is a new native module: it moves the
  fingerprint mid-device-pass (#187) and adds a licence notice. Android can fill the same key
  later without breaking the contract. Version and update already separate Android builds.
- **`language` moves into the context of every signal.** The root layout hands the resolved
  language to `lib/telemetry.ts` (`setTelemetryLanguage`), so the module imports no i18n.
- **The queue lives in `stores/progress.ts`** (`telemetryQueue`). It is persisted progress
  state, and the existing resets already give the semantics About needs: `factoryReset`
  empties it (it joins `INITIAL`), switching usage statistics off empties it, and Clear all
  scores keeps it.
- **A response decides a queued signal's fate** (`flushOutcome`): 2xx sent; 408, 429, 5xx or
  no response kept; any other 4xx dropped, since it will never succeed.
- **Reset Escuadra's own signal is sent at once, unqueued** (`trackNow`), before the reset
  runs. It carries the identifier being replaced. Offline, it is lost.
- **A round is "left" when it is thrown away unfinished:** Leave, or a new round replacing
  one still in progress. A round left by Back and resumed later is not left. A killed app
  sends nothing.
- **`seconds` survives a suspended round.** The session store accumulates active time
  (`activeMs`), so a round resumed after Back keeps its clock.
- **`picker.noResults`** is sent when a non-empty search has found nothing for 1.5 s, once
  per picker visit, so letters typed on the way to a team don't count.
- **A session starts again on a return after 5 minutes in the background**
  (`SESSION_GAP_MS`, Amplitude's mobile default). Android reports the share chooser, a photo
  credit's browser tab and Play's review dialog as the background, where iOS stays in the
  app, so renewing on every return would split Android sessions at Results. iOS's `inactive`
  (Control Center, a call banner) does not count. Switching usage statistics back on starts a
  session too, so no signal belongs to a session without a start.
- **A flush posts at most 100 signals** (`FLUSH_BATCH`), so one refusal never costs the
  whole queue, and waits 30 s for an answer (`FLUSH_TIMEOUT_MS`), so a hanging connection
  never holds the queue. Delivery is at least once: a batch the server took but never
  answered for is sent again.
- **`textSize`** buckets the font scale at the layout's own thresholds: `default` (≤ 1.05),
  `large` (≤ 1.35), `largest` (above, where Results' cards start to strain).
- **Counts are bucketed** `0`, `1`, `2-5`, `6+`.

## Context on every signal

| Key                                       | Value                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `TelemetryDeck.AppInfo.version`           | `app.json`'s version, e.g. `2.0.0`                                             |
| `TelemetryDeck.AppInfo.buildNumber`       | the native build number (iOS only, see Decisions)                              |
| `TelemetryDeck.Device.platform`           | `iOS` / `Android`                                                              |
| `TelemetryDeck.Device.systemMajorVersion` | the OS's major version, e.g. `18`, `15`                                        |
| `update`                                  | the running update's 8-character group id, as Settings shows it, or `embedded` |
| `language`                                | the app's language                                                             |

TelemetryDeck's own names where it defines the fact
([default parameters](https://telemetrydeck.com/docs/ingest/default-parameters/)), so its
built-in insights work. A context value that can't be read is left out, never guessed.

## The events

Every value is an enum, a small integer or a boolean. `squad` is a squad id (`mkd`, a
club's slug). An event's properties are typed in `TelemetryProps`, and `buildPayload` drops
anything else.

| Event                           | Properties                                                                                                                                                                                                                               | Sent when                                                                                                                           | Answers    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `TelemetryDeck.Session.started` | —                                                                                                                                                                                                                                        | a session starts: after hydration on a cold start, on a return after 5 minutes away, and when usage statistics are switched back on | Q1         |
| `app.launched`                  | `languageSource` (`phone`/`picked`); `theme` (`system`/`light`/`dark`); `haptics` (`on`/`off`); `TelemetryDeck.Accessibility.isReduceMotionEnabled` (`true`/`false`); `textSize`; `starred`, `teams` (teams with a best score), bucketed | cold start, after hydration                                                                                                         | Q1, Q9     |
| `team.opened`                   | `squad`, `kind`; `from` (`continue`/`squads`/`picker`); `search` (`true`/`false`, the picker only)                                                                                                                                       | Difficulty mounts                                                                                                                   | Q5, Q6     |
| `round.started`                 | `squad`, `kind`, `level`; `source` (`ladder`/`retry`/`nextLevel`)                                                                                                                                                                        | a round is built: by the question screen (`ladder`) or by Results                                                                   | Q2, Q4     |
| `round.completed`               | `squad`, `kind`, `level`, `score`, `aLaEscuadra`; `previousBest` (`none`/`0`–`10`); `missedName`, `missedPosition`, `missedClubOrNationality` (the parts the level asks); `seconds`                                                      | the round's phase becomes `complete`                                                                                                | Q3, Q4, Q9 |
| `round.left`                    | `squad`, `kind`, `level`; `question` (`1`–`10`); `score` (right so far); `seconds`                                                                                                                                                       | a round is thrown away unfinished                                                                                                   | Q2         |
| `study.opened`                  | `squad`, `kind`; `from` (`ladder`/`results`); `view` (`grid`/`list`)                                                                                                                                                                     | Study mounts                                                                                                                        | Q7         |
| `study.namesHidden`             | `squad`, `kind`                                                                                                                                                                                                                          | Hide names is switched on                                                                                                           | Q7         |
| `tips.closed`                   | `screen` (a `TipScreen`); `skipped` (`true`/`false`)                                                                                                                                                                                     | a How to play layer closes                                                                                                          | Q8         |
| `intro.skipped`                 | —                                                                                                                                                                                                                                        | the launch strike is tapped through                                                                                                 | Q8         |
| `result.shared`                 | `squad`, `kind`, `level`, `score`, `format`                                                                                                                                                                                              | the share sheet hands a result on                                                                                                   | —          |
| `picker.noResults`              | `kind`                                                                                                                                                                                                                                   | see Decisions                                                                                                                       | Q11        |
| `progress.reset`                | `scope` (`team`/`scores`/`all`); `squad` (`team` only)                                                                                                                                                                                   | a reset is confirmed, before it runs                                                                                                | Q11        |

How to read them:

- **Completion** is `round.completed` over `round.started`. What neither accounts for is
  rounds lost to a kill.
- **`previousBest`** is read before the score is recorded, outdated or not. `none` is a
  first play. A replay beats it when `score > previousBest`. It unlocks the next level when
  the score reaches `PASS_RATIO` and the previous best did not.
- **`missed*`** count each missed question once, against the first part answered wrong,
  since grading stops there. Level 1 sends only `missedName`, level 2 adds
  `missedPosition`.
- **`seconds`** is active time, to the nearest 10 and capped at 600. It excludes time in the
  background, and time while the first question's tips show.
- **`team.opened` from `picker`** includes the picker's starred rows. `search` is whether
  the field held text when the team was tapped.

## Sessions

`lib/telemetry.ts` gives its client a new random `sessionID` when a session starts again,
and sends `TelemetryDeck.Session.started` at every start. The cold start's code is the
client's first. A new identifier (Reset Escuadra) never starts a session
(`telemetryIdentifier.test.ts`).

## Delivery: the queue

```
track() ─gate─▶ client.queue(type, payload)        builds the body: hashed id, session,
                    │                               receivedAt = now, payload + context
                    ▼
           store.push(body)  ──▶ progress.telemetryQueue (persisted, trimmed)
                    │
                    ▼
                 flush()  single-flight; again after itself if more arrived
                    │  client.flush(): POST the oldest 100 bodies, as the SDK does
                    ▼
            flushOutcome(status) ──▶ sent / dropped: removed · kept: stays
```

- The SDK's `flush()` clears its store before the POST settles. The app's store
  ignores `clear()` and removes the bodies it handed over only once `flushOutcome` says so.
- A body is pushed only if usage statistics are still on and the identifier is still the
  one it was built with. So nothing built before an opt-out or a reset is queued after it.
- The queue keeps the newest 500 bodies, none older than 30 days.
- A flush runs after each push and at each session start. It sends batch after batch while
  they leave, and stops at the first one kept. The only timer is its 30 s wait for an answer.
  There is no retry loop.
- The SDK posts to TelemetryDeck's v2 ingest, which moves a `receivedAt` more than 24 hours
  old into the last 24 hours. Counts are exact up to the rare duplicate (a batch taken but
  never answered for), but days are approximate after a long offline stretch.

## Units

| Unit                          | Role                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/telemetryEvents.ts`      | Pure: the allowlist, `TelemetryProps`, the context keys and `contextPayload`, the gate, the buckets, `roundSeconds`, `nextAppPhase` and `SESSION_GAP_MS`. |
| `lib/telemetryQueue.ts`       | Pure: `trimQueue`, `flushOutcome`, `withoutSent`, `FLUSH_BATCH`, `FLUSH_TIMEOUT_MS`.                                                                      |
| `lib/roundStats.ts`           | Pure: `missesByPart`, `previousBestValue`, `leftRound` (the props of a round being thrown away, or null).                                                 |
| `lib/settingsView.ts`         | `updateGroupId`, extracted from `versionLabel`, shared by Settings and the context.                                                                       |
| `lib/telemetry.ts`            | The SDK's only importer: the client, the queue's store adapter, `track`, `trackNow`, `startSession`, `setTelemetryLanguage`.                              |
| `stores/progress.ts`          | `telemetryQueue`, `pushTelemetry`, `dropTelemetry`; the opt-out and `factoryReset` empty it.                                                              |
| `stores/session.ts`           | `activeMs`, `addActiveMs`; `startRound` starts it at 0.                                                                                                   |
| `components/useRoundClock.ts` | Runs the round's clock while the screen is focused, the app active and no tips show.                                                                      |
| `app/_layout.tsx`             | Session starts (AppState), the language hand-off, `app.launched`'s snapshot.                                                                              |
| Screens                       | Pass `from` and `source` as route params, and call `track` where the table says.                                                                          |

## Testing

Vitest pins the full allowlist and the context keys (a promise test from now on), each pure
helper, and the queue's keep, drop and trim rules. `telemetrySdk.test.ts` keeps its pins on
`signal()` and gains one on a queued request (`receivedAt`). `telemetryIdentifier.test.ts`
keeps its assertion. Its fakes gain the queue, since signals now go through it.
A new `telemetryQueueing.test.ts` drives the real `lib/telemetry.ts` with `fetch` stubbed:
offline and back, opt-out, reset, session renewal. Screens are checked on a preview build
in #187, where every event shows in TelemetryDeck's test mode.

## The contract from 2.0.0 on

Once 2.0.0 ships, event names, property names and value sets are a contract: add, never
rename, and a changed meaning gets a new name. `.claude/rules/privacy-telemetry.md` says so.

## Disclosure

About's English wording is the owner's (guardrail 7). The PR carries a draft, and the five
catalogs, `privacy/2/` and #55's table follow once the owner agrees. App Privacy and Data
safety keep their data types (Device ID; Product Interaction / App interactions).

## Interaction with #222

#222 changes when the question screen starts a round, in the same effect `round.started`
and `round.left` hook into. This branch rebases onto #222 once it lands, keeping #222's
start condition and adding the tracking around it.
