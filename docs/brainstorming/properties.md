# Properties: facts on a node, not sentences in its note

Status: **ratified 2026-08-15** (shape ruled twice on the way — see [What the shape was, twice](#what-the-shape-was-twice)). Built in #179.

## The problem, shown

Today the roadmap tracks a running lane like this, inside `desc`:

    **Now** (2026-08-15):
    - Kolu terminal: `485cd9bb` (Claude Opus, YOLO), branch `chat-model-stale`
    - PR: #176 — stage #review
    - Evidence: https://github.com/user-attachments/...

Nothing can ask "which lanes are at review?" or "what PR is this node about?" — the answers are trapped in prose. Every reader re-parses it by eye.

## The same node, with properties

    title:  The chat header's model goes stale after /model
    doing:  true
    custom:
      terminal: 485cd9bb
      agent:    claude-opus
      pr:       https://github.com/juspay/olai/pull/176
    desc: (the actual story: what was found, what was ruled, why)
    children (the cloned workflow steps — orchestrator.md):
      • implement + open PR   done
      • review: grok          done
      • review: opencode      doing   ← the stage, no property needed
      • address findings      todo, after: both reviews

`desc` keeps the prose. Properties hold the facts. Any key, any string value — nothing is reserved, olai gives no key a meaning. Note what is NOT a property: the stage. The lane's cloned DAG steps (orchestrator.md) already say it — the `doing` step IS the stage — and a `stage: review` beside a DAG whose review step is `doing` would be two spellings of one fact, free to drift.

## The shape: one open field, and the record it sits in

**The record does not change.** `todo`/`doing`/`done` stay the three fields they have always been, `date`, `see`, `after`, `desc`, `doc` untouched, the top level closed — a key olai has no meaning for is still a `bad-record` naming it, which is what catches a typo'd `titel` before it becomes a fact nobody can see.

**One new optional field is open:** `custom`, a map of any key to text or a list of text.

    {"id":"lane","ord":"a1","title":"…","doing":true,
     "custom":{"agent":"claude-opus","pr":"https://github.com/juspay/olai/pull/176"}}

**No migration.** Every file already on disk is already valid; nothing is rewritten, nothing is swept at boot, and a vault that never uses a property never changes at all.

**One open field rather than an open record.** Letting unknown top-level keys through as user properties would buy the same expressiveness by giving up the refusal that catches typos — and it would put `pr` and `title` in one namespace, where a key called `done` reads as a mark and is not one. Two namespaces in two places: which is which is a fact about where the key sits, not a rule to remember.

**System fields and custom keys differ in one way only:** olai READS the fields (the journal reads `date`, the checkbox reads the marks, blocking reads `after`), and their writes stay policed through the verbs that own them (`set_done` records the instant, `set_date` validates, `set_after` refuses a cycle). Nothing reads a custom key except the person who wrote it, `prop:` in a query, and the drawer.

## Two stamps, borrowed from Workflowy

`created` and `changed`, as ordinary flat fields. Nobody writes them — not even a verb: capture stamps `created`, every write op re-stamps `changed`. On a node written before they existed both are absent (**no backfill**: the ledger does not invent a past it did not see; `git log` is the archaeologist's tool) and they appear as the node is touched. `created` with no `changed` beside it means nothing has been written to that node since it was made.

## What each face does with them

**MCP** — one verb, following `set_desc`'s shape:

    set_prop {id: "chat-model-stale", key: "stage", value: "addressing"}
    set_prop {id: "chat-model-stale", key: "stage", value: null}   # removes

It writes only inside `custom` and structurally cannot touch anything else. One refusal remains, and it is about SHADOWING rather than reach: a custom key spelled like a field the record already has (`done`, `doing`, `todo`, `status`, `date`, `see`, `after`, `id`, `title`, `created`, `changed`, …) is turned toward the verb that writes that fact, because a node saying `done` twice with two meanings is a node no reader can trust.

Reads carry them: `read_node` answers `custom` (and both stamps), and search learns

    prop:pr                       # any node that is about a PR
    prop:agent=claude-opus        # every lane this agent ran

**Web** — a quiet drawer under the note (Workflowy-flavored, one `key value` line each). It leads with the node's own facts, READ-ONLY — its `id`, the mark it carries, its `date`, the stamps when it has them — because those had nowhere on the page to be read at all, and the id is what every tool call and every `((` reference takes. The custom keys follow, editable from the `•••` menu (add / change / remove). Same ops underneath — no second writer.

Interactive prototype of the original drawer (chalk/pitch palettes, hover ••• menu, add/edit/remove): https://claude.ai/code/artifact/48a09a59-5079-44fe-b99a-7f3a5fe49c90

## Examples beyond orchestration

    custom: {source: "https://news.ycombinator.com/item?id=...", author: "pg"}   # a clipped article
    custom: {isbn: "978-0134757599"}                                             # a book note
    custom: {due-owner: "@rahul"}                                                # anything a future reading might want

None of these need olai to understand the key. And that is the whole difference between a field and a custom key: `date` is a fact the journal happens to READ. The day a reading needs `isbn`, it gets one — the key's shape never changes, only what consumes it.

## What this deliberately is not

- Not typed: values are strings (or lists of them). A URL is a string that looks like a URL.
- Not tags: `#review` in a title stays what it is; `stage=review` is a fact with a value, not a label.
- Not a second note: prose stays in `desc`. A property value that grows a paragraph is a smell the review should catch.

## What the shape was, twice

Both earlier shapes were built and then superseded by ruling; they are recorded because the arguments against them are the reasons the shape above is what it is.

1. **Everything into one `props` map.** `todo`/`doing`/`done` folded into `status` + `since`, and `date`/`see`/`after` moved into the same map beside the user keys. It worked and was reviewed, and it cost a whole migration — an eager boot sweep rewriting every outline in a vault, a migrator that was the only reader of the old spelling, and a fence to keep the old spelling from creeping back. The review found that migrator laundering malformed legacy records into valid ones, which is the class of defect a migration exists to avoid.
2. **A flat record with `custom` beside it, marks still unified into `status`/`since`.** Same record shape as today except the marks, which still needed a migration — smaller, but a migration.

The ruling that stands deletes the migration entirely: nothing is rewritten, because nothing is old. The only thing that survived from (1) unchanged is the argument for how the two halves relate, which is the paragraph above about namespaces.

## Open questions

1. ~~Sort order in the drawer~~ — **answered**: the file's own order, which is alphabetical among custom keys. A record's key order is canonical so two files meaning the same thing are byte-identical, so "the order it was added in" is not a fact the file remembers; a drawer keeping it would re-sort itself under the reader after a reload.
2. Do search HITS carry properties (like they carry `see`/`after`), or only `read_node`? Hits carrying them makes "list lanes at review" one query. **Still open** — `read_node` answers them, hits do not.
3. When properties land, do the roadmap's existing **Now** blocks migrate in one sweep, or rot away naturally as lanes close? **Still open**, and now cheaper either way: nothing forces the question, since the old prose stays valid.
