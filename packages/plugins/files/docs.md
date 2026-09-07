# Files

Files owns the directory tree and file creation/deletion controls. It consumes
the vault's file-access service and keeps browser-local folder preferences under
its own scope. The sidebar receives its tree through a contribution; disabling
files removes browsing UI without withdrawing an open content editor.

`files.state` carries the two controls this row draws for another row's page —
the box that names a new file and the guarded verb that deletes one. The
outline and the document each name it on a component of their own, so a page
with no files row mounted is a whole page with no delete verb under it and no
minting box.

Content providers contribute creation controls through `files.types`. Removing
a content provider removes its control. The tree and vault group live in files,
while capture, pins and trash provide their own sidebar contributions.
