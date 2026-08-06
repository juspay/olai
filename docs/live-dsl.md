# live: a declare-and-check DSL (brainstorm)

Status: brainstorm. Nothing here is built. The live-view framework (worktree `live-view`, in flight) ships functions + contracts first; this doc asks what a macro layer on top would buy — and for whom.

Context: [The Bottlenecks for AI-Driven System Design](https://maheshba.bitbucket.io/blog/2026/07/22/agentdesign.html). Agents are not bottlenecked on correctness or codegen; they are bottlenecked on evolution (changing a system safely), frangibility (you cannot learn by breaking production), and entropy (many agents with partial context accumulate special cases faster than any one of them can see). The remedy the post names: abstractions that let agents reason in a precise language instead of conventions. This repo is built by exactly such a swarm.

The whole argument fits in one toy app. Meet `scoreboard`.

## The toy, wired by hand

One page. A list of players and scores. When a score changes on the server, every open browser updates, live, without losing its scroll position. Clicking a player navigates to their page without rebuilding the board. This is htmx + SSE, the way olai's live view is wired today.

Three files:

```racket
;; scores.rkt — knows when scores change
(define (score! player n)
  (set-score! player n)
  (broadcast! hub 'score-changed (render-board)))

;; board.rkt — draws the page
(define (render-board)
  `(div ([id "board"] [hx-ext "sse"]
         [sse-connect "/events"]
         [sse-swap "score-changed"]
         [hx-swap "morph"])
     ,@(for/list ([p (players)]) (player-row p))))

(define (player-link p)
  `(a ([href ,(player-href p)] [hx-get ,(player-href p)]
       [hx-target "#board"] [hx-select "#board"]
       [hx-swap "morph"] [hx-push-url "true"])
     ,(player-name p)))

;; app.rkt — serves "/", "/p/<name>", and "/events" off the hub
```

It works. Now count the agreements that make it work — each one a pair of spellings in different files that nothing checks:

1. `"board"` the id, and `"#board"` twice over in every link.
2. `'score-changed` in scores.rkt, and `"score-changed"` in an attribute in board.rkt.
3. `"morph"` on the region, and `"morph"` again on every link that targets it — disagree and a click repaints what an event morphs.
4. `"/events"` in the attribute, and the route app.rkt actually serves.

Four conventions. Zero checkers. The compiler sees six string literals with nothing in common.

## How it breaks

Write `sse-swap "score-change"` — no error. The server compiles, the page renders, scores silently never update. Write `hx-target "#bord"` — no error; clicking a player now replaces the whole body. Every failure is runtime, in a browser, visible only to an eyeball that knows what SHOULD have happened.

Now put a swarm on it. Each agent arrives with partial context and must REDISCOVER the four conventions from source before touching anything. The post calls the result entropy: special cases and near-misses accumulating faster than any one agent can see. And the only net under them is the e2e suite — simulation, in the post's terms: expensive, late, and only as good as its scenario coverage. This is not hypothetical; olai's sidebar-rebuilds-chat bug was convention 3 misapplied, shipped green, and caught by a human.

Frangibility says what the fix must feel like: an agent cannot learn by breaking your browser session, so the feedback has to arrive before anything runs. The cheapest such feedback in Racket is expansion failure with a srcloc — already this repo's agent interface (`#lang olai` is a closed grammar with one checker; css-expr makes stylesheets checked s-expressions; CLAUDE.md holds tests to srcloc fidelity). The cure below is the same one, applied to the wiring.

## The toy, declared

Same three files. The conventions become bindings:

```racket
;; scores.rkt — the PRODUCER owns the stream vocabulary
(define-stream scores
  #:version 1
  #:events (score-changed)
  #:id revision            ; SSE id: field = a revision counter
  #:heartbeat 15)

(define (score! player n)
  (set-score! player n)
  (stream-send! scores 'score-changed (render-board)))

;; board.rkt — the DRAWER owns the region
(require (only-in "scores.rkt" scores))

(define-live-region board
  #:swap morph
  #:stream scores)

(define (render-board)
  (live-region board
    (for/list ([p (players)]) (player-row p))))

(define (player-link p)
  (live-link board (player-href p) (player-name p)))
```

What expands out is the exact HTML you read in the hand-wired version — attributes, nothing else:

```racket
(div ([id "board"] [hx-ext "sse"]
      [sse-connect "/events?stream=scores&v=1"]
      [sse-swap "score-changed"] [hx-swap "morph"]
      [data-live-heartbeat "15"]) ...)

(a ([href "/p/alice"] [hx-get "/p/alice"]
    [hx-target "#board"] [hx-select "#board"]
    [hx-swap "morph"] [hx-push-url "true"]) "alice")
```

No new runtime. The macro's entire contribution is that the four conventions are now written ONCE each, and every other appearance is a reference the compiler resolves — or refuses:

```racket
(live-link bord (player-href p) (player-name p))
;; board.rkt:31:15: bord: unbound live region

(stream-send! scores 'score-change html)
;; scores.rkt:12:24: score-change: not an event of scores
```

Both die at expansion, srcloc first, before a server boots. That error message IS the agent interface: a misinformed agent gets a file:line:col and a name, not a silently dead page.

## The questions, asked of the code

**Should `player-row` be a region too?** It's tempting — rows are what actually change. But look at what the two concepts do in the expansion: the REGION is the swap target, the unit a link or event replaces (`#board`). What keeps a row's identity across that swap is morph, and morph needs only a stable `id` on each row. Declaring per-row regions would complect the two. Resolved: a region is one element; stable per-row ids are an obligation the consumer contract states, not a declaration — the framework cannot check what `player-row` emits without becoming the renderer.

**Where does `define-stream scores` go — a central registry.rkt?** Follow the `require` line in board.rkt: the module graph already IS the registry. The producer defines and provides; drawers require; the compiler resolves the name or fails. A registry module would reintroduce the disease one level up — agents agreeing about registry keys instead of id strings. Precedent in this house decides it anyway: `define-style` lives with the module that draws. Resolved: streams live with their producer, regions with their drawer.

**Should `define-live-region` generate the JavaScript?** The watchdog that flags a stale board when heartbeats stop has to run client-side, so the temptation is a macro that emits JS. But the expansion above already shows the answer: `data-live-heartbeat "15"` is DATA on the DOM, and one generic, vendored, hand-written client file reads it — the same bet htmx itself makes (HTML is the interface). Resolved: declarations expand to attributes only; no DSL emits JavaScript. This is also what keeps the client reusable by any consumer app.

**A tab loaded yesterday's board; the server now speaks v2. Then what?** Racket-side, evolution is already safe: delete `score-changed` from `#:events` while board.rkt still references it and expansion fails. But a browser tab is a consumer OUTSIDE the module graph — the compiler cannot see it. So the version travels on the wire: `#:version 1` is stamped into the connect URL (`/events?stream=scores&v=1`), and a v2 server answering a v1 connect sends one mismatch frame telling the tab to hard-reload. Resolved: define-stream owns the version, the wire enforces it, stale tabs self-heal on reconnect — which quietly fixes deploy-time skew, a glitch nobody had even listed.

**Still open, on purpose: will the swarm extend it?** The post's endgame is abstractions agents GENERATE for their own use. The test is empirical: when an agent adds scoreboard's third live surface — say a spectator-count badge — does it write `define-live-region` unprompted? And when it hits a convention these forms don't cover, does it extend the grammar, or scatter strings? Declarations are data; an agent that keeps tripping on a convention could propose the next declared-and-checked form. That is the DSL succeeding or failing at its actual job.

## The rules that fall out

- **Thin DSL over a functional core.** Every form expands into calls on a documented, contract-out'd runtime API. A consumer who doesn't want the sugar uses the functions; the forms can evolve without trapping them. The framework's reuse story rides the functions, not the forms.
- **No macro without a check.** Sugar for terseness alone is entropy wearing a uniform — it rots like a comment. Each form above earns its place by refusing a specific misspelling.
- **Macros own compile time, contracts own runtime.** Blame + srcloc already police the module boundary at runtime; the forms police names before it. Complementary, not competing.
- **Streams are one-way doors.** `#:events` is append-only and versioned like the JSON replies; removing an event is an expand-time error until every requirer is gone. Evolution pressure lands on one declaration site instead of a grep across three languages.

## And olai?

Substitute names: `board` is `#ol-live`, `scores` is `outline-events` in web/watch.rkt, `player-link` is every sidebar, crumb, and permalink the renderer draws — and the chat panel is the second consumer of the same three forms, riding the same hub. serve.rkt requires both drawers; the module graph wires the rest.

The in-flight live-view PR ships the functional core. The DSL is a possible second PR, judged then by the same lenses: build it only if the declarations CHECK something a swarm actually trips on.
