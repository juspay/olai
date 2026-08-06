# The live view

What `olai serve` pushes, what a browser does with it, and the contract
between them. Read `live/README.md` first if you care about the
machinery — that is a framework of its own, and olai is its first
consumer. This file is what olai puts through it.

## The shape

```
$OLAI_HOME/*.rkt          the files
    |
olai/store                WHAT the outlines are      -> a revision per reload
    |
olai/web/watch            WHEN they moved            -> one callback
    |
olai/web/live             what a revision MEANS      -> a cursor, a frame
    |
live/hub                  WHO is listening           -> SSE, generic
    |
GET /events               the stream
    |
live/static/live.js       the browser's half
```

They meet in `olai/web/serve`, and nowhere else.

## GET /events

An `text/event-stream` that never ends. One per page — the chat panel
rides the same connection.

It opens with two things, always:

```
retry: 1000

event: live:hb
data: 15
```

`retry:` is how soon to come back after a drop. `live:hb` is the
heartbeat, repeated every 15 seconds, and its payload IS that cadence:
the client sizes its watchdog from the stream rather than from a number
copied into a script. It is a real event and not a comment because a
comment is invisible to `EventSource`, and a client that cannot see the
beat cannot notice it stopping.

Then, before anything live, whatever THIS connection missed (see
"catching up"). Then, as they happen:

| event | data | id |
|---|---|---|
| `outline` | the cursor the outlines are now at | the same cursor |
| `chat` | one JSON chat frame (see docs/cli.md) | none |

`outline` means "the region you are showing is behind" — never content.
The page re-fetches its own address, so one handler serves the first
render and every update.

`chat` carries no id on purpose. It is not a checkpoint: a client that
reconnects should be told the last state it can be BEHIND, and the
conversation is replayed in full on the way in regardless.

## The cursor

A cursor is an opaque string naming one state of one server:

```
1786025954450.7
└─ boot ─────┘ └ revision
```

The revision is `store-revision` — a counter that moves on every reload,
including a reload that FAILED (a file that just broke is a change every
reader has to see). The boot half is the server's start time in
milliseconds. Both halves are needed: a revision counts from one per
process, so `7` would name a different outline before and after a
restart, and every tab open across that restart would be told it was up
to date.

Nothing outside `olai/web/live` reads a cursor. To the transport it is a
string; to a client it is a token to hand back.

## Catching up

A connection is born mid-story. Two things say where it came in:

* `Last-Event-ID`, which `EventSource` sets on a reconnect.
* `?last-event-id=<cursor>` on the stream's URL, which the PAGE puts
  there — the cursor its markup was rendered at.

The header wins when both are present; it is the fresher answer. The
second exists because a page is rendered at one moment and its
`EventSource` connects at a later one: an edit landing in between is
broadcast to a connection that does not exist yet, and without the
page's own cursor the browser would have no id to be behind with.

The rule is one line: **a connection that says anything other than the
current cursor is owed one `outline` frame.** Not "older than" —
anything else. A cursor from a previous process, from another version,
from a proxy inventing headers: none of those can be ordered against
this one, and re-fetching is a cheap wrong answer where showing stale
content is an expensive one. A connection that says nothing at all is
owed nothing: it has seen nothing because there was nothing to see.

One frame, never a replay. The page re-fetches the current state, so the
revisions in between are states nobody needs to have been shown.

The conversation catches up the same way and on the same connection, in
the chat frames that built it (`olai/web/chat`).

## What the page does

Every page carries `sse-connect` on `<body>` and one live region,
`#ol-live`, holding the error banner slot and the outline pane. The
sidebar, the chat panel and the skin sit outside it and are never
rebuilt.

* **An `outline` event** makes `#ol-live` re-fetch the page's own
  address and morph the reply onto itself. Morph, not replace: scroll
  position, text selection, focus and running transitions survive an
  update that did not concern them.
* **A link** — sidebar tree, breadcrumb, bullet, Today, the brand —
  does the same fetch, aimed at the same region, and pushes the address.
  The plain `href` is still on it, so no-JS, middle-click and copy-link
  are unharmed. Back and Forward restore the region, not the page.
* **The stream's health** is one class on `<html>`, written by the
  framework's runtime: `live-connecting` while a drop is being
  reconnected, `live-stale` once it has been down long enough (five
  seconds after a drop the browser noticed; two and a half missed beats
  for a socket that stayed open and went quiet). Neither class is a
  healthy stream. `#ol-stream` is what those look like — "reconnecting…"
  and "showing last known state", the store's own last-good vocabulary.
  Catch-up clears it: the reconnect brings the content back and the
  class goes with it.

## Reading it by hand

```
curl -N localhost:8080/events
curl -N -H 'Last-Event-ID: 1786025954450.3' localhost:8080/events
```

The first is a fresh connection: heartbeats, and events as they happen.
The second is a browser claiming to have been away, and answers
immediately with the `outline` frame it is owed.

## Client assets

`/live/` is the framework's runtime — htmx, its SSE extension,
idiomorph, and the health watchdog — served from the `live` collection
and never edited here. `/static/` is olai's own: the collapse, prefs,
chat and PWA scripts, the icons, the manifest. The generated stylesheet
is `/static/app.css` and is not a file at all (`olai/web/skin`).
