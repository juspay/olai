## The folder

A plugin your directory defines is a folder under `plugins/`, and the folder's name is the plugin's name:

```
plugins/hex-swatch/
  README.md     what it does, for a person
  server.ts     required
  browser.tsx   optional
```

- The name has the same shape a built-in plugin's does, `[a-z][a-z0-9-]*`, and may not be a name this server already uses. A folder named anything else is not compiled, and is shown with a sentence saying so.
- `README.md` is a `# Title`, a blank line, one sentence, then as much prose as the plugin deserves. The heading is the plugin's name on screen, and the first paragraph the line under it.
- `server.ts` is required, and is a whole plugin on its own: it can teach the directory a property kind, or send a message at seven each morning.
- `browser.tsx` is optional. It is the file that draws on screen.
- Anything else in the folder is ordinary content, and olai leaves it alone.

olai treats these two code files as a plugin only under `plugins/`, so a code checkout somebody keeps beside their notes is untouched. They stay plain text: stored like any other file, recorded in the ledger, and listed by path in the commit panel, where you commit changes.

They are not rows in the sidebar's **Reference** tree, because you read them on the plugin's page. A file's path is an address too: `/plugins/hex-swatch/server.ts` opens the plugin at that file.

## What each file may import

Three modules, by their bare names:

```ts
import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"
import { createSignal } from "solid-js"
```

olai resolves all three itself, against the copies inside the running binary, so what a plugin draws uses the same Solid the app does. The directory has no `node_modules`, so any other import is refused when olai reads the plugin, not while it runs:

```
olai resolves @olai/plugin-api, effect and solid-js for a plugin it mounts from
a vault, and nothing else — so "left-pad" names nothing this serve can hand
over. A vault has no node_modules.
```

A subpath is also refused (`effect/Schema`, `solid-js/web`), and so is an `import()` whose path is computed while the plugin runs. A person approves the source they read, so every module a plugin imports must be visible in it. A relative import is refused with its own sentence, because a plugin is these two files and nothing else.

Both files import the bare `@olai/plugin-api`, and olai gives each different services: the server file `Kinds`, `Vault`, `Surfaces` and `Deliveries`, the browser file `Slots`, `Clocks` and `Wired`.

## Give it settings

The server file may expose a `Config` schema, as a built-in plugin does. Give every field a decoding default and a description annotation, then pass it as `config` to `definePlugin`; `apply` receives the decoded object.

```ts
import { definePlugin } from "@olai/plugin-api"
import { Effect, Schema } from "effect"
const Config = Schema.Struct({
  tone: Schema.String.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("blue")),
    Schema.annotate({ description: "the colour to draw" })),
})
export default definePlugin({
  name: "hex-swatch", needs: [], config: Config,
  apply: (config) => Effect.logInfo(`tone: ${config.tone}`),
})
```

- Each field is a property on the plugin's row in `_olai/Settings.olai`, beside `on` and `approved`.
- Its control appears under **Settings** on the plugin's page, and in the plugin's row in the **Plugins** panel. A ● marks a value somebody set, and ↺ removes the property.
- Changing a setting re-applies the plugin and asks for no fresh approval, because a setting is not source code.
- A value that does not fit the schema falls back to the default, warns once, and shows the file's text and the schema's message under its control.

## What an agent can do

| Tool | Answers |
| --- | --- |
| `vault-plugins_guide` | this guide, which ships inside the binary |
| `vault-plugins_inspect` | what a plugin may name: the three modules, the service keys, the slots and their keys, the folder layout, and the names in use |
| `vault-plugins_write` | writes one file of one plugin, and says whether that file compiles |
| `vault-plugins_run` | the state of one plugin right now: its state, its version, and the fault sentence if it has one |
| `vault-plugins_stop` | switches one plugin off for good, by writing `on: no` |

- Call `vault-plugins_inspect` before you write code. Each service record says which file it belongs to, and `availability` says whether a server file provides it now or has declared it for the browser.
- Its `taken` list holds every name this server uses, built-in plugins and folders under `plugins/` alike: a new plugin may use neither.
- `vault-plugins_write` creates the folder if it is not there. It is all the vocabulary you need: no paths, no rules about which files olai claims, no guessing.
- `vault-plugins_run` answers `pending` for a plugin nobody has approved. That is the approval boundary answering you: say so and stop.
- `vault-plugins_stop` works on these plugins only. Naming a built-in plugin is answered as no such plugin.

## Check a file before you ask for approval

Every edit changes the version, and every version costs a person a decision, so be sure the file is right before you ask for approval.

Write the file with `vault-plugins_write`, which says in the same reply whether it compiled, so the loop is one call rather than a write and a guess. Or compile it yourself, with the call the server makes:

```ts
import { buildHalf } from "@olai/plugin-build"
console.log(await buildHalf("browser", source))   // { ok: true, text } | { ok: false, why }
```

Run that from a package that depends on `@olai/plugin-build`; `packages/server` does. It catches every way a file can fail to become a module: a module olai does not provide, a relative import, a computed `import()`, a syntax error. Then typecheck both files with `bun x tsc --noEmit`.

> The typecheck has one trap. Both files import the bare `@olai/plugin-api`, and each gets different services, so typechecking a server file as written reports `has no exported member 'Kinds'`. Point that import at `@olai/plugin-api/services` for the check, then put it back.

## Say when you are finished

`vault-plugins_run` is the last check, and the only one that asks about the real thing: it answers about the same plugin the person is looking at. It is also how you say the build is over.

Until that call comes in, the plugin's page says it is still being built, and nobody is notified. A file arriving cannot mean it is finished, because this guide has you write `browser.tsx` last. Call it once the folder is complete, at the version on disk, and the person is told it is ready.

Call it again after every fix. Each call is about the version it was made at, and only a call with no fault in its answer ends the build. A mistake you fixed yourself notifies nobody. olai writes that version onto the plugin's settings row, so a build finished before a restart is still finished after one.

## Share a service with another plugin

A server file can offer a service to other plugins, with no change to olai's own services. Name `Offers` in `needs`, then yield `offers.own("fleet", consumer => ({ ... }))`. olai puts the offering plugin's name in front of the key, so `fleet-source` offers `fleet-source.fleet`. The callback is given the asking plugin's name, so it can return a different view per plugin.

- Both parts of the key start with a lower-case letter and hold only lower-case letters, digits or hyphens. A dot separates them.
- A plugin that wants it writes `const Fleet = serviceTag<FleetShape>("fleet-source.fleet")`, puts `Fleet` in `needs`, and reads it with `yield* Fleet`. Making a tag names a dependency; it grants nothing.
- The two plugins agree between themselves on the service's shape. The string key checks nothing while they run.
- A plugin waits until the service has started up. Replacing a provider unloads the plugin using it and waits for its cleanup while the old service is still alive, then starts it on the new one.
- Offering a key already offered faults the offering plugin and undoes its registrations. Cordis, the registry olai runs plugins on, refuses a second provider for one key and names both.
- `vault-plugins_inspect` lists the keys on offer now, beside olai's own. A stopped provider's keys leave the list, and a plugin may name a key nobody offers yet and wait for it.

### A service the browser file offers

A browser file imports `Offers` the same way, and publishes with `yield* (yield* Offers).own("palette", consumer => ({ ... }))`. A browser file that wants it declares `serviceTag<Shape>("provider.palette")` in `needs` and yields it in `apply`.

- In the browser, `Offers` has only `own`, so a plugin cannot replace `Slots`, `Wired` or anything the app's shell provides. These keys live in the tab, apart from server keys of the same name.
- A provider publishes only once it has started up. While it is missing, the plugin waiting for it draws nothing, and when the provider withdraws, what that plugin drew is removed before the provider's own resources are released.
- To make a browser key visible to `vault-plugins_inspect`, the server file names `Offers` in `needs` and calls `yield* (yield* Offers).browser(["palette"])`. Those declarations go when the server file unloads.

## What happens when it starts

The server file is compiled, evaluated and started as a fiber on the registry the built-in plugins run on. Its property kinds become available, a surface it adds reaches the wire, the list of plugins changes, and open tabs reconnect.

Then olai reads the served directory again, which is what draws the plugin on values that were already there. Without that, the plugin's kind would be in force, but its chip would not be drawn until the next keystroke somewhere in your files.

The browser file is compiled to a chunk of JavaScript, served at `/_olai/plugins/<name>-<version>.js`. The tab loads it as it loads a built-in plugin's chunk, and what the plugin draws appears with no reload. The version is in the path, so an approved edit has a different address, and no cache can return the code approved before it.

The server keeps the last chunk served for each plugin name, so a tab still fetching one while the plugin stops gets that code rather than a 404.

The plugin ends up `failed` if a file will not compile, exports no plugin, declares a name other than the folder's, or if `apply` throws. The sentence explaining it is on the plugin's page and its row, no other plugin is touched, and **Ask the agent to fix it** hands that sentence to the conversation verbatim.

## Starting and stopping

The server file stays `waiting` while its `apply` starts up, and the services it offers reach other plugins only once that succeeds. If it fails, its registrations and resources are undone, and the page shows the fault.

- The switch and `vault-plugins_stop` can stop a plugin still starting up. Stopping interrupts its work, waits for background work and cleanup, and leaves it switched off.
- Losing a service the plugin requires also interrupts start-up, leaves it `waiting`, and names the missing key. When that service comes back, start-up runs again.
- Shutting the server down closes every plugin, and a plugin's cleanup finishes before the service it depends on releases what it was using.
- Cancellation is cooperative: synchronous JavaScript cannot be interrupted, and acquisitions and cleanups marked uninterruptible run to the end. There is no time limit on start-up.

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
    yield* vault.revision((snapshot) =>
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

Both code files declare the same `name`, and it has to be the folder's own name. A file that declares a different name is started under a name nothing on screen is looking for, so nothing it registers is ever drawn.

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
