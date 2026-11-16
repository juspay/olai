# The file list in the sidebar

The `files` plugin draws the list of files in the sidebar, olai's left column. It is also where you make a file and where you delete one.[^browse]

## What the list shows

The directory olai serves, in three sections:

| Section | Holds |
| --- | --- |
| **Outlines** | every file of a kind that holds rows, a row being one line of an outline[^claimed] |
| **Reference** | every other file olai knows the kind of, with a count beside the heading[^reference] |
| `olai` | the `_olai/` files — Pins, Settings, the Inbox — grouped under one entry[^olai] |

Every line of the list shows where its file is, not only its name.[^paths] When the sidebar is collapsed to its narrow rail, the list becomes two icons.[^rail]

## Make a file

The `+` on the **Outlines** heading, named **New outline or document**, opens a menu of the kinds of file you can make.[^menu]

1. Type a path without a suffix — `notes/plan`, which is the box's own suggestion.
2. Press `Enter`. The kind's suffix is added, so you get `notes/plan.olai`, and the box closes.[^creating]

If the name already ends in another kind's suffix, nothing is written.[^suffix] An empty directory shows a `No outlines yet` page, and its **New outline** button opens the same box.[^nooutlines]

## Delete a file

A file's page has **Delete…** beside **Edit**, and asks you to confirm first.[^ask]

> There is no undo for this. What [git.md](git.md) has already committed can be recovered from git; anything else cannot.

## What the Reference section remembers

Opening the section is remembered. Collapsing it is not: olai forgets that you opened it rather than storing that it is shut.[^fold] Opening a reference file shows the section and highlights that file, without storing anything.[^reveal]

[^browse]: The list is the **Outlines** tree, the **Reference** section under it, and the `olai` group of olai's own files. **Outlines** and **Reference** leave out folders that hold no files. How you move around the directory is in [../getting-around.md](../getting-around.md).

[^claimed]: olai lists only files of a kind one of its plugins claims; which kinds those are is in [vault.md](vault.md). A claimed file whose plugin is switched off gets the plain file glyph and the name of the kind.

[^reference]: The **Reference** section is absent when there are no such files, and collapsed until you open it.

[^olai]: The `olai` group is drawn only when `_olai/` holds a file. The Trash entry belongs to [trash.md](trash.md) and sits at the foot of the column rather than in that group.

[^paths]: The row draws the file's name, and the whole path is both the tooltip and the end of the name a screen reader reads out. A folder's fold button keeps its own name, `Expand <folder>` or `Collapse <folder>`, and carries the path on the folder glyph beside it. A file that could not be read wears a ⚠ whose sentence, `This file couldn't be read`, is drawn in the row as well as given as the tooltip.

[^rail]: The two icons are `Outlines`, named `Open outlines`, and `Documents`, named `Open the sidebar`.

[^menu]: The menu holds **New outline**, **New document**, and one item for every other kind of file that can be made. Picking one opens a path box under the heading with the cursor in it; `Escape` closes the menu or the box and gives the cursor back to the `+`.

[^creating]: The box says `Creating…` while the write is in flight. It is a box for a name, and it tells a phone so: the return key says **Done**, and nothing is autocorrected, capitalised or spell-checked, so `garden.olai` typed on a phone is `garden.olai` on disk.

[^suffix]: The box names the kind the name belongs to, and suggests the name to type instead: at the outline door, `notes/plan.md` is a document, so the box offers `notes/plan`, which makes `notes/plan.olai`. A kind whose plugin is off says `Creating <kind> files is turned off.`

[^nooutlines]: With the `files` plugin off, the **New outline** button is not drawn.

[^ask]: The question is `Delete notes/plan.olai? olai can't bring it back. Only what git has already saved can be recovered.`, with **Delete file** and **Cancel**.

[^fold]: Clicking the heading folds the section even while the open file is the one that showed it, until you navigate or reload.

[^reveal]: Opening a reference file also opens the folders it sits in. So a reload with a reference file open shows it again, and a reload on an outline keeps the default collapse. Folder folds are a separate decision from the Reference one.

<details>
<summary>Files a plugin's own page draws</summary>

A file kind can say that its files are listed somewhere other than the sidebar, and one kind does. The two code files of a plugin your own directory defines are in neither list, because that plugin's own page shows them ([vault-plugins.md](vault-plugins.md)). They are files of the directory all the same, recorded by git and listed by path in the commit panel, and the address of one opens that page at that file.

</details>

<details>
<summary>What other plugins contribute</summary>

| Location | Takes |
| --- | --- |
| `files.types` | a kind of file that can be made: its item in the `+` menu, and the path box it opens. Remove the last one and the heading has no `+` |
| `files.kinds` | a kind's glyph, noun, article and test ids, keyed by the id of the plugin that claims it or by what it holds. The plugin's id is preferred |

`files.state` carries the two controls this plugin draws for another plugin's page: the path box, and the delete that asks first. Its `open(kind)` opens the path box for one kind and brings the sidebar into view: on a desktop the column comes out of its rail, and on a phone the drawer opens. A page that names `files.state` on a component of its own is whole without this plugin: no delete, no path box.

Switching `files` off removes the list and those two controls, and leaves an open editor and its file untouched.

</details>
