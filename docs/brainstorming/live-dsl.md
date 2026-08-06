# live: a declare-and-check DSL (brainstorm)

Status: brainstorm. Nothing here is built. The live-view framework (worktree `live-view`, in flight) ships functions + contracts first; this doc asks what a macro layer on top would buy — and for whom.

Context: [The Bottlenecks for AI-Driven System Design](https://maheshba.bitbucket.io/blog/2026/07/22/agentdesign.html). Agents are not bottlenecked on correctness or codegen; they are bottlenecked on evolution (changing a system safely), frangibility (you cannot learn by breaking production), and entropy (many agents with partial context accumulate special cases faster than any one of them can see). The remedy the post names: abstractions that let agents reason in a precise language instead of conventions. This repo is built by exactly such a swarm.

The whole argument fits in one toy app. Meet `counters`: the hello-world of live pages — three counters racing, sorted by who's winning.

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

Same three files. The conventions become bindings:

```racket
;; counters.rkt — the PRODUCER owns the stream vocabulary
(define-stream counts
  #:version 1
  #:events (counts-changed)
  #:id tick                ; SSE id: field = the bump counter
  #:heartbeat 15)

(define (bump!)
  (stream-send! counts 'counts-changed (render-list (counter-values))))

;; list.rkt — the DRAWER owns the region
(require (only-in "counters.rkt" counts))

(define-live-region clist
  #:swap morph
  #:stream counts)

(define (render-list cs)
  (live-region clist
    (for/list ([c cs]) (counter-row c))))

(define (counter-link c)
  (live-link clist (counter-href c) (counter-name c)))

;; clock.rkt — a SECOND producer, its own stream
(define-stream clock
  #:version 1
  #:events (clock-tick)
  #:id tick
  #:heartbeat 15)

;; header.rkt — a second drawer, its own region
(require (only-in "clock.rkt" clock))

(define-live-region ticker
  #:swap morph
  #:stream clock)
```

What expands out is the exact HTML you read in the hand-wired version — attributes, nothing else:

```racket
(div ([id "clist"] [hx-ext "sse"]
      [sse-connect "/events?stream=counts&v=1"]
      [sse-swap "counts-changed"] [hx-swap "morph"]
      [data-live-heartbeat "15"]) ...)

(a ([href "/c/beta"] [hx-get "/c/beta"]
    [hx-target "#clist"] [hx-select "#clist"]
    [hx-swap "morph"] [hx-push-url "true"]) "beta")
```

No new runtime. The macro's entire contribution is that the four conventions are now written ONCE each, and every other appearance is a reference the compiler resolves — or refuses:

```racket
(live-link clsit (counter-href c) (counter-name c))
;; list.rkt:31:15: clsit: unbound live region

(stream-send! counts 'count-changed html)
;; counters.rkt:12:24: count-changed: not an event of counts
```

Both die at expansion, srcloc first, before a server boots. That error message IS the agent interface: a misinformed agent gets a file:line:col and a name, not a silently dead page.

And the two surfaces cannot collide: a `live-link` on `clist` expands to `hx-target "#clist"` and nothing else. A counter link that rebuilds the ticker is not merely unwritten — it is unwritable.

## The questions, asked of the code

**Should each counter row be a region?** Tempting — rows are what actually change, and the reorder raises the stakes: sorted by value, rows move every second, and the row you selected must stay the same COUNTER, not the same position. But look at what the two concepts do in the expansion: the REGION is the swap target, the unit a link or event replaces (`#clist`). What preserves a row's identity across that swap is morph, and morph needs only a stable `id` on each row — the counter's name. Declaring per-row regions would complect the two. Resolved: a region is one element; stable per-row ids are an obligation the consumer contract states, not a declaration — the framework cannot check what `counter-row` emits without becoming the renderer.

**Where does `define-stream counts` go — a central registry.rkt?** Follow the `require` line in list.rkt: the module graph already IS the registry. The producer defines and provides; drawers require; the compiler resolves the name or fails. A registry module would reintroduce the disease one level up — agents agreeing about registry keys instead of id strings. Precedent in this house decides it anyway: `define-style` lives with the module that draws. Resolved: streams live with their producer (counts in counters.rkt, clock in clock.rkt), regions with their drawer.

**Should `define-live-region` generate the JavaScript?** The watchdog that flags a frozen table when heartbeats stop has to run client-side, so the temptation is a macro that emits JS. But the expansion above already shows the answer: `data-live-heartbeat "15"` is DATA on the DOM, and one generic, vendored, hand-written client file reads it — the same bet htmx itself makes (HTML is the interface). Resolved: declarations expand to attributes only; no DSL emits JavaScript. This is also what keeps the client reusable by any consumer app.

**A tab loaded yesterday's page; the server now speaks v2. Then what?** A tab left open across a redeploy is the rule for any live page, not the edge. Racket-side, evolution is already safe: delete `counts-changed` from `#:events` while list.rkt still references it and expansion fails. But a browser tab is a consumer OUTSIDE the module graph — the compiler cannot see it. So the version travels on the wire: `#:version 1` is stamped into the connect URL (`/events?stream=counts&v=1`), and a v2 server answering a v1 connect sends one mismatch frame telling the tab to hard-reload. Resolved: define-stream owns the version, the wire enforces it, stale tabs self-heal on reconnect — which quietly fixes deploy-time skew, a glitch nobody had even listed.

**Still open, recalibrated: will the swarm extend it?** The post's endgame is abstractions agents GENERATE for their own use. [One paper](https://arxiv.org/abs/2506.10021) says a Lisp is the natural medium for that — conceptual framework, zero experiments. The measured record ([agents-and-dsls.md](agents-and-dsls.md), conclusion 8) says otherwise: LLM-authored abstraction libraries deliver nothing where human-curated ones deliver plenty, and LLMs apply stable abstractions well while discovering them badly. So the test splits in two. Third live surface: does the agent reach for `define-live-region` unprompted? Expect yes. Uncovered convention: does it propose a form for a human to ratify? Maybe. Autonomous grammar growth: don't design for it.

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
9. *Never reject reasonable code* → the checker checks only the cross-file coincidences (region names, event names, swap modes, stream versions), nothing stylistic, and every rejection ends by showing the plain-function spelling of the same thing.
10. *Past the edge of the literature* → count checker errors per PR from CI logs, watch whether the third live surface uses the macros unprompted, and write up what happens — the first agents-on-Racket account would be worth publishing.

## The rules that fall out

- **Thin DSL over a functional core.** Every form expands into calls on a documented, contract-out'd runtime API. A consumer who doesn't want the sugar uses the functions; the forms can evolve without trapping them. The framework's reuse story rides the functions, not the forms.
- **No macro without a check.** Sugar for terseness alone is entropy wearing a uniform — it rots like a comment. Each form above earns its place by refusing a specific misspelling.
- **Macros own compile time, contracts own runtime.** Blame + srcloc already police the module boundary at runtime; the forms police names before it. Complementary, not competing.
- **Streams are one-way doors.** `#:events` is append-only and versioned like the JSON replies; removing an event is an expand-time error until every requirer is gone. Evolution pressure lands on one declaration site instead of a grep across three languages.
- **Errors explain the violated rule, at length.** srcloc first, then the constraint, the candidates in scope, and a suggestion — the agent-facing optimum is more verbose than the human-facing one, and location alone measures at zero.
- **Every form ships documented and exampled.** A docstring per form and 3–5 worked examples in the repo; undocumented abstractions measurably make agents worse than no abstractions.
- **The expansion is dumpable.** A command that prints what any form expands to (`raco expand` dressed for the purpose) is part of the interface — the one verified metaprogramming-debugging success depended on exactly this.
- **The vocabulary is curated, not accreted.** Tiny, frozen between deliberate revisions; the swarm proposes, a human ratifies, unused forms get retired.

## And olai?

Substitute names: `clist` is `#ol-live`, `counts` is `outline-events` in `web/watch.rkt`, `counter-link` is every sidebar, crumb, and permalink the renderer draws — and the `ticker` is the chat panel: the second live surface a navigation must not rebuild. The sidebar-click that rebuilt the chat was the bug that started this doc; declared, it is unwritable. `serve.rkt` requires both drawers; the module graph wires the rest.

The in-flight live-view PR ships the functional core. The DSL is a possible second PR, judged then by the same lenses: build it only if the declarations CHECK something a swarm actually trips on.
