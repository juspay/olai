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
  | { kind: "text" }                  // the default — every key today
  | { kind: "date" }                  // dispatched: an ISO date or datetime, nothing else
  | { kind: "int" }                   // pr: 193 — a number, not a string that has one in it
  | { kind: "path" }                  // worktree: path-shaped, may point anywhere
  | { kind: "doc" }                   // brief: a path that names a served document
  | { kind: "ref";  under?: NodeId }  // one of a parent's children — absent parent = the declaration's OWN children
  | { kind: "node" }                  // any node id in the set — item

// There is deliberately no "sum" — an enum IS a ref. The variants are nodes:
// merge's declaration has children `auto` and `human`, and the value must be
// one of its children's titles. agents-roster is the same thing that happens
// to live elsewhere. One mechanism; adding a variant is adding a child.
```

A vault's declarations are one map:

```ts
type PropDeclarations = ReadonlyMap<PropKey, PropType>
// e.g.
// merge      → { kind: "ref" }                             // variants = its own children: auto, human
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
  {"id":"prop-merge","title":"merge","props":{"type":"ref"}}
  {"id":"prop-merge-auto","parent":"prop-merge","title":"auto"}
  {"id":"prop-merge-human","parent":"prop-merge","title":"human"}
  {"id":"prop-dispatched","title":"dispatched","props":{"type":"date"}}
  {"id":"prop-agent","title":"agent","props":{"type":"ref","under":"agents-roster"}}
```

One node per key; the title IS the key; the type is spelled in the node's own props — and an enum's variants are its CHILDREN, not a list encoded into a string (no `"of":"auto | human"`; a pipe-separated string inside a prop is exactly the sloppiness this feature refuses). Adding a variant is adding a child row. Editing the vocabulary is editing an outline — no config file, no restart, and the declarations page is readable in olai like anything else. (Bootstrap: `prop-*` nodes' own `type`/`under` props are checked against a built-in table, the one place the recursion grounds.)

Alternative considered: per-outline declarations (frontmatter or a root node). Rejected lean: props are one namespace across the vault — `merge` on a lane and `merge` anywhere else should mean one thing, or the key's meaning depends on where you're standing.

## Does it cover lanes.olai? (audited 2026-08-25)

The live board uses **140+ distinct keys**. The core — every key used more than a handful of times — types cleanly:

```ts
// key         uses  type
   terminal  // 315  text            (a uuid; a pattern type is possible, not needed)
   pr        // 180  { kind: "int" }
   agent     // 138  { kind: "ref", under: "agents-roster" }
   repo      // 138  { kind: "ref", under: "repos-roster" }   // olai, kolu, xyne-boxes, drishti — a roster, not a hardcoded sum
   item      // 131  { kind: "node" }                         // any node in the set
   verdict   // 101  { kind: "ref" }   // children: verified, failed — reasoning goes in the note
   brief     // 101  { kind: "doc" }
   sha       //  90  text                                     (hex pattern possible)
   merged    //  69  text                                     // holds the merge COMMIT — a sha, not a date; name says otherwise. typing would have caught the drift
   worktree  //  64  { kind: "path" }
   retired   //  42  { kind: "date" }
   merge     //  28  { kind: "ref" }   // children: auto, human
   approved  //  25  { kind: "date" }                         // "by the human 2026-08-19 — gate open; merge after…" → date here, story in the note
   dispatched//  19  { kind: "date" }
```

Real sloppy values the fence would have refused: `agent: "claude-opus (the #336 author session 638f8364, resumed)"` (a ref plus a biography), every `approved` above, the screenshot's `dispatched` and `merge`.

**The other ~120 keys are used once or twice** — `approval-354`, `run-2`, `round-2-correction`, `localhost-load-10:18`, `kolu-reland-run4`… These are not a typing problem: they are **journal entries wearing property clothes**. Typing stays opt-in, so they remain legal — but the actual fix is upstream of types: the orchestrator-as-code writes only declared keys by construction (procedures don't improvise vocabulary), and a prose fact goes in the note or a child node, dated. The tail exists because today's orchestrator is a model with a free string map; the driver won't be.

## What typing does NOT do

- A `date`-typed prop still does not put the node on a day page. Property ≠ mark (format.md's standing rule). **Typing constrains the value; it grants no meaning.**
- No required keys, no schemas-per-node-kind, no defaults. A node may carry any subset of keys, as today. This is one rule about values, not a record system.

## Search already knows properties — types make it sharper

Today (built, shipping): `prop:pr` (carries the key), `prop:agent=claude-opus` (equality), `prop:stage="in review"` (quoted values), `-prop:agent` (negation); hits carry the custom map. All string-shaped.

**Ruled (the human, 2026-08-25): typed keys gain SPANS**, reusing the syntax `created:` already has — meaningful only because the type says the values compare:

```
prop:dispatched=2026-08-20..        ← every lane dispatched since the 20th
prop:pr=190..200                    ← PRs in a range — int makes ".." honest
prop:merge=auto is:todo             ← equality on a ref, exactly as today
```

A range on an untyped (text) key stays refused — comparing strings as if they were dates is the lie types exist to prevent.

## Cost

The check is local — one node's props against one small map — so it rides every write without joining the O(n) sweep's catalogue. `ref` reads an existing index. Nothing walks.

## Ruled (the human, 2026-08-25, question tool)

- **Declarations live in `_olai/Properties.olai`**, read by name like Pins/Inbox/Trash — one node per key, variants as children.
- **`date` accepts obvious spellings and stores ISO** — `2026-08-25 10:06` → `2026-08-25T10:06`, the day-page's existing leniency. Prose stapled on is still refused.
- **Typed search: spans for date/int** (section above); equality for ref/text as today.
- **Migration is clean-then-declare**: retire finished lanes (they're history), fix the few live values, then declare — a declaration never lands on a board with violations, and no grace machinery is built.
- `doc` and `path` stay two kinds (a served document is a different promise than a path-shaped string).
