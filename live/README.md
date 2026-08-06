# live

Live views for Racket web apps: a server-sent-events hub with reconnect catch-up, and a browser runtime that morphs updates in instead of replacing markup.

Server renders HTML. Something changes. Every open page follows, without a reload and without losing where the reader was.

No JSON protocol, no client-side router, no build step. Your app keeps rendering HTML; this decides what gets re-fetched and how it lands.

## The disease

DOM that did not change is replaced anyway.

Click a link and the browser rebuilds the whole page — including the sidebar it was already showing and the panel someone was typing into. Push an update and the app swaps a container wholesale, throwing away scroll position, text selection, focus and running CSS transitions along with the markup that happened to be identical.

Both are the same mistake at different scales. Both have the same fix: fetch only the region that moved, and MORPH it onto what is there.

## The model

Four ideas, and they compose:

**Region.** One element on the page re-fetches its own URL and lifts itself back out of the reply. Everything outside it — chrome, panels, sidebars — is never rebuilt, by construction rather than by care.

**Stream.** One SSE connection per page. The server pushes an event name; the region hears it and re-fetches. The payload is a notification, never content: one handler serves the first render and every update, so there is no second renderer to keep in step.

**Morph.** Updates land through [idiomorph](https://github.com/bigskysoftware/idiomorph), which walks the new markup against the old and touches only what differs. That is what makes scroll, selection, focus and transitions survive an update that did not concern them.

**Cursor.** Every frame may carry an id. The last id a client saw comes back — in the browser's `Last-Event-ID` header on a reconnect, or in the stream's URL for a page's first connection — and your app answers one question: *what did this client miss?* That is the whole reconnect story. A laptop that slept, a suspended phone tab, a server that restarted: all the same question.

The framework never interprets an id. It is an opaque string, and what it MEANS is yours.

**Boot id.** The one skew a cursor cannot see is a page drawn by a different BUILD: a deploy that renames an event leaves yesterday's tab holding a connection that is open, beating, healthy-looking and subscribed to a name nobody sends any more. Both ends are behaving, so neither can notice. So the server's identity rides the address the client connects to — `/live/<boot-id>/events`, which is `live-stream-path` — and a connect naming another process is answered with one frame that means reload (`live-reload-response`), never an HTTP error. Same-code restarts reload every open tab too; that is the price and it is paid on purpose.

The forms put that address on a page for you. `make-live-view` still takes whatever string you hand it, so a consumer that mounts its stream somewhere else keeps working and gives up this one check.

## Install

Not on the package catalog. Vendor it, or link it:

```bash
raco pkg install --link path/to/live
```

Deps: `base`, `web-server-lib`. `rackunit-lib` to run the tests.

Three of the four files under `static/` are pinned upstream rather than committed (see [Vendored assets](#vendored-assets)); in this repo `just vendor` stages them from `live/default.nix`. A consumer taking the collection some other way has to put htmx, its SSE extension and idiomorph-ext into `static/` under the names `live-scripts` lists, or serve them itself and skip `live-script-hrefs`.

## Usage

Three things to wire: mount the assets, put the attributes on the page, answer the stream.

```racket
#lang racket/base
(require web-server/servlet-env
         live/client live/frame live/hub)

;; What your app's live view is called. Every name in it is yours. It is a
;; PER-PAGE value: `href` is the page being drawn and `cursor` is the state it
;; was drawn from.
(define (view-for href cursor)
  (make-live-view #:region "app"              ; the element that redraws itself
                  #:event  "changed"          ; "this region is behind"
                  #:stream live-stream-path   ; where the stream lives
                  #:href   href               ; what the region re-fetches
                  #:cursor cursor))       ; what THIS page was rendered at

(define hub (make-hub))

;; Your app's notion of "what state is this". Anything, as long as two
;; different states are two different strings — see the contract below.
(define state (box (string-append live-boot-id ".0")))

(define (page req)
  (define live (view-for "/" (unbox state)))
  (response/xexpr
   `(html (head ,@(for/list ([src (live-script-hrefs "/live/")])
                    `(script ((src ,src) (defer "defer")))))
          (body ,(live-connect-attributes live)
                (div ,(live-region-attributes live)
                     ;; ...whatever the region shows...
                     )
                (a ,(live-link-attributes live "/other") "elsewhere")))))

;; The stream: what this connection missed, then live from there. Mounted at
;; /live/<boot>/events, and a request naming some OTHER process is answered
;; rather than refused — EventSource hides an HTTP status from the page and
;; retries a refusal forever.
(define (events req boot)
  (cond
    [(not (live-boot-current? boot)) (live-reload-response)]
    [else
     (hub-response
      hub
      #:last-event-id (request-last-event-id req)
      #:catch-up (λ (last-id subscribe!)
                   (subscribe!)
                   (if (equal? last-id (unbox state))
                       '()
                       (list (make-frame "changed" (unbox state) #:id (unbox state))))))]))

;; And when something changes, say so.
(define (changed!)
  (set-box! state (next-state))
  (hub-broadcast! hub (make-frame "changed" (unbox state) #:id (unbox state))))
```

Serve `(live-static-dir)` at whatever prefix you passed to `live-script-hrefs`. That directory holds htmx, its SSE extension, idiomorph and this framework's own runtime — four files, vendored, no CDN, no inline script, so a strict CSP is satisfied by a nonce or a hash on nothing at all.

## A worked example

[`examples/counters`](examples/counters/README.md) is the whole model on one
page: two live surfaces (a list that reorders under you, a clock in the header
that a navigation must not rebuild), two producers, one stream, and an input
box that keeps what you typed through every swap. Five short files, declared
with the forms below — and its test asserts that what they emit is what the
hand-wired version emitted. `nix run .#counters` runs it, and it carries that
test.

It is not part of this collection: `examples/` is not in the source this
package is built from (`default.nix`), so installing `live` never carries the
demo, and editing the demo never rebuilds `live`. It shares the directory
because raco will not link a package inside another package's directory —
nothing else.

## The forms

`live/dsl` is the same live view, declared instead of agreed. The functions above are complete without it; what they cannot do is check the COINCIDENCES between them.

Count them on a page wired by hand. The region's id, spelled in the drawer and again in every link that targets it. The event name, spelled by the producer that broadcasts it and again by the drawer that triggers on it. The id on a row, spelled by whoever remembered. Each is one string that has to be the same string in two files, and the compiler sees two unrelated literals. Misspell one and nothing fails: the page renders, the stream connects, and a region silently stops moving. That failure is a browser away — which is the one place a coding agent cannot look.

So: write each name once, as a declaration, and let every other appearance be a reference the expander resolves — or refuses.

### The grammar

```text
;; the producer's end
(define-stream name #:events (event-name ...+) [#:heartbeat seconds])
(stream-frame stream 'event data [#:id id])                          -> frame?
(stream-heartbeat stream)                                            -> seconds

;; the drawer's end
(define-live-region name #:stream stream [#:event event-name] [#:history? bool])
(live-connect stream ...+ [#:cursor cursor])                         -> attributes
(live-region region #:href href)                                     -> attributes
(live-link region href)                                              -> attributes
(live-item region tag key body ...)                                  -> xexpr
```

* **`define-stream`** declares a stream's vocabulary, in the module that PRODUCES it. The events are the complete set of names anything may send on it or trigger from it, and the list is append-only: removing one is an expansion error at every use until the last of them is gone. `#:heartbeat` is the cadence in seconds, read back by `stream-heartbeat` where the app answers the stream — a page has one connection and every event name rides it, so declare the beat on the stream the app answers with and leave it off the others.
* **`stream-frame`** is `make-frame` with the event checked against the declaration. A frame rather than a send, because a frame is what both places want: one goes to `hub-broadcast!` when something moves, and the same one goes to the connection that missed it in `#:catch-up`.
* **`define-live-region`** declares the region a module DRAWS. The name IS the element id, so the selector, the target, the swap and every link derive from one line. `#:event` says which of the stream's events redraws it, and may be left out when the stream declares exactly one — with two or more, leaving it out is an error rather than a guess. `#:history?` is the page-global decision htmx forces (it honours the FIRST history element in the document): with two regions on a page, one of them must yield or Back restores the wrong one.
* **`live-connect`** is the page's connection, for an ancestor of every region and link on it. It names every stream riding it and takes the cursor the markup was drawn from. The address is the transport's, not the app's — see **Boot id** above.
* **`live-region`**, **`live-link`** and **`live-item`** are the three places a name would otherwise be retyped. A link names the region it aims at, which is what makes a link into the wrong surface unwritable rather than merely unwritten; an item's id is MINTED from its region and a key, because a written id is an obligation a drawer can forget and a forgotten one fails by preserving nothing rather than by failing.

### Declared, end to end

```racket
;; counters.rkt — the PRODUCER owns the vocabulary
(define-stream counts #:events (counts-changed) #:heartbeat 15)
(hub-broadcast! hub (stream-frame counts 'counts-changed cursor #:id cursor))

;; list.rkt — the DRAWER owns the region
(require (only-in "counters.rkt" counts))
(define-live-region clist #:stream counts)

(define (row c)
  (live-item clist li (counter-name c)
    `(a (,@(live-link clist (counter-href c))) ,(counter-name c))))

(define (render href cs)
  `(div (,@(live-region clist #:href href))
        (ol ,@(map row cs))))

;; app.rkt — the page, and the one route whose shape the transport owns
(body (,@(live-connect counts clock #:cursor cursor)) ...)

[("live" (string-arg) "events")
 (λ (req boot)
   (if (live-boot-current? boot)
       (hub-response hub
                     #:last-event-id (request-last-event-id req)
                     #:heartbeat-seconds (stream-heartbeat counts)
                     #:catch-up (λ (last-id subscribe!) ...))
       (live-reload-response)))]
```

Not one string agreed between two files. [`examples/counters`](examples/counters/README.md) is that, running, with a second surface beside it.

Two rules shaped all of it. **Thin**: every form expands into a call on the functions above and nothing else — no runtime of its own, no state, and no generated JavaScript. A consumer who does not want the sugar calls `make-live-view` directly and loses only the checks. **No form without a check**: sugar for terseness alone is a convention wearing a uniform, and it rots like one. Each form earns its place by refusing a specific misspelling.

### The refusal

The error is the interface. Source location of the offending form first, then the rule it broke, then what IS in scope, then a guess:

```text
list.rkt:31:26: clsit: unbound live region
  live-link's first argument must be a region bound by define-live-region
  regions in scope in this module: clist (declared at list.rkt:14:20)
  did you mean: clist?
```

Longer than you would write for a human, on purpose. Every line of that format is a test in `live/tests/dsl.rkt`, srclocs included.

### Seeing through them

```bash
just expand live/examples/counters/list.rkt
```

Every live form in the file, beside what it became — one level, the macro's own output, before the expander went on to rewrite it into core syntax. A macro that cannot be looked through is a macro you debug by guessing, so the dump is interface and not a debugging convenience. (`live/expand` is the module; `live-form-expansions` is the same thing as a function.)

### Raw htmx attributes are banned

The attributes a live view is made of — `hx-get`, `hx-select`, `hx-push-url`, `hx-history-elt`, `sse-connect`, `sse-swap`, and the `hx-target` and `hx-swap` that go with them — are the forms' output in app code and nobody else's. Writing one by hand, or filtering one back out of what a form produced, fails review. Consumers outside this repo have the documented functions instead; both doors are checked, and neither is a hand-written attribute.

Writes are the exception, and this framework already named it: it says nothing about forms and mutations (see [What it does not do](#what-it-does-not-do)). An `hx-post` and the target and swap that belong to it are ordinary htmx and none of this rule's business. What the rule covers is everything that DRAWS or NAVIGATES a region.

A gap in the vocabulary is not a licence to hack around it. It is proposed to the human, ratified, and then it is a form — which is how `#:history?` got here: the counters example hit htmx's one-history-element rule, filtered the attribute back out by hand, and flagged it as unsayable. The vocabulary stays tiny and human-curated for the same reason; an abstraction library nobody prunes sinks below having none.

## The contract

### What your app provides

* **A cursor**: a string naming the state a page was rendered at. Any two different states must be different strings. A counter is not enough on its own — one that restarts with the process names two different states "3", and every client that reconnects across a restart is then told it is up to date when it is not. `live-boot-id` is the answer: a string this process alone will use, so `(string-append live-boot-id "." n)` holds the property. A state that is already globally unique — a commit hash, a ULID, a log offset — needs nothing.
* **An answer to "what did this client miss?"**: the `#:catch-up` procedure. It is handed the client's last id and a `subscribe!` thunk, and returns the frames this one connection is owed. Call `subscribe!` inside whatever lock makes your answer consistent; then nothing can fall between reading your state and joining the broadcast.
* **Stable element ids**: the region's, and ideally the things inside it. Idiomorph matches old to new by id first. Markup that re-keys itself on every render will morph correctly and preserve nothing.
* **One handler that renders the region**: the region re-fetches its own address and selects itself out of the reply, so the page's own URL has to answer with a page containing that region. There is no separate fragment endpoint to keep in step.

### What you get

* Updates that land without disturbing scroll, selection, focus or transitions.
* Navigation that does not rebuild the page, with the plain `href` intact — no-JS, middle-click and copy-link all still work — and Back and Forward restoring the region rather than the chrome around it.
* Reconnect catch-up: a connection that comes back says where it was, and your `#:catch-up` says what that owes it. This covers sleep, tab suspension, network blips and server restarts with no client code.
* A health signal: the runtime writes `live-connecting` or `live-stale` on `<html>`, and neither when the stream is fine.
* One way to hear a named event whose payload is not markup: `live.on(name, fn)` in the browser, handed the frame's data as a string. The page has one stream and everything rides it, so a panel that draws its own JSON does not need — and must not open — a second EventSource.

### What it does not do

* **It ships no CSS.** The health states are class names; what they look like is your app's, and a framework with opinions about that is a framework you have to undo. `live-connecting-class` and `live-stale-class` are exported so your stylesheet spells a binding rather than a literal.
* **It does not reconnect for you.** EventSource does that, and the stream tells it how soon (`retry:`). What the runtime adds is noticing: a heartbeat carries its own cadence, and a beat that does not arrive is how a half-open socket — one that looks connected and is not — becomes `live-stale` instead of looking like a quiet afternoon. A socket that never errors is REPORTED, not forced; the browser owns the connection and this owns the story about it.
* **It is not a component model.** There is no client state, no reactivity, no diffing of your data. The server renders HTML; this decides what to re-fetch and how it lands.
* **It does not multiplex.** One page, one stream, and every event name rides it — the region swaps on one name, `live.on` hears any of the others. Two EventSources to the same origin is a browser connection limit waiting to happen, and two stories about health.
* **It says nothing about writes.** This is a push channel. Forms, mutations and their responses are ordinary htmx, or ordinary anything.

## The modules

| module | what is in it |
|---|---|
| `live/frame` | the wire format: a frame is a name, a payload and maybe an id. Plus everything both ends agree on — the cursor's query parameter, the beat's cadence, this process's boot id and the stream address it rides in. |
| `live/hub` | fan-out, heartbeat, the streaming response, reading a client's cursor off a request, and the one-frame answer to a connect nobody is answering for. |
| `live/client` | what a page wears (three attribute sets), what the runtime writes back (two class names), how a thing inside a region is identified, and where the assets are. |
| `live/dsl` | the forms. Sugar over the two above, and a checker over the names between them. |
| `live/expand` | what the forms in a file expand to (`just expand FILE`). |

`hub` and `client` are the two ENDS — one reads requests, one writes markup — and neither requires the other; what they agree on is in `frame`. `dsl` sits above both and is required by neither. Everything is `contract-out`. No module here knows anything about any application.

One caveat worth knowing before you adopt it: the runtime sets `htmx.config.historyCacheSize = 0`, so Back and Forward re-fetch the region instead of restoring a cached snapshot of it. That is the right policy for a page whose whole premise is that the server changes under it, and it is a global htmx setting — if your app depends on htmx's history cache elsewhere, that is the one thing here that will surprise you.

## Frames on the wire

```text
retry: 1000

event: live:hb
data: 15

id: 42
event: changed
data: 42
```

* `retry:` opens the stream — the reconnect delay, so a drop before the first beat still comes back promptly.
* `live:hb` is the heartbeat. A real event and not a comment: a comment keeps a proxy from timing the connection out but is invisible to EventSource, and a client that cannot see the beat cannot notice it stopping. The payload is the cadence in seconds, so the watchdog on the other end is sized by the stream instead of by a number copied into a script.
* `live:reload` is the only other frame the transport sends on its own behalf, and it is the whole of `live-reload-response`: a connect naming a boot id this process does not answer to gets one of these and then the end of the stream. The payload is the boot id this server DOES answer to, so a stream read by hand says which two processes disagreed. The runtime hard-reloads on it — what is stale is the document, not the region's content.
* Everything else is yours. `id:` moves the client's cursor; a frame without one leaves it alone, which is what you want for anything that is not a checkpoint.

The stream's address is `/live/<boot-id>/events` — `live-stream-path`, and the reason is under **Boot id** above. A page's first connection has no `Last-Event-ID` to send, so the cursor in `live-view` goes in that URL as `?last-event-id=…`. `request-last-event-id` reads the header first and falls back to that, which closes the window between rendering a page and its EventSource connecting — a window in which an update is broadcast to a connection that does not exist yet, and after which the page would look live forever while showing pre-update markup.

## Vendored assets

Four files under `live/static/`, all served as-is. One of them is ours; the other three are pinned upstream checkouts, staged in by `live/default.nix`.

| file | source | license |
|---|---|---|
| `htmx.min.js` | [htmx](https://htmx.org) `dist/htmx.min.js` | BSD-2-Clause |
| `sse.js` | [htmx-extensions](https://github.com/bigskysoftware/htmx-extensions) `src/sse/sse.js` — the SSE extension moved out of the htmx repo for 2.x, and is unversioned, so it is pinned by revision | BSD-2-Clause |
| `idiomorph.min.js` | [idiomorph](https://github.com/bigskysoftware/idiomorph) `dist/idiomorph-ext.min.js` — the bundle that also registers the htmx extension, NOT plain `idiomorph` | BSD-2-Clause |
| `live.js` | this framework, and the only tracked file of the four | AGPL-3.0-or-later |

Vendored rather than pulled from a CDN at runtime: a live view that needs somebody else's DNS is a live view that stops working when that DNS does. But pinned rather than committed as blobs — the versions and their hashes are in `npins/sources.json`, so "which htmx is this" has an answer that cannot drift from the bytes. The three are gitignored and staged into place by `just vendor`; `live.js` is source.

Upgrading is `npins update idiomorph` (or `htmx`, or `htmx-extensions`), then `just test && just e2e`. The diff is a revision and a hash rather than 10,000 columns of unreviewable minified JavaScript. If an upgrade renames an artifact, the new name is not in `.gitignore` and shows up as untracked — which is the reminder to update the table above and the `assets` list in `live/default.nix`.

## Tests

```bash
raco test live/tests/*.rkt
```

Including the two things nothing else would catch. The border between this collection's languages: the heartbeat's name, the reload event, the default cadence, the two state classes and the runtime's own entry point are spelled in Racket and again in `live.js`, and `live/tests/client.rkt` is what keeps them the same words. And the error contract: `live/tests/dsl.rkt` asserts each refusal line by line, srclocs included, because a message that quietly lost its candidate list would still pass an "it raised something" test.

## License

AGPL-3.0-or-later.
