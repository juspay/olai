# Markdown

Markdown supplies pages for the vault's bodied files, including the existing Markdown editor and the read-only HTML, CSV, image and PDF views. It owns document body subscriptions, headings, document drafts, conflict handling, frontmatter display and its own undo history. Its server readings and writes run without browser code or outline UI.

The browser provider owns a document reader and a fresh edit-history scope. Its content integration registers with `navigation.content`, and its creation control registers with `files.types`. A Markdown page reads its document metadata and body directly; it needs no outline page, outline filtering, selection or drag context. Disabling outlines leaves an existing Markdown editor mounted and able to save. File metadata comes from the vault, so disabling the Files sidebar also leaves open content intact. Frontmatter remains readable independently; when outlines is present, it contributes the existing rich property drawer through the document-owned properties location.

Separate integrations contribute document previews and document-property navigation to outlines. Journal consumes Markdown's body location for daily notes and its creation handoff capability for opening newly created notes. Those integrations retract when Markdown leaves. Outline notes and chat messages continue rendering Markdown text through `@olai/markdown-ui`, which is a static renderer independent of this plugin.

Drafts retain their original conflict baseline across unrelated shell changes. Removing Markdown withdraws its content and integrations and clears retained drafts and creation handoffs. Re-enabling starts a fresh activation; it does not resurrect unsaved text from the departed one.
