# Where a plugin of your own can draw, and how it writes

A plugin in your directory draws the same places a built-in plugin does, and its page can ask its own server code to change your files.

## What it can add

| Place | What you see |
| --- | --- |
| a row of an outline | a chip, a pane or a block for one of the plugin's properties, or a verb on the row's **•••** menu |
| an outline's page | something above or below the rows |
| the sidebar | a section of its own, or an entry among the app's |
| the palette | a row that opens an address, or one that runs something |
| the keyboard | a shortcut that does what the plugin says |
| a page of its own | a whole page at `/plugins/<name>/app`, and any address under it |
| a file of its own kind | the whole page of every file with a suffix the plugin claims |
| a Markdown note | something above its text, or under it |
| the header | a readout, a banner, or a row of the health popover |

Each of these is a slot, a named place a plugin registers a component in.[^slot] What a plugin draws there stays only while the plugin is running: switch it off and every one of them goes.[^off]

A plugin's own page is always under its own name, and `/plugins/<name>` stays the page where you read its code and turn it on. While the plugin is off, its page's address says so and links there.

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
| `app.command` | a palette row that runs a function, and a key that runs it too |
| `plugin.page` | the plugin's own page at `/plugins/<word>/app`, handed the rest of the address |
| `file.page` | the whole page of a file of the kind the plugin's server file claimed, handed the file's path and its revision |
| `document.page.head`, `document.page.foot` | a component handed a Markdown note's path, drawn above its text or under it |
| `app.header`, `app.banner` | a readout in the header or the health popover, or a banner across the top |
| `app.viewer`, `app.mount` | the app's one viewer, or a wrapper around the whole app |
| `plugins.row` | words and buttons on the plugin's own row of the **Plugins** panel |
| `conversation.wake`, `tool.reply`, `delivery.mark` | a conversation's controls, how its replies are drawn, and its mark |
| `app.route` | not open to a plugin in your directory: it takes only a page built with navigation's own functions, which such a plugin cannot import; use `plugin.page` |
| `search.box.below` | not open to any other plugin: search fills it with the row under its own box, so a second registration is refused |

A slot keyed by plugin holds one face per plugin, and a slot keyed by nothing is a list, so a plugin may put several faces in it.

- `app.keys` refuses a key the app already answers, such as `Cmd` + `K`, and a key an earlier plugin took. That key is not listened for, and the browser's console says which plugin asked for it.
- `app.viewer` holds one face in all: while another plugin holds it, a second registration fails the plugin that asked.
- `app.command`'s key follows `app.keys`' rule, and its line in the shortcut list is the command's label.

### A page of its own, and a command

`plugin.page` takes one component per plugin. It is drawn at `/plugins/<word>/app`, handed `{ rest: "" }`, and at `/plugins/<word>/app/<rest>`, handed the rest. A reload draws it again.

- `/plugins/<word>` is always the page where the plugin is read and turned on, and `/plugins/<word>/<file>` opens that page at one of the folder's files. A path under `app/` that names a code file, such as `app/review.ts`, is that file.
- While the plugin is not running, its addresses under `app` say so and link to `/plugins/<word>`.

The reading companion's review is its own page, opened from the palette, a key and the sidebar:

```tsx
yield* slots.register("plugin.page", Own)
yield* slots.register("app.command", {
  id: "reader-review",
  label: "Start review",
  search: "reader review start words vocabulary",
  run: () => navigate.open(REVIEW),
  chord: { key: "e", shift: true, whileEditing: false },
})
```

### A file of its own kind, and a note's head and foot

A server file claims a suffix with `FileKinds`, and the browser file's `file.page` face draws every file of that kind:

```ts
yield* (yield* FileKinds).register({
  exts: [".reader"],
  holds: "text",
  kept: true,
  opaque: true,
  fetched: false,
  noun: "transcribed page",
  article: "a",
})
```

- The kind is named after the plugin, so the claim and the face need nothing more to find each other.
- `kept: true` keeps the file's text where the gate reads the vault: `(yield* gate.read).set.documents` holds it as `body`. `opaque: true` keeps search and the list of notes out of it.
- The face is handed `{ file, revision }`. `revision` changes when the file does, so the face reads the text again through its own server file.
- The sidebar lists such a file under **Reference**, with the plain file mark: a plugin in your directory cannot give its kind a mark of its own.
- Switched off, the plugin's claim goes with it, and the file's address says olai cannot open that suffix.

`document.page.head` and `document.page.foot` are lists on a Markdown note's page, above its text and under the list of what links to it. Each face is handed `{ file }`.

### A sidebar section, a key and a palette row

The reading companion in [dynamic-plugins-examples.md](dynamic-plugins-examples.md) registers all three from its browser file:

```tsx
yield* slots.register("sidebar.section", { said: "Reading", body: Section })
yield* slots.register("app.keys", {
  key: "y",
  shift: true,
  whileEditing: false,
  said: "Open your vocabulary",
  press: () => navigate.open(VOCABULARY),
})
yield* slots.register("app.palette", {
  id: "reader-book",
  label: "Open the book you are reading",
  search: "reader book french read",
  href: BOOK,
})
```

- A link in a face is an ordinary `<a href>`. olai follows a link to one of its own addresses inside the app, with no reload.
- A key's `press` and a command's `run` get nothing, so they open an address with `Navigate`, navigation's own verb: name it in `needs` and call `(yield* Navigate).open(address)`. It opens the page a link to that address would. `Cmd` + `Shift` + `Y` opens the vocabulary, and `whileEditing: false` leaves the key alone while the caret is in a text field.
- A palette row opens its `href` when you choose it, and is found by the words in its `search`.
- Switch the plugin off and the section, the key and the palette row go together.

## Talk to your own server file

A browser file asks its own server file for things through a surface: a list of named calls, each with what it takes, what it answers and how it can fail. Four steps, which the reading companion follows file by file:

1. Write the surface once, in a file both entries import, with `defineSurface` from `@olai/plugin-api`. A call that writes declares `error: OpFailure`, the gate's refusal. Beside the surface, a `faces` map says who may make each call: `browser` for the plugin's own page, `agent` for your agents.
2. `server.ts` names `Surfaces` in `needs` and registers `{ surface, faces, writes, deps }`. `deps` answers each call, typed with `ImplementSurfaceDeps<typeof surface.spec>`, so an answer the surface does not declare is a type error.
3. `browser.tsx` exports `surface`, so the tab connects to it, names `Wired` in `needs`, and calls `clientOf(surface, wired)`. That answers the surface's own typed client, or `null` while the plugin's server file is not connected. A call the gate refused fails with its sentence, and the face shows it.
4. To write, `server.ts` names `Ops` in `needs` and runs `(yield* Ops).gate.run(request, writer, rule)`. The gate plans, checks and commits the write exactly as it does your typing.

- The calls are on the connection under the plugin's own name, and only while it is running.
- `writes` lists the calls that write, as `surface/<group>/<call>`. For each of these the transport hands the handler `RequestAuthority`: the caller's writer and its session's rules, for the handler to pass to `gate.run`. Nothing checks that it does; that is in the code you read before turning it on. Any call not listed is handed `{ writer: "web" }` and no rules, whoever made it.
- A call the `faces` map grants to `agent` must be listed in `writes`; otherwise the plugin does not start, and its page says which call and how to fix it. So such a plugin cannot grant an agent a cell or a stream. The check is made when the server file registers its surface, which is the first start after you turn it on.
- Each call an agent may make is listed on the plugin's page under **What it uses**.
- The gate's types come with `@olai/plugin-api`: `Gate`, `WriteRequest`, `Writer`, `WriteResult`, and `OpFailure` as a schema too.

<!-- guide:end -->

</details>
