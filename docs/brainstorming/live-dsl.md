# live: a declare-and-check DSL (brainstorm)

Status: brainstorm. The DSL is not built. The functional core it would sit on landed as `live/` (PR #29), and the toy example below is now real, hand-wired code: [`live/examples/counters/`](../../live/examples/counters/) (PR #32). This doc asks what a macro layer on top would buy — and for whom. The questions section names the exact lines to read before answering.

Context: [The Bottlenecks for AI-Driven System Design](https://maheshba.bitbucket.io/blog/2026/07/22/agentdesign.html). Agents are not bottlenecked on correctness or codegen; they are bottlenecked on evolution (changing a system safely), frangibility (you cannot learn by breaking production), and entropy (many agents with partial context accumulate special cases faster than any one of them can see). The remedy the post names: abstractions that let agents reason in a precise language instead of conventions. This repo is built by exactly such a swarm.

The whole argument fits in one toy app. Meet `counters`: the hello-world of live pages — three counters racing, sorted by who's winning. It runs: `just counters`, then read [`live/examples/counters/`](../../live/examples/counters/). The snippets in this doc are simplified from those files; where the two disagree, the shipped code is the reference, and the disagreements are themselves findings — see the questions section.

## The toy, wired by hand

One page, two live surfaces. Three counters (`alpha`, `beta`, `gamma`) incrementing at random rates on the server, listed sorted by value — rows reorder constantly. A clock ticker in the header, fed by its own stream. Your selected row and the half-typed text in the header's input box survive every swap. Clicking a counter opens its detail view without rebuilding the input box — or the ticker, which must not so much as flinch. This is htmx + SSE, the way olai's live view is wired today.

Three files:

```racket
;; counters.rkt — bumps three counters at random rates
(define (bump!)
  (broadcast! hub 'counts-changed (render-list (counter-values))))

;; list.rkt — draws the page
(define (render-list cs)
  `(div ([id "clist"] [hx-ext "sse"]
         [sse-connect "/events"]
         [sse-swap "counts-changed"]
         [hx-swap "morph"])
     ,@(for/list ([c cs]) (counter-row c))))

(define (counter-link c)
  `(a ([href ,(counter-href c)] [hx-get ,(counter-href c)]
       [hx-target "#clist"] [hx-select "#clist"]
       [hx-swap "morph"] [hx-push-url "true"])
     ,(counter-name c)))

;; app.rkt — serves "/", "/c/<name>", and "/events" off the hub
```

It works. Now count the agreements that make it work — each one a pair of spellings in different files that nothing checks:

1. `"clist"` the id, and `"#clist"` twice over in every link.
2. `'counts-changed` in counters.rkt, and `"counts-changed"` in an attribute in list.rkt.
3. `"morph"` on the region, and `"morph"` again on every link that targets it — disagree and a click repaints what an event morphs.
4. `"/events"` in the attribute, and the route app.rkt actually serves.

Four conventions. Zero checkers. The compiler sees six string literals with nothing in common.

And that is ONE surface. The ticker repeats all four agreements with its own spellings — `"ticker"`, `'clock-tick`, its own morph, its own stream URL. Eight coincidences for two surfaces, two more for every surface after that, forever.

## How it breaks

Write `sse-swap "count-changed"` — no error. The server compiles, the page renders, the counters silently freeze. A stalled counter does not look broken; it looks idle. Write `hx-target "#clsit"` — no error; clicking a counter now replaces the whole body, input box, ticker and all. And with two live surfaces on one page, a careless target on a counter link rebuilds the ticker as collateral — nothing checks that a link touches only its own region. And since the list is sorted by value and reorders every second, the row you selected stays the same COUNTER — not whatever moved into that position — only if morph is actually in play on both the event and the link. Every failure is runtime, in a browser, visible only to an eyeball that knows what SHOULD have happened.

Now put a swarm on it. Each agent arrives with partial context and must REDISCOVER the four conventions from source before touching anything. The post calls the result entropy: special cases and near-misses accumulating faster than any one agent can see. And the only net under them is the e2e suite — simulation, in the post's terms: expensive, late, and only as good as its scenario coverage. This is not hypothetical; olai's sidebar-rebuilds-chat bug was convention 3 misapplied, shipped green, and caught by a human.

Frangibility says what the fix must feel like: an agent cannot learn by breaking your browser session, so the feedback has to arrive before anything runs. The cheapest such feedback in Racket is expansion failure with a srcloc — already this repo's agent interface (`#lang olai` is a closed grammar with one checker; css-expr makes stylesheets checked s-expressions; [CLAUDE.md](../../CLAUDE.md) holds tests to srcloc fidelity). The cure below is the same one, applied to the wiring.

## The toy, declared

The conventions become bindings, over the same files as [`live/examples/counters/`](../../live/examples/counters/):

```racket
;; counters.rkt — the PRODUCER owns the stream vocabulary
(define-stream counts #:events (counts-changed) #:heartbeat 15)
(stream-send! counts 'counts-changed)     ; payload stays what live/ ships: the cursor

;; list.rkt — the DRAWER owns the region
(require (only-in "counters.rkt" counts))
(define-live-region clist #:stream counts)

;; clock.rkt / header.rkt — the second surface: same two forms, its own names
```

What expands out is exactly what `make-live-view` writes in the shipped example — attributes, nothing else, no new runtime. The macro's whole contribution: each convention is written ONCE, every other appearance is a reference the compiler resolves — or refuses:

```racket
(live-link clsit (counter-href c) (counter-name c))
;; list.rkt:31:15: clsit: unbound live region

(stream-send! counts 'count-changed)
;; counters.rkt:12:24: count-changed: not an event of counts
```

Both die at expansion, srcloc first, before a server boots. That error IS the agent interface: file:line:col and a name, not a silently dead page.

## The questions, asked of the code

The toy is built — [`live/examples/counters/`](../../live/examples/counters/), PR #32, hand-wired. Each question below is a choice between code blocks. Pick one.

### First, the recount

The sketch above counts four loose strings per surface. Shipped code:

```racket
;; the sketch — four agreements, all loose
[id "clist"] [sse-connect "/events"] [sse-swap "counts-changed"] [hx-swap "morph"]

;; shipped (list.rkt:15) — one value; region, targets, selects, links all derived from it.
;; Swap mode: not even a parameter. The sidebar bug is unwritable here.
(make-live-view #:region "clist" #:event "counts-changed" #:stream "/events" ...)
```

Still loose: `"counts-changed"` (list.rkt:23 ↔ counters.rkt:48) and `"/events"` (list.rkt:24 ↔ app.rkt:100). **Two per surface, not four.** The DSL competes against half the disease it was sketched for.

And one agreement nobody counted, found by the agent that built the example:

```racket
;; header.rkt:43 — htmx honours only the FIRST hx-history-elt on a page.
;; Two regions = one must yield, or Back restores the wrong thing.
;; "A ninth agreement, uncounted by the brainstorm and unspellable in live/'s API today."
(define (without-history attrs)
  (filter (λ (a) (not (eq? (car a) 'hx-history-elt))) attrs))
```

### Should each counter row be a region?

```racket
;; A — shipped (list.rkt:42): a stable id; morph keeps your selection on the COUNTER,
;; not the position, through two reorders a second
(li ((id ,(string-append "row-" (counter-name c)))) ...)

;; B — a declaration per row. Broken, twice:
;; 1. on counts-changed each row re-fetches its own fragment — 3 requests per bump
;; 2. a region swaps its own CONTENT; it cannot move itself in its parent.
;;    Nobody reorders the rows. The sort freezes at first paint.
(define-live-region row #:swap morph #:stream counts)

;; B′ — the itch B was scratching, minus the region: A's id is an UNCHECKED
;; obligation, so give it a form that MINTS the identity — a drawer cannot forget
;; what it never writes
(live-item (counter-name c)          ; ⇒ (li ((id "row-alpha")) ...)
  (a ...) (span ...))
```

**Verdict: B′.** Hardcoding id strings in drawers is a HARD NO — the form mints the identity.

### What does `define-stream` buy — and over what?

```racket
;; A — shipped: spelled twice, nothing checks. Typo = counters freeze, silently.
(define counts-event "counts-changed")    ; counters.rkt:48 — not provided
#:event "counts-changed"                  ; list.rkt:23    — spelled again

;; B — two lines, no macro: provide the name, use the binding
(provide counts-event)                    ; counters.rkt
#:event counts-event                      ; list.rkt — typo = unbound id, compile time

;; C — the DSL
(define-stream counts #:events (counts-changed))
(stream-send! counts 'count-changed ...)
;; counters.rkt:12: count-changed: not an event of counts
```

list.rkt already requires counters.rkt (line 8) — B is available TODAY. C beats B only when a stream carries several events; counts carries one. The real fight is B vs C, not A vs C.

**Verdict: C.** `define-stream` earns its macro.

### Should the DSL generate JavaScript?

```racket
;; A — shipped: declarations put DATA on the DOM; one generic vendored client reads it
(div ([data-live-heartbeat "15"] ...))
(span ((id "health")))                                        ; header.rkt:53
"html." live-stale-class " #health::after{content:'stale'}"   ; app.rkt:44

;; B — each region expands to markup PLUS its own inline script
(define-live-region clist #:swap morph #:stream counts)
;; ⇒ (script "live.watch('#clist',{heartbeat:15,...})")

;; C — a build step compiles ALL declarations into the client bundle it serves,
;; replacing the vendored file (typed-RPC style)
```

Costs. **B**: JS as strings inside Racket, one watchdog copy per region, inline scripts die under any CSP. **C**: a JS build step in a Racket house, and the client stops being reusable by non-DSL consumers. **A**'s real weakness, proven by the ninth agreement: anything the data vocabulary cannot say (`hx-history-elt` yielding) forces a hacky filter until the client grows a `data-live-history="no"`.

**Verdict: A.** Grow the client's data vocabulary whenever an app is caught hacking around it. Revisit if that stops scaling.

### A tab loaded yesterday's page; the server now speaks v2

```racket
;; A — shipped: the payload is a CURSOR, the region re-fetches its own address
(string-append live-boot-id "." (number->string (unbox bumps)))   ; counters.rkt:44
;; redeploy → new boot id → every reconnect mismatches → re-fetch draws v2 markup.
;; Stale tabs already self-heal. No #:version anywhere.
```

The one skew A cannot see: v2 RENAMES the event. The v1 tab keeps its EventSource, heartbeats arrive, health shows green, the list freezes forever.

```racket
;; B — version on the wire: a v2 server answering a v1 connect sends one frame: reload
[sse-connect "/events?stream=counts&v=1"]

;; C — no mechanism, one rule: events are append-only, never renamed
;; (the rule the JSON replies already live by)

;; D — human's proposal: the server's identity IS the URL. No hand-counted
;; versions; live-boot-id already exists.
[sse-connect ,(string-append "/live/" live-boot-id "/events")]

;; app.rkt — a UUID nothing answers to gets ONE frame: reload
[("live" (string-arg) "events")
 (λ (req boot)
   (if (equal? boot live-boot-id)
       (events-response hub req)
       (one-frame-response "live-reload")))]
```

D covers the renamed-event skew that the cursor cannot see. Two caveats:

1. **Never 404 the stale URL.** Browser `EventSource` hides HTTP status; on error it retries forever. The dead UUID must be ANSWERED — one reload frame, then close.
2. **A boot UUID reloads every tab on every restart, even same-code** — and a hard reload eats the half-typed input box that cursor catch-up preserves today. Refinement: key on a HASH of the code/assets instead. Same-code restart keeps the URL valid and the cursor heals it gently; only a real deploy reloads.

**Verdict: D as-is, boot UUID.** A same-code restart reloads every tab; accepted. This also retires `#:version` on `define-stream` — the wire carries the server's identity, not a hand-counted number.

### Will the swarm extend it?

When an agent adds live surface number three (olai's chat panel, say), it does one of:

- **(a)** uses `define-stream` / `define-live-region` correctly, unprompted
- **(b)** hits something the forms cannot say, proposes a new form, waits for the human to ratify
- **(c)** hand-rolls raw htmx attributes and routes around the DSL

The research ([agents-and-dsls.md](agents-and-dsls.md), conclusion 8) says: expect (a), gate (b) on the human, prevent (c) by keeping the forms easier than raw attributes. One data point already: the counters agent did (b) — found the `hx-history-elt` clash (block above), hacked around it locally, flagged it as unsayable in the API.

**Verdict: (c) is BANNED.** Raw htmx attributes in app code fail review; the forms are the only door. Gaps take path (b): propose the form, the human ratifies. Watch what surface three does with (a). The ban lands in live/README.md, with one pointer line in CLAUDE.md's hard rules, in the same PR as the forms.

## What the research says, applied here

The measured record on LLM agents and custom DSLs lives in its own doc — [agents-and-dsls.md](agents-and-dsls.md), eleven conclusions with the evidence in footnotes — because it applies to any DSL this house might grow, not just this one. What each conclusion means for THIS design:

1. *The prior fights you* → the vocabulary stays at three macros, and the Racket baseline gets taught separately — the repo is adopting [racket-skills SKILL.md](https://tangled.org/notjack.space/racket-skills/blob/main/racket/SKILL.md).
2. *The cost is the compile loop* → ours measures fast (2026-08: ~5 s no-op `just build`, ~8 s edit to 263 green tests, ~13 s worst-case clean rebuild), and DSL checks run at expansion, inside that loop. Also: hand-writing raw htmx attributes must never be easier than using the macros, or agents will route around them.
3. *Teach with grammar plus worked examples* → each macro's docs carry its mini-grammar; `live/README.md` gains a grammar section; counters graduates from this doc into a runnable `live/examples/counters/`, built by CI like `examples/` — a worked example that cannot go stale. The thin expansion is itself this channel: the macros expand to plain htmx attributes, vocabulary the model already knows.
4. *Errors explain, not point* → the message format becomes a tested contract, like srcloc fidelity already is: rule name, offending form quoted, candidates in scope, a did-you-mean. The failure examples earlier in this doc are too terse; the checker should say:

    ```racket
    (live-link clsit (counter-href c) (counter-name c))
    ;; list.rkt:31:15: clsit: unbound live region
    ;;   live-link's first argument must be a region bound by define-live-region
    ;;   regions in scope in this module: clist (defined at list.rkt:14)
    ;;   did you mean: clist?
    ```

5. *No standing prose* → when the DSL lands, CLAUDE.md's live-view bullets shrink to one pointer at `live/`'s docs, and any rule the checker enforces gets deleted from CLAUDE.md rather than restated.
6. *Docstrings are load-bearing* → no macro merges without its docstring and a worked example in the same PR.
7. *Tiny, human-curated vocabulary* → a fourth macro starts life as a Roadmap.rkt item, ratified by the human before any PR — the roadmap is the proposal queue.
8. *Dumpable expansion* → `just expand FILE`, `raco expand` trimmed to the live forms, ships in the same PR as the macros.
9. *Never reject reasonable code* → the checker checks only the cross-file coincidences (region names, event names, row identities), nothing stylistic, and every rejection ends by showing the plain-function spelling of the same thing.
10. *Past the edge of the literature* → count checker errors per PR from CI logs, watch whether the third live surface uses the macros unprompted, and write up what happens — the first agents-on-Racket account would be worth publishing.

## The rules that fall out

- **Thin DSL over a functional core.** Every form expands into calls on a documented, contract-out'd runtime API. A consumer who doesn't want the sugar uses the functions; the forms can evolve without trapping them. The framework's reuse story rides the functions, not the forms.
- **No macro without a check.** Sugar for terseness alone is entropy wearing a uniform — it rots like a comment. Each form above earns its place by refusing a specific misspelling.
- **Macros own compile time, contracts own runtime.** Blame + srcloc already police the module boundary at runtime; the forms police names before it. Complementary, not competing.
- **Streams are one-way doors.** `#:events` is append-only, like the JSON replies; removing an event is an expand-time error until every requirer is gone. Wire skew is the boot UUID's job, not a version number's. Evolution pressure lands on one declaration site instead of a grep across three languages.
- **Errors explain the violated rule, at length.** srcloc first, then the constraint, the candidates in scope, and a suggestion — the agent-facing optimum is more verbose than the human-facing one, and location alone measures at zero.
- **Every form ships documented and exampled.** A docstring per form and 3–5 worked examples in the repo; undocumented abstractions measurably make agents worse than no abstractions.
- **The expansion is dumpable.** A command that prints what any form expands to (`raco expand` dressed for the purpose) is part of the interface — the one verified metaprogramming-debugging success depended on exactly this.
- **The vocabulary is curated, not accreted.** Tiny, frozen between deliberate revisions; the swarm proposes, a human ratifies, unused forms get retired.

## And olai?

Substitute names: `clist` is `#ol-live`, `counts` is `outline-events` in `web/watch.rkt`, `counter-link` is every sidebar, crumb, and permalink the renderer draws — and the `ticker` is the chat panel: the second live surface a navigation must not rebuild. The sidebar-click that rebuilt the chat was the bug that started this doc; declared, it is unwritable. `serve.rkt` requires both drawers; the module graph wires the rest.

The functional core shipped (`live/`, PR #29); the worked example was built hand-wired (PR #32) and shrank the target — two unchecked strings per surface plus one page-global history decision, not four. Verdicts are in (above), and the build is decided: ONE PR ships it all — the boot-UUID wire in live/, the forms (`define-stream`, `define-live-region`, `live-item`), and the raw-attribute ban in live/README.md plus its pointer in CLAUDE.md.
