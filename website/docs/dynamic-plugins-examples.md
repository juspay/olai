# Two example plugins you can copy

Two complete plugins, written out file by file. Copy either one into the directory olai serves, turn it on, and watch it run.[^how]

## A plugin that runs on a schedule

The morning agenda plugin reads your journal's agenda, which lists the rows that are overdue and the ones dated today. From 7 in the morning, by the clock of the machine olai runs on, it sends that list once a day into every conversation a node agent has open. A node agent is an agent that works on one row of an outline and the rows under it.[^agenda]

## A plugin that draws a colour on a row

The swatch plugin teaches olai a `hex` property kind, so a row that carries a property such as `swatch-hex: "#ff8800"` shows a small square of that colour beside it. A property is a key and a value on one line of an outline.[^swatch]

Both plugins are written out below, step by step: asking olai which names and services are free, writing each file, and pressing **Turn on** on the plugin's page.

[^how]: How a plugin is written, approved and checked is explained in [dynamic-plugins.md](dynamic-plugins.md). This page shows the two plugins end to end instead.

[^agenda]: The morning agenda has no browser file, because it draws nothing on screen: it is two files, a `README.md` and a `server.ts`. It does not ship with olai, so you get one by asking your agent to write it into your directory, or by copying the code on this page.

[^swatch]: The swatch is three files, and both code files declare the same `name`, which has to be the folder's name. On a row the property key is `swatch-hex`: the plugin contributes the bare word `hex`, and olai puts the plugin's own name in front of it.

<details>
<summary>The two plugins, file by file</summary>

<!-- guide:start -->

## The morning agenda

A plugin that reads your journal's agenda each morning and puts it into the conversation of every node agent. It uses the agenda the journal plugin offers, reads the time from the server's clock, and sends a message it writes itself.

### 1. Ask which services you may use

Call `vault-plugins_inspect`. It lists the services, and says for each one whether it belongs to a plugin's server file or its browser file. A server service appears while the plugin offering it is running, and a browser service appears because a server file has declared it.

```
"services": [
  { "key": "clock", "half": "server", "availability": "core" },
  { "key": "journal.agenda", "half": "server", "availability": "provided" },
  { "key": "identity.viewer", "half": "browser", "availability": "declared" },
  …
]
```

`journal.agenda` is the service the journal plugin offers ([plugins/journal.md](plugins/journal.md)). Naming it in `needs` is all you have to do: your plugin waits while the journal is switched off, and says so on its row, starts when the journal comes back, and unloads if the journal goes away.

### 2. Make the folder

Two files, because this plugin draws nothing on screen, and a plugin that draws nothing needs no browser file:

```
plugins/morning-agenda/
  README.md
  server.ts
```

`README.md` is what a person reads on the plugin's page:

```md
# Morning agenda

Puts what is overdue and what is on today into your agent's conversation, once each morning.
```

### 3. Write `server.ts`

Write each file with `vault-plugins_write`, which tells you in the same reply whether that file compiles. A plugin your directory defines cannot import `@olai/format`, so it writes out the fields it reads itself, and the journal's own types match them because they have the same shape. The service key names a dependency; it does not check that the shape is right.

`server.ts`:

```ts
import { Clock, definePlugin, Deliveries, serviceTag, Vault } from "@olai/plugin-api"
import { Effect, Schedule } from "effect"

// WHEN, and HOW OFTEN THIS LOOKS. Kept in the source rather than in a `Config`,
// which is a choice and not an oversight: a knob is a thing the owner can move
// without reading code again, and the hour somebody wants their morning at is
// exactly that. Left here, changing either is an EDIT — and an edit is a fresh
// approval.
//
// THE HOUR IS THE SERVER'S OWN, which is the machine olai is serving from and
// not the machine you are reading on: `Clock` answers an instant and `Date`
// turns it into local time where the process runs. For a vault you serve on
// your own laptop those are the same place. For one you reach from another
// zone they are not, and seven o'clock means seven where the serve is.
const AT_HOUR = 7
const EVERY = "5 minutes"

// What `journal.agenda` answers, in the fields this plugin reads.
interface Row { readonly title: string }
interface Group { readonly file: string; readonly nodes: ReadonlyArray<Row> }
interface Day { readonly date: string; readonly groups: ReadonlyArray<Group> }
interface Answer {
  readonly date: string
  readonly dated: ReadonlyArray<Group>
  readonly agenda: { readonly overdue: ReadonlyArray<Day> }
}

const Agenda = serviceTag<{
  readonly read: (
    ask: { readonly at: unknown; readonly date: string },
  ) => Effect.Effect<Answer, { readonly reason: string }>
}>("journal.agenda")

const two = (value: number): string => String(value).padStart(2, "0")

// THE WORDS ARE THE PLUGIN'S, whole, and they say who is speaking: a
// conversation resumed from the agent's own store rebuilds its rows out of
// message chunks and core's mark is not among them, so a body that did not name
// its author would be put in the person's mouth on replay.
const words = (answer: Answer): string | null => {
  const late = answer.agenda.overdue.flatMap((day) =>
    day.groups.flatMap((group) =>
      group.nodes.map((row) => `- ${row.title} — owed ${day.date}, in ${group.file}`)
    )
  )
  const on = answer.dated.flatMap((group) =>
    group.nodes.map((row) => `- ${row.title}, in ${group.file}`)
  )
  if (late.length === 0 && on.length === 0) return null
  return [
    `Morning agenda for ${answer.date}, from your journal.`,
    ...(late.length === 0 ? [] : ["", "Overdue:", ...late]),
    ...(on.length === 0 ? [] : ["", "On today:", ...on]),
  ].join("\n")
}

export default definePlugin({
  name: "morning-agenda",
  needs: [Agenda, Clock, Deliveries, Vault],
  apply: Effect.gen(function*() {
    const agenda = yield* Agenda
    const clock = yield* Clock
    const deliveries = yield* Deliveries
    const vault = yield* Vault

    // The reading every answer will be about, kept as the vault publishes it
    // and handed back unchanged. This plugin never looks inside it.
    let at: unknown
    yield* vault.revision((snapshot: { readonly value: unknown }) =>
      Effect.sync(() => {
        at = snapshot.value
      })
    )
    yield* vault.unloaded(Effect.sync(() => {
      at = undefined
    }))

    // The day already spoken for, so a morning is one message rather than one
    // per tick.
    let said: string | null = null

    const consider = Effect.gen(function*() {
      const now = new Date(clock.now())
      const day = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`
      if (at === undefined || day === said || now.getHours() < AT_HOUR) return
      // Every node agent with a live session, derived from its own subtree —
      // nobody has to pick a file for one.
      const scopes = deliveries.scopes()
      if (scopes.length === 0) return
      const answer = yield* Effect.catch(
        agenda.read({ at, date: day }),
        () => Effect.succeed(null),
      )
      if (answer === null) return
      const body = words(answer)
      if (body === null) return
      for (const scope of scopes) {
        yield* deliveries.deliver(scope, () => body)
      }
      said = day
    })

    yield* Effect.forkScoped(Effect.repeat(consider, Schedule.spaced(EVERY)))
  }),
})
```

### 4. Turn it on, and read what happens

Call `vault-plugins_run` once the folder is complete: that call is what tells the person the plugin is ready. They open its page at `/plugins/morning-agenda`, read it, and press **Turn on**.

- From seven in the morning, by the clock of the machine olai is served from, every node agent with a session running is sent one message listing what is overdue and what is dated today ([node-agents.md](node-agents.md)).
- A morning nobody was there for is not counted as done: `said` is set only after a message went out, so if no conversation was open at seven, the plugin still sends the message when one is opened.
- `deliveries.deliver` takes a function rather than a string, so the text is built at the moment it enters the conversation. The message may wait while the agent finishes a turn, so that moment is the only one at which the text is still accurate.
- The repeating check runs on the plugin's own scope, so switching the plugin off interrupts it along with everything else the plugin is holding. There is no timer to clear.
- None of this ships with olai: you get a morning agenda by asking your own agent to write it into your directory, or by copying the code here.

## A coloured square beside a colour

A plugin that draws a small coloured square next to a `hex` property. The first example acts on a schedule; this one draws on screen, which is the other thing a plugin can do.

### 1. Make the folder

```
plugins/swatch/
  README.md
  server.ts
  browser.tsx
```

Both code files declare the same `name`, and it has to be the folder's own name. A server file that declares a different name makes the plugin fail with a sentence naming both. A browser file that does is not loaded: the plugin's row in the **Plugins** panel says **Failed in this tab**, with a sentence naming both names.

### 2. Write `server.ts`, which teaches olai the property kind

`server.ts`:

```ts
import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"

export default definePlugin({
  name: "swatch",
  needs: [Kinds],
  apply: Effect.gen(function*() {
    const kinds = yield* Kinds
    yield* kinds.register({ kind: "hex", takes: "text", admits: (value) => /^#[0-9a-f]{6}$/i.test(value) })
  }),
})
```

### 3. Write `browser.tsx`, which draws the coloured square

`browser.tsx`:

```tsx
import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

const Swatch = (context: { readonly entry: { readonly value: string } }) => (
  <span style={{ background: context.entry.value }} class="inline-block h-3 w-3 rounded" />
)

export default definePlugin({
  name: "swatch",
  needs: [Slots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    yield* slots.register("outline.row.chip", "hex", Swatch)
  }),
})
```

A component a plugin draws is given a context object, not a bare value. `outline.row.chip`, the place on a row where the square is drawn, passes a context with `entry`, holding the property's `key`, `value` and `values`, plus `opened`, `onToggle` and `chrome`. The colour you draw is `context.entry.value`.

> A component that reads `props.value` gets `undefined`, and fails in the quietest way there is: it compiles, it is drawn, the plugin's row says `running`, and the square is invisible. `vault-plugins_inspect` lists the places a plugin can draw, and what each one passes.

### 4. Turn it on, and put a colour on a row

Read the files on the plugin's page and press **Turn on**. The browser file's code loads without a reload, so the squares appear while you watch.

- The property kind is called `swatch-hex`: the plugin contributes the bare word `hex`, and olai puts the plugin's own name in front of it, exactly as it does for a built-in plugin.
- Registering the kind claims that name, so a property `swatch-hex: "#ff8800"` is checked against the pattern and shows the coloured square, with no `_olai/Properties.olai` file in your directory at all.
- What you cannot do is declare the kind yourself. A `type` in `_olai/Properties.olai` is checked against the kinds the binary was built with, so `{"title":"colour","custom":{"type":"swatch-hex"}}` is refused. Use `swatch-hex` as the property key instead.
<!-- guide:end -->

</details>
