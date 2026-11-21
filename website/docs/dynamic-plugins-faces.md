# Where a plugin of your own can draw

A plugin in your directory draws the same places a built-in plugin does: beside a row, in the sidebar, in the palette, or on a key.

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

[^slot]: An agent writing a plugin calls `vault-plugins_inspect`, which lists every slot this server has. Each entry names the slot, says how many plugins may fill it, and carries one sentence from the plugin that owns the slot saying what a component there is handed.

[^off]: A plugin is drawn only while it is approved at the version on disk, switched on and not failing. Turning it off, editing its code, or a fault takes away everything it drew, with no reload.

<details>
<summary>Every slot, and the reading companion's sidebar section, key and palette row</summary>

<!-- guide:start -->

## Where a face can go

A browser file draws by registering a face in a slot with `Slots.register`. `vault-plugins_inspect` lists every slot this server has: its name, its key rule, and a sentence from the slot's owner saying what a face there is handed. Read it before you write a face, because a face that reads a field the slot does not pass gets `undefined` and draws nothing.

| Slot | What a face there is |
| --- | --- |
| `outline.row.chip`, `outline.row.pane`, `outline.row.block`, `outline.row.placement` | how one of the plugin's own property kinds is drawn on a row |
| `outline.row.aside`, `outline.row.fold`, `outline.crumb.aside` | a component handed a row's id and file, drawn beside it, under it, or in a breadcrumb |
| `outline.page.head`, `outline.page.foot` | a component drawn at the top or foot of an outline's page |
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

This is the browser file of `reader`, a companion for reading a book in French. It adds a **Reading** section to the sidebar with a link to the book and one to the vocabulary, a key that opens the vocabulary, and a palette row that opens the book.

`browser.tsx`:

```tsx
import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

const BOOK = "/book.olai"
const VOCABULARY = "/vocabulary.olai"

// Opens an address the way a link on the page does: the app follows it in the
// pane you are reading in, with no reload.
const open = (address: string) => {
  const link = document.createElement("a")
  link.href = address
  document.body.append(link)
  link.click()
  link.remove()
}

const Section = () => (
  <nav data-reader="section" class="flex flex-col px-3 py-2 text-body">
    <span class="text-label text-muted">Reading</span>
    <a href={BOOK}>Le Petit Prince</a>
    <a href={VOCABULARY}>Vocabulary</a>
  </nav>
)

export default definePlugin({
  name: "reader",
  needs: [Slots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
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
  }),
})
```

- A link in a face is an ordinary `<a href>`. olai follows a link to one of its own addresses inside the app, with no reload.
- A key's `press` gets nothing, so `open` follows an address the same way a link does. `Cmd` + `Shift` + `Y` opens the vocabulary, and `whileEditing: false` leaves the key alone while the caret is in a text field.
- A palette row opens its `href` when you choose it, and is found by the words in its `search`.
- Switch the plugin off and the section, the key and the palette row go together.

<!-- guide:end -->

</details>
