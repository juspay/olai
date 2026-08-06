# typed edges: the graph beyond containment (brainstorm)

Status: brainstorm. Nothing here is built. Rides the cross-file linker (roadmap: "mirror nodes across files"), which is also unbuilt — this doc exists so the design is settled before either lands, and the linker ships first, built to this doc's requirements. The backlinks panel is blocked on this by the human's call (2026-08-06): one data model, designed once.

## The idea, in one outline

The tree says one thing: what CONTAINS what. Everything else a task graph needs — order, dependency, cross-reference — gets said today in prose, where nothing can check it. Typed edges make those relations grammar:

```racket
#lang olai

kitchen remodel #project
  demo the old cabinets ^demo
  order the new ones ^order
  install ^install
    @after ^order
    @after ^demo
  paint
    @after ^install
    @see ^color-notes
  pick a color ^color-notes
    : Warm white. The samples are in the garage.
```

Three relations, all references to anchors:

- `@after ^x` — ordering: this node is not actionable until `^x` is done.
- `@blocks ^y` — the inverse pointer, for when the blocker is the natural place to write it.
- `@see ^z` — a plain cross-reference, no semantics beyond the link.

The TREE stays the spanning structure: every node has exactly one defining site. An edge never moves a node — it points at one.

## What each layer does

The pattern is the house pattern: grammar in the language, checking in one checker, derivation in the snapshot, queries pure.

**Language.** Each relation is a field line, like `@date` — reader translates, expander carries it as `(relation target-anchor)` with srcloc. The relation set is CLOSED (the checker owns it, like node views' closed set); a new relation is ratified by the human before it parses.

**Checker.** Two rules, both srcloc'd at the offending form:

```
Tasks.rkt:9:4: @after ^ordr: unknown anchor
  anchors in scope: ^order (Tasks.rkt:5), ^demo (Tasks.rkt:4), ...
  did you mean: ^order?

Tasks.rkt:12:4: @after cycle: ^install -> ^order -> ^install
  @after must be acyclic; the cycle is the path above
```

Acyclicity is PER RELATION: `@after` cycles are errors (with the cycle path in the message), `@see` cycles are fine. Cross-file targets exist only after the splice — same two-phase story as mirrors, which is why this rides the "mirror nodes across files" linker.

**Snapshot.** The store derives, once per reload, beside `index`:

```racket
;; edges   : hash relation -> hash source-key -> (listof target-key)
;; back    : hash target-key -> (listof (backlink source-key relation))
;; topo    : per acyclic relation, a cached order — "blocked" is a lookup, not a walk
```

`back` is the backlinks panel's whole data model — mirrors become just one more relation kind in it, so the panel ships against every relation at once.

**Queries.** Pure functions over the snapshot, `today` as an argument, like the agenda:

- *blocked* — nodes with an unfinished `@after` target; the agenda gains a BLOCKED group that hides them from TODAY.
- *project reach* — everything reachable from a node over chosen relations; "what does shipping this actually involve".

**JSON.** An `edges` index beside `anchors`, append-only within the version, mirrors ride along as a relation. Agents query the graph instead of grepping prose.

## The questions

**Is `@blocks` sugar or a real edge?** Sugar. `a @blocks b` normalizes to `b @after a` at derivation time, so the graph has one edge kind to check and topo-sort, and the two spellings can never disagree. The file keeps whichever direction the writer thought in.

**Does `@after` mean scheduling?** No. It means ordering — "not actionable yet", a fact for the agenda's BLOCKED group. Dates stay `@date`; a blocked node with a due date is overdue AND blocked, and the agenda says both.

**Do mirrors become edges?** In the reverse index, yes — a mirror is "this node is also shown here", one more backlink kind. In the grammar, no — mirrors are identity (same node, two sites), not relation, and complecting them would undo 0.2b.1.

**Open: does done-ness propagate?** `install @after ^order` where `order` is done — obvious. But `@after` a PARENT: does the target count as done when all its children are? Today done is explicit, not derived. Deciding this decides what "blocked" means for subtree targets. Undecided; needs a worked example when the linker exists.
