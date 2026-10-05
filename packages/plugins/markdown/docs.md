# Markdown

Markdown claims Markdown text files and supplies their document page, editor and glyph. HTML, CSV, image and PDF views belong to their own rows. It owns document body subscriptions, headings, document drafts, conflict handling, frontmatter display and its own undo history. Its server readings and writes run without browser code or outline UI.

The browser provider owns a document reader and a fresh edit-history scope. Its content integration registers with `navigation.pages`, and its creation control registers with `files.types`, where it is the `New document` item in the Outlines heading's `+` menu. A Markdown page reads frontmatter, referrers and missing-file transitions through its own `documentPage` stream and bodies through its own collection; it needs no outline page, outline filtering, selection or drag context. Disabling outlines leaves an existing Markdown editor mounted and able to save. File metadata comes from the vault, so disabling the Files sidebar also leaves open content intact. Frontmatter remains readable independently; when outlines is present, it contributes the existing rich property drawer through the document-owned properties location.

While a page's first reading is on its way it says `Loading…`. An address that names no such file says `Page not found`, with a detail such as `There is no document named notes/plan.md.` The source editor's accessible name is `Edit <file>`.

Heading fragments remain in each pane's navigation route and scroll history.
A heading link and a contents entry both encode `/document.md#slug` directly
(the authored slug; element ids on the page stay namespaced), and there is no
second destination attribute. A plain click records the heading in the address
and the router's landing scrolls to it; Alt opens that same destination on the
right, including from a preview card. A note in an outline keeps its local
`#fragment` links (footnotes): the renderer scrolls to them in place and the
address is not touched. Metadata subscriptions depend only
on the document path, so changing headings retains the document owner.

`markdown.browser-state` carries what this row owns in a tab — its sibling
client, the open documents and their drafts, and its own edit history — rather
than announcing readiness over values kept in module variables. Where a minted
document is OPENED travels beside it on `markdown.editing`, which the journal's
day page names on a component of its own: with no document row mounted the
journal's calendar, agenda and day pages are whole and the *+ day note* button
is simply not drawn.

An integration contributes document-property navigation to outlines. Journal consumes Markdown's body location for daily notes and its creation handoff capability for opening newly created notes. Those integrations retract when Markdown leaves. Outline notes and chat messages continue rendering Markdown text through `@olai/markdown-ui`, which is a static renderer independent of this plugin.

Drafts retain their original conflict baseline across unrelated shell changes. Removing Markdown withdraws its content and integrations and clears retained drafts and creation handoffs. Re-enabling starts a fresh activation; it does not resurrect unsaved text from the departed one.

Markdown supplies document pages, body editing, heading navigation and document
metadata. Its document read/write procedures and metadata stream belong to this
plugin; enabling the outline renderer is not required to use them.

The vault supplies file access and navigation supplies the active address.
Markdown owns its reading subscriptions and undo history. The default property
drawer keeps frontmatter editable without outlines; optional property renderers
can enhance it through contributed locations.

Disabling Markdown removes document pages and procedures while leaving outline
editing available. Re-enabling it reads the current files with fresh editor state.
Existing browser history remains available for the returning content provider.

Its body collection contains only its own claimed Markdown files. The four
read-only body rows obtain their metadata through the vault’s file surface and `vault.files`; this row’s live state is used only by Markdown.

Rendered prose is cached by claims, source, writing file, and directory
membership snapshot. The snapshot supplies both membership lookup and cache
identity, so callers cannot pair a changing predicate with a stale revision. Code spans,
code fences and frontmatter cannot introduce missing-link warnings; queries
and fragments are excluded from membership checks. Authored link titles are
preserved alongside the warning.

## Draft and rendering lifetime

A live pane keeps its document page across tab switches and layout changes.
Drafts belong to the Markdown activation and are keyed by pane id and file.
The declared navigation integration retains only files still addressed by live
panes, so closing a pane or navigating away abandons that visit's draft. A
missing file restored during the same visit can resume it. Plugin presentation
changes do not use Route-object caches to carry editor state.

Landing marks use the pane's own element. Changes to the vault's path membership
update internal-link metadata without rebuilding unrelated Markdown HTML.
