## The folder

A plugin the directory defines is a folder under `plugins/`, and the folder's name is the plugin's word:

```
plugins/hex-swatch/
  README.md     what it does, for a person
  server.ts     required
  browser.tsx   optional
```

- The word takes the same shape a built plugin's name does, `[a-z][a-z0-9-]*`, and may not be a word this serve already has. A folder named anything else is drawn with a sentence saying so rather than compiled.
- `README.md` is a `# Title`, a blank line, one sentence, then as much prose as the plugin deserves. The heading is what the plugin is called on screen and the first paragraph is the line under it.
- `server.ts` is required. A plugin that teaches the directory a property kind, or rings a doorbell at seven, is a whole plugin.
- `browser.tsx` is optional, and is the half that draws.
- Anything else in the folder is ordinary content and is passed over.

The two code files are claimed by olai only under `plugins/`, so a checkout somebody keeps beside their notes is untouched. They are kept text: the revision holds them, the ledger records them, and the commit panel lists them by path. They are not rows in the sidebar's **Reference** tree, because the plugin's page is where they are read. The path of one is an address onto that page: `/plugins/hex-swatch/server.ts` opens the plugin at that file.

## What a half may import

Three modules, by their bare names:

```ts
import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"
import { createSignal } from "solid-js"
```

olai resolves all three itself, against the modules inside the running binary, so a face an agent wrote draws with the same Solid the app does. The directory has no `node_modules`, so anything else is refused when the plugin is read rather than when it dies:

```
olai resolves @olai/plugin-api, effect and solid-js for a plugin it mounts from
a vault, and nothing else — so "left-pad" names nothing this serve can hand
over. A vault has no node_modules.
```

Subpaths are also refused (`effect/Schema`, `solid-js/web`), and so is a computed `import()`: what a person approved is the source they read, so every module a plugin uses is visible in it. A relative import is refused with its own sentence, since a plugin is two halves and nothing else.

The server half's `@olai/plugin-api` is the runtime door (`Kinds`, `Vault`, `Surfaces`, `Deliveries`), and the browser half's is the app door (`Slots`, `Clocks`, `Wired`). One name in the source, and each half gets the door it is written against.

## Give it knobs

A server half may expose a `Config` schema just as a built plugin does. Give every field a decoding default and a description annotation, then pass it as `config` to `definePlugin`; `apply` receives the decoded object.

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

- The leaves are properties on the plugin's node in `_olai/Settings.olai`, beside `on` and `approved`.
- The controls appear under **Settings** on the plugin's page and in its row on the plugins panel. A ● marks an authored value and ↺ removes the property.
- A knob edit re-applies the plugin and asks nobody for a fresh approval, because a setting is not source.
- An invalid leaf uses its default, warns once, and shows the file text and the schema message under its control.

## What an agent can do

| Tool | Answers |
| --- | --- |
| `vault-plugins_guide` | this guide, shipped inside the binary |
| `vault-plugins_inspect` | what a plugin may name: the three modules, the service keys, the slots and their keys, the folder layout, and the words already taken |
| `vault-plugins_write` | writes one file of one plugin, and says whether that half compiles |
| `vault-plugins_run` | what became of one plugin now: its state, its version, and the fault sentence where there is one |
| `vault-plugins_stop` | switches one off for good, by writing `on: no` |

- Read `vault-plugins_inspect` before writing code. Service records are marked by half, and `availability` tells a server provision from a browser declaration.
- Its `taken` list is every word this serve has, the built plugins and every folder under `plugins/` alike, because a new plugin may take neither.
- `vault-plugins_write` creates the folder if it is not there. It is the whole vocabulary needed to write a plugin: no paths, no claim rules, no guessing which file is which.
- A plugin nobody has approved answers `pending` from `vault-plugins_run`. That is the boundary said back to its author, and the right thing to do with it is to say so and stop.
- `vault-plugins_stop` reaches these plugins only. Naming a built one is answered as no such plugin.

## Check a half before you ask

Every edit changes the version, and every version costs a person a decision, so be sure before you ask.

Write it with `vault-plugins_write`, which answers that half's compile result in the same reply. That makes the loop one call rather than a write and a guess. Or compile it by hand with the call the serve itself makes:

```ts
import { buildHalf } from "@olai/plugin-build"
console.log(await buildHalf("browser", source))   // { ok: true, text } | { ok: false, why }
```

Run that from a package that depends on `@olai/plugin-build`; `packages/server` does. It catches every way a half can fail to become a module: a module olai does not bind, a relative import, a computed `import()`, a syntax error. Then typecheck the two files with `bun x tsc --noEmit`.

> The typecheck has one trap. A half writes the bare `@olai/plugin-api` and olai binds each half to a different door, so typechecking a server half as written reports `has no exported member 'Kinds'`. Point that import at `@olai/plugin-api/services` for the duration of the check, and put it back.

## Say when you are finished

`vault-plugins_run` is the last check and the only one that is the real thing: it answers off the same plugin a person is looking at. It is also how you say the build is over.

Until that call comes in, the plugin's page says it is being built and nothing wakes anybody. A file landing cannot mean finished, because this guide has you write `browser.tsx` last. Call it when the folder is whole, at the version on disk, and the person is told the plugin is ready for them.

Call it again after every fix. Each call is about the version it was made at, and only a call with no fault in its answer ends the build. A mistake you found and fixed wakes nobody. olai writes that version onto the plugin's settings node, so a build that finished before a restart is still finished after one.

## Share a service with another plugin

A server half can provide a service without changing core's catalogue. Name `Offers` in `needs`, then yield `offers.own("fleet", consumer => ({ ... }))`. olai stamps the key with the offering plugin's name, so a plugin named `fleet-source` offers `fleet-source.fleet`. The callback receives the consumer's own name, so it can return a view per consumer.

- Both segments start with a lower-case letter and hold only lower-case letters, digits or hyphens. Dots are the separator.
- A consumer writes `const Fleet = serviceTag<FleetShape>("fleet-source.fleet")`, puts `Fleet` in `needs`, and reads it with `yield* Fleet`. Minting a tag names a dependency and grants nothing.
- Provider and consumer agree on the shape themselves. The string key checks none at runtime.
- The consumer waits until the provider has finished initializing. Replacing a provider unloads the consumer, awaits its cleanup while the old resource is still alive, and starts it again on the new one.
- A duplicate offer fails the offering plugin and unwinds its registrations. Cordis refuses a second provider for a contested key and names both.
- `vault-plugins_inspect` lists the keys offered now beside the core catalogue. A stopped provider's keys disappear, and a consumer may name a missing key and wait for it.

### A service a browser half offers

Browser halves import `Offers` the same way and publish with `yield* (yield* Offers).own("palette", consumer => ({ ... }))`. A browser consumer declares `serviceTag<Shape>("provider.palette")` in `needs` and yields it in `apply`.

- Browser `Offers` has only `own`, so a plugin cannot replace `Slots`, `Wired` or the shell's furniture. These keys live in the tab, apart from server keys of the same name.
- A provider publishes only after it has initialized. A missing one keeps the consumer waiting with no faces, and withdrawal releases those faces before the provider's resources.
- To make a browser key discoverable, the server half names `Offers` in `needs` and calls `yield* (yield* Offers).browser(["palette"])`. Those declarations leave when the server provider unloads.

## What happens when it mounts

The server half is compiled, evaluated and mounted as a fiber on the same registry the built plugins are on. The kind vocabulary gains its words, a sibling surface reaches the wire, the roster moves, and every open tab redials.

Then the served directory is read again, which is what puts a face on values that were already there. Without it the plugin would mount, its kind would be in force, and its chip would not draw until the next keystroke anywhere in your files.

The browser half is compiled to a chunk and served at `/_olai/plugins/<word>-<version>.js`. The tab loads it as it loads a built plugin's chunk and the faces appear without a reload. The version is in the path, so a re-approved edit is a different address and no cache can hand back the code approved before the edit.

The serve keeps the last chunk each word served, so a tab still fetching one while the plugin stops gets the bytes that path named rather than a 404.

A half that will not compile, a module that exports no plugin, a half that calls itself a different word, and an `apply` that throws each land the plugin on `failed`. The sentence that explains it is on the page and on the row, no sibling is touched, and **Ask the agent to fix it** hands that sentence to the conversation verbatim.

## Starting and stopping

A server half stays `waiting` while its `apply` initializes, and the services it offers reach consumers only after that succeeds. If it fails, its registrations and resources are unwound and the page shows its fault.

- The switch and `vault-plugins_stop` can stop a half that is still initializing. Stopping interrupts its work, waits for background work and cleanup, and leaves it switched off.
- Losing a required service also interrupts initialization, leaves the plugin `waiting` and names the missing key. When that service returns, initialization runs again.
- Shutting the host down closes every plugin, and a dependent's cleanup finishes before the provider releases what it was using.
- Cancellation is cooperative: synchronous JavaScript cannot be preempted, and uninterruptible acquisitions and finalizers finish themselves. There is no per-plugin initialization timeout.

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
