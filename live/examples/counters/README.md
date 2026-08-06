# counters

The hello-world of live pages: one page, two live surfaces, dumb data.

Three counters — alpha, beta, gamma — race on the server at seeded random
rates, listed sorted by value, so the rows reorder twice a second. A clock
ticks in the header off its own producer. Neither surface can touch the other,
and the input box between them keeps whatever you were typing through all of
it.

It is wired BY HAND against `live/`'s functional API — no macros, no helper
layer, nothing between the example and the framework. That is the point: the
[DSL brainstorm](../../../docs/brainstorming/live-dsl.md) proposes replacing
these string conventions with declarations, and the case for that has to be
read off working code.

## Run it

```bash
just counters                        # http://127.0.0.1:8080
just counters run --port 9000        # somewhere else
nix run .#counters                   # the built program, no dev shell
just counters::test                  # its own test
```

## Where it lives

Everything the example is — its five modules, its test, its `just` module, its
nix derivation — is in this directory, and the repo mounts it in three lines:
`mod counters` in the justfile, a `callPackage` in `flake.nix`, and two nodes
in `ci/mod.just` that say when to run its test and build its derivation.

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
* **Start it again.** The light clears and the list catches up in one re-fetch
  — of the NEW process's counters, which start over from zero. That the tab
  knows it is behind at all is `live-boot-id` in the cursor: a bump count alone
  would have said "7" both times.
* **Read the stream by hand.**

  ```bash
  curl -N localhost:8080/events
  curl -N -H 'Last-Event-ID: nope' localhost:8080/events   # owed one frame
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
name, swap mode, events URL — and eight for the two here. Every one of them is
marked in the source with a comment naming its other end. What the count looks
like once `live/`'s functions are doing the work:

* **Region id.** Written once, in the view. `live/client` derives `#clist` for
  the swap target, the select and every link built from that view, so the three
  spellings the brainstorm's raw-htmx sketch has are one string. Its remaining
  other end is the stylesheet.
* **Event name.** Still two spellings in two files, and nothing checks them:
  `counters.rkt` broadcasts `counts-changed`, `list.rkt` names it in the view.
  Misspell either and the counters silently freeze.
* **Swap mode.** Gone as an agreement. The region and its links take
  `morph:outerHTML` from the same value; a link that repaints what an event
  morphs is unwritable through this API.
* **Events URL.** Still two spellings: `"/events"` in each view, and the route
  in `app.rkt`.

So the functional API already closes half of it, and the half it closes is the
half that caused olai's bug. What is left for a DSL is the two NAMES — plus a
ninth agreement the brainstorm did not count, and this example hit on the first
page it drew: `live/client` puts `hx-history-elt` on every region, htmx honours
the first one in the document, and a page with two regions has to decide which.
The ticker yields (`without-history`, `header.rkt`), or Back restores the clock
and leaves the list showing the counter you navigated away from.

## Reading it

Five files, no cleverness, plain `provide` rather than `contract-out`: these
are module boundaries with exactly one consumer, and the framework underneath
them is contracted at every edge. Everything the browser does is in the four
attribute sets `live/client` writes — `view-source` on the page and the
expansion the brainstorm sketches is right there.

`tests/counters.rkt` boots all of it on an ephemeral port: the page serves,
both surfaces deliver a frame on the one stream, a client that says it has
been away is caught up, and the two regions keep their promises to each other.
It lives here rather than in `live/tests/` because the example consumes the
framework, and a framework test that reached back the other way would invert
the dependency this is here to show.
