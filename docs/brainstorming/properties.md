# Properties: facts on a node, not sentences in its note

Status: brainstorming, opened 2026-08-15. Ruled so far: freeform key→value, brainstorm before code, full web parity in the same PR.

## The problem, shown

Today the roadmap tracks a running lane like this, inside `desc`:

    **Now** (2026-08-15):
    - Kolu terminal: `485cd9bb` (Claude Opus, YOLO), branch `chat-model-stale`
    - PR: #176 — stage #review
    - Evidence: https://github.com/user-attachments/...

Nothing can ask "which lanes are at review?" or "what PR is this node about?" — the answers are trapped in prose. Every reader re-parses it by eye.

## The same node, with properties

    title: The chat header's model goes stale after /model
    props:
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

## What each face does with them

**On disk** — ONE map. Today's `todo`/`done`/`date`/`see`/`after` fields are legacy properties and MIGRATE INTO it (olai auto-migrates each file on startup — reads the old shape, writes the new):

    before:  {"id":"x", "title":"...", "todo":true, "date":"2026-08-20", "see":["y"]}
    after:   {"id":"x", "title":"...", "props":{"status":"todo", "date":"2026-08-20", "see":"y",
                                                "created":"2026-08-15T09:12:03-04:00",
                                                "changed":"2026-08-15T21:33:40-04:00",
                                                "pr":"https://..."}}

Two of those are new, borrowed from Workflowy: `created` and `changed`. Nobody writes them — not even a verb: capture stamps `created`, every write op re-stamps `changed`. On a migrated node both start absent (the ledger does not invent a past; `git log` is the archaeologist's tool) and appear as the node is touched.

System keys and user keys live in the same map; the difference is only that olai READS the system ones (journal reads `date` and the done instant, blocking reads `status` + `after`) and their writes stay POLICED through their own verbs:

    set_prop {id:"x", key:"pr", value:"..."}        # freeform: fine
    set_prop {id:"x", key:"status", value:"done"}   # refused: "set_done is the door — it records the instant"
    set_prop {id:"x", key:"date", value:"tuesday"}  # refused: "set_date is the door — it validates"
    set_prop {id:"x", key:"after", value:"y"}       # refused: "set_after is the door — it checks for cycles"

    set_prop {id:"x", key:"changed", value:"..."}   # refused: "the ops layer stamps this — nothing else may"

Built-in keys are not settable willy-nilly: every system key refuses toward its own verb, and the verb keeps its policing (instants recorded, dates validated, cycles refused). `created`/`changed` have no verb at all — they are stamps. `set_prop` owns only the keys olai does not read or write.

**MCP** — two verbs, following `set_desc`'s shape:

    set_prop   {id: "chat-model-stale", key: "stage", value: "addressing"}
    set_prop   {id: "chat-model-stale", key: "stage", value: null}   # removes

  and reads carry them: `read_node` answers `props`, search learns

    prop:pr                       # any node that is about a PR
    prop:agent=claude-opus        # every lane this agent ran

**Web** — a quiet drawer under the note (Workflowy-flavored: hidden until the node has properties, one `key value` line each), editable from the ••• menu (add / change / remove). Same ops underneath — no second writer. Interactive prototype (chalk/pitch palettes, hover ••• menu, add/edit/remove): https://claude.ai/code/artifact/48a09a59-5079-44fe-b99a-7f3a5fe49c90

## Examples beyond orchestration

    props: {source: "https://news.ycombinator.com/item?id=...", author: "pg"}   # a clipped article
    props: {isbn: "978-0134757599"}                                             # a book note
    props: {due-owner: "@rahul"}                                                # anything a future reading might want

None of these need olai to understand the key. And that is the whole difference between user keys and system keys: `date` is a prop the journal happens to READ. The day a reading needs `isbn`, it gets one — the key's shape never changes, only what consumes it.

## What this deliberately is not

- Not typed: values are strings. A URL is a string that looks like a URL.
- Not tags: `#review` in a title stays what it is; `stage=review` is a fact with a value, not a label.
- Not a second note: prose stays in `desc`. A property value that grows a paragraph is a smell the review should catch.

## Open questions

1. Sort order in the drawer — key-alphabetical, or insertion order kept?
2. Do search HITS carry props (like they carry `see`/`after`), or only `read_node`? Hits carrying them makes "list lanes at review" one query.
3. When properties land, do the roadmap's existing **Now** blocks migrate in one sweep, or rot away naturally as lanes close?
