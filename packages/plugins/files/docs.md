# Files

`files` draws the file list in the sidebar, and is where you make a file and where you delete one.[^browse]

## What the list shows

Two walks over the served directory, both omitting empty folders:

| Section | Holds |
| --- | --- |
| **Outlines** | every claimed file whose kind holds nodes[^claimed] |
| **Reference** | every other claimed file, with a count beside the heading[^reference] |
| `olai` | the `_olai/` files — Pins, Settings, the Inbox — under one parent[^olai] |

Every row says where its file is, not only what it is called.[^paths] On the collapsed rail the list is two icons.[^rail]

## Make a file

The `+` on the **Outlines** heading, named **New outline or document**, opens a menu of the kinds that can be minted.[^menu]

1. Type a path without a suffix — `notes/plan`, the box's own suggestion.
2. Press `Enter`. The kind's suffix is added, so you get `notes/plan.olai`, and the box closes.[^creating]

A name that already carries another kind's suffix writes nothing.[^suffix] The same box opens from the **New outline** button on an empty directory's `No outlines yet` page.[^nooutlines]

## Delete a file

A file's page carries **Delete…** beside **Edit**, and it asks first.[^ask]

> There is no undo for this. What [git.md](git.md) has already committed can be recovered from git; anything else cannot.

## What the Reference fold remembers

Opening the section stores that choice; collapsing it forgets the choice rather than storing the opposite.[^fold] Opening a reference file reveals the section and marks its row, without storing anything.[^reveal]

[^browse]: The list is the **Outlines** tree, the **Reference** section under it, and the `olai` group of olai's own files. Browsing the directory is [../getting-around.md](../getting-around.md).

[^claimed]: Which files are claimed at all is [vault.md](vault.md); a claimed file whose browser row is off gets the plain file glyph and the claim's noun.

[^reference]: The **Reference** section is absent when there are none, and collapsed until you open it.

[^olai]: The `olai` group is drawn only when `_olai/` holds a file. The Trash door is [trash.md](trash.md)'s own, at the foot of the column rather than a row of that group.

[^paths]: The row draws the basename, and the whole path is both the tip and the end of the row's accessible name. A folder's fold button keeps its own name, `Expand <folder>` or `Collapse <folder>`, and carries the path on the folder glyph beside it. A file that could not be read wears a ⚠ whose sentence, `This file couldn't be read`, is drawn in the row as well as given as the tip.

[^rail]: The two icons are `Outlines`, named `Open outlines`, and `Documents`, named `Open the sidebar`.

[^menu]: The menu holds **New outline**, **New document**, and one item per other kind that can be minted. Picking one opens a path box under the heading with the caret in it; `Escape` shuts the menu or the box and gives the caret back to the `+`.

[^creating]: The box says `Creating…` while the write is in flight. It is a box for a name, and it tells a phone so: the return key says **Done**, and nothing is autocorrected, capitalised or spell-checked, so `garden.olai` typed on a phone is `garden.olai` on disk.

[^suffix]: The box names the kind the name belongs to and suggests the name to type instead: at the outline door, `notes/plan.md` is a document, so the box offers `notes/plan`, which makes `notes/plan.olai`. A kind whose row is off says `Creating <kind> files is turned off.`

[^nooutlines]: With the files row off, the **New outline** button is not drawn.

[^ask]: The question is `Delete notes/plan.olai? olai can't bring it back. Only what git has already saved can be recovered.`, with **Delete file** and **Cancel**.

[^fold]: Clicking the heading folds the section even while the open file is the one that revealed it, until you navigate or reload.

[^reveal]: Opening a reference file reveals its ancestry too. So a reload with a reference file open reveals it again, and a reload on an outline keeps the default collapse. Folder folds are a separate decision from the Reference one.

<details>
<summary>Files a plugin's own page draws</summary>

A claim may say its files are read somewhere else, and one does. The two code files of a plugin the directory defines are in neither walk, because that plugin's own page draws them ([vault-plugins.md](vault-plugins.md)). They are in the set all the same, in the ledger and in the commit panel, and the address of one opens that page at that file.

</details>

<details>
<summary>What other plugins contribute</summary>

| Location | Takes |
| --- | --- |
| `files.types` | a kind that can be minted: its item in the `+` menu, and the path box it opens. Remove the last one and the heading has no `+` |
| `files.kinds` | a kind's glyph, noun, article and test ids, keyed by the claiming row's id or by what it holds. The row's id is preferred |

`files.state` carries the two controls this row draws for another row's page, the path box and the guarded delete. Its `open(kind)` opens the path box for one kind and brings the sidebar into view: the column comes out of its rail on a desktop, and the drawer opens on a phone. A page that names `files.state` on a component of its own is whole without this row: no delete, no path box.

Switching `files` off removes the list and those two controls, and leaves an open editor and its file untouched.

</details>
