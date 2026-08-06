# counters

The hello-world of live pages: one page, two live surfaces, dumb data.

Three counters — alpha, beta, gamma — race on the server at seeded random
rates, listed sorted by value, so the rows reorder twice a second. A clock
ticks in the header off its own producer. Neither surface can touch the other,
and the input box between them keeps whatever you were typing through all of
it.

It is wired with `live/dsl`'s forms — a stream declared where it is produced, a
region declared where it is drawn, and no name spelled twice anywhere. It was
built hand-wired first, against the functional API and nothing else, which is
why its test can assert that the declared version emits exactly what the
hand-wired one did. The [DSL brainstorm](../../../docs/brainstorming/live-dsl.md)
is the argument; this directory is the answer.

## Run it

```bash
nix run .#counters                   # http://127.0.0.1:8080
nix run .#counters -- --port 9000    # somewhere else
```

That is the whole interface. There is no `just` recipe to run it: the example
is a package, and running a package is `nix run`.

## Where it lives

Everything the example is — its five modules, its test, its nix derivation and
the two commands CI runs against it (`mod.just`) — is in this directory. Two
lines outside it know the example exists: a `callPackage` in `flake.nix`, which
is what makes `nix run .#counters` a thing, and a mount in `ci/mod.just`, which
runs the test and builds the derivation on every commit. The root justfile
knows nothing about it.

It is a directory under `live/` and no part of that package. `live`'s source
(`live/default.nix`) excludes `examples/`, so the framework ships without the
demo and an edit here rebuilds neither `live` nor olai. The one thing it
cannot be is its own **raco** package: raco refuses to link a package inside
another package's directory, so in the source tree these files compile with
`live` — which is also what makes `just build` catch a broken example.

## What to try

* **Watch the rows reorder.** Select a row's text, or Tab to its link. It stays
  with the counter, not with the position: rows are keyed `row-<name>` and
  morph matches by id before anything else.
* **Type in the box, then click a counter.** The address changes, the region
  under it becomes that counter's detail, and the half-typed text is untouched.
  It sits outside both regions; nothing swaps it.
* **Watch the ticker while you navigate.** It must not so much as flinch. This
  is the whole acceptance criterion — the stand-in for olai's
  sidebar-rebuilds-chat bug.
* **Kill the server.** The health light goes `reconnecting...` and then, five
  seconds later, `stale`. The list freezes at its last known values.
* **Start it again.** The tab reloads itself. Its stream address names the
  process that drew it — `/live/<boot-id>/events` — and the new process
  answers a connect to an id it does not own with one frame that means reload.
  A restart is a new process even when it is the same code, so this is every
  restart, and it is the price of catching the deploy that renames an event.
  (Kill it and start it on a DIFFERENT port and the tab stays stale forever:
  nothing is answering, which is the state the health light is for.)
* **Read the stream by hand.** The address holds a boot id, so the process
  prints it on the way up:

  ```bash
  curl -N localhost:8080/live/<boot-id>/events
  curl -N -H 'Last-Event-ID: nope' localhost:8080/live/<boot-id>/events  # owed one frame
  curl -N localhost:8080/live/yesterday/events                # one reload frame, then EOF
  ```

## The files, and the agreements between them

| file | role |
|---|---|
| `counters.rkt` | producer: the three counters, and what their ids mean |
| `clock.rkt` | producer: the wall clock, its own event, its own cadence |
| `list.rkt` | drawer: the `clist` region, as a list and as one counter |
| `header.rkt` | drawer: the `ticker` region, the input box, the health light |
| `app.rkt` | routes, the hub both producers push onto, the page shell |

The brainstorm counts four cross-file agreements per surface — region id, event
name, swap mode, events URL — and eight for the two here. What each of them is
now:

* **Region id.** A binding. `(define-live-region clist #:stream counts)` in
  `list.rkt` mints the id, the selector, the swap target and every link from
  the declared NAME, and `live-item` mints the row ids under it. No id string
  is written in that file at all. Its one remaining other end is the
  stylesheet in `app.rkt` (`#clist`), which is CSS and not htmx.
* **Event name.** A binding. `counters.rkt` declares `#:events
  (counts-changed)` and `list.rkt` requires `counts`; the name is spelled once
  and `count-changed` does not compile.
* **Swap mode.** Gone as an agreement, and gone before the forms: the region
  and its links take `morph:outerHTML` from the same value in `live/client`.
  A link that repaints what an event morphs is unwritable.
* **Events URL.** The transport's, not the app's. `live-connect` puts
  `live-stream-path` on the page and `app.rkt` matches
  `("live" (string-arg) "events")` — the one shape still written on both
  sides, and the test opens the URL out of the page's own markup rather than
  rebuilding it.

The ninth agreement, which the brainstorm did not count and this example hit on
the first page it drew: `live/client` puts `hx-history-elt` on every region,
htmx honours the first one in the document, and a page with two regions has to
decide which. Hand-wired, the ticker filtered the attribute back out. Declared,
it says `#:history? #f` — a gap proposed, ratified, and turned into vocabulary,
which is the process the ban in [live/README.md](../../README.md) exists to
force.

## Reading it

Five files, no cleverness, plain `provide` rather than `contract-out`: these
are module boundaries with exactly one consumer, and the framework underneath
them is contracted at every edge. Everything the browser does is in the four
attribute sets `live/client` writes — `view-source` on the page, or

```bash
just expand live/examples/counters/list.rkt
```

for the same thing one level up, every form beside the call it became.

`tests/counters.rkt` boots all of it on an ephemeral port: the page serves,
both surfaces deliver a frame on the one stream, a client that says it has
been away is caught up, and the two regions keep their promises to each other.
It lives here rather than in `live/tests/` because the example consumes the
framework, and a framework test that reached back the other way would invert
the dependency this is here to show.
