# Files

Files owns the outline tree, the collapsed Reference section and file creation/deletion controls. It consumes
the vault's file-access service and keeps browser-local folder and Reference preferences under
its own scope. Two walks select by the served claim: `holds: nodes` goes in Outlines; every other claimed file goes in Reference. Each walk omits empty folders, and both share directory-path fold keys. The sidebar receives both through one contribution; disabling
files removes browsing UI without withdrawing an open content editor.

Sidebar file rows carry their served path through the host-supplied `Landings` table. A press still opens the file; a travelled carry suppresses navigation. Holding a file on a phone closes the drawer through the sidebar region’s existing owner-supplied `onClose` callback, without unmounting the carrier.

`files.state` carries the two controls this row draws for another row's page —
the box that names a new file and the guarded verb that deletes one. The
outline and the document each name it on a component of their own, so a page
with no files row mounted is a whole page with no delete verb under it and no
minting box.

Content providers contribute creation controls through `files.types`. Removing
a content provider removes its control. The two trees and vault group live in files,
while capture, pins and trash provide their own sidebar contributions.

`files.kinds` holds scoped glyph, noun, article and test-id contributions keyed
by a claiming row id or by `holds`. Lookup prefers the row id, then `holds`.
Outlines draws every node-holding format; body rows draw their own glyphs.
A claimed file whose browser contribution is absent gets the plain-file glyph
and its server claim's noun. A withdrawn server claim leaves no tree row.

Reference counts files, excluding `_olai/`, and is absent when empty. Opening a reference file expands the section and its ancestry; its row marks the selection. The Reference preference follows storage for the same activation lifetime as the folder preference and withdraws first.

Reference has a separate boolean preference from folder paths. The active file
can reveal the section and its ancestry without persisting either decision.
Both folds and their subscriptions belong to the Files browser activation.

A header click folds the section even when its active file revealed it. Opening explicitly stores `true`; collapsing removes that preference key. Collapsing an active reference file suppresses selection-driven visibility only until navigation or reload, under the mounted Files contribution. Reloading with a reference file open reveals the section again; reloading an outline keeps the default collapse.

Folder paths (`fold/folders.ts`) and Reference visibility (`fold/reference.ts`)
are separate decisions. The Files activation acquires their storage listeners
separately and releases Reference before folders. Reference's stored default
and temporary selection override compose inside its controller; the sidebar
only renders its `open` value and sends `toggle` gestures. The controller's
reactive work belongs to the mounted sidebar, while preference subscriptions
retain the Files activation lifetime.
