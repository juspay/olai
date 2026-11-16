# Navigation

`navigation` owns the address in the browser's bar, the history behind Back and
Forward, the panes a page is drawn in, and the command palette. Every link in
olai is an ordinary anchor, and this row answers the press on it.

## The addresses you see

| Address | The page |
| --- | --- |
| `/` | the front page: whichever outline is found first |
| `/notes/plan.olai` | a file |
| `/notes/plan.olai#<id>` | that outline, with the row revealed |
| `/README.md#install` | a document, at that heading |
| `/#<id>` | a row, revealed wherever it is |
| `/zoom/#<id>` | the row's own page |
| `/trash` | the Trash |
| `/s/…` | a saved layout of panes |
| `?q=…` | the page you are on, narrowed |

A plugin's page spells its own words — the journal's `/agenda` is one. A `/s/`
address naming one literal file is still that file; encoded pane segments,
several segments, or an explicit tree describe a workspace.

`/#<id>` means reveal: the row is selected where it is already visible in the
pane, and otherwise its file opens at that row. Everything that points into a
place reveals — breadcrumbs, `see` and blocker references, backlinks, search
hits, property chips and transcript references. The bullet, **Zoom in** and a
conversation's rows open `/zoom/#<id>` instead, which is the row's own page.

When a plugin leaves, its page unmounts and the open addresses are read again
against the claims that remain. The address stays in the bar and in history, so
the page comes back when the plugin does, and a link it cannot read spells the
front page rather than nothing.

## What a click does

| Gesture | Where the page opens |
| --- | --- |
| a click, or `Enter` | in place |
| `Alt` and a click | in a pane on the right |
| `Alt` + `Shift` and a click | in a new pane inserted beside this one |
| `Ctrl`, `Cmd`, `Shift` or a middle-click | the browser's own, untouched |

The pane a link is drawn in is the pane it acts on; chrome outside every pane
acts on the focused pane. A link to a fragment of the page you are on stays
with the content that drew it, and so do `download` links and links aimed at
another window. The same reading answers a hover preview
([link-preview.md](link-preview.md)) and the tab strip's link menu
([tabs.md](tabs.md)), so all three agree about where a link goes.

## When a page cannot be opened

| The pane says | Why |
| --- | --- |
| `Loading…` | the directory is still being read |
| `Finding…` | a reveal is still looking for the row's file |
| `Page not found` — `There is no node at this address.` | the row does not exist |
| `Page not found` — `There is no document named notes/plan.md.` | the directory holds nothing by that name |
| `Page not found` — `There is nothing named notes/plan.` | the name carries no suffix olai knows |
| `Page not found` — `olai can't open .xyz files.` | no row claims that suffix |
| `This page can't be opened` — `The plugin that opens documents is turned off.` | the file is served and its page's row is off |
| `This page can't be opened` — `The plugin that shows it is turned off.` | the plugin whose page this address is has left |
| `This page can't be opened` — `The outline could not say where this node lives.` | the reveal could not be answered |

Every one of them but `Loading…` offers **Go home**.

## Back and Forward

Back and Forward walk the window's history. A row that keeps several workspaces
open, such as the tab strip ([tabs.md](tabs.md)), names a lane for the one in
front, and Back and Forward then walk that lane's entries alone. A traversal
that meets another lane's entry keeps going in the same direction without
drawing anything, and returns to where it started when this lane has nothing
beyond it. Nothing on screen changes while it travels.

History is per document, so after a reload every entry written before it is
dead, and each browser tab's history starts empty. Bringing a workspace forward
is not a history step.

## The palette

`Cmd` + `K` opens **Command palette**; `Cmd` is the modifier on a Mac and
`Ctrl` elsewhere. The empty box says what it takes: `Jump`, `toggle`, and each
contributed prefix in that plugin's own words. Typing filters the rows this tab
already holds, and the nodes and documents a query finds arrive under them, so
a late answer never pushes a row out from under the cursor.

| Row | Hint |
| --- | --- |
| **Go home** | `Open the first outline` |
| **Go to Trash** | `Deleted items` |
| **Toggle sidebar** | `Cmd` + `\` |
| **Keyboard shortcuts** | `All keys` |
| **Reset sidebar width** | `Back to default` |
| **Close pane** | `Cmd` + `Shift` + `W` |

Other plugins add rows of their own, and prefixes: a character that takes the
rest of the line, such as capture's `+`. Switch that plugin off and its
character is ordinary query text again. Where two plugins ask for one
character, the first keeps it and the clash is reported.

### Levels

A palette row can open a level instead of acting at once. The list is replaced
by the level, a crumb for it goes before the box, and the box empties.
`Backspace` in an empty box goes back one level, clicking a crumb closes that
level and every level after it, and `Escape` closes the palette; reopening
starts at the root. Inside a level the box belongs to the level, so a prefix
character typed there is a character.

| Kind | What it draws |
| --- | --- |
| a group | a list of ordinary rows, which route, run, write or open a further level, with no depth limit. A static list is filtered by what you type; a list a function answers does its own matching |
| a value | a free-text box with its own placeholder and starting text, and options the arrows move between. `Enter`, a click on an option or the submit button sends it |

A value level's `validate` returns a sentence, which is drawn in the palette's
refusal line with the level still up. While a submit is in flight the level
says it is busy and refuses a second one.

```ts
yield* slots.contribute(paletteAdapters, { items: () => [{
  id: "notes-new", label: "New note", taking: atOnce, search: "new note",
  action: { kind: "level", level: {
    kind: "value", placeholder: "Say something…",
    options: [{ id: "here", label: "Here" }, { id: "inbox", label: "Inbox" }],
    validate: (text) => text.trim() === "" ? "Type something first." : null,
    submit: async (text, where, signal) => {
      await save(text, where?.id)
      return signal.aborted ? {} : { said: { tone: "aside", text: "Saved." } }
    },
  } },
}] })
```

A group row is found at the root by its own label, like any command; its
children are not searched from the root. `showAt(path, text?)` opens the
palette already drilled into a path of row ids, and puts `text` in the deepest
level when the whole path resolves; where the path stops resolving, the palette
opens at the deepest level that does.

When the plugin behind an open level goes, that level and everything after it
stop being drawn. The palette stands at the deepest level still there and says
which one it dropped. A draft you typed, the option you chose and a submit in
flight survive the overlay being redrawn by an unrelated plugin.

> Closing or popping a level mid-submit stops the palette listening; it does
> not undo what the submit already did elsewhere. A contributor whose submit
> goes on to navigate or open something must check `signal.aborted` first.

### How the panel behaves

The palette and the keyboard shortcuts sheet it opens are native dialogs. The
page behind is inert (no click, no caret, no tab stop), so the keyboard cannot
leave the panel. `Escape` is a close request the browser offers the topmost
panel, so a question standing in the box answers it first and the dialog closes
only once nothing is standing. A press outside puts it away the same way.
Neither can be opened while the offline freeze is up.

The caret goes back to whatever held it when the palette opened, unless the
row you chose moved you, in which case the page keeps what it revealed.

## Chords a plugin registers

`app.keys` takes a chord, dispatched after olai's own table and by the same
rule: `Cmd` on Apple and `Ctrl` elsewhere, no `Alt`, and `Shift` matched
exactly. With `Shift` held, `.` and `,` match by the key they sit on.

A chord whose key and `Shift` olai's own table already answers is refused with
a console warning naming both, and between two plugins the first keeps it.
Registered chords are listed in the shortcuts sheet under `Added by plugins`,
in their own words. They are answered only while the palette's component is
drawn, so with the layout row off a registered chord does nothing.

## What a page is called

`Routing.label(route)` is a page's short name: `Home`, `Trash`, a row's id, a
file's path, or a plugin page's breadcrumb.

`Routing.name(route)` is what a whole document goes by: the stem for a kind the
directory keeps, `garden` for `garden.olai`, and the filename with its suffix
for anything else, `q3.pdf`. It answers nothing for a page that is not a file.
The tab strip and a pane header both read `name` and fall back to `label`.

## What other plugins contribute

| Location | Takes |
| --- | --- |
| `app.route` | a plugin's own page: its `claims`, `parse`, `href`, `breadcrumb` and `narrowable`, plus a face. A node page hands over a reading of rows, which outlines hosts; a self-drawn page draws itself, and navigation hosts it |
| `navigation.pages` | the page for a file kind, keyed by the claiming row's id or by what it holds |
| `navigation.content` | a handler for a computed route |
| `navigation.palette-adapters` | contextual palette rows and prefixes |
| `navigation.link-previews` | a preview of where a link goes |
| `app.keys` | a chord |
| `app.palette` | a row that opens an address |

A route's kind rides on it, so tabs, pane labels, breadcrumbs, link intents and
the palette treat both kinds alike, and a host can tell its own routes apart
after the plugin has left. A pane still holding a departed plugin's route draws
`Page not found` with **Go home**, whichever kind it was.

`navigation.state` carries the roster-dependent half of the grammar: printing a
plugin's address, reading one, finding the plugin behind one, and whether a
page takes a filter. `navigation.palette` is what a sibling may do to the box —
open it, open it at a level, ask a question in it, shut it.
`navigation.gestures` eats the synthetic click a touch browser makes after a
long press. The runtime these sit on is
[../architecture/plugin-system.md](../architecture/plugin-system.md).

The palette's levels are driven end to end against the maintained fixture in
[test-palette.md](test-palette.md), on a desktop and on a phone.

## While a page is still answering

A pane keeps the page it is drawing until the next one answers, with
**Loading…** as the cue. Links, Back and search stay usable, so you can leave a
request that failed or is being held.

Keystrokes are never buffered across pages: an edit aimed at a row of the page
you have left is declined until the new reading arrives, and olai does not
infer what you meant for the new one. Undo stays available throughout, since
its inverse edits name their own subjects.
