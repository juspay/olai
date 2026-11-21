# Where a plugin of your own can draw, and how it writes

A plugin in your directory draws the same places a built-in plugin does, and its page can ask its own server code to change your files.

## What it can add

| Place | What you see |
| --- | --- |
| a row of an outline | a chip, a pane or a block for one of the plugin's properties, or a verb on the row's **•••** menu |
| an outline's page | something above or below the rows |
| the sidebar | a section of its own, or an entry among the app's |
| the palette | a row that opens an address |
| the keyboard | a shortcut that does what the plugin says |
| the header | a readout, a banner, or a row of the health popover |

Each of these is a slot, a named place a plugin registers a component in.[^slot] What a plugin draws there stays only while the plugin is running: switch it off and every one of them goes.[^off]

## Buttons that change your files

A button the plugin draws can ask the plugin's own server file to write, and that write goes through the same checks as your own typing. It shows in the commit panel like any other change.[^write]

[^slot]: An agent writing a plugin calls `vault-plugins_inspect`, which lists every slot this server has. Each entry names the slot, says how many plugins may fill it, and carries one sentence from the plugin that owns the slot saying what a component there is handed.

[^off]: A plugin is drawn only while it is approved at the version on disk, switched on and not failing. Turning it off, editing its code, or a fault takes away everything it drew, with no reload.

[^write]: The reading companion in [dynamic-plugins-examples.md](dynamic-plugins-examples.md) does this twice: a word you click in a sentence becomes a row of your vocabulary, and **Again**, **Good** and **Easy** write when a word is next due.

<details>
<summary>Every slot, and how a browser file talks to its own server file</summary>

<!-- guide:start -->

## Where a face can go

A browser file draws by registering a face in a slot with `Slots.register`. `vault-plugins_inspect` lists every slot this server has: its name, its key rule, and a sentence from the slot's owner saying what a face there is handed. Read it before you write a face, because a face that reads a field the slot does not pass gets `undefined` and draws nothing.

| Slot | What a face there is |
| --- | --- |
| `outline.row.chip`, `outline.row.pane`, `outline.row.block`, `outline.row.placement` | how one of the plugin's own property kinds is drawn on a row |
| `outline.row.aside`, `outline.row.fold`, `outline.crumb.aside` | a component handed a row's id and file, drawn beside it, under it, or in a breadcrumb |
| `outline.page.head`, `outline.page.foot` | a component handed the id of a row, drawn at the top or foot of that row's own page; a whole file's page draws none |
| `outline.row.action` | the plugin's verbs on a row's **•••** menu |
| `sidebar.section`, `sidebar.entry` | a section of the sidebar, or an entry among the app's own |
| `app.keys` | a keyboard shortcut, `Cmd` and a key (`Ctrl` elsewhere) |
| `app.palette` | a palette row that opens an address |
| `app.header`, `app.banner` | a readout in the header or the health popover, or a banner across the top |
| `app.viewer`, `app.mount` | the app's one viewer, or a wrapper around the whole app |
| `plugins.row` | words and buttons on the plugin's own row of the **Plugins** panel |
| `conversation.wake`, `tool.reply`, `delivery.mark` | a conversation's controls, how its replies are drawn, and its mark |
| `app.route` | not open to a plugin in your directory: it takes only a page built with navigation's own functions, which such a plugin cannot import |

A slot keyed by plugin holds one face per plugin, and a slot keyed by nothing is a list, so a plugin may put several faces in it.

- `app.keys` refuses a key the app already answers, such as `Cmd` + `K`, and a key an earlier plugin took. That key is not listened for, and the browser's console says which plugin asked for it.
- `app.viewer` holds one face in all: while another plugin holds it, a second registration fails the plugin that asked.

### A sidebar section, a key and a palette row

The reading companion in [dynamic-plugins-examples.md](dynamic-plugins-examples.md) registers all three from its browser file:

```tsx
yield* slots.register("sidebar.section", { said: "Reading", body: Section })
yield* slots.register("app.keys", {
  key: "y",
  shift: true,
  whileEditing: false,
  said: "Open your vocabulary",
  press: () => open(VOCABULARY),
})
yield* slots.register("app.palette", {
  id: "reader-book",
  label: "Open the book you are reading",
  search: "reader book french read",
  href: BOOK,
})
```

- A link in a face is an ordinary `<a href>`. olai follows a link to one of its own addresses inside the app, with no reload.
- A key's `press` gets nothing, so the plugin's `open` follows an address the same way a link does: it adds an `<a>` to the page, clicks it and takes it away. `Cmd` + `Shift` + `Y` opens the vocabulary, and `whileEditing: false` leaves the key alone while the caret is in a text field.
- A palette row opens its `href` when you choose it, and is found by the words in its `search`.
- Switch the plugin off and the section, the key and the palette row go together.

## Talk to your own server file

A browser file asks its own server file for things through a surface: a list of named calls, each with what it takes and what it answers. Four steps, which the reading companion follows file by file:

1. Write the surface once, in a file both entries import, with `defineSurface` from `@olai/plugin-api`. Beside it, a `faces` map says who may make each call: `browser` for the plugin's own page, `agent` for your agents.
2. `server.ts` names `Surfaces` in `needs` and registers `{ surface, faces, deps }`, where `deps` answers each call.
3. `browser.tsx` exports `surface`, so the tab connects to it, names `Wired` in `needs`, and calls `clientOf(surface, wired)`. That answers the surface's own typed client, or `null` while the plugin's server file is not connected.
4. To write, `server.ts` names `Ops` in `needs` and runs `(yield* Ops).gate.run(request, "web")`. The gate plans, checks and commits the write exactly as it does your typing.

- The calls are on the connection under the plugin's own name, and only while it is running.
- A member the `faces` map grants to `agent` becomes something your agents can call, and the plugin's page lists each one under **What it uses**.
- A write the server file makes runs as the writer it names, with none of the limits olai puts on an agent's own writes, even when an agent made the call. The server file cannot tell which face called it.
- The gate's types come with `@olai/plugin-api`: `Gate`, `WriteRequest`, `Writer`, `WriteResult` and `OpFailure`.

<!-- guide:end -->

</details>
