# Typed properties

Status: brainstorming, 2026-08-25. Roadmap: `typed-properties` (features → Task model & edges). Today a property value is any string; nothing refuses a sloppy one. A key should be able to declare its type, and the write gate should refuse a value that doesn't fit — the same fence `set_doing` and duplicate-ids already are.

## The problem, from a live lane node

```
agent       claude-opus
brief       briefs/pdb.md
dispatched  2026-08-25 10:06 (sweep queue #5; the slot freed by #387's merge)
merge       AUTO: grok review folded + CI green; gate = index≡scan differential + …
worktree    .worktrees/doc-backlinks-index
```

`dispatched` is a date with a story stapled on. `merge` should be exactly `auto` or `human` — the driver switches on it, and this value matches neither. The value should be the value; the story belongs in the node's note.

## The types

```ts
type PropType =
  | { kind: "text" }                        // the default — every key today
  | { kind: "sum";  of: readonly string[] } // merge: one of "auto" | "human"
  | { kind: "date" }                        // dispatched: an ISO date or datetime, nothing else
  | { kind: "int" }                         // pr: 193 — a number, not a string that has one in it
  | { kind: "path" }                        // worktree: path-shaped, may point anywhere
  | { kind: "doc" }                         // brief: a path that names a served document
  | { kind: "ref";  under?: NodeId }        // agent: a node under a parent; item: any node in the set
```

A vault's declarations are one map:

```ts
type PropDeclarations = ReadonlyMap<PropKey, PropType>
// e.g.
// merge      → { kind: "sum", of: ["auto", "human"] }
// dispatched → { kind: "date" }
// worktree   → { kind: "path" }
// brief      → { kind: "doc" }
// agent      → { kind: "ref", under: "agents-roster" }
```

A key with no declaration is `text` — **typing is opt-in per key**, or nobody could capture anything until the whole vault's vocabulary was declared.

## What a refusal looks like

```
set_prop {"id":"lane-dbi","key":"merge","value":"AUTO: grok review folded + CI green"}
→ REFUSED: `merge` is auto | human — got "AUTO: grok review folded + CI green".
  The commentary belongs in the note.

set_prop {"id":"lane-dbi","key":"dispatched","value":"2026-08-25 10:06 (sweep queue #5)"}
→ REFUSED: `dispatched` is a date — got a date plus prose. Write "2026-08-25T10:06";
  the story goes in the note.

set_prop {"id":"lane-dbi","key":"agent","value":"claude-opus"}
→ REFUSED: `agent` names a node under agents-roster — those are: claude, grok,
  opencode, pi. (did you mean `claude`?)
```

A hand edit that lands a bad value makes the file **broken, naming the key** — exactly how every other validation rule reports. Live writes are refused; edits from vim are named. One rule, two doors, like everything else.

## `ref` is the dynamic sum

The `agent` question answered: yes. The type points at a *place*, and the valid values are whatever nodes live there **now**:

```ts
{ kind: "ref", under: "agents-roster" }
// valid values = ids of agents-roster's children, read from the same
// index checkTargets already uses (byId + children) — no new machinery
```

The roster stays data — add a node under it and the sum grows; no declaration edit. If a roster node is deleted while lanes still name it, those values go stale the way a dangling `after` edge does: the validator flags them, with a did-you-mean.

## Where declarations live

Data, not config — the olai way. Lean: a file read by NAME, like `Pins.olai` and the Inbox:

```
_olai/Properties.olai:
  {"id":"prop-merge","title":"merge","props":{"type":"sum","of":"auto | human"}}
  {"id":"prop-dispatched","title":"dispatched","props":{"type":"date"}}
  {"id":"prop-agent","title":"agent","props":{"type":"ref","under":"agents-roster"}}
```

One node per key; the title IS the key; the type is spelled in the node's own props. Editing the vocabulary is editing an outline — no config file, no restart, and the declarations page is readable in olai like anything else. (Bootstrap: `prop-*` nodes' own `type`/`of`/`under` props are checked against a built-in table, the one place the recursion grounds.)

Alternative considered: per-outline declarations (frontmatter or a root node). Rejected lean: props are one namespace across the vault — `merge` on a lane and `merge` anywhere else should mean one thing, or the key's meaning depends on where you're standing.

## Does it cover lanes.olai? (audited 2026-08-25)

The live board uses **140+ distinct keys**. The core — every key used more than a handful of times — types cleanly:

```ts
// key         uses  type
   terminal  // 315  text            (a uuid; a pattern type is possible, not needed)
   pr        // 180  { kind: "int" }
   agent     // 138  { kind: "ref", under: "agents-roster" }
   repo      // 138  { kind: "ref", under: "repos-roster" }   // olai, kolu, xyne-boxes, drishti — a roster, not a hardcoded sum
   item      // 131  { kind: "ref" }                          // any node in the set
   verdict   // 101  { kind: "sum", of: ["verified","failed"] }  // the reasoning goes in the note
   brief     // 101  { kind: "doc" }
   sha       //  90  text                                     (hex pattern possible)
   merged    //  69  text                                     // holds the merge COMMIT — a sha, not a date; name says otherwise. typing would have caught the drift
   worktree  //  64  { kind: "path" }
   retired   //  42  { kind: "date" }
   merge     //  28  { kind: "sum", of: ["auto","human"] }
   approved  //  25  { kind: "date" }                         // "by the human 2026-08-19 — gate open; merge after…" → date here, story in the note
   dispatched//  19  { kind: "date" }
```

Real sloppy values the fence would have refused: `agent: "claude-opus (the #336 author session 638f8364, resumed)"` (a ref plus a biography), every `approved` above, the screenshot's `dispatched` and `merge`.

**The other ~120 keys are used once or twice** — `approval-354`, `run-2`, `round-2-correction`, `localhost-load-10:18`, `kolu-reland-run4`… These are not a typing problem: they are **journal entries wearing property clothes**. Typing stays opt-in, so they remain legal — but the actual fix is upstream of types: the orchestrator-as-code writes only declared keys by construction (procedures don't improvise vocabulary), and a prose fact goes in the note or a child node, dated. The tail exists because today's orchestrator is a model with a free string map; the driver won't be.

## What typing does NOT do

- A `date`-typed prop still does not put the node on a day page. Property ≠ mark (format.md's standing rule). **Typing constrains the value; it grants no meaning.**
- No required keys, no schemas-per-node-kind, no defaults. A node may carry any subset of keys, as today. This is one rule about values, not a record system.

## Cost

The check is local — one node's props against one small map — so it rides every write without joining the O(n) sweep's catalogue. `ref` reads an existing index. Nothing walks.

## Open

- Normalization: does `date` accept `2026-08-25 10:06` and store `2026-08-25T10:06`, or refuse anything non-ISO? (Lean: accept obvious spellings, store one.)
- `doc` vs `path`: two kinds as drawn, or one `path` with `within: "vault"`? (Drawn as two — a served document is a different promise than a string that looks like a path.)
- Migration: existing sloppy values (the screenshot's own lane) become broken the moment their keys are declared. Declare-then-clean, or a `--warn` grace mode? (Lean: declare on a clean board; the orchestrator's next dispatch writes typed values from day one.)
