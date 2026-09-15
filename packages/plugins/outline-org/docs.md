# Outline Org

The `outline-org` row claims the `.org` outline format: one Org heading per record, its fields in a property drawer. It owns the pure parser (the packaged Org2), the canonical writer, and its own sidebar glyph: the outline tree drawn with Org's stars instead of bullets, so a sidebar keeping one outline in both spellings tells them apart at a glance. Outlines contributes the tree page and every other face for any claim holding nodes.

## Representation

Each record is one heading. Heading depth represents `parent`; `ID` is the record id; `OLAI_KIND` is `regular` or `mirror`. The remaining fields use a fixed `OLAI_*` property map (`src/format.ts`), JSON-encoded so arrays, booleans, arbitrary Markdown and embedded newlines round-trip through Org's one-line property grammar.

The heading text is a readable face, not canonical data. The exact title remains in `OLAI_TITLE`; a mirror face says `mirror of <id>`. Free-standing body text, document-level Org content and unknown properties are refused, because the next canonical write would otherwise discard them. Notes belong in `OLAI_DESC`, and custom application data belongs in the JSON object held by `OLAI_CUSTOM`.

A format receives the file path, contents and the caller's Claims snapshot. It never reads the live registry. The vault's codec, write gate and outline-diff procedure choose the format and pass the same snapshot used for their decision.

Org2 0.7 ships its parser as JavaScript with no TypeScript declarations, so the one deep import of `@aviaviavi/org2/dist/parser.js` is quarantined in `src/format.ts` behind a locally declared shape.

Merge guarantee: unlike the line-based `.olai` spelling, one record spans a heading and its drawer, so a plain line-based Git merge conflicts over a whole record's region rather than one field.

Its switch is ordinary: turning it off withdraws all its files and their outline pages until it returns. The mint `format` setting stays `outline-olai` by default; while both outline rows are on, the `+ New outline` box asks which spelling to mint — the configured row chosen first — and a typed `notes.org` names its format in the name itself, with the door's refusal saved for suffixes it cannot mint (`notes.md`).
