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
  (make-live-view #:region "app"          ; the element that redraws itself
                  #:event  "changed"      ; "this region is behind"
                  #:stream "/events"      ; where the stream lives
                  #:href   href           ; what the region re-fetches
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

;; The stream: what this connection missed, then live from there.
(define (events req)
  (hub-response
   hub
   #:last-event-id (request-last-event-id req)
   #:catch-up (λ (last-id subscribe!)
                (subscribe!)
                (if (equal? last-id (unbox state))
                    '()
                    (list (make-frame "changed" (unbox state) #:id (unbox state)))))))

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
box that keeps what you typed through every swap. Five short files, hand-wired
against the functions above and nothing else. `just counters` runs it;
`live/tests/counters.rkt` is what keeps it from rotting.

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
| `live/frame` | the wire format: a frame is a name, a payload and maybe an id. Pure, and the vocabulary both other modules share. |
| `live/hub` | fan-out, heartbeat, the streaming response, reading a client's cursor off a request. |
| `live/client` | what a page wears (three attribute sets), what the runtime writes back (two class names), and where the assets are. |

`hub` and `client` are the two ENDS — one reads requests, one writes markup — and neither requires the other; what they agree on is in `frame`. Everything is `contract-out`. No module here knows anything about any application.

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
* Everything else is yours. `id:` moves the client's cursor; a frame without one leaves it alone, which is what you want for anything that is not a checkpoint.

A page's first connection has no `Last-Event-ID` to send, so the cursor in `live-view` goes in the stream's URL as `?last-event-id=…`. `request-last-event-id` reads the header first and falls back to that, which closes the window between rendering a page and its EventSource connecting — a window in which an update is broadcast to a connection that does not exist yet, and after which the page would look live forever while showing pre-update markup.

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

Including the border a compiler cannot check: the heartbeat's name, the two state classes and the runtime's own entry point are spelled in Racket and again in `live.js`, and `live/tests/client.rkt` is what keeps them the same words.

## License

AGPL-3.0-or-later.
