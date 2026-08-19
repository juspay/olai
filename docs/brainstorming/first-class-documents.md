# First-class documents

Brainstorm, 2026-08-19. Filed from two places: the parity table on roadmap node
`md-second-class`, and the graph-view PR (#247), parked as a draft because it
drew nodes and could not draw documents. The goal here is not to patch parity
one feature at a time — it is to change the architecture so that a feature
*cannot* treat `.md` as second-class, because there is nothing node-only left
for it to be written against.

## The problem

olai has two content types, and they are wildly unequal:

- **`Node`** (`packages/format/src/node.ts`) is a rich record: id, position,
  title, marks with instants, date, repeat rule, a markdown note, an attached
  document, edges (`see`, `after`, mirrors), stamps, and open custom
  properties.
- **`Document`** (`packages/format/src/documents.ts`) is two fields:
  `{ file, text }`. No id, no title (the title is scraped from the first
  line), no edges, no marks, no properties.

The loaded set (`packages/format/src/set.ts`) decodes each file into a union —
`DecodedFile = Outline | Document` — and then immediately tears that union
into two parallel collections, `nodes` and `documents`. Every feature that
reasons about content imports the `nodes` half. The root cause, in one
sentence (from the parity table): **a document has no addressable identity
below the file, so everything keyed on ids excludes it by construction.**

That is why parity keeps failing the same way: graph view is keyed on ids and
edges, so documents cannot be vertices. Search walks node fields, so document
bodies are invisible. Backlinks, edge targets, `apply` — same exclusion, same
reason. Each fix so far (#251 document reads, #253 palette rows) bolts
documents onto one feature; the next feature starts node-only again.

## The ruling: a hierarchy, not a merge

Nodes and documents do not become one type. Instead, both *file kinds* are
documents, under one supertype, and nodes are the substructure of one kind:

```
Document              any content file the directory serves
  address             its path
  title               .olai: the filename;  .md: its first line
  kind                which of the two it is (kinds.ts already answers this)
  text                what search reads
  links               the addresses it points at
  tags                the #tags and @mentions it carries

OutlineDocument       a .olai — additionally HAS NODES
  nodes               the tree, exactly as today: ids, marks, edges, props

MarkdownDocument      a .md — additionally has its body
  body                the prose, verbatim
  (derived facts)     see "The markdown face" below
```

`Node` keeps every field it has. What changes is its standing: a node is part
of an outline document, not a peer of documents. Features consume the
`Document` face; reaching down into nodes is a deliberate specialization, not
the default posture.

The seam already exists and is unused: `set.ts` builds the union and discards
it; `kinds.ts` classifies paths in one place. The work is to give the union a
real shared face and make *that* what the set serves.

## Addresses: the one currency

The grammar (ruled 2026-08-19): **`[document] # [element]`**.

| Address | Names |
|---|---|
| `Tasks.olai` | an outline document |
| `README.md` | a markdown document |
| `#a1b2c3` | a node — the document half is optional |
| `README.md#install` | a heading — the document half is required |

Two asymmetries, both deliberate:

- **A node's document half is optional, and the bare id stays canonical.**
  Node ids are unique across the whole set, so the link survives renames and
  moves across files — the property `routes.ts` argues for today (`/n/<id>`),
  kept.
- **A markdown element's identity is its derived heading slug.** Rewording
  the heading breaks the address; accepted for now. The later evolution is an
  opt-in explicit id (`## Install {#setup}`) — noted, not designed here.

Addresses are what features trade in. A graph vertex is an address. An edge
is address → address. A pin holds one (the Pins ruling already says so: a
bare address, or `[label](address)`). A search hit carries one. Chat arms
one. MCP speaks them. This dissolves the "two grains" question: a feature
does not handle nodes *and* documents — it handles addresses, which name a
whole document or an element inside one, uniformly.

## The markdown face, this round

Derived facts only — everything computable from the body, no format change:

- **title** — the first non-empty line, heading marks off (`firstLine`, exists)
- **links** — where its `[…](…)` land (`bodiedOf`, exists) plus node
  references (`#id`) in the body
- **tags** — `#tag` and `@mention` in the body, indexed as node titles are
- **day-ness** — a date-named `.md` is a day (exists)

**Frontmatter is the named next step, not designed here.** YAML at the top of
a `.md` would be the document's own authored record — a date, edges, custom
properties, possibly marks — giving a document what a node's fields give a
node. It waits until the derived face is standing, because it raises the
questions this round doesn't need: which keys mean what, and what `is:done`
means for a file.

## What becomes impossible

Once the set serves one collection of documents (nodes inside the outline
kind) and features consume addresses:

- **Graph view** — vertices are addresses; markdown links, node edges, and
  `doc` attachments are all edges between addresses. A `.md` is a vertex by
  construction. This is what unparks #247.
- **Search** — the query walks the shared face; a document's body is text the
  way a node's note is. (Operators that read fields a document doesn't have —
  `is:done` — simply select nothing there, until frontmatter exists.)
- **Backlinks** — incoming edges to an address; a document's page shows who
  points at it.
- **Palette, pins, chat** — already address-shaped; they stop needing a
  per-feature document patch.

The enforcement is structural, not reviewed-for: the set stops exporting
`nodes` and `documents` as parallel primary collections, so a new feature has
no node-only list to import. Treating both kinds evenly is what the types
hand you; treating them unevenly is work.

## Path from here

1. **format**: the `Document` supertype and shared face; the markdown
   derivations become the face rather than scattered helpers.
2. **set/index**: serve the unified collection; nodes reachable through their
   outline document; the parallel exports retired.
3. **addresses**: one `Address` type with parse/print, subsuming the
   `routes.ts` forms; pins, search hits, and edges adopt it.
4. **graph view** rebuilt on addresses — #247 unparks.
5. **later**: frontmatter; opt-in stable element ids (`{#id}`); structure
   verbs for `.md` (move, rename) as address-preserving operations.

## What this does not reopen

The parity table marks some rows as ruled doctrine, and this design keeps
them rulable: nothing here forces marks onto documents, teaches the commit
panel to parse prose, or turns a document into an outline. It only ends the
situation where a document is invisible to a feature *because the feature
could not name it*.
