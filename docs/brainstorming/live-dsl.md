# live: a declare-and-check DSL (brainstorm)

Status: brainstorm. Nothing here is built. The live-view framework (worktree `live-view`, in flight) ships functions + contracts first; this doc asks what a macro layer on top would buy — and for whom.

Context: [The Bottlenecks for AI-Driven System Design](https://maheshba.bitbucket.io/blog/2026/07/22/agentdesign.html). Agents are not bottlenecked on correctness or codegen; they are bottlenecked on evolution (changing a system safely), frangibility (you cannot learn by breaking production), and entropy (many agents with partial context accumulate special cases faster than any one of them can see). The remedy the post names: abstractions that let agents reason in a precise language instead of conventions. This repo is built by exactly such a swarm.

The whole argument fits in one toy app. Meet `ptop`: htop in the browser.

## The toy, wired by hand

One page, two live surfaces. A process table the server resamples every second, and a load-average ticker in the header, fed by its own stream. Your sort column, your selected row, and the filter you typed all survive each refresh. Clicking a process opens its detail view without rebuilding the filter — or the ticker, which must not so much as flinch. This is htmx + SSE, the way olai's live view is wired today.

Three files:

```racket
;; sampler.rkt — takes a sample once a second
(define (sample!)
  (broadcast! hub 'procs-changed (render-table (take-sample))))

;; table.rkt — draws the page
(define (render-table procs)
  `(div ([id "ptable"] [hx-ext "sse"]
         [sse-connect "/events"]
         [sse-swap "procs-changed"]
         [hx-swap "morph"])
     ,@(for/list ([p procs]) (proc-row p))))

(define (proc-link p)
  `(a ([href ,(proc-href p)] [hx-get ,(proc-href p)]
       [hx-target "#ptable"] [hx-select "#ptable"]
       [hx-swap "morph"] [hx-push-url "true"])
     ,(proc-name p)))

;; app.rkt — serves "/", "/p/<pid>", and "/events" off the hub
```

It works. Now count the agreements that make it work — each one a pair of spellings in different files that nothing checks:

1. `"ptable"` the id, and `"#ptable"` twice over in every link.
2. `'procs-changed` in sampler.rkt, and `"procs-changed"` in an attribute in table.rkt.
3. `"morph"` on the region, and `"morph"` again on every link that targets it — disagree and a click repaints what an event morphs.
4. `"/events"` in the attribute, and the route app.rkt actually serves.

Four conventions. Zero checkers. The compiler sees six string literals with nothing in common.

And that is ONE surface. The ticker repeats all four agreements with its own spellings — `"ticker"`, `'load-changed`, its own morph, its own stream URL. Eight coincidences for two surfaces, two more for every surface after that, forever.

## How it breaks

Write `sse-swap "procs-change"` — no error. The server compiles, the page renders, the table silently freezes. A frozen monitor does not look broken; it looks calm. Write `hx-target "#ptabel"` — no error; clicking a process now replaces the whole body, filter, ticker and all. And with two live surfaces on one page, a careless target on a table link rebuilds the ticker as collateral — nothing checks that a link touches only its own region. And when sorted by CPU the rows reorder every second, so the row under your cursor — the one you are about to kill — keeps its identity only if morph is actually in play on both the event and the link. Every failure is runtime, in a browser, visible only to an eyeball that knows what SHOULD have happened.

Now put a swarm on it. Each agent arrives with partial context and must REDISCOVER the four conventions from source before touching anything. The post calls the result entropy: special cases and near-misses accumulating faster than any one agent can see. And the only net under them is the e2e suite — simulation, in the post's terms: expensive, late, and only as good as its scenario coverage. This is not hypothetical; olai's sidebar-rebuilds-chat bug was convention 3 misapplied, shipped green, and caught by a human.

Frangibility says what the fix must feel like: an agent cannot learn by breaking your browser session, so the feedback has to arrive before anything runs. The cheapest such feedback in Racket is expansion failure with a srcloc — already this repo's agent interface (`#lang olai` is a closed grammar with one checker; css-expr makes stylesheets checked s-expressions; [CLAUDE.md](../../CLAUDE.md) holds tests to srcloc fidelity). The cure below is the same one, applied to the wiring.

## The toy, declared

Same three files. The conventions become bindings:

```racket
;; sampler.rkt — the PRODUCER owns the stream vocabulary
(define-stream samples
  #:version 1
  #:events (procs-changed)
  #:id tick                ; SSE id: field = the sample counter
  #:heartbeat 15)

(define (sample!)
  (stream-send! samples 'procs-changed (render-table (take-sample))))

;; table.rkt — the DRAWER owns the region
(require (only-in "sampler.rkt" samples))

(define-live-region ptable
  #:swap morph
  #:stream samples)

(define (render-table procs)
  (live-region ptable
    (for/list ([p procs]) (proc-row p))))

(define (proc-link p)
  (live-link ptable (proc-href p) (proc-name p)))

;; loadavg.rkt — a SECOND producer, its own stream
(define-stream loadavg
  #:version 1
  #:events (load-changed)
  #:id tick
  #:heartbeat 15)

;; header.rkt — a second drawer, its own region
(require (only-in "loadavg.rkt" loadavg))

(define-live-region ticker
  #:swap morph
  #:stream loadavg)
```

What expands out is the exact HTML you read in the hand-wired version — attributes, nothing else:

```racket
(div ([id "ptable"] [hx-ext "sse"]
      [sse-connect "/events?stream=samples&v=1"]
      [sse-swap "procs-changed"] [hx-swap "morph"]
      [data-live-heartbeat "15"]) ...)

(a ([href "/p/4242"] [hx-get "/p/4242"]
    [hx-target "#ptable"] [hx-select "#ptable"]
    [hx-swap "morph"] [hx-push-url "true"]) "raco")
```

No new runtime. The macro's entire contribution is that the four conventions are now written ONCE each, and every other appearance is a reference the compiler resolves — or refuses:

```racket
(live-link ptabel (proc-href p) (proc-name p))
;; table.rkt:31:15: ptabel: unbound live region

(stream-send! samples 'procs-change html)
;; sampler.rkt:12:24: procs-change: not an event of samples
```

Both die at expansion, srcloc first, before a server boots. That error message IS the agent interface: a misinformed agent gets a file:line:col and a name, not a silently dead page.

And the two surfaces cannot collide: a `live-link` on `ptable` expands to `hx-target "#ptable"` and nothing else. A table link that rebuilds the ticker is not merely unwritten — it is unwritable.

## The questions, asked of the code

**Should each process row be a region?** Tempting — rows are what actually change, and the kill race raises the stakes: sorted by CPU, rows reorder every second, and the row you are about to act on must stay the same PROCESS, not the same position. But look at what the two concepts do in the expansion: the REGION is the swap target, the unit a link or event replaces (`#ptable`). What preserves a row's identity across that swap is morph, and morph needs only a stable `id` on each row — the PID. Declaring per-row regions would complect the two. Resolved: a region is one element; stable per-row ids are an obligation the consumer contract states, not a declaration — the framework cannot check what `proc-row` emits without becoming the renderer.

**Where does `define-stream samples` go — a central registry.rkt?** Follow the `require` line in table.rkt: the module graph already IS the registry. The producer defines and provides; drawers require; the compiler resolves the name or fails. A registry module would reintroduce the disease one level up — agents agreeing about registry keys instead of id strings. Precedent in this house decides it anyway: `define-style` lives with the module that draws. Resolved: streams live with their producer (samples in sampler.rkt, loadavg in loadavg.rkt), regions with their drawer.

**Should `define-live-region` generate the JavaScript?** The watchdog that flags a frozen table when heartbeats stop has to run client-side, so the temptation is a macro that emits JS. But the expansion above already shows the answer: `data-live-heartbeat "15"` is DATA on the DOM, and one generic, vendored, hand-written client file reads it — the same bet htmx itself makes (HTML is the interface). Resolved: declarations expand to attributes only; no DSL emits JavaScript. This is also what keeps the client reusable by any consumer app.

**A tab loaded yesterday's ptop; the server now speaks v2. Then what?** For a monitoring page this consumer is the rule, not the edge — the tab stays open for weeks. Racket-side, evolution is already safe: delete `procs-changed` from `#:events` while table.rkt still references it and expansion fails. But a browser tab is a consumer OUTSIDE the module graph — the compiler cannot see it. So the version travels on the wire: `#:version 1` is stamped into the connect URL (`/events?stream=samples&v=1`), and a v2 server answering a v1 connect sends one mismatch frame telling the tab to hard-reload. Resolved: define-stream owns the version, the wire enforces it, stale tabs self-heal on reconnect — which quietly fixes deploy-time skew, a glitch nobody had even listed.

**Still open, recalibrated: will the swarm extend it?** The post's endgame is abstractions agents GENERATE for their own use. [One paper](https://arxiv.org/abs/2506.10021) says a Lisp is the natural medium for that — conceptual framework, zero experiments. The measured record ([agents-and-dsls.md](agents-and-dsls.md), conclusion 8) says otherwise: LLM-authored abstraction libraries deliver nothing where human-curated ones deliver plenty, and LLMs apply stable abstractions well while discovering them badly. So the test splits in two. Third live surface: does the agent reach for `define-live-region` unprompted? Expect yes. Uncovered convention: does it propose a form for a human to ratify? Maybe. Autonomous grammar growth: don't design for it.

## What the research says, applied here

The measured record on LLM agents and custom DSLs lives in its own doc — [agents-and-dsls.md](agents-and-dsls.md), eleven conclusions with the evidence in footnotes — because it applies to any DSL this house might grow, not just this one. What each conclusion means for THIS design:

1. *The prior fights you* → the vocabulary stays at three macros, and the Racket baseline gets taught separately — the repo is adopting [racket-skills SKILL.md](https://tangled.org/notjack.space/racket-skills/blob/main/racket/SKILL.md).
2. *The cost is the compile loop* → ours measures fast (2026-08: ~5 s no-op `just build`, ~8 s edit to 263 green tests, ~13 s worst-case clean rebuild), and DSL checks run at expansion, inside that loop. Also: hand-writing raw htmx attributes must never be easier than using the macros, or agents will route around them.
3. *Teach with grammar plus worked examples* → each macro's docs carry its mini-grammar; `live/README.md` gains a grammar section; ptop graduates from this doc into a runnable `live/examples/ptop/`, built by CI like `examples/` — a worked example that cannot go stale. The thin expansion is itself this channel: the macros expand to plain htmx attributes, vocabulary the model already knows.
4. *Errors explain, not point* → the message format becomes a tested contract, like srcloc fidelity already is: rule name, offending form quoted, candidates in scope, a did-you-mean. The failure examples earlier in this doc are too terse; the checker should say:

    ```racket
    (live-link ptabel (proc-href p) (proc-name p))
    ;; table.rkt:31:15: ptabel: unbound live region
    ;;   live-link's first argument must be a region bound by define-live-region
    ;;   regions in scope in this module: ptable (defined at table.rkt:14)
    ;;   did you mean: ptable?
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

Substitute names: `ptable` is `#ol-live`, `samples` is `outline-events` in `web/watch.rkt`, `proc-link` is every sidebar, crumb, and permalink the renderer draws — and the `ticker` is the chat panel: the second live surface a navigation must not rebuild. The sidebar-click that rebuilt the chat was the bug that started this doc; declared, it is unwritable. `serve.rkt` requires both drawers; the module graph wires the rest.

The in-flight live-view PR ships the functional core. The DSL is a possible second PR, judged then by the same lenses: build it only if the declarations CHECK something a swarm actually trips on.
