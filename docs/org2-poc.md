# Org2 storage POC

This branch replaces OLAI's JSONL outline storage with Org2 `.org` files. It is a proof of concept, not a compatibility mode: the production parser no longer accepts the old payload and new outlines are always written as Org headings and property drawers.

## Representation

Each OLAI record is one heading. Heading depth represents `parent`; `ID` is the record id; `OLAI_KIND` is `regular` or `mirror`. The remaining fields use a fixed `OLAI_*` property map. Property values are JSON-encoded so arrays, booleans, arbitrary Markdown and embedded newlines round-trip through Org's one-line property grammar.

The heading text is a readable face, not canonical data. The exact title remains in `OLAI_TITLE`; a mirror face says `mirror of <id>`. OLAI rejects free-standing body text and unknown properties because its next canonical write would otherwise discard them. Notes belong in `OLAI_DESC`, and custom application data belongs in the JSON object held by `OLAI_CUSTOM`.

OLAI's existing two-stage validation remains intact. Org2 parses each file, OLAI validates each decoded record, and the existing whole-set validator checks parents, ids, mirrors, edges, typed properties and documents. Candidate writes still pass through the store's atomic validation and optimistic revision gate before they touch disk.

At server startup, OLAI also invokes the packaged `org2 compile corpus` CLI over the served directory. That preflight proves the standing corpus is accepted by Org2 itself. Candidate writes use the in-process parser because the current CLI has no stdin-oriented parse/validate command suitable for OLAI's atomic write gate.

## What the POC covers

- Canonical Org serialization and exact parse/serialize round trips for every OLAI field.
- Hierarchical creation, property edits, cross-outline subtree moves and mirrors through the real ops/store path.
- Refusal of malformed or lossy Org input without changing the file on disk.
- Optimistic revision protection against stale concurrent writes.
- `.org` outline discovery throughout the server, UI, plugins, tests and documentation.
- Startup compilation through the real Org2 CLI.

There is deliberately no automatic JSONL migration. Existing `.olai` vaults need a one-time content conversion and rename before this branch can serve them.

## Org2 improvements needed for a production migration

1. **A supported TypeScript library surface.** Org2 0.7 publishes its parser implementation but no package declarations or stable parser export. This POC quarantines one unsupported import from `@aviaviavi/org2/dist/parser.js` behind a local typed boundary. OLAI should be able to import a documented `parseOrgWithDiagnostics` entry point with versioned AST types.

2. **A candidate-document CLI/API.** `org2 compile corpus` works on files already in a directory. OLAI's transaction gate needs to validate proposed in-memory contents before an atomic rename. A CLI command accepting stdin, or a supported library `compileDocument`/`compileCorpus` API over virtual files, would let the CLI/compiler participate in every write rather than only startup.

3. **Lossless multiline property values.** Org properties are one physical line, so the POC JSON-escapes all non-ID values. That is exact but not pleasant to hand-edit, especially for Markdown notes. A standard lossless multiline/raw value form would let `desc` remain native readable text without confusing arbitrary body prose with data OLAI owns.

4. **Schema-aware compilation.** Org2 accepts OLAI's property names but does not know that each heading needs one drawer, `OLAI_KIND`, `OLAI_ORD`, and either `OLAI_TITLE` or `OLAI_MIRROR`. A project schema hook or compile plugin could make the Org2 CLI report these constraints directly while OLAI retains its domain validation.

5. **Incremental and virtual-corpus performance.** OLAI decodes only files whose stamps changed and validates a proposed multi-file transaction before writing it. An incremental Org2 compiler API that accepts changed virtual documents and retains the unchanged corpus would fit this model; spawning a whole-corpus CLI on every edit would not.

6. **Stable non-UUID identity guidance.** OLAI ids are stable slugs, while many Org workflows conventionally use UUIDs. The parser and compiler accept these IDs today, but Org2 should explicitly document which graph, indexing and editor features support arbitrary stable strings before OLAI treats that as a durable contract.

7. **Record-aware merge support.** A JSONL record used to occupy one line. An Org heading and drawer span several, which widens ordinary Git conflict regions. Stable `ID` values make an identity-aware merge driver possible; Org2 could provide or document one for heading records.

8. **A migration/export primitive.** The direct cutover intentionally omits migration, but adoption needs a previewable converter that preserves ids and reports every record it cannot represent. A supported AST builder/serializer would keep that converter from duplicating Org syntax.

9. **An empty-corpus success result.** `org2 compile corpus` exits non-zero when a directory contains no Org files. An empty OLAI directory is a valid starting state, so the POC recognises that exact diagnostic and continues. A machine-readable “zero documents, zero diagnostics” success result would avoid treating valid emptiness as a special error string.

None of these changes are made to Org2 in this branch. The local workarounds are intentionally small and isolated so they can be deleted when supported interfaces exist.
