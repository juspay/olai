# Markdown

Markdown claims Markdown text files and supplies their document page, editor and glyph. HTML, CSV, image and PDF views belong to their own rows. It owns document body subscriptions, headings, document drafts, conflict handling, frontmatter display and its own undo history. Its server readings and writes run without browser code or outline UI.

The browser provider owns a document reader and a fresh edit-history scope. Its content integration registers with `navigation.pages`, and its creation control registers with `files.types`. A Markdown page reads frontmatter, referrers and missing-file transitions through its own `documentPage` stream and bodies through its own collection; it needs no outline page, outline filtering, selection or drag context. Disabling outlines leaves an existing Markdown editor mounted and able to save. File metadata comes from the vault, so disabling the Files sidebar also leaves open content intact. Frontmatter remains readable independently; when outlines is present, it contributes the existing rich property drawer through the document-owned properties location.

Heading fragments remain in each pane's navigation route and scroll history. Metadata requests use only the document path, so opening a section still fetches the correct file, and two panes can land independently at headings in the same document. Moving between headings of that file reuses its metadata subscription.

`markdown.browser-state` carries what this row owns in a tab — its sibling
client, the open documents and their drafts, and its own edit history — rather
than announcing readiness over values kept in module variables. Where a minted
document is OPENED travels beside it on `markdown.editing`, which the journal's
day page names on a component of its own: with no document row mounted the
journal's calendar, agenda and day pages are whole and the *+ day note* button
is simply not drawn.

Separate integrations contribute document previews and document-property navigation to outlines. Journal consumes Markdown's body location for daily notes and its creation handoff capability for opening newly created notes. Those integrations retract when Markdown leaves. Outline notes and chat messages continue rendering Markdown text through `@olai/markdown-ui`, which is a static renderer independent of this plugin.

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
