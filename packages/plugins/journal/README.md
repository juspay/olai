# olai-plugin-journal

The journal tenant owns olai's calendar, day page, agenda, owed badge and daily-note mint.

- `src/wire.ts` declares the browser-only sibling surface.
- `src/server.ts` derives journal readings from the vault through the shared standing-query cache and exposes the narrow `note.mint` write.
- `src/browser.tsx` registers journal routes, sidebar seats and palette destinations.
- `docs.md` is the user-facing account served as `docs/plugins/journal.md`.

Core retains the date and repeat file-format vocabulary. This package owns only the journal application built from it.
Its route claims and node-page protocol are checked by the shell's typed route adapter.
