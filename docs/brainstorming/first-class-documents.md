# First-class documents

Brainstorm, 2026-08-19. Filed from the parity table (roadmap `md-second-class`)
and the graph-view PR (#247), parked because it drew nodes and could not draw
documents. Goal: change the architecture so a feature *cannot* treat `.md` as
second-class — not patch parity one feature at a time.

## The problem

- Two content types, wildly unequal:
  - **`Node`** (`packages/format/src/node.ts`) — rich record: id, position,
    title, marks, date, repeat, note, attached doc, edges, stamps, custom props.
  - **`Document`** (`packages/format/src/documents.ts`) — `{ file, text }`.
    No id, no title (scraped from the first line), no edges, no marks, no props.
- The set (`packages/format/src/set.ts`) decodes each file into
  `DecodedFile = Outline | Document`, then tears the union into parallel
  `nodes` and `documents` collections. Features import the `nodes` half.
- Root cause, one sentence (from the parity table): **a document has no
  addressable identity below the file, so everything keyed on ids excludes it
  by construction.**
- Hence the repeating failure: graph view keyed on ids → no doc vertices;
  search walks node fields → doc bodies invisible; backlinks, edge targets,
  `apply` — same exclusion. Each fix so far (#251, #253) patched one feature;
  the next feature starts node-only again.

## The ruling: a hierarchy, not a merge

- Nodes and documents do **not** become one type.
- Both *file kinds* are documents under one supertype; nodes are the
  substructure of one kind.
- `Node` keeps every field. What changes is its standing: part of an outline
  document, not a peer of documents.
- The seam already exists, unused: `set.ts` builds the union and discards it;
  `kinds.ts` classifies paths in one place.

In types (illustrative TypeScript — the real spelling is an effect `Schema`,
as `node.ts` does it):

```ts
// The spellings, kept apart at the type level: a path is not an id is not a
// slug, and a function that wants one cannot be handed another.
type DocumentPath = string & Brand<"DocumentPath"> // relative to the served root
type NodeId       = string & Brand<"NodeId">       // unique across the whole set
type Slug         = string & Brand<"Slug">         // a heading's derived id, scoped to its document
type Tag          = string & Brand<"Tag">          // #topic or @person, spelled bare

// The face every feature consumes. All of it is total: no Maybe to branch
// on, which is exactly what makes a node-only feature unwritable.
interface Face {
  readonly path:  DocumentPath           // its identity
  readonly title: string                 // outline: the filename; markdown: the first line
  readonly links: ReadonlyArray<Address> // every address its content points at
  readonly tags:  ReadonlyArray<Tag>
}

// A closed sum, discriminated on `kind` (kinds.ts already computes it from
// the suffix). Exhaustive matches are compiler-checked; a third kind added
// here is a compile error at every feature that forgot it.
export type Document = Outline | Markdown

export interface Outline extends Face {
  readonly kind:  "outline"
  readonly nodes: ReadonlyArray<Node>    // the tree, exactly as today: ids, marks, edges, props
}

export interface Markdown extends Face {
  readonly kind:     "markdown"
  readonly body:     string              // the prose, verbatim
  readonly headings: ReadonlyArray<Slug> // its addressable elements, in document order
}
```

- In Haskell terms: `data Document = Outline Face [Node] | Markdown Face Text
  [Slug]` — a sum of products, no nullable fields, no downcasting.
- Naming: today's wire type `Document {file, text}` keeps its name on the MCP
  surface (`documents.ts`: a rename breaks an external contract). These names
  are the model's.

## Addresses: the one currency

The grammar (ruled 2026-08-19): **`[document] # [element]`**.

| Address | Names |
|---|---|
| `Tasks.olai` | an outline document |
| `README.md` | a markdown document |
| `#a1b2c3` | a node — the document half is optional |
| `README.md#install` | a heading — the document half is required |

Parsed, an address is a sum of three — not a pair of Maybes:

```ts
// The grammar's "optional document half" is parse sugar, not structure.
// Three constructors make the illegal corners unrepresentable: the empty
// address, the heading with no document, and — the subtle one — a node
// address carrying a document half that could disagree with where the node
// actually lives. A node's location is the set's fact, not the address's.
export type Address =
  | { readonly _tag: "AtDocument"; readonly path: DocumentPath }                       // Tasks.olai
  | { readonly _tag: "AtNode";     readonly id: NodeId }                               // #a1b2c3
  | { readonly _tag: "AtHeading";  readonly path: DocumentPath; readonly slug: Slug }  // README.md#install

// One bijection on canonical forms, both total, as routes.ts already
// demands of itself: print never throws, parse answers null rather than
// throwing on what cannot be an address.
declare const printAddress: (address: Address) => string
declare const parseAddress: (text: string) => Address | null
```

- `parseAddress` accepts `Tasks.olai#a1b2c3`, normalizes to `AtNode` — read
  leniently, print one way. Parse-then-print is canonicalization; one string
  per address.
- **Node: bare id stays canonical.** Ids are global; the link survives moves
  and renames — the property `routes.ts` argues for today, kept.
- **Markdown element: derived heading slug.** Rewording breaks the address;
  accepted. Opt-in stable ids (`## Install {#setup}`) are the later
  evolution, not this round.
- Addresses are what features trade in:
  - graph vertex = address; edge = address → address
  - pin = address (the Pins ruling already: bare, or `[label](address)`)
  - search hit carries one; chat arms one; MCP speaks them
- This dissolves the "two grains" question: features handle addresses, which
  name a whole document or an element inside one, uniformly.

## URLs

Backwards compatibility is explicitly breakable here, so the scheme is
rebuilt, not extended.

**A content URL is `/` + the address, verbatim.**

```
/                          the front page
/Tasks.olai                an outline document
/notes/README.md           a markdown document
/notes/README.md#install   the same page, landed at the heading
/#a1b2c3                   a node, wherever it lives — the permalink
/Tasks.olai#a1b2c3         accepted, normalized to the bare form
?q=<filter>                narrowing, unchanged, on any of them
```

- Retired: `/o/`, `/doc/`, `/n/` — they existed only because outlines,
  documents and nodes were three different things. Links in the wild break;
  blessed cost. (A 301 from the old prefixes is a footnote, not a
  constraint.)
- The URL still says what kind of page it opens before the set is in hand:
  the suffix (`kinds.ts`'s question) carries what the `/o/` vs `/doc/`
  prefix used to.
- The node permalink stays location-free: `/#a1b2c3` is the bare `#id`
  mounted at root, resolved client-side as `/n/<id>` is today.
- Computed pages keep their spellings: `/today`, `/agenda`, `/trash`,
  `/d/<date>`. No collision possible — content paths end in a known suffix,
  computed pages are extensionless words.
- Parsing stays total; parse/print stays one bijection, now shared with
  `parseAddress`/`printAddress` rather than a second grammar that could
  drift.

## The markdown face, this round

Derived facts only — everything computable from the body, no format change:

- **title** — first non-empty line, heading marks off (`firstLine`, exists)
- **links** — where its `[…](…)` land (`bodiedOf`, exists) plus node
  references (`#id`) in the body
- **tags** — `#tag` and `@mention` in the body, indexed as node titles are
- **day-ness** — a date-named `.md` is a day (exists)

**Frontmatter is the named next step, not designed here.** YAML at the top as
the document's own authored record — dates, edges, props, possibly marks. It
waits until the derived face is standing.

## What becomes impossible

Once the set serves one collection of documents and features consume
addresses:

- **Graph view** — a `.md` is a vertex by construction; node edges, markdown
  links and `doc` attachments are all edges. Unparks #247.
- **Search** — a document's body is text the way a node's note is. Operators
  over fields a document lacks (`is:done`) select nothing there, until
  frontmatter exists.
- **Backlinks** — incoming edges to an address; a document's page shows who
  points at it.
- **Palette, pins, chat** — already address-shaped; no more per-feature
  document patches.

Enforcement is structural, not reviewed-for: the set stops exporting `nodes`
and `documents` as parallel primary collections. A new feature has no
node-only list to import — treating both kinds evenly is what the types hand
you; treating them unevenly is work.

## The PRs

Three, each self-contained: a thing arrives WITH all its consumers, and what
it replaces leaves in the same diff. No PR lands types nobody calls, and no
PR leaves the old spelling alive beside the new one.

- **PR 1 — addresses.** The `Address` sum and its whole world, in one PR:
  - branded primitives + the three constructors, `parseAddress` /
    `printAddress`, bijection test (`parse ∘ print = id`; doc-qualified node
    spelling normalizes)
  - `routes.ts` rebuilt on them: URL = `/` + address; every printed href
    through `printAddress`; parsing total
  - `/o/` `/doc/` `/n/` deleted in this diff — not deprecated, gone
  - one-time sweep of stored addresses (`Pins.olai` titles)
  - self-contained test: the app runs entirely on the new grammar, and no
    code spells the old one
- **PR 2 — the face.** The `Document` sum and its whole world, in one PR:
  - `Outline | Markdown` with the derived markdown face
    (`firstLine`/`bodiedOf` promoted from helpers to fields, tags-from-body,
    heading slugs)
  - the set serves it as THE collection; the parallel `nodes`/`documents`
    exports deleted in this diff, every importer migrated to the face
  - search walks `Document`, hits carry addresses (closes roadmap
    `search-document-bodies`); palette and backlinks ride the same index
  - the big one, deliberately: its size is the size of the habit being broken
  - self-contained test: `grep` finds no consumer of a node-only collection,
    because there is none to import
- **PR 3 — the proof.** Graph view rebuilt on addresses; re-opens and
  supersedes the parked #247. If PR 2 did its job, this PR contains no
  document-special-casing at all — that absence is the test.

Later, out of this arc: frontmatter (PR 2's "selects nothing" is the hole it
fills); opt-in stable element ids (`{#id}`); structure verbs for `.md` (move,
rename) as address-preserving operations.

## What this does not reopen

Nothing here forces marks onto documents, teaches the commit panel to parse
prose, or turns a document into an outline. It only ends the situation where
a document is invisible to a feature *because the feature could not name it*.
