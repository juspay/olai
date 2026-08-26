# @olai/kolu-client — how olai reaches kolu

One package holds the dial, the standing mirror, the projection into olai's own vocabulary, and the one screen read. What leaves is [`@olai/surface`](../surface/README.md)'s shapes — a `KoluLink`, a `FleetTerminal`, a `Snapshot`, a `DotFace` — so a change to padi's contract is a change **here** and stops.

**Olai works on top of kolu and never launches agents itself.** Every process with a model in it is a kolu terminal (`docs/brainstorming/orchestrator.md`); what olai does is *read* the fleet those terminals make and put it where the fact already is. This package is the whole of the reading.

## What it is for, today

The terminal door's two rungs (roadmap: `terminal-door`). A lane step carries `terminal: <id>`, so a property chip in a plain outline wears the agent's state and opens onto its screen — no route, no page.

- **`link.ts`** — the dial and the **one standing mirror**. `connectPadi` over the unix socket, `mirrorRemoteSurface` of padi's `terminals`, and a five-second re-dial that never gives up. Ten tabs are ten subscriptions to olai's own `fleet` collection and *one* connection to padi, because the link is forked by the `kolu` cell's connector when the surface **binds** — the git sweep's arrangement applied to a socket. The invariant is structural at bind; `mirror.test.ts` counts it as well.
- **`face.ts`** — padi's agent states folded to the dot's four faces, and the only module in olai that has ever seen an agent state literal. Two switches over one closed set is the defect kolu's own `agentProjection.ts` spends a page on; sending the *answer* over the wire is what keeps there being one.
- **`fleet.ts`** — one padi record projected to one row, joined with olai's ownership overlay.
- **`socket.ts`** — where padi is: `$PADI_SOCKET` first, the rendezvous path algebra second. kolu's own README asks a client to be *given* the socket, because the correcting read-back stayed with the daemon.
- **`screen.ts`** — one `screen.text` read, tailed here.
- **`index.ts`** — `koluHalf`, which is what a server composes: three surface members and one revision hook.

## Absent is a state, not a failure

A machine with no kolu running is the ordinary case and every page must draw on it. So a dial that finds nothing produces a `KoluLink` on the `absent` arm and an empty fleet — never a failed effect, never a log at error level, and never a fleet that has quietly stopped moving with its last good rows still on screen. `skew` is a third arm rather than a flag on the second because the two have **opposite fixes**: one is "start kolu", the other is "these two builds disagree, and here are the versions".

Nothing a dial can do may be fatal, and that is a rule with a scar on it: `connectPadi`'s compatibility gate *throws*, so a padi one major ahead arrives as a **defect**. Caught only on the error channel, it escaped, killed the connector's fiber and faulted the whole surface runtime — a skewed kolu took olai's server down on a machine where every page would otherwise have opened fine. The handler reads the **cause** now, and two tests plus an e2e scenario hold it.

## The tail is taken here

padi's `screen.text` window (`startLine`/`endLine`) is **absolute** into the scrollback, and kaval's only clamp is low-side — so "the last N lines" cannot be spelled in it without already knowing the buffer length, and a caller that tries gets the empty string for any terminal shorter than N. This package asks for the whole rendered buffer and slices the tail beside the padi hop, which is what kolu's own MCP face does for the same verb: the expensive wire is the one to the browser, and it carries only the tail. The trailing run of blank rows goes first, because a rendered buffer ends in the empty viewport below the cursor.

kaval already resolves a `tail` extent internally and padi does not expose it; the ask is filed (`kolu-screen-tail`) rather than worked around further.

## Why it is a package

Because the wall makes the dependency direction **physics**. It began as a directory under [`@olai/server`](../server/README.md), and a directory can import its parent: one convenient reach into `runtime.ts` for a type and the boundary is a comment somebody has to keep believing. `@olai/kolu-client` cannot depend on `@olai/server` — a cycle does not resolve — so nothing has to be remembered and nothing has to be swept for. A grep-for-padi-imports check written while this was a directory was deleted when it became a package: it was a substitute for a wall.

The manifest is **`@olai/surface` and `effect`**, and that is the whole olai half of it. `@olai/format` is deliberately not in it: the walk over the vault that decides who *owns* a terminal reads outline records, so it belongs to whoever holds the vault ([`@olai/server`](../server/README.md)'s `claimants.ts`), and what crosses into this package is four strings per claim (`fleet.ts`'s `Claimant`). Keeping that edge out is what stops "how olai reaches kolu" from also knowing what an outline node is.

The `@kolu/*` packages it imports — `@kolu/padi-client`, `@kolu/surface`, `@kolu/terminal-vocab` — are absent from the manifest for [`@olai/surface`](../surface/README.md)'s reason (`bunfig.toml`): they are hydrated as raw TypeScript from the Nix store rather than installed from `bun.lock`, so they are declared once for the whole tree in the root `package.json`, and `scripts/check-kolu-deps.sh` keeps that list honest. **This is the only olai package that imports them.**

## The second pin

`@kolu/padi-client` needs `osfacts-client`, which is not in the kolu tree — kolu grafts it from its own npins pin of `juspay/osfacts` and gitignores it. So olai pins that repository too, at **the revision kolu pins**, and `scripts/check-osfacts-pin.sh` fails `just check` when the two have drifted. Re-pinning kolu always owes a look at this one.

## What is deliberately not here

The driver, the gate predicates and the procedure registry `docs/brainstorming/orchestrator.md` also names are later phases. A registry with one entry is a shape arguing for itself before anything needs it — and when they land, they land here, which is the other half of what the wall buys: there is somewhere for them to go that is not the composition root.
