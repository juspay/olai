# opencode — opening (round 1) · module-boundaries altitude

My seat is the narrowest and, after today, I think the most crowded one: boundaries **inside existing packages**. Not a new package wall, not kolu. What the altitude buys is precision — I am not asking where a new vault should stand, I am asking which question today is being **answered in two places**, because every one of the five bugs is, at module level, a *second spelling of an answer that already exists* (or that one module is owed and nobody owns). Löwy's oscilloscope, read at call-site resolution.

Three candidates, ranked, each through the four tests explicitly. Then what I am deliberately not proposing, and the guards parked for the closing.

---

## First: what the harvest looks like at module altitude

Read the five bugs one level down from the symptom and a single pattern repeats — **a question with one true answer, derived twice:**

| bug | the one question | who answers it today |
|---|---|---|
| `door-ignores-declarations` + siblings | what does this value name? | the validator (`typing.ts`'s `wrongValue`) and `door.ts`'s five shape-guesses — **independently** |
| `prop-path-resolves-beside-writer` | where does a relative path stand? | `documents.ts`'s `resolveRelative`, `pathedOf`, `typing.ts`'s `wrongDoc` — and the *board's convention*, which lives in nobody's code |
| `broken-file-blocks-healthy-writes` | which files does this verdict implicate? | nobody — the write gate holds "a boolean", the errors `E` is a flat list, so the refusal cannot name the file |
| `last-good-banner-flood` | how much of a verdict does one surface draw? | `Report.tsx` — which *forbids* summarising, because the enumeration is the only shape the answer has |
| `cold-boot-all-or-nothing` | which errors are fatal, and when? | `validate.ts:188` ("any error at all refuses the set") meets `store.ts`'s `snapshot = null` — two lifecycle paths, one implicit classification |
| `stale-set-reads-clean-writes-refuse` | what does the disk *now* say, and how sure are we? | watcher events, mtime+size stamps, the 60s backstop, and a `resync` door the consumer must know to knock on |

Every row is one volatility answered ad hoc. The three that earn receptacles at my altitude follow, in order of strength.

---

## Candidate 1 — the MEANING socket: *what a declared value names* (the door family, and it does not stop at the door)

**The volatility.** What a property **value means** — its resolution basis, what it names, how it should be drawn. This axis moved *three times today alone*: `pr` → `pr-url` (full URLs, int spelling dead), `merged` split into date + `merge-commit` URL, `item` dropped outright (commits `1c30daf5`, `24f80b2d`, same afternoon as #395 `6120e715`). Five client PRs since 08-11 kept widening what a chip may open (#179 `3d8f0dbb` the drawer, #195 `b3c13616` search rows, #302 `f2bea7cb` frontmatter, #322 `523e2d3d` document pages, #373 `89f2245c` chips on rows — *three* of them named in `door.ts`'s own header as the reason it had to become a module: "a row, a node's own page and a document's frontmatter… so 'what does this value open' has to have one answer or three surfaces will drift into three"). The brainstorm (§5) names *more* forward vocabulary; spans on date/int are ruled. The axis is open-ended, has already churned, and is declared to keep churning. Not speculative: happened, today, in commits.

**Today's shape — the axis answered twice, from two premises.** The validator consults the declared vocabulary: `wrongValue` / `wrongDoc` resolve a `doc` value through the declaration (`typing.ts:674-676, 736-752`). The display *re-derives* the same question by inspecting shape: `doorFor` runs five ordered guesses over `{from, serves, names}` (`door.ts:155-196`), `door.ts` *predates #395 and never reads `_olai/Properties.olai`*. The children of `typed-chips-doors` are exactly where the two answers disagree:

- `prop-path-resolves-beside-writer` — basis volatility. `pathedOf(vault.from, value)` (`door.ts:177`) resolves beside the writing file, exactly as `wrongDoc`'s `resolveRelative(from, value)` does. But the board's stated convention is vault-root-relative (~101 `brief` values), and the declaration says `doc` = *"a path that names a served document"* without the display learning anything from it. So both code encodings say beside-writer, the vault's actual usage says root, and every `brief` chip outside the root is dead. Three facts, three locations: the arithmetic in `documents.ts`, the gate's check in `typing.ts`, the convention in the *vault's data*. Löwy: a change to the convention must today touch code in two packages *and* contradict data.
- `ref-chip-face-shows-id` — face volatility. A ref value is an ID by design ("names rename, ids don't"), and the display half of that rule is *admitted missing in the code*: `typing.ts:36-39` — "nothing resolves a ref value to its variant's title yet, and doing so is the same door work." The resolved title arrives in `door.says` but lands only in `title=` (`PropsDrawer.tsx:572,588`); the chip face draws the stored id verbatim, so every lane chip reads `agent agent-claude-opus`.
- `door-ignores-declarations` — the structural umbrella over both.

**The receptacle.** A **meaning** module in `@olai/format`, beside `typing.ts` which already owns the vocabulary: `meaningOf(typed, file, key, value) → Meaning | undefined`, where `Meaning` carries (a) the **basis** the declaration grants (a declared `doc` key resolves vault-root; the `doc` *field* and undeclared guesses keep beside-writer — two bases, each stated once, *chosen by the declaration*, not guessed per call site), (b) the **target** — document / node / variant / day / away — resolved against the same indexes `wrongValue` already reads, and (c) the **face** — the title a ref id *means*, the canonical date, the path as resolved. `wrongValue` and `meaningOf` are then *two questions of one module*: "may this value be stored" and "what does this value name" — same declaration, same resolution, same indexes, no second derivation. `door.ts` thins to route-construction (routing *is* the client's business); `PropsDrawer` draws the face the meaning carries; undeclared keys keep today's shape-guessing as the *fallback arm of the same function* — nothing regresses, which the module can promise because it is the one place both arms live.

The implementation consequence, said plainly: the client needs the answer on the wire (declarations today reach only server-side query code — `narrowing.ts`, `plan.ts`), so the page reading carries either the vocabulary or, better, the per-value `Meaning`. That is wiring the socket's plug, not evidence against the socket.

**The four tests.**

1. **Opaque socket.** Consumers stop seeing `PropDeclarations`, `pathedOf` arithmetic, the five-rule order, and — crucially — the *basis*: today `door.ts`'s `Vault` interface exposes `from` (the writing file) to every caller, i.e. the resolution convention is part of the public contract. With the socket, a change of basis convention, a new `PropType`, or a face-policy ruling never reaches the consumers' types.
2. **Functional but not domain-functional.** "Ground a string in the thing it names, and prefer its display form" is reference-resolution + rendering convention — mechanics, like the power strip grounding a plug. It knows nothing of tasks, lanes, marks, or outlines; a `\`-typed value is a *name*, not a business rule. The volatility (type vocabulary, bases, faces) is exactly the house-current kind: AC/DC/110/220 of value interpretation, constant in shape, varying in supply.
3. **Oscilloscope.** Cited above: three vocabulary amendments in one day; five display-reach PRs in two weeks; three filed bugs from one afternoon's audit; the code's own header confessing drift as its organising fear; `typing.ts` confessing the unbuilt half. I will add the confession that matters most: door.ts's header says *"`custom` is the one open field… olai gives no key in it a meaning — that is the format's rule and it does not move."* It moved *today*. A module founded on a frozen premise, on the day the premise thaws.
4. **Vault.** The next change of this kind — root-relative granted by a declaration keyword, the `node` kind's display, span-shaped values for `prop:dispatched=2026-08-20..`, a ref-face ruling — lands inside the socket; row, drawer, search, document frontmatter stay untouched. The counterfactual today is proven by the bug list itself: one basis ruling requires edits in `documents.ts`, `typing.ts`, `door.ts`, and data — a change resonating across four modules for one question, which is Löwy's definition of functional decomposition.

**Impossibility, not detection.** With one consult: `door-ignores-declarations` cannot exist — there is no second authority for the door to ignore. `prop-path-resolves-beside-writer` cannot exist as *display* divergence — the same function decides for gate and display; if the answer is wrong it is wrong in one place, which is the honest form of this class. `ref-chip-face-shows-id` cannot exist — the face is *produced by the same authority that licensed the id*; a meaning without a face is unrepresentable, whereas today the title is a tooltip-optional side channel.

**Honest limits.** The socket does not make documents exist: the board carries stale `brief` values that resolve under *no* basis (`docs/briefs/tfa.md` is gone), and those stay the validator's did-you-mean reports — data rot, not a boundary. Routing stays web-side. And the `serves`/existence question the door asks is real client knowledge — the socket answers "what it names", the client decides how a click opens it.

---

## Candidate 2 — the VERDICT socket: *a set's judgement is data with a shape, not a log every consumer re-partitions*

**The volatility.** How a validation failure is **scoped, classified, and admitted** — which files it implicates, which errors are fatal where, what a write may touch, what each surface draws of it. This axis moved on 08-11 (#112 `c5774a7d` — platform failures became data on the same channel, the banner's comment now says the old lede "became a lie"), it moved *today* (#397 `4604ee41` narrowed a whole-vault disagreement check to an op's footprint — the same scope axis, cost-shaped), and it filed three of today's five bugs.

**Today's shape — the answer is a flat list, so every consumer invents the missing structure.** `Codec<S, E>` publishes `E = ReadonlyArray<OutlineError>`. A flat log is not a socket; it is the *raw material* of the answer, and so the structure gets derived per consumer:

- **Write gate** derives *admission* as one boolean: whole set validates or the write dies, `ops.ts:466-473` — and the refusal it builds — "`add_node …` would leave the outlines invalid, so nothing was written" — *literally has no slot for the broken file's name*. The bug's sentence: "the write was innocent," and the indictment landed on it because *implication* is not in the type.
- **The banner** derives *presentation* as total enumeration: `Banner.tsx` inlines `<Report errors={…}/>`, and `Report.tsx:6-7` *forbids* summarising ("none of the three can quietly start summarising") — a rule that made sense when the enumeration was the interesting answer, and that flooded every page with 135 rows of *another file's* rows today. The presentation policy is a comment in a component because the verdict carries nothing to summarise *to*.
- **Cold boot** derives *fatality*: `snapshot = null` until the whole set validates (`store.ts:120-122`), `ErrorPage`'s own lede: "an outline set is valid or it is not, and half of one would be a different set from the one on disk." The running server survives the same rows per file. Two lifecycle paths, and the *severity classification* that could reconcile them — a dangling `see` is "a flag with a did-you-mean, not a brick," per the bug — exists nowhere: `validate.ts:188` is monotonic on purpose, which is correct for the *format* and lethal as the *only* representation.
- **MCP reads** derive staleness as silence: the errors ride a *separate* cell (`runtime.ts` binds it); `read_node` answered the last-good snapshot with no marker — the bug's "every diagnosis trusts the reads." (Grok's small-finding #1; it is a symptom of this candidate, and I will say so in r2.)

Half the structure already exists, half-built and private: `errors.ts`'s `Stage`/`Reach` ("set-across-files" — *the exact classification cross-file admission needs*), the catalogue's own header ("a code declared in one place and classified in another is a pair that can — **and did** — drift apart"), `Report`'s by-file/across partition, `validate.ts`'s withheld rule. The project *knows* the shape; it just keeps it inside the validator where no consumer can ask it a question.

**The receptacle.** Make `E` a **Verdict**: the rows, plus the questions consumers actually have — `implicated(paths)` (which files does this judgement touch — the refusal's missing adjective), `admits(write)` (the gate's policy, one place, whatever the human rules per-file admission to be), `summary(n)` (the bounded form a banner draws; full rows remain on the broken file's own page and the error page), `fatalAtBoot` (the severity classification both lifecycle paths consult, so "this vault will not boot" is *projectable* while the server still runs — the bug's own arm-2 fix, as a socket rather than a second policy). Home: `@olai/format`'s `errors.ts`/`validate.ts` (where the catalogue and `Reach` already live), published through `ops/src/codec.ts` as today; the store's generic all-or-nothing *mechanism* below stays untouched.

I must mark one boundary carefully, because precision is the seat's whole value: **mechanism vs policy.** The store's all-or-none stage-rename-validated-set is a *mechanism*, and a fine one — what is missing is the *policy* it executes, which today defaults to "the whole set, always" because that is the only shape `Result<S, E>` naturally carries. The Verdict is the policy growing its own type. Bug 3's class then dies not because the gate got kinder but because *the gate's judgement has an answer to "who is implicated"* — whichever admission rule the human rats, it is written once, in the verdict's module.

**The four tests.**

1. **Opaque socket.** Consumers ask questions (`implicated`, `admits`, `summary`, `fatalAtBoot`); they stop walking rows. A new error code, a severity reclassification, an admission ruling lands inside the verdict; `Banner`, `Report`, `ops.run`, `Page.tsx`, and the MCP faces compile unchanged.
2. **Functional but not domain-functional.** Diagnostic scoping/classification/rendering of a validated corpus — the shape an electricity panel gives the breakers, not the rooms. `OutlineError` semantics stay the format's; the *meta*-question (which rows implicate which files, what is fatal when) is mechanics.
3. **Oscilloscope.** #112 (08-11), #397 (today), three bugs filed today from one broken file; plus the accretion history — per-file error scope decided 08-09 (validate.ts's header dates it), `unreadable-directory` forced a second kind into the channel, `Reach` forced a third classification. The verdict's shape has been changing every fortnight; only its *availability to consumers* has stood still.
4. **Vault.** Next change of this kind — per-file write admission, severity on the dangling classes, a chat-surface health dot, a summary for a new banner — lands inside. The blast radius counterfactual is today's: one broken file implicated the gate's boolean, the banner's enumeration, the boot's fatality, and every MCP read — four modules resonating with one verdict because the verdict has no shape.

**Impossibility, not detection.** Bug 3: a refusal that cannot name the implicated file becomes *unrepresentable* — the sentence is built from the verdict's answer, and the answer names files by construction. Bug 4: a banner bound to `summary(n)` cannot flood; the enumeration stops being on the wire *to that surface* at all. Cold boot's *asymmetry* class: note the precision — the bug names two asymmetries (running-vs-cold availability, severity classification) and "either's fix would have prevented the outage." The socket kills the second: fatality becomes a classification the boot *reads* rather than a consequence of there being no last good, and the loud-while-running projection becomes one map consulted twice. Whether the availability policy then converges (cold boot as catch-up-from-empty — fable's arm-1) is a *policy* debate for r2; the receptacle makes both policies expressible, which is the part that is mine to claim here.

**Honest limits.** `Reach` shows the hard kernel: a write to a healthy file *can* genuinely implicate the broken one (a new `see` edge pointing into it) — admission is not trivially per-file, and the verdict must model reach, which is why the classification already exists in `errors.ts`. This is a real receptacle *because* the kernel is non-trivial; it fails the "trivially expendable" end of the almost-expendable test correctly, not cheaply.

---

## Candidate 3 — the TRUTH contract: *one look at the disk* (the smallest, and I say so myself)

**The volatility.** How the process learns the disk moved — watcher events, stamps, polling, caller knowledge. Three weeks of oscilloscope: `watcher-postboot-blind` → per-directory arming (#196 `e93871a1`) → the bun 1.4.0 rewrite pin (#368 `fb3a0cfc`) → the afterhook race (#381 `05d6757f`), and the stamp trade *resolved* 08-09 (`disk.ts:54-58` — coarse by design). Then today's `stale-set-reads-clean-writes-refuse`: 30+ minutes of errorless stale reads, writes refusing, `touch` and a size-changing append not waking it, the 60s *unconditional* backstop not catching it. That last fact does not fit the stamp story — an append changes size — so the honest reading is the bug's own: undiagnosed, two possibilities, both inside these walls.

**The socket violation that is provable *today*, independent of the undiagnosed bug:** the store's public face carries **two look-verbs** — `refresh` and `resync` — and the difference between them is the implementation's stamp arithmetic, explained in doc comments so that *a consumer can choose correctly* (`store.ts:131-143`; `server/src/resync.ts`: "The Effect this route is handed…" — the trade reached an HTTP route and an e2e harness). An interface that changes with the encapsulated volatility is leaking (skill §5): the `resync` door exists *because* the socket wears the wiring. The receptacle at module altitude is small: one `look` verb, certainty as an argument or policy inside — and a read answer that carries its *vintage*, so "stale but reads healthy" is unrepresentable rather than merely unprobed.

**The four tests, with the throttle on.**

1. **Opaque socket.** One verb; consumers stop modelling stamps. Fails *today*, passes under the candidate.
2. **Functional but not domain-functional.** Change detection over a directory — the purest electricity in this opening.
3. **Oscilloscope.** Strong, cited above — three weeks of it.
4. **Vault.** Next detection change (hash stamps, verify-on-read, a watchman backend) lands inside. Yes.

**Why I rank it third and hand the house the throttle.** Candidate 3 would **not** have made today's filed bug structurally impossible *as filed*: if the probe loop wedged, no boundary fixes a wedged machine, and the backstop's silence is a machinery failure, not a decomposition failure. What it kills is the *provable* class member — the consumer-visible two-door leak, and reads that cannot say how old they are. That last clause rhymes with grok's "the errors cell exists and the read path did not join it"; his guard and my socket are the same fix seen from two altitudes, and I will argue in r2 that his #1 is the *pin* on my socket, not an alternative to it. But per the charter's own bar — *impossible, not caught* — candidates 1 and 2 make their classes unrepresentable; candidate 3 makes one leak unrepresentable and one bug *more diagnosable*. Ranked accordingly.

---

## What I am deliberately not proposing

- **No lifecycle/custody package.** Fable's custody and my candidate 2 share an oscilloscope trace; at my altitude the finding is that the *shape of the answer* is missing, not that a boundary wall is missing. If the verdict grows the classification, cold boot consults it, and the composition root decides availability — no new home is built, which is either my candidate absorbing his or his candidate wearing module clothes. The diff will referee. I note, not argue, that today.
- **No per-file last-good restructure.** It *looks* like the fix for bugs 1 and 3 and it rewrites the publish contract — the expensive kind of wrong that a missing-answer shape mimics. Candidate 2 first; if per-file last-good is still wanted after the verdict exists, it will be because the verdict said so.
- **Nothing in the planner's braid.** plan.ts is 4,974 lines and *busy* — but the house record says busy ≠ volatile, and today's churn there (#395–#398) is each verb's own semantics, not an unhomed axis.

## Guards, parked for the closing (catch-tests, not receptacles)

1. Banner clamps to one sentence per broken file + row counts; full rows stay on the file's own page (`last-good-banner-flood`'s minimal fix).
2. The gate's refusal names the implicated file (`ops.ts:469`'s sentence grows the adjective).
3. MCP reads on non-null errors carry a staleness marker (grok's #1 — adopted, not stolen).
4. `Codec.byName` / `Store.body` stay *named exceptions*; they are the two places the socket already wears wiring, and candidate 3's tightening must not paper over them.

## Headline

Today, the vault shipped a *declaration of meaning* (#395) and then demonstrated, four ways in one afternoon, that **declaring an answer and *consuming* it are different modules.** The door guesses what the gate already knows; the gate holds a boolean where the verdict should hold a map; the banner enumerates because summarising was never given a shape; the boot bricks because fatality was never given a classification. Two sockets make the dominant classes structurally dead — **MEANING** in format (consumed by web: the door family's one consult) and **VERDICT** in format (consumed by ops, web, server, MCP: the judgement's shape) — and one tightened contract — **TRUTH** in store — retires the resync leak. The oscilloscope for all three is dated today, in commits and in the bugs' own prose.
