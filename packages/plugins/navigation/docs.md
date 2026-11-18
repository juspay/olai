# Addresses, panes and the command palette

This plugin owns the address in the browser's bar, the history behind Back and Forward, the panes a page is drawn in, and the command palette.[^anchor]

A pane is one column of the main area, showing one page.

## The addresses you see

| Address | The page |
| --- | --- |
| `/` | the front page: the first outline found |
| `/notes/plan.olai` | a file |
| `/notes/plan.olai#<id>` | that outline, with the row selected |
| `/README.md#install` | a document, at that heading |
| `/#<id>` | a row, selected where it is |
| `/zoom/#<id>` | the row's own page |
| `/trash` | the Trash |
| `/s/…` | a saved layout of panes |
| `?q=…` | the page you are on, narrowed |

A link to a row is `/#<id>`; the bullet and **Zoom in** open `/zoom/#<id>`.[^reveal] A plugin's own page picks its address.[^addresses] An address outlives the plugin that drew it.[^leaving]

## What a click does

| Gesture | Where the page opens |
| --- | --- |
| a click, or `Enter` | in place |
| `Alt` and a click | in a pane on the right |
| `Alt` + `Shift` and a click | in a new pane beside this one |
| `Ctrl`, `Cmd`, `Shift` or a middle-click | the browser's own, untouched |

A link opens in the pane it is drawn in.[^pane][^chat] Back and Forward walk the window's history.[^back]

## When a page cannot be opened

A pane says `Loading…` while the directory is read, and `Finding…` while olai looks for the file a row lives in.[^answering] The closed block below lists the refusals.

## The command palette

`Cmd` + `K` opens the palette, a box labelled **Command palette**; `Cmd` is the key on a Mac and `Ctrl` elsewhere. Typing filters the rows.[^rows] The empty box names the prefixes it takes.[^prefix] A row can open a further step instead of acting at once.[^levels]

## What other plugins add

A plugin can add a page, a palette row, a prefix, a link preview or a keyboard shortcut.[^locations] Navigation offers three services.[^services]

[^anchor]: Every link in olai is an ordinary HTML anchor, and this plugin answers the click on it.

[^addresses]: The journal's `/agenda` is one such page. A `/s/` address that names one file is still that file. Pane segments in the address, several of them, or an explicit tree of them, describe a whole layout of panes instead.

[^reveal]: `/#<id>` selects the row in a pane that is already showing it, and otherwise opens the row's file at that row. Everything that points at a row works this way: breadcrumbs, `see` and blocker references, backlinks, search hits, property chips and references inside a conversation. The bullet, **Zoom in** and a conversation's rows open `/zoom/#<id>` instead, which is the row's own page.

[^leaving]: When a plugin is switched off, its page is removed from the screen and every open address is read again against the plugins that remain. The address stays in the bar and in the history, so the page comes back when the plugin does. An address nothing can read shows the front page rather than nothing.

[^pane]: Anything outside every pane, such as the header, acts on the pane you last used. A link to a place on the page you are already on stays with the content that drew it, and so do `download` links and links aimed at another window.

    A hover preview ([link-preview.md](link-preview.md)) and the tab strip's link menu ([tabs.md](tabs.md)) read the same rules, so all three agree about where a link goes.

[^chat]: A pane drawing a conversation keeps it: a link pressed there opens in the pane to its left, or in one opened to its right where there is nothing on the left. So an agent's answer stays on screen while you read what it points at. **Open beside ›**, on the chat's own page and wherever chat names a conversation, is the same arrangement made by hand ([chat.md](chat.md)).

[^back]: A plugin that keeps several layouts open, such as the tab strip ([tabs.md](tabs.md)), gives the one in front a history list of its own, and Back and Forward then walk that list alone. A step that meets another list's entry keeps going the same way without drawing anything, and returns to where it started when this list has nothing further. Nothing on screen changes while it travels.

    History belongs to the loaded document: after a reload every earlier entry is dead, and each browser tab starts with an empty history. Bringing a layout to the front is not a history step.

[^answering]: A pane keeps showing the page it has until the next one answers, with `Loading…` as the sign. Links, Back and search stay usable meanwhile, so you can leave a request that failed or is being held.

    Keystrokes are never saved up across pages: an edit aimed at a row of the page you have left is declined until the new page arrives, and olai does not guess what you meant for the new one. Undo stays available throughout, because each undo names the row it acts on.

[^prefix]: The empty box says `Jump`, `toggle`, and each plugin's own prefix. A prefix is a single character that takes the rest of the line, such as capture's `+`. Switch that plugin off and the character is ordinary text again. Where two plugins ask for one character, the first keeps it and olai reports the clash.

[^rows]: Typing filters the rows this browser tab already holds, and the rows and documents a search finds arrive under them, so a late answer never pushes a row out from under the cursor. Six rows are navigation's own: **Go home**, **Go to Trash**, **Toggle sidebar**, **Keyboard shortcuts**, **Reset sidebar width** and **Close pane**, with their hints in the closed block below. Other plugins add rows of their own.

[^levels]: A further step replaces the list, puts a breadcrumb for itself before the box, and empties the box. A step is either a group of ordinary rows or a box you type a value into. The closed block below holds both kinds, the keys that move through them, how a plugin declares one, and what happens when its plugin is switched off.

[^locations]: The seven places a plugin can add to are `app.route`, `navigation.pages`, `navigation.content`, `navigation.palette-adapters`, `navigation.link-previews`, `app.keys` and `app.palette`. The closed block below says what each takes, and how a keyboard shortcut is registered.

[^services]: `navigation.state` writes a plugin's address, reads one, says which plugin is behind an address, and says whether a page takes a filter. `navigation.palette` is what another plugin may do to the box: open it, open it at a step, ask a question in it, or close it. `navigation.gestures` ignores the extra click a touch browser sends after a long press. The runtime these sit on is [../architecture/plugin-system.md](../architecture/plugin-system.md).

<details>
<summary>What a pane says when it cannot open a page</summary>

| The pane says | Why |
| --- | --- |
| `Loading…` | the directory is still being read |
| `Finding…` | olai is still looking for the file the row lives in |
| `Page not found` — `There is no node at this address.` | the row does not exist |
| `Page not found` — `There is no document named notes/plan.md.` | the directory holds nothing by that name |
| `Page not found` — `There is nothing named notes/plan.` | the name carries no suffix olai knows |
| `Page not found` — `olai can't open .xyz files.` | no plugin claims that suffix |
| `This page can't be opened` — `The plugin that opens documents is turned off.` | the file is there and the plugin that draws its page is off |
| `This page can't be opened` — `The plugin that shows it is turned off.` | the plugin whose page this address is has been switched off |
| `This page can't be opened` — `The outline could not say where this node lives.` | olai could not find the file the row lives in |

Every one of them but `Loading…` offers **Go home**.

</details>

<details>
<summary>The palette's own rows</summary>

| Row | Hint |
| --- | --- |
| **Go home** | `Open the first outline` |
| **Go to Trash** | `Deleted items` |
| **Toggle sidebar** | `Cmd` + `\` |
| **Keyboard shortcuts** | `All keys` |
| **Reset sidebar width** | `Back to default` |
| **Close pane** | `Cmd` + `Shift` + `W` |

</details>

<details>
<summary>Steps inside the palette, and how the panel behaves</summary>

`Backspace` in an empty box goes back one step, clicking a breadcrumb closes that step and every step after it, and `Escape` closes the palette; reopening starts at the top. Inside a step the box belongs to that step, so a prefix character typed there is just a character.

| Kind | What it draws |
| --- | --- |
| a group | a list of ordinary rows, which open a page, run something, write something or open a further step, with no limit on depth. A fixed list is filtered by what you type; a list a function answers matches for itself |
| a value | a free-text box with its own placeholder and starting text, and options the arrow keys move between. `Enter`, a click on an option or the submit button sends it |

A value step's `validate` returns a sentence, which the palette draws in its refusal line with the step still open. While a submission is in flight the step says it is busy and refuses a second one.

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

A group row is found at the top level by its own label, like any command; its children are not searched from there. `showAt(path, text?)` opens the palette already inside a path of row ids, and puts `text` in the deepest step when the whole path is found. Where the path stops being found, the palette opens at the deepest step that was.

When the plugin behind an open step is switched off, that step and everything after it stop being drawn. The palette stands at the deepest step still there and says which one it dropped. A draft you typed, the option you chose and a submission in flight all survive the overlay being redrawn by an unrelated plugin.

> Closing a step while a submission is in flight stops the palette listening; it does not undo what the submission already did elsewhere. A plugin whose submission goes on to navigate or open something must check `signal.aborted` first.

The palette, and the keyboard shortcuts sheet it opens, are native dialogs. The page behind is inert (no click, no cursor, no tab stop), so the keyboard cannot leave the panel.

`Escape` is a close request the browser offers the topmost panel, so a question standing in the box answers it first, and the dialog closes only once nothing is standing. A click outside closes it the same way. Neither can be opened while the app is frozen behind the **Connection lost** card.

The cursor goes back to whatever held it when the palette opened, unless the row you chose moved you, in which case the page keeps what it showed you.

The palette's steps are tested end to end against the maintained fixture in [test-palette.md](test-palette.md), on a desktop and on a phone.

</details>

<details>
<summary>What other plugins add, and the shortcuts they register</summary>

| Location | Takes |
| --- | --- |
| `app.route` | a plugin's own page: its `claims`, `parse`, `href`, `breadcrumb` and `narrowable`, plus what draws it. A page over rows hands over a reading of rows, which outlines draws; a page a plugin draws itself is drawn inside navigation |
| `navigation.pages` | the page for a kind of file, keyed by the claiming plugin's id or by what the file holds |
| `navigation.content` | a handler for a computed address |
| `navigation.palette-adapters` | palette rows and prefixes that depend on where you are |
| `navigation.link-previews` | a preview of where a link goes |
| `app.keys` | a keyboard shortcut |
| `app.palette` | a row that opens an address |

Each address carries which of the two kinds it is, so tabs, pane labels, breadcrumbs, link intents and the palette all treat both kinds alike. The plugin drawing them can still tell its own addresses apart after another plugin has been switched off. A pane still holding a departed plugin's address draws `Page not found` with **Go home**, whichever kind it was.

`app.keys` takes a shortcut, dispatched after olai's own table and by the same rule: `Cmd` on Apple and `Ctrl` elsewhere, no `Alt`, and `Shift` matched exactly. With `Shift` held, `.` and `,` match by the key they sit on.

A shortcut whose key and `Shift` olai's own table already answers is refused with a console warning naming both, and between two plugins the first keeps it. Registered shortcuts are listed in the shortcuts sheet under `Added by plugins`, in their own words. They work only while the palette's component is drawn, so with the layout plugin off a registered shortcut does nothing.

</details>

<details>
<summary>What a page is called</summary>

`Routing.label(route)` is a page's short name: `Home`, `Trash`, a row's id, a file's path, or a plugin page's breadcrumb.

`Routing.name(route)` is what a whole document goes by: the name without its suffix for a kind the directory keeps, `garden` for `garden.olai`, and the filename with its suffix for anything else, `q3.pdf`. It answers nothing for a page that is not a file. The tab strip and a pane header both read `name` and fall back to `label`.

</details>
