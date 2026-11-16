# Two plugins to write into your directory

Two plugins you can paste into your directory, turn on and watch run: one that does something on a clock, and one that draws something on a row.[^how]

## A plugin on a clock

The morning agenda reads the journal's agenda each morning and hands it to every node agent with a live session: a service somebody else offers, a clock and a sentence.[^agenda]

## A plugin that draws

The swatch dresses a `hex` property: a server half that teaches the kind, and a browser half that draws the chip on the row.[^swatch]

Both are written out below, file by file, from the first `vault-plugins_inspect` to the press on **Turn on**.

[^how]: How a plugin is written, approved and checked is [dynamic-plugins.md](dynamic-plugins.md). This page is the two paths end to end.

[^agenda]: The morning agenda needs no browser half, because it draws nothing: two files, a `README.md` and a `server.ts`. Nothing of it ships in olai, so a morning agenda somebody reads is written into their own directory by their own agent, or pasted from here.

[^swatch]: The swatch is three files, and both halves declare the same `name`, which has to be the folder's own word. The kind's word on a row is `swatch-hex`: the plugin contributes the bare word and the registry composes it with the plugin's own name.

<details>
<summary>The two plugins, file by file</summary>

<!-- guide:start -->

## The morning agenda

A plugin that reads the journal's agenda each morning and puts it into a node agent's own conversation: a service somebody else offers, a clock and a sentence.

### 1. Ask what you may name

Call `vault-plugins_inspect`. It lists service records by half: a server-owned key appears while its provider is running, and a browser key is advertised by its server declaration.

```
"services": [
  { "key": "clock", "half": "server", "availability": "core" },
  { "key": "journal.agenda", "half": "server", "availability": "provided" },
  { "key": "identity.viewer", "half": "browser", "availability": "declared" },
  …
]
```

`journal.agenda` is the journal row's own key ([plugins/journal.md](plugins/journal.md)). Naming it in `needs` is all a consumer does: the plugin waits while the journal is switched off, saying so on its row, activates when the journal returns, and unloads if it leaves.

### 2. Make the folder

Two files, because this plugin draws nothing and a plugin with no face needs no browser half:

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

Write each file with `vault-plugins_write`, which answers whether that half compiles in the same reply. A plugin your directory defines cannot import `@olai/format`, so it spells the fields it reads and the provider's own types satisfy them structurally. The string key names a dependency; it does not check a shape.

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

Call `vault-plugins_run` when the folder is whole: that is what tells the person it is ready. They open its page at `/plugins/morning-agenda`, read it, and press **Turn on**.

- From seven o'clock, by the serving machine's own clock, every node agent with a live session is handed one message naming what is overdue and what is on today ([node-agents.md](node-agents.md)).
- A morning that reached nobody has not passed: `said` is set only after a delivery went out, so a serve with no conversation open at seven still says it when one is opened.
- `deliveries.deliver` takes a thunk rather than a string, so the words are composed at the moment they enter the conversation, which for a message that may wait through a running turn is the only time they are true.
- The beat is forked onto the plugin's own scope, so stopping the row interrupts it with everything else the plugin acquired. There is no timer to clear.
- Nothing of this ships in olai: a morning agenda somebody reads is written into their own directory by their own agent, or pasted from here.

## A swatch beside a colour

A dressing for a `hex` property. Where the first example does something, this one draws something, which is the other half of what a plugin can be.

### 1. Make the folder

```
plugins/swatch/
  README.md
  server.ts
  browser.tsx
```

Both halves declare the same `name`, and it has to be the folder's own word: a half signed with another word is a fiber bound under a name nothing draws.

### 2. Write the server half, which teaches the kind

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

### 3. Write the browser half, which draws the chip

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

A face is handed a context, not a value. `outline.row.chip` takes a chip context: `entry`, holding the property's `key`, `value` and `values`, plus `opened`, `onToggle` and `chrome`. What you draw is `context.entry.value`.

> A face that reads `props.value` gets `undefined` and fails in the quietest way available: it compiles, it mounts, the row says `running`, and the chip is invisible. `vault-plugins_inspect` names the slots and the keys each one takes.

### 4. Turn it on, and put a colour on a row

Read the files on the plugin's page and press **Turn on**. The browser half's chunk loads without a reload, so the faces appear while you watch.

- The kind's word is `swatch-hex`: a plugin contributes the bare word and the registry composes it with the plugin's own name, exactly as for a built plugin.
- That composed word is claimed by the registration, so a property `swatch-hex: "#ff8800"` is held to the pattern and wears the swatch with no `_olai/Properties.olai` in your directory at all.
- What you cannot do is declare it. A `type` in `_olai/Properties.olai` is judged against what the binary was built with, so `{"title":"colour","custom":{"type":"swatch-hex"}}` is refused. Use the claimed word as the key.
<!-- guide:end -->

</details>
