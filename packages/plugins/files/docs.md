# Files

Files owns the directory tree and file creation/deletion controls. It consumes
the vault's file-access service and keeps browser-local folder preferences under
its own scope. The sidebar receives its tree through a contribution; disabling
files removes browsing UI without withdrawing an open content editor.

Sidebar file rows carry their served path through the host-supplied `Landings` table. A press still opens the file; a travelled carry suppresses navigation. Holding a file on a phone closes the drawer through the sidebar region’s existing owner-supplied `onClose` callback, without unmounting the carrier.

`files.state` carries the two controls this row draws for another row's page —
the box that names a new file and the guarded verb that deletes one. The
outline and the document each name it on a component of their own, so a page
with no files row mounted is a whole page with no delete verb under it and no
minting box.

Content providers contribute creation controls through `files.types`. Removing
a content provider removes its control. The tree and vault group live in files,
while capture, pins and trash provide their own sidebar contributions.

`files.kinds` holds scoped glyph, noun, article and test-id contributions keyed
by a claiming row id or by `holds`. Lookup prefers the row id, then `holds`.
Outlines draws every node-holding format; body rows draw their own glyphs.
A claimed file whose browser contribution is absent gets the plain-file glyph
and its server claim's noun. A withdrawn server claim leaves no tree row.
