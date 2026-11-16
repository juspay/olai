## The folder

A plugin the vault defines is a **folder** under `plugins/`, and the folder's name is the plugin's word:

```
plugins/hex-swatch/
  README.md     what it does, for a person
  server.ts     required
  browser.tsx   optional
```

- **The word** is the folder's name — the row's id, the key its wire members are composed under, the word the page and the sidebar draw. It takes the same shape a built row's id does (`[a-z][a-z0-9-]*`) and it may not be a word this serve already has; a folder named anything else is drawn with a sentence saying so rather than compiled.
- **`README.md`** is `# Title`, a blank line, one sentence, and then as much prose as the plugin deserves. The heading is what a person is told the plugin is called and the first paragraph is the line under it, on the page and in the sidebar's tip. It is an ordinary document — **markdown's own claim**, openable, editable and searchable like any other `.md` — and the only thing this row says about it is where it sits.
- **`server.ts`** is required. A plugin with no face — one that teaches the vault a property kind, or rings a doorbell at seven — is a whole plugin.
- **`browser.tsx`** is optional, and is the half that draws.
- Anything else in the folder is ordinary vault content and is passed over.

**The two halves are ordinary files, and the claim that makes them so is SCOPED.** A `.ts` names a file a directory is likely to be full of for reasons that have nothing to do with olai — a checkout somebody keeps beside their notes — so the `vault-plugins` row claims `.ts` and `.tsx` **only under `plugins/`** (`@olai/format`'s `Claim.under`), and no other TypeScript in the vault is swept into the set. Inside that folder the halves are kept text like a document's body: the store reads them, the revision holds them, the write gate writes them, the ledger records them and the Commit panel lists them by path.

**They are not in the sidebar's Reference tree**, and that is the claim's `elsewhere` flag rather than secrecy. They are in the set, they are in the ledger, and the plugin's own page is where they are read — with the file names over them and a diff when they change. Two front doors onto one file is how a sidebar fills up with the app's own plumbing. **A half's own path is an address onto that page**: `/plugins/hex-swatch/server.ts` opens the plugin at that file, so a path a person copied out of the Commit panel lands somewhere, with the README over it and the one button that decides whether it runs.

**What that buys is not tidiness.** It is that a plugin is a thing you can show somebody: a folder, with a README at the top of it, that travels by being copied, that git records line by line, and that a pull request can review.

### Consent lives in Settings, not in the folder

`on`, `approved`, the `builder` binding and the plugin's own knobs are properties on a root node titled `<word>` in `_olai/Settings.olai` — the same file, the same shape and the same reader every row olai ships already keeps its settings in.

```
hex-swatch            on: yes
                      approved: 3fa9c1d2b7e45610
                      builder: n-7f3a
                      size: large
```

Three things follow, and all three are the point:

- **A folder copied in from another vault arrives off and unapproved.** The code travels; the consent does not. A plugin with no settings node is off, whatever it says about itself.
- **Enablement survives a restart.** So does a stop: `on: no` is in a file, not in a set in the server's memory.
- **`approved`, `on` and `builder` are reserved.** A `Config` schema declaring any of them faults the row, and `plugins.configure` refuses to write one, with the same sentence either way: *`on` is reserved for the plugin's approval, its switch and the conversation building it.*

### Only a person can turn it on

An agent can write every byte of a plugin and ask what became of it. It cannot approve one. The code runs with the server's own authority — there is no sandbox and this page is not pretending there is one — so the boundary is an owner, at a page, having read what the folder holds. `vault-plugins_run` on a plugin nobody has approved answers `pending`, which is that boundary said back to the author. The right thing to do with a `pending` is to say so and stop.

## What a half may import

Three modules, by their bare names:

```ts
import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"
import { createSignal } from "solid-js"
```

olai resolves all three itself, against the modules **inside the running binary** — so a face an agent wrote draws with the same Solid the app does and can read a context a shipped plugin provided. A vault has no `node_modules` and never will, so anything else is refused with a sentence naming it, at the moment the half is compiled rather than at the moment it dies:

```
olai resolves @olai/plugin-api, effect and solid-js for a plugin it mounts from
a vault, and nothing else — so "left-pad" names nothing this serve can hand
over. A vault has no node_modules.
```

Subpaths are refused too (`effect/Schema`, `solid-js/web`), and so is a computed `import()`: what a person approved is the source they read, so every module a plugin uses has to be visible in it. A relative import of a fourth file in the folder is refused for the same reason — a plugin is two halves, and what is approved is both of them whole.

The server half's `@olai/plugin-api` is the runtime door (`Kinds`, `Vault`, `Surfaces`, `Deliveries`, `Offers`, …); the browser half's is the app door (`Slots`, `Clocks`, `Wired`, `Offers`, …). One name in the source, and each half gets the door it is written against.

Both halves declare the same `name`, and it has to be the folder's own word. A half that signed another word would be a fiber bound under a name no row draws.

## Knobs

A server half may expose a `Config` schema exactly as a built row does. Give every field a decoding default and a description annotation, pass it as `config` to `definePlugin`, and `apply` receives the decoded object. This one is the whole of `plugins/greeting/server.ts`:

```ts
import { definePlugin } from "@olai/plugin-api"
import { Effect, Schema } from "effect"

const Config = Schema.Struct({
  tone: Schema.String.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("blue")),
    Schema.annotate({ description: "the colour to draw" })),
})

export default definePlugin({
  name: "greeting", needs: [], config: Config,
  apply: (config) => Effect.logInfo(`greeting tone: ${config.tone}`),
})
```

The values are properties on the plugin's node in `_olai/Settings.olai`, and child nodes under it supply schema sections — the same layout, read by the same reader, as a built row's. A plugin's schema-derived controls are drawn **on its own page**, under **Settings**, and in its row's detail on the plugins panel: descriptions are tooltips, a ● marks an authored value and ↺ removes the property. A knob edit re-applies the row without touching its approval, because the version is a hash of code and a setting is not code. An invalid leaf uses its default, warns once, and shows the file text and the schema message under its control; an invalid schema fails only this plugin.

`vault-plugins_inspect` answers this layout — the folder's three names, the settings file, and the three reserved words — so an agent writing a plugin does not have to read it out of prose.

## Faces and slots

A browser half hangs a face in a named slot:

```tsx
yield* slots.register("outline.row.chip", "hex", Swatch)
```

**A face is handed a context, not a value.** `outline.row.chip` takes a `ChipContext` — `entry` (the property's `key`, its `value`, its `values`), `opened`, `onToggle`, `chrome` — so what you draw is `context.entry.value`. A face that reads `props.value` gets `undefined` and fails in the worst way available: it compiles, it mounts, the page says **On**, and the chip is invisible. `vault-plugins_inspect` names every slot and what keys each; the shapes are `@olai/plugin-api`'s `plugin.ts`.

A registration is held by the activation that made it, so nothing has to be taken back by hand: the switch, `vault-plugins_stop`, an edit that puts the plugin back to pending, and the row leaving all unwind every face, kind and offer the plugin acquired.

## Sharing a plugin-owned service

A server half can provide a service without changing core's catalog. Name `Offers` in `needs`, then yield `offers.own("fleet", consumer => ({ ... }))`. Olai stamps the key with the offering fiber's name: a plugin named `fleet-source` offers `fleet-source.fleet`. The callback receives the **consumer's** runtime name, so it can return a per-consumer view. Neither name is a caller-supplied argument. Both segments must start with a lowercase letter and contain only lowercase letters, digits or hyphens; dots are reserved for the separator.

A consumer defines `const Fleet = serviceTag<FleetShape>("fleet-source.fleet")` using `serviceTag` from `@olai/plugin-api`, includes `Fleet` in `needs`, and reads it with `yield* Fleet`. Minting a tag names a dependency; it does not grant permission to provide that key or access the runtime host. Providers and consumers must agree on the shape; the string key does not validate arbitrary dynamic code's types at runtime.

The consumer waits until the provider finishes initialization. Removing or replacing the provider unloads the consumer, awaits its cleanup while the old resource is still alive, and reactivates it with the new provision when ready. Failed initialization publishes no usable service. Duplicate offers fail the offering activation and unwind its registrations.

`vault-plugins_inspect` includes currently offered plugin-owned keys beside the core catalog. A stopped or removed provider's keys disappear; consumers can still name a missing key and wait for it. This is discovery of keys, not a schema registry. `Offers.offer` accepts only the core-defined `OFFERABLE` keys. Any row may stand behind one, one at a time; Cordis refuses a second provider and names both rows and the contested key. Once the first leaves, a differently named provider can take its place without a core edit. Other host services remain closed: `own("vault", ...)` means `your-plugin.vault` and cannot replace core's `vault`.

**A door worth naming answers in its OWN shape**, rather than in whatever type it happens to build the answer out of. `journal.agenda`'s row is four fields the journal promises; the page model behind it is free to move, and a plugin in somebody's vault does not find out about it on a Tuesday morning. The same argument runs the other way: a plugin a vault defines cannot import `@olai/format`, so it writes down the fields it reads and the provider's own types satisfy them structurally.

**Two shipped ones to read, and they are the two cases.** The Spaces mirror uses this mechanism between two rows this build compiles together: chat offers `chat.seating`, whose `in(derived)` returns the node seating for that snapshot, including nodes without a session. The mirror declares that key in `needs`; switching chat off removes the mirror's registrations and switching it on restores them. The mirror declares no dependency on the chat package to do it: a key is a name, so a consumer that names one takes on nothing of the provider's build.

`journal.agenda` ([the journal](plugins/journal.md#the-agenda-as-a-service)) is the other case, and the one a key like this exists for: its consumer is a plugin somebody wrote into a vault, which nothing rebuilds when the provider changes. Three things follow, and all three are visible in the door. The journal takes the reading IN, so the answer is about one snapshot and the caller says which. The ask is opaque, because the consumer cannot name a `Reading` and does not have to — it passes on what the revision door gave it. And the answer is the door's OWN shape rather than the type the journal happens to build it out of, so the page model behind it stays free to move.

### Browser-owned services

Browser halves import `Offers` from `@olai/plugin-api` and publish with `yield* (yield* Offers).own("palette", consumer => ({ ... }))`. A browser consumer declares `serviceTag<Shape>("provider.palette")` in `needs` and yields that tag in `apply`, just like a server consumer. Each local segment must start with a lowercase letter and contain only lowercase letters, digits or hyphens; the provider name comes from the owning plugin's binding.

Browser `Offers` has only `own`: plugins cannot replace `Slots`, `Wired`, or the shell furniture. Keys live in the tab host, independently of identically named server keys. Providers publish only after successful initialization. A missing provider keeps the consumer waiting with no faces; withdrawal releases those faces before the provider resources, and reactivation receives a fresh service. The plugin's page and the plugins panel both show browser waiting and failed states beside the server's state, including the missing service key and the component's name. Shapes remain a contract between the two authors.

To make a browser key discoverable, the server half names `Offers` in `needs` and calls `yield* (yield* Offers).browser(["palette"])`. These local words use the same namespace grammar and fiber stamp as `own`, and their declarations leave when the server provider unloads. This call does not provide a server service or execute browser code on the server.

`vault-plugins_inspect` returns service records with `key`, `half` (`server` or `browser`) and `availability`: `core` for core server vocabulary, `provided` for server-owned keys, and `declared` for browser contracts. A browser declaration can be discovered without a connected tab; the page reports whether this tab actually activated the provider. In a built plugin, keep the local word list in the shared definition and use it in both `Offers.browser` and `Offers.own`.

Identity offers `identity.viewer`, including the resource over `who.get`, `saying` and `UserIcon`. Chat exports a `components` record containing its speaker's plugin. Each browser component gets a separate dependency lifecycle, a name stamped as `parent/component`, and is removed with its parent row. The activation name is separate from the owning plugin: components share the row's service namespace, sibling client and slot ownership, while each registration still closes with its component. A service factory receives the consuming plugin's owner name, including when that consumer is a component. A waiting speaker leaves chat's anonymous face available. Components have no host access and cannot offer a different row's keys.

## A worked example: the morning agenda

A plugin that reads the journal's agenda each morning and puts it into the node agent's own conversation — which is the shape most of these are: a service somebody else offers, a clock, and a sentence.

**Ask first what may be named.** `vault-plugins_inspect` lists service records by half. A server-owned key appears while its provider is running; a browser key is advertised by its server declaration:

```
"services": [
  { "key": "clock", "half": "server", "availability": "core" },
  { "key": "journal.agenda", "half": "server", "availability": "provided" },
  { "key": "identity.viewer", "half": "browser", "availability": "declared" },
  …
]
```

`journal.agenda` is the journal row's own — offered with `Offers.own`, so the key is stamped from that fiber's name and no other row can take it. Naming it in `needs` is all a consumer does: the plugin waits while the journal is switched off, saying so on its page, activates when it returns, and unloads if it leaves. Nothing in core knows these two are connected.

The folder is two files, because this plugin draws nothing and a plugin with no face needs no browser half:

```
plugins/morning-agenda/
  README.md
  server.ts
```

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

**The beat is forked onto the plugin's own scope**, so stopping the plugin — the switch, `vault-plugins_stop`, an edit that puts it back to pending — interrupts it with everything else the plugin acquired. There is no timer to clear.

**A morning that reaches nobody is not a morning that has passed.** `said` is set after a delivery went out, so a serve with no conversation open at seven o'clock still says it when one is opened. And `deliveries.deliver` takes a thunk rather than a string: the words are composed at the moment they enter the conversation, which for a message that may wait through a running turn is the only time they are true.

**This ships as nothing.** The source above is not in the binary and is not meant to be: a morning agenda somebody actually reads is written into their own vault by their own agent, or pasted from here, and turned on by them. It is vault content.

## A second example: a face

A dressing for a `hex` property — a swatch beside the value. Where the first example does something, this one draws something, which is the other half of what a plugin can be. Its folder has all three files:

```
plugins/hex-swatch/
  README.md
  server.ts
  browser.tsx
```

`README.md`:

```md
# Hex swatch

A colour swatch beside any hex colour.

Draws a small colour swatch beside any property whose kind is `hex`, so a
palette written as text reads as a palette. Declare a property as
`hex-swatch-hex` and give it a value like `#ff8800`; anything that is not six
hex digits is refused when you type it.
```

`server.ts`:

```ts
import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"

export default definePlugin({
  name: "hex-swatch",
  needs: [Kinds],
  apply: Effect.gen(function*() {
    const kinds = yield* Kinds
    yield* kinds.register({ kind: "hex", takes: "text", admits: (value) => /^#[0-9a-f]{6}$/i.test(value) })
  }),
})
```

`browser.tsx`:

```tsx
import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

const Swatch = (context: { readonly entry: { readonly value: string } }) => (
  <span style={{ background: context.entry.value }} class="inline-block h-3 w-3 rounded" />
)

export default definePlugin({
  name: "hex-swatch",
  needs: [Slots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    yield* slots.register("outline.row.chip", "hex", Swatch)
  }),
})
```

**The kind word is `hex-swatch-hex`, and it is CLAIMED rather than declared.** A plugin contributes the bare word and the registry composes it with the plugin's own name, exactly as for a built plugin — and that composed word is claimed by the registration, so `shade: "#ff8800"` is held to it with no `_olai/Properties.olai` in the vault at all. That is the whole of what an author has to do.

What you cannot do is *declare* it. A `type` in `_olai/Properties.olai` is judged against what the BINARY was built with, and that list is read off the bundle's rows — a vault's own plugin is in no row and teaches its word by calling `Kinds.register` at mount, so `{"title":"colour","custom":{"type":"hex-swatch-hex"}}` is refused. The asymmetry is real and currently one-way: a compiled-in plugin's kind can be pointed at a key of the vault's own choosing, a vault plugin's cannot. Use the claimed word as the key.

## Checking a half before you ask

Every edit changes the version, and every version costs a person a decision. So be sure before you ask. Three checks, and one trap.

**Write it through the door that answers.** `vault-plugins_write` puts one file of one plugin through the vault's ordinary write gate — same planner, same validation, same ledger commit as a keystroke — and answers in the same reply whether that half **compiles** and, when it does not, why. That makes the loop one call rather than a write and a guess, and it is the check to reach for first.

**Or compile it by hand** — the same call the serve makes, so the answer is the answer:

```ts
import { buildHalf } from "@olai/plugin-build"
console.log(await buildHalf("browser", source))   // { ok: true, text } | { ok: false, why }
```

Run it from a package that depends on `@olai/plugin-build` (`packages/server` does). This catches every way a half can fail to become a module: a module olai does not bind, a relative import, a computed `import()`, a syntax error.

**Typecheck it** — the two halves are real `.ts` and `.tsx` files in the vault, so point a `tsc` at them, or drop copies into some package's `src/` and `bun x tsc --noEmit`.

**The trap in the last one.** A half writes the bare `@olai/plugin-api` in both files and olai binds each to a different door: a server half to `./services`, a browser half to the root. So typechecking a *server* half exactly as written reports `has no exported member 'Kinds'` — and that error is the **check** being wrong, not your source. Point the import at `@olai/plugin-api/services` for the duration of the typecheck, and put it back.

`vault-plugins_run` is the last check and the only one that is the real thing: it answers the state, the version and the fault sentence off the same plugin a person is looking at. A `pending` there is not a failure — it is the one person who can turn it on not having been asked yet.

**It is also how you say you are finished.** Until a build's conversation calls it, the plugin's page says *being built* and lists the files that have landed, and nothing wakes anybody: the files arriving cannot mean *done*, because this guide has you write the face last. Call it when the folder is whole, at the version on disk, and the person is told the plugin is ready for them. Call it again after every fix — each call is about the version it was made at.
