# @olai/kolu-ui — the browser's kolu half

Everything a page draws about kolu, in one package: the row on a `terminal` property, the live pane the row opens, the fleet a tab holds **once**, the events a header press shows — and the words the padi readout says. What the app reaches it through is `KoluUi`, one mount taking the composed client and a `now`: which surface members exist, what two named verbs the pane calls — the whole of what would otherwise be spelled in olai's composition root. `Block` registration, the pill's chrome and olai's preference cadence are web's.

- **`src/props/KoluUi.tsx`** — the socket: `KoluClient`, the structural pin, and the members of the composition (three cells — the link, the pill's liveness and the drawer's foot — the two collections — fleet and the watcher's events — the screen read, the live pane).
- **`src/props/fleet.tsx` / `src/props/held.ts`** — the fleet the tab holds once: one subscription per tab however many chips are down the page, one map, one counter; and the accumulator the events ring reuses (a frame the events ring sees is the same move as one the fleet sees, since the server's ring is one Store).
- **`src/props/EventsFeed.tsx` / `src/padi/events.ts`** — the drawer the Padi pill opens: what recently wanted attention, the folds over kolu's own, the words spelled **once, in `padi/events.ts`, and nowhere else** — past tense means the past, even for a still-held state. ATTENTION only: heartbeats never reach this drawer — liveness lives on the pill (the pulse cell folded in `padi/said.ts`).
- **`src/props/TerminalDoor.tsx` / `src/props/LivePane.tsx`** — the block and the window, wearing web's own chrome.
- **`src/padi/said.ts`** — every word a status reads has one home; the header and the chat's probe speak this three-state sentence.
- **`src/testids.ts`** — this half's `data-testid`s. Web keeps its own side of the bar.

## Why it is a package

The sixth Löwy sitting's ruling in one manifest: the human asked that the NON-kolu packages of Olai not hold kolu implementation, and a directory is a wall one import pore can cross. Two more packages know about kolu the way `git` knows about `@olai/git` — `server` composes, `web` chrome — and the rest never does. `scripts/check-kolu-deps.sh`'s fourth assertion is the wall's *fourth* leg: the hydrated `@kolu/*` imports also only compile inside this package and its sibling, `kolu-client`.

## The events

The feed shows **the past tense of the fleet** — it is a LOG, not a live reading: the server's watch draws a frozen pip, label and hold at fire time, and this package draws exactly that. Two folds own the words (`padi/events.ts`, `fleet.tsx`), THE ONE VOCAB — WHAT an event IS — is [`@olai/kolu-client`](../kolu-client/README.md)'s `KoluEvent`, and the pill's own register — the beat's — is `padi/said.ts`'s `beatOf` (a `fresh | quiet | none` fold off the `pulse` cell). The watch reads `_olai/Kolu.olai` through the server's walk ([server's README](../server/README.md)'s `koluConfig.ts`).
