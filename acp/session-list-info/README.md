# acp/session-list-info — the inference, owned

What the second patch under `acp/patches/` says about one stored conversation
(`messageCount`, `clearedAt`, and WHICH listed conversation it supersedes)

The pair of things the adapters' `session/list` cannot say today — how big a
conversation is, and which other one a `/clear` moved you into — answered by
the patch at `acp/patches/session-list-info.patch`, whose pairing rules are
extracted here so *they* carry the tests, not the patch's comments.

The shape follows from the pin carrying the code in compiled form:

- **`facts.js`** is the code of the inference, dependency-free so it can be
  spliced verbatim into the compiled adapter bundle
- **`facts.test.js`** is the testing: not the wiring (that one has its own
  scenario in `choosing_an_agent.feature`), but the edges of the rules
  themselves — the tie, the same-timestamp boundary, the stale candidate,
  the claimant arriving second, the undated opener, the unreadable
  transcript, the cache keys, the refusal announcers through `say`.
- **`regenerate.sh`** rebuilds `acp/patches/session-list-info.patch` from
  `facts.js`: it downloads the pristine npm package at the version from
  `acp/package-lock.json`, splices `facts.js` (with `export` removed) ahead
  of the class declaration, replaces the `listSessions` method with the one
  authored per the note in the script, and then `diff -u` computes the
  hunks — the patch committed is this script's print-out, because hunks
  by hand are hunks numbered by hand; three rounds of malformed regen taught
  where the arithmetic belongs (the diffing machinery that has to be right
  everywhere anyway).

Run it when `facts.js` changes:

```console
$ bash acp/session-list-info/regenerate.sh
$ nix build .#acp-agent     # applies both patches at -F0 and builds the pin
```

and note that the template's `sessionListFactsCache` and the bundled handler
of a process-lifetime Map live inside the splice scaffold — the script, not
`facts.js`, owns them (`facts.js` is the pure part; what has a lifecycle a
process should know about is handled with the logger beside it).

The metadata grammar `getSessionMessages` reads makes everything possible at
all: local commands ride user entries wrapped in `<command-name>` markers,
the HARNESS stamps the time the command fired, and the listing builder.s own `dir` filter
in the listing builder already means project-to-project bleeding never has
to happen in the pairing pass. One day the harness could just write the
link: see `acp/patches/README.md` for where THOSE words are.
