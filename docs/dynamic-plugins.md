# Plugins the vault defines

Everything else under `docs/plugins/` is a plugin olai was built with. This page is about the other kind: a plugin somebody writes **into the directory olai is serving**, usually a node agent asked for it by its owner, which olai compiles and mounts while it is running.

A plugin like that is an ordinary row once it is up. It has the same seven states, the same containment when its `apply` throws, the same switch, and the same reach into the app as `kolu` or `journal` — a property kind, a chip on a row, a pane its press opens, a sibling on the wire. What differs is where it came from, that it has **a page of its own** rather than a line on a panel, and that **a person has to say yes to it first**.

## What a person does

Nobody is asked about halves, slots, service keys or a word grammar. The whole of it is five gestures:

1. **⌘K → New plugin**, and say in one sentence what it should do. The same two-level palette shape **New chat** already has, so there is nothing new to learn.
2. **Name it.** olai suggests a name from the sentence; the folder it is kept in is that name slugged, and the level says so — *Kept in your vault as `plugins/hex-swatch/`*.
3. **Watch.** The press lands on the plugin's own page at `/plugins/<word>`, with the conversation that is building it docked beside. The page fills in as the three files land. It is an ordinary chat, under **Chats** in the sidebar: close the panel, come back tomorrow, and an alert says when the builder wants you.
4. **Turn on.** One button, on the page, with what the plugin does, what it uses and its source under it. That press is the approval *and* the switch, and the faces appear with no reload.
5. It is in the **Plugins** section of the sidebar from then on, beside Chats and Outlines. A vault with no plugins has no such section.

Three verbs are a person's and no agent has any of them: **Turn on** (which approves exactly the version on the screen and sets the switch), **Always trust changes** (under `•••`, for a plugin somebody is iterating on), and the switch itself.

<!-- guide:start -->
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

**They are not in the sidebar's Reference tree**, and that is the claim's `elsewhere` flag rather than secrecy. They are in the set, they are in the ledger, an address names them, and the plugin's own page is where they are read — with the file names over them and a diff when they change. Two front doors onto one file is how a sidebar fills up with the app's own plumbing.

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
<!-- guide:end -->

## Approval

Nothing mounts until a person approves it, on the plugin's page, with the source in front of them.

The page says what the plugin does **in words before code**: the README's own title and sentence, then **What it uses** — the kinds it teaches, the slots it draws into, the services it names — read off the code's own imports rather than off anything the author wrote in prose. The source is one scroll further, with a tab per file, for whoever wants it. Under the primary button is one plain line: *Runs on your server with everything olai can reach.*

- **Turn on** writes `approved: <version>` and `on: yes`, in one write, on the plugin's node in `_olai/Settings.olai`. They were one gesture when the switch was a set in the server's memory and the approval was the only durable thing about a plugin; they are both durable now, and both land together so a press cannot leave half of itself behind.
- **Always trust changes** (under `•••`) writes `approved: always`.

Both are ordinary property writes: they go through the same gate a keystroke does, land in the same settings file every other row's switch does, and are in the ledger.

The plugins panel draws the same block in a vault plugin's row detail, for somebody already working down a whole serve's rows, and links to the page from there. Neither door can approve a stale version: both send back the version they drew, and the refusal below is the same one.

**An approval names a VERSION**, which is a hash of both halves. An edit to either half therefore puts the plugin back to pending **and unmounts it** — which is what stops *approve once* from meaning *approve whatever this becomes*. The page then shows **what changed**: a diff against the version that was approved, not the whole file again, because you already read that one. `always` is the escape for a plugin somebody is iterating on with an agent, where re-approving every edit is a gesture that stops being read after the third time.

**The README is not in the version.** Fixing a typo in the prose is not a fresh decision about code, and a plugin that paused itself every time its description improved would teach people to press Turn on without looking.

The page sends back the version it drew. If the folder moved while somebody was reading it, the approval is refused rather than applied:

```
"hex-swatch" has been edited since this page drew it, so approving it now would
approve source nobody has read. Look again, read what it says, and approve that.
```

**The code runs with the server's own authority.** There is no sandbox and this is not pretending to be one: approval by the owner is the boundary. That is why the page shows the source, why the verb is on the browser face only, and why an agent cannot approve the plugin it just wrote.

## What an agent can do

Five tools, on the agent face:

- **`vault-plugins_guide`** — how to write one. It is this page's authoring section, shipped inside the binary, because an agent working in somebody's vault has no olai checkout to read and a plugin written from memory is a plugin written wrong. It answers the text, the three file names and the folder, so nothing has to be parsed out of the prose.
- **`vault-plugins_inspect`** — what a plugin may name: the three modules, service records marked by half (including declared browser-owned keys), the slots a browser half may register a face into with what keys each, the folder layout and the settings file, and the words already taken. `taken` is every word this serve has — the build's rows **and** every plugin in the vault, including ones other agents wrote — because a new plugin may take neither.
- **`vault-plugins_write`** — one file of one plugin, through the vault's own write gate, answering that half's compile result. It creates the folder if it is not there. This is the whole of the vocabulary an agent needs: no vault paths, no claim rules, no guessing which file is which.
- **`vault-plugins_run`** — ask olai to look at a plugin now and say what became of it: the state, the version, the configuration values and the fault sentence where there is one. The only refusal is *no such folder*; a half that will not compile, a word already taken and an `apply` that threw are **states with sentences**, because those are answers about a plugin rather than failures of the call.
- **`vault-plugins_stop`** — turn one off. It reaches **vault plugins only**: an agent cannot turn off the row that seats it, the row that watches its writes, or the row whose tools it is holding. It is durable now — `on: no` in the settings file — so a restart comes back to it.

(On the wire those are `plugins.guide`, `plugins.inspect`, `plugins.write`, `plugins.run` and `plugins.stop`; the tool names are the agent-facing words, the way `commit` is `git.commit`.)

Retracting a plugin is deleting its folder: the row goes on the next revision and the fiber unwinds every registration it made. Its settings node is left where it is, which is the honest behaviour — a folder that comes back comes back to the decision somebody already made about it, and a node nobody wants is one row to delete.

**The browser's own three** — `plugins.approve`, `plugins.mint` (what ⌘K → New plugin presses) and `plugins.ask` (what *Ask for a change* and *Ask Claude to fix it* press) — are on the browser face and nowhere else. `@olai/server`'s `faces.test.ts` pins the agent face as an exact set, so those absences are asserted rather than trusted to nobody having typed them.

## What happens when it mounts

The server half is compiled, evaluated, and mounted as a fiber on the same registry the bundle's rows are on. Everything downstream follows the way it does for a built row: the kind vocabulary gains its words, a sibling surface reaches the wire, the roster moves, and every open tab redials.

**And the vault is read again.** Turning a plugin on writes two properties; nothing else on disk moved, and the reading every page is drawn from was validated a revision ago — before the fiber existed and so before the word did. So the mount is followed by a re-read of the served directory, which is what puts a face on values that were already there. Without it a plugin would mount, its kind would be in force, its values would be held to it, and its chip would not draw until the next keystroke anywhere in the vault. The switch does the same thing in the other direction: a plugin switched off takes its words with it, and its values have to go back to being plain text on the same press.

The browser half is compiled to a chunk and served at `/_olai/plugins/<name>-<version>.js`. The roster carries that URL, the tab loads it exactly as it loads a built plugin's chunk, and the faces appear **without a reload**. The version is in the path, so a re-approved edit is a different URL and no cache can hand back code that was approved before the edit.

A half that will not compile, a module that exports no plugin, a half that calls itself a different word, and an `apply` that throws all land the plugin on `failed` with the sentence that explains it, and touch no sibling. The page says that sentence in words, with the line it is about, and its primary button hands the fault **verbatim** to the conversation that built the plugin — an agent told "it broke" has to go and find out what, and the serve already knows.

## Initialization and stopping

A server half stays `waiting` while its `apply` initializes. Services it offers
become available to consumers only after initialization succeeds. If it fails,
its acquired registrations and resources are unwound and the page shows its fault.

The switch and `plugins.stop` can stop a half that is still initializing.
Stopping interrupts its Effect work, waits for background work and cleanup, and
then leaves it switched off — in the file, so a restart finds it off. Losing a
required service also interrupts initialization, but leaves the plugin `waiting`,
naming the missing service; when that service returns, initialization runs again.
Host shutdown closes every plugin, including one with no declared needs.
Dependent cleanup finishes before the provider releases the resources those
dependents use.

Cancellation is cooperative: synchronous JavaScript cannot be preempted in this
process, and uninterruptible acquisitions and finalizers must finish themselves.
There is no per-plugin initialization timeout.

## Where a live value may live

A service carries a value; a module variable does not. The rule is one
sentence: **a module another package can open holds no live value.** Every
reading one row hands another — the served directory, the shell's geometry, the
URL grammar's roster-dependent half, what day it is, the pinned shelf, the file
controls, the outline's naming of a node, where a minted document opens —
travels on a service the provider offers and the consumer names in `needs`.
None of them travels as an exported `let` behind a door.

What that buys is the thing a module variable cannot have: the runtime knows
who is asking. A consumer that named the key is held `waiting` while nobody
stands behind it, the plugins panel says which key and on whose account, the
value is withdrawn when the provider stops, and a replacement is a fresh
activation rather than an overwrite.

**A private holder is still how a value reaches a face.** A service arrives
where the dependency is declared, which is an `apply`; it is spent three levels
inside a component, in a memo, in a `<For>`. So a consuming package keeps a
holder of its own — `@olai/ui-primitives`' `heldService`, or the same six lines
written out — and the rules are three:

- **the consumer holds, never the provider.** What crosses the wall is the
  service; what lives at module scope is the consumer's own copy of it.
- **the hold is an activation's**, registered with `Effect.acquireRelease` on
  the scope of the component that declared the key, and cleared BY IDENTITY so
  a stopped activation cannot take a replacement's value away.
- **the read answers the absence.** `undefined` is *the service that carries
  this is not mounted*, and a consumer draws its own absent arm for it — the
  transcript keeps its chips as ids with no outline row, the palette says *no
  matcher* with no search row, the day page hides its mint button with no
  document row.

**Declare it on a COMPONENT, not on the row,** wherever the row has work of its
own that must survive the provider leaving. That is nearly always: content runs
under another layout (`olai-plugin-test-layout`), chat runs without outlines,
the inspector runs without the row that approves source. A `needs` on the row
would take the whole row away with the provider, which is the opposite of what
the dependency is for.

**And a plain helper takes the operation, not the holder.** A module with no
activation of its own — a catalogue of menu verbs, a fold over the pinned shelf
— is handed the narrow function it spends by the component that has it. That is
what keeps it testable over a roster a bench names rather than over whatever the
process last installed.

`@olai/effect-cordis/fence`'s `live-state` claim holds all of it: no module opened across a
package boundary holds a `let`, a module-scope Solid cell, a `heldService` or
`heldFaces` minted at load, a state-bearing IIFE, an instance of a class it
declared, or a `const` it writes into — and for a general package's doors the
same is asked of the implementation behind them, because a `let` one import back
is state you can open with nothing in the door to see. What is allowed is named
there with a reason each: a process's signals, a page's layer stack, memos over
immutable input, and the `Wired` broker §6 establishes.

## Moving one you wrote under the old shape

A plugin used to be a node carrying a `plugin` property with two children whose notes held the halves. Nothing reads that shape any more, and there is no migration in the product: move it by hand, once. Make `plugins/<word>/`, paste each child's note into `server.ts` and `browser.tsx` beside a `README.md` saying in a heading and a sentence what the thing does, delete the old node, and press **Turn on** on the plugin's page. The approval does not come across — the version is a hash of files now, and consent lives in `_olai/Settings.olai` — so you are asked once, about source you can finally read in an editor.

## What this is not

- **Not sandboxed.** See above. Approval is the boundary.
- **Not a lock, and the fence has a shape.** olai refuses a session's write of `approved` and `on` at its own door — that is a real refusal, with a sentence, and it is what stops an agent approving the plugin it just wrote *through olai*. It is not a claim about the file. Those are ordinary properties in an `.olai` in the served directory, the store watches that directory, and an approval that simply *appears* there is an ordinary revision. The agents this is about are processes on the same host with their own file and shell tools. The vault is the owner's directory: treating it as an attack surface leads somewhere silly, and olai does not pretend to police what it does not serve. What the fence covers is writes through olai's door (ruled, 2026-09-04).
- **Not a report of what the FACE did.** A half whose `apply` throws lands the plugin on `failed` with its own sentence, on the server. A face that throws while it is being *drawn* does not: the tab's fault boundary contains it the way it contains a shipped plugin's, the console says which plugin it was, and the page goes on saying **On** — because on the server it is. Initialization failures and missing browser dependencies are reported beside the server state. Render-time faults remain the drawing boundary's responsibility.
- **Not a second settings namespace.** A plugin's knobs are in `_olai/Settings.olai` with everybody else's, under a node named for the plugin. There is nothing per machine and no file beside the source.
- **Not a package.** There is no `olai plugin add`, no npins pin and no out-of-tree build. A plugin is three files in a directory olai is already serving.
