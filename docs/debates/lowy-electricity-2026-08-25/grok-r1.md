# grok — opening (round 1) · upstream-into-kolu altitude

Seat: what, if anything, moves into `@kolu/surface` and friends so that today's bug *classes* become unrepresentable — not caught earlier, not diagnosed faster. The house has killed every *olai package* for three sittings; the same bar applies here. A kolu extraction that fails a test is not a finding. I ran two candidates at this altitude. Neither survives.

---

## The harvest, mapped onto the code that actually ran today

The incident (`incident-vault-restart-2026-08-25`) is one afternoon, four coats, one policy disagreement. I read the nodes, then the files.

1. **`cold-boot-all-or-nothing`.** `Store.make` boots with `snapshot = null` (`packages/store/src/store.ts:306`). A codec refusal leaves it there (`store.ts:373-380`: snapshot stays, errors published). There is no last-good on a first load — the header says so as a *design* (`store.ts:292-293`: "there is no last-good to fall back to"). The UI copy is the same sentence: ErrorPage's lede, `packages/web/src/client/errors/Page.tsx:40`, *"Nothing is served until these are fixed: an outline set is valid or it is not, and half of one would be a different set from the one on disk."* The two dangling `see` edges are `reportUnknownTargets(danglingIn(derived), …)` (`packages/format/src/validate.ts:163`), and *"Any error at all refuses the set"* (`validate.ts:188-189`). Chat chrome is *not* inside that gate — `ChatPanel` mounts above the directory `Switch` (`App.tsx:326` vs `:386-387`). What died is the *data plane* the agent's tools plug into, which is the store's null snapshot, not a surface-framework blanking of the shell.

2. **`stale-set-reads-clean-writes-refuse`.** Two readings of the same symptoms, and I will not pick one on vibes.

   - **As filed:** a `git pull --rebase` produced no watcher event, and the 60s backstop "never caught it." The store's own contract says that is not supposed to be possible. Events are dropped at the disk edge (`disk.ts:97-101`: payload unread, "probe soon"). The probe re-lists and re-stats (`probe.ts:5-8, 239-251`); `sameStamp` is mtime+size (`disk.ts:64-65`); an append changes size, a `touch` changes mtime, a rebase of a typed-properties migration changes both. The backstop is `Effect.forever(sleep(60s) → dirty.open)` (`store.ts:580-582`), and the loop header calls it correctness, not a latency optimisation (`store.ts:566-570`). There is already a door for an outside rewrite the stamps cannot see: `Store.resync` (`store.ts:131-142`), and the e2e harness already knocks on it (`POST /olai/resync`).
   - **What the write-refuse also fits:** `commit` probes *first* (`store.ts:436`), then validates the candidate set. A codec refusal is `Result.fail` with the validator rows (`ops.ts:466-472`: *"`…` would leave the outlines invalid, so nothing was written"*). Reads of last-good come off `store.snapshot`; the errors ride a *second* `SubscriptionRef`, mapped to the `errors` *cell* (`runtime.ts:633-639`). MCP already has that cell as a resource (`surface://cells/errors`); `packages/server/src/mcp/face.test.ts:213-241` pins that an unreadable directory reaches the agent, and `tools.test.ts:1276-1308` pins that a directory that will not *load* refuses `search_nodes` *and* a write with the same rows. The last-good case is the hole: snapshot non-null, errors non-null, `read_node` answering the snapshot with no staleness marker — exactly the bug's "reads served the stale set errorlessly."

   Either reading lands in store / format / MCP-tool wiring. Neither is a missing `@kolu/surface` verb.

3. **`broken-file-blocks-healthy-writes`.** Whole-set `codec.validate` on the candidate (`store.ts:508-513`). Decode failures of *this write's own files* already refuse free, named (`store.ts:470-496`). One neighbour's typed-property rows poisoning a write to a healthy file is the codec's error-scope decision (`codec.ts:17-20`; `validate.ts:14-23, 188-189`), not a collection-handler gap.

4. **`last-good-banner-flood`.** The errors cell already carries the rows. `Banner` inlines `<Report errors={props.errors} />` (`Banner.tsx:64`) on every page that has a last-good tree (`Panes.tsx` via `App.tsx:424`). `Report`'s header forbids summarising (`Report.tsx:6-7`: "none of the three can quietly start summarising"). Unbounded payload × a renderer that will not clamp = the flood. The *carrier* is already a surface cell.

5. **`typed-chips-doors`.** `packages/web/src/client/props/door.ts` is five shape-guesses, in order, over a `Vault` of `{from, serves, names}`. It never reads `_olai/Properties.olai`. Rule 4 resolves beside the writing file (`door.ts:177`, `pathedOf(vault.from, value)`); the board writes vault-root-relative. This is display over `@olai/format`. `@kolu/surface` has no property, no chip, no door.

Sitting 3's two kolu sockets are *already in this tree*, so they are not today's yield: `holders: bodies.held` (`runtime.ts:957`) with the wrap-at-the-root deleted (`runtime.ts:1304-1315`); `entries.fold(SERVED_FILES)` (`directory.ts:470`). `isPrivateOwnedDir` is imported from `@kolu/surface/unix-socket` (`lock.ts:96`). The bun 1.4.0 pin that closed `watcher-postboot-blind` at the runtime is merged (`#368` / `fb3a0cfc`, `disk.ts:151-159`). I will not re-propose shipped work.

---

## Candidate A — last-good / health as a `@kolu/surface` collection verb

The temptation: make `get` / `readAll` return `{value, health}` so a consumer cannot read a last-good snapshot as if it were current. Bug 2's "stale-set-reads-clean" subclass would become unspellable; bug 1's cold path would be a health state rather than a null snapshot; bug 4 would have a bounded health face to draw.

### The four tests

**Opaque socket.** Consumers would see `(value, health)`. Behind it: last-good vs current, validator rows vs counts, freshness. The socket *looks* like a receptacle.

**Functional-but-not-domain-functional.** FAIL. "A collection whose producer holds a last-good while disk has moved" is olai's validated-corpus policy. Kolu-the-app, padi, and kaval serve live registries and stream-scoped values; they have no last-good (sitting 3's own survey, `docs/lowy-electricity/surface-design-2026-08-19.md` §"Does kolu itself benefit?"). Odu's logs store is a cache-with-follow, not a last-good of a refused validate. Putting last-good on the framework is the house growing an olai-shaped axis. Sitting 3's design already ruled the sibling move: *"Policy stays app-side."*

**Oscilloscope.** The churn is real and it is *not in kolu*. Store's two `SubscriptionRef`s (`store.ts:31-35`: "last-good data and what-is-wrong-now are two independent facts, and they map onto surface's stream and cell") already *are* the socket. `runtime.ts:633-639` already binds `errors` to a cell. `surface://cells/errors` already exists. Today's bugs 2 and 4 are appliances that did not join that cell to the read (MCP `read_node`) or clamped it (Banner/Report). That is unplugged wiring, not a missing wall outlet. Löwy: you do not build a second receptacle because a lamp in one room was never plugged in.

**Vault.** FAIL in the direction that matters. The next change of this kind — typed-violation vs parse-failure, per-file vs whole-set, cold-boot-as-catch-up — is codec/store policy. Landing it in `@kolu/surface` would force a framework bump on padi/drishti/odu for an axis they do not have. Volatility should decrease downward (lowy skill §4). The most depended-upon package (`@kolu/surface`) must not absorb the most domain-specific policy in the tree.

**Verdict: killed.** The grenade is already in a vault. The errors cell is the receptacle. Bug 2's clean reads are a consumer that did not look at it; that is a guard test (see small-findings), not an upstream extraction.

Jamming health onto `get` would also fail skill §5: an interface mixing the value with the validity of the value is `OpenPort`/`ClosePort` plus `ReadCode` on one contract. Store split them on purpose. Rejoining them in the framework undoes a decomposition the article endorses.

---

## Candidate B — a kolu "directory pulse" (olai's `Disk.watch` ∪ `@kolu/git`'s working-tree-watcher ∪ padi `pulseSource`)

The temptation: watcher technology has churned in olai's store (`#196` e93871a1 per-directory arming; `#368` fb3a0cfc bun 1.4.0 pin; `docs/brainstorming/watcher-fd-cost.md`), and kolu already encapsulates the same *kind* of doorbell with `@parcel/watcher` (`packages/integrations/git/src/working-tree-watcher.ts`, "Catches axis 4 — editor saves, file create/delete/rename"). Bug 2 as *filed* is a doorbell miss. One house doorbell, olai deletes `disk.ts`'s watch/arming block.

### The four tests

**Opaque socket.** `watch(root) → Stream<void>` is already `Disk.watch`'s contract (`disk.ts:96-111`). Consumers of the *store* already cannot name bun vs inotify vs a poll. The store *is* the opaque socket for this axis. Extracting the doorbell into kolu would re-house an implementation behind a socket the consumer already does not see. That is not a missing receptacle; it is moving furniture inside a vault that sitting 1 named as the textbook one.

**Functional-but-not-domain-functional.** The *doorbell* is not domain-functional. The *policies on it* are: store prunes `.git` and `node_modules` (`disk.ts:425-428`); kolu's watcher derives ignores from `git ls-files` and *adds* `.git` because the git-dir watchers cover it (`working-tree-watcher.ts:28-38`). One shared primitive would have to take those policies as knobs, and knobs on the socket are leaking (skill §5). "New domain, same kind" duplicates the receptacle (skill, prior-encapsulation), it does not unify the volatility.

**Oscilloscope.** Watcher-tech *did* churn — and then *stopped, in olai, yesterday*. `#368` pinned bun 1.4.0; `disk.ts:151-159` records that recursive watch now follows a post-boot directory; `watcher-postboot-blind` is closed at the runtime. Kolu's own doorbell has its own live grenades (`working-tree-watcher.ts:47-54`, kolu#2065: parcel's per-`(dir, ignore)` bookkeeping, newly-created directory never scanned). Swapping olai onto parcel would import those, not delete today's class. And bug 2 as filed includes "the 60s backstop never caught it." The backstop does not go through the doorbell. A better doorbell cannot make a listing+stat miss structurally impossible; if the listing+stat did *not* miss and last-good was republished, the doorbell is not the class at all.

**Vault.** The next bun rewrite, the next parcel hazard, a watchman backend — those *could* land in a kolu doorbell. They already land in two vaults that have different consumers. Unifying them would be a kolu-internal §6.5 question ("one socket, not three wires") about `pollOnEvent` + `pulseSource` + `working-tree-watcher`, which is *kolu's* sitting, not this harvest. `@kolu/surface` already owns `pollOnEvent` (`packages/surface/src/server.ts`). Olai's probe loop is not a poll-on-event of git status; it is a stamp-diff + codec-validate + last-good publish. Plugging `pollOnEvent` in as the trigger would not delete `probe.ts`. The product is the probe.

**Verdict: killed, for this sitting.** Would not make bugs 1, 3, 4, 5 impossible. Would not make bug 2's last-good-masquerade subclass impossible. Would not make bug 2's "backstop missed" subclass impossible. At best it moves bun-vs-parcel behind a wall the store already presents as `Stream<void>`. That is an implementation PR inside an existing vault, and the lowy skill's "almost expendable" test says the doorbell-extraction is too small to be a boundary of its own once `Disk.watch` exists.

---

## What I am not claiming, named so it cannot be inferred

- **`@olai/store` does not move into kolu.** Sittings 1–3 already recorded it as the textbook receptacle. The graduation clock is still interrupted: `git log --since=2026-08-13 -- packages/store/src` is fourteen commits, including the bun pin and the unreadable-directory channel. Today's four bugs are grenades *for that vault*, which is the article working. Moving the vault into kolu would invert skill §4 (most-depended-upon grows more volatile).
- **Typed chips / `door.ts`.** Zero kolu. The declaration map is `@olai/format` (`validate.ts:158-168`, `typing.ts`); the display is `door.ts` five rules. Module altitude.
- **Fable's custody socket**, if it is real, is an olai *face* — store's public contract growing `(set, health)` / `mayWrite`. I will steelman it in r2. I will not steal it upstream. Candidate A is the version of that idea that *does* go into kolu, and I killed it on the article's own tests.
- **Sitting 3 leftovers.** Fold, holders, unix-socket export: shipped, cited above. Not a fourth-sitting finding.

---

## Small-findings (guards, not receptacles — parked for the closing)

These would have *caught* today's bugs. The charter puts them here, not in the headline.

1. **MCP reads of a last-good snapshot should name the errors cell.** The cell exists; `read_node` / `read_subtree` answering as if current is the bug 2 symptom. A claim test: no successful MCP read while `errors !== []` without a staleness field. That is a pin on an existing socket, not a new one.
2. **Out-of-band git should knock on `Store.resync`, not hope the doorbell.** The door exists (`store.ts:131-142`); the harness already uses it; a human `git pull --rebase` in a terminal does not. A procedure or a post-git hook is plugging a lamp in, not wiring a new room.
3. **Banner must not be `Report`.** `Report.tsx:6-7` forbids summarising *because three surfaces share it*; the banner is the one surface whose job is one sentence plus a count (the bug node says so). Clamp at the banner, keep `Report` on ErrorPage and the broken file's own pane. UI module, not kolu.

---

## Headline

**Zero new kolu receptacles from this harvest.** Today's classes are last-good vs cold vs whole-set-validate vs "the errors cell exists and the read path did not join it." Those live in `@olai/store`, `@olai/format`, ops, and two web files. The framework sockets this seat has previously argued for are already in the pin. Forcing last-good or the doorbell into `@kolu/surface` fails the article's tests in opposite directions: the first is domain policy leaking downward, the second is a parallel receptacle for an axis already behind `Disk.watch`.

I will change this if r2 produces a kolu-shaped axis I missed — a change that actually churned in `@kolu/surface` *today*, or a consumer besides olai that paid the same last-good tax this afternoon. I have not found one in the harvest, the store, `door.ts`, or the kolu master worktree.
