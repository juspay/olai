# Adding a plugin

The steps to add one plugin to olai. Only the name is required, plus a file declaring the calls the plugin answers if it answers any.[^outside]

A plugin that contributes one piece of live data is a whole plugin: the odu plugin is. What each word in those files means is in [plugin-vocabulary.md](plugin-vocabulary.md).

| Step | Where it lands |
| --- | --- |
| 1. The package | `packages/plugins/<name>/package.json` |
| 2. The calls it answers | `src/wire.ts` |
| 3. The server code | `src/server.ts` |
| 4. The browser code | `src/browser.tsx`, only if the plugin draws something |
| 5. The page | `packages/plugins/<name>/docs.md`, plus a symlink and an index row |
| 6. The registry row | `packages/bundle/olai.yml` |
| 7. If it runs a coding agent | `src/leg.ts`, `src/install.ts`, no surface |
| 8. If it ships a binary, a pin or a generated file | `default.nix` |
| 9. If it runs a coding agent | `e2e/fake/` |
| 10. Run the import check | `bun test packages/bundle` |

[^outside]: What lands outside `packages/`: two files, a symlink to the plugin's page and a line in the docs index. No general package changes at all.

<details>
<summary>1–4: the package, the calls it answers, and its two pieces of code</summary>

## 1. The package: `packages/plugins/<name>/package.json`

The package is called `olai-plugin-<name>`, with no `@scope/` in front, and its directory is the plugin's own word. `@olai/*` is the scope for the packages that are olai itself; a plugin is named the way a plugin written outside this repository would be. It goes in `packages/plugins/` and nowhere else.

Copy another plugin's manifest: `main`, `types`, a `typecheck` script, and an `exports` map listing the subpaths this plugin offers.

```json
"exports": {
  ".": "./src/index.ts",
  "./wire": "./src/wire.ts",
  "./browser": "./src/browser.tsx",
  "./server": "./src/server.ts",
  "./testids": "./src/testids.ts",
  "./all.css": "./src/browser/all.css"
}
```

- `./browser` is the one to get right: it is the subpath the generator writes the browser's dynamic `import()` against, so a manifest without it generates a row the browser cannot load.
- A plugin with no browser code leaves out `./browser` and `./all.css`. You do not need empty modules for them, and the generator writes neither a chunk nor a stylesheet import.
- Declare `@olai/plugin-api`, `effect`, the client for whatever outside program you talk to, `@olai/format` if you read the directory, `solid-js` if you draw anything, and everything else your own source files import. Bun gives a package exactly what its manifest names.
- Never declare `@olai/bundle`, which imports you, nor `@olai/effect-cordis` and `cordis`, which are the plugin engine's business.
- A plugin with slow tests records how long they take in its own `test-weights.json` at the package root, a map of repo-relative path to seconds. The harness decides how to split the tests up, and only the tests know their own timings.

## 2. The calls it answers: `src/wire.ts`

Export `name`, a `defineSurface` call declaring the calls this plugin answers, and the `faces` map saying who may make them. This module may not import SolidJS, a client for an outside program, or a `node:` builtin.

```ts
export const name = "odu"

export const surface = defineSurface({
  cells: {
    ci: oduMembers.cells.ci,
    service: oduMembers.cells.service,
  },
})

export const faces = { browser: { ci: "resource", service: "resource" } }
```

A plugin that runs a coding agent has no such file. What such a plugin shows in the browser already travels on the chat plugin's own data, so it declares no calls of its own and puts its `name` in `src/index.ts`. See step 6.

## 3. The server code: `src/server.ts`

Export as `default` a `definePlugin({ name, needs, apply })`, where `apply` is one Effect. Yield each service you listed in `needs`; the compiler refuses one you did not list.

- This is where you call the client for your outside program, where `Surfaces.register(…)` puts your calls on the connection, where `Kinds.register(…)` teaches the directory a word, and where `Deliveries` sends a message into a conversation.
- Register a `wake`, or no control appears for you on a conversation's strip and `chat.scope` refuses your plugin's name. That is the check working.
- Register on `SessionStart` if you have a tool to look for on the machine, and on `Agents` if your plugin runs a coding agent.
- Log with `Effect.logDebug` and `Effect.logWarning`, which are printed at whatever level the operator asked for.
- If your outside program calls you back from a timer or a socket, take `detached` once and start Effects through it. Use `ring(work)` where nobody needs to track the work, and `ring.held(work)` where something of yours has to interrupt it or wait for it.
- Everything you register is withdrawn for you when the plugin unloads, so write no teardown code, unless you hold something the runtime cannot see. That is an `Effect.addFinalizer`, which is what `xyne-spaces` does for the copies it keeps running.

> Use `addFinalizer` only when nothing was awaited to obtain the thing it releases. A fiber parked in `Effect.promise` unwinds where it stands, so anything you waited for belongs in `Effect.acquireRelease`, which cannot be interrupted between acquiring and registering the release.

## 4. The browser code: `src/browser.tsx`

Only if the plugin draws something. Same shape: `name` and `surface` re-exported from `./wire.ts`, and a `default` `definePlugin` whose Effect registers your components into `Slots`. It is a chunk of its own, fetched only when the list of running plugins names yours.

- A plugin that has a page of its own registers `app.route` here. A page made of rows uses `defineAppRoute` and `defineAppPage`; a page of any other sort uses `defineSelfDrawnRoute` and `defineSelfDrawnPage`. Both pairs are in `olai-plugin-navigation/routes`, and [navigation.md](../plugins/navigation.md) describes what they draw.
- The slots you may put a component in, and what each one takes, are in [slot-ownership.md](slot-ownership.md).

> An `onCleanup` registered after an `await` inside `onMount` runs with no owner, and Solid's production build compiles that to nothing. So register the cleanup before the load, over an empty slot, and check afterwards that the owner has not gone away.

</details>

<details>
<summary>5–6: the page, and the row in the registry</summary>

## 5. The page: `packages/plugins/<name>/docs.md`

Write the plugin's page there, symlink it at `website/docs/plugins/<name>.md`, and add a row for it to `website/docs/index.md`, under the group its sidebar entry belongs in. `packages/tests/plugin_docs.test.ts` fails if you skip either.

## 6. The row in `packages/bundle/olai.yml`

One row, because the rest is generated.

```yaml
- id: odu
  name: olai-plugin-odu/server
  section: Connections
  label: Odu
```

| Column | What it says |
| --- | --- |
| `id` | the plugin's word: the key other plugins know it by, the name its settings are kept under, its fiber's name, and the address of its page |
| `name` | the module the loader mounts, written as a string it looks up at mount time rather than as an import |
| `section` | required: the group this plugin sits in on the plugins panel, spelled as the screen spells it |
| `label` | the name a person reads on that row, such as `Claude Code`. Leave it out and the row shows the `id` |
| `disabled` | `true` for a plugin somebody has to turn on, such as one needing a secret this machine may not have |
| `profiles` | the extra profiles that include this plugin. The `web` profile takes the catalogue's defaults |
| `switchHint` | the warning shown before somebody switches this plugin off |
| `quiet` | `true` lets its group start collapsed while every plugin in it is running with nothing to say |

Add one line to the `dependencies` in `packages/bundle/package.json`, without which the generated `import()` does not resolve.

The generator writes everything else from the row: the browser's table of plugins with a dynamic import for each, the chain of stylesheets, the merged table of test identifiers, and the tables of assets and write reservations. It also writes the list of stand-in agents the tests use. `just install` produces all of them, and so does the Nix build in its own sandbox, so a packaged build cannot ship an out-of-date copy.

</details>

<details>
<summary>7–9: running a coding agent, a Nix part, and a scripted stand-in</summary>

## 7. If the plugin runs a coding agent

Such a plugin runs an ACP coding agent in a conversation, rather than talking to an outside program the way the kolu and odu plugins do. Smaller shape, same rules.

- No `./wire`, no surface, no `faces`: `src/index.ts` holds the plugin's word and nothing else.
- `src/leg.ts` is a `Leg` from `@kolu/acp/engine`: every assumption about how that agent talks, each written as a pure function with a unit test. Where none of them matches, the person is asked.
- `src/server.ts` registers `{ name, leg, at, prompt }` on `Agents`: the name a person reads, the leg, a probe answering `Adapter | NotHere` for this machine, and the channel the standing prompt travels on.
- `src/install.ts` holds the sentence shown when the agent is not installed: a `NotHere` whose `why` is a whole sentence, which nothing else assembles. One shared component draws it in the greyed-out picker row, on the page shown when there is no agent, and in the plugins panel row.
- `src/browser.tsx` registers the agent's logo in `delivery.mark`, and may define its own `row` component, which it gives to `plugins.row` under its own name through the `chat.engines` service.
- Its `testids` table is rightly empty: such a plugin draws inside elements olai's own code owns, under olai's identifiers, with `data-agent` carrying its word.
- The order of these rows in `olai.yml` matters: it is the order the picker draws them in and the order the install screen lists, and a conversation that names no agent is taken to be about the first row.

There is no slot for the words in the picker. The server supplies both the agent's name and the reason it is missing, so one place is responsible for that fact.

## 8. If it ships a binary, a pin or a generated file: `default.nix`

A plugin may have a `packages/plugins/<name>/default.nix`, which is its Nix part, folded in by `packages/bundle/default.nix`. Most plugins have none, which is the ordinary case. It takes `{ pkgs, pins, kit, b2n ? null }:` and returns an attrset whose keys are all optional, and any key not in the table below is refused by name.

| Key | Meaning |
| --- | --- |
| `hydrate` | sources copied into `node_modules/<dest>` after `bun install` |
| `externals` | the npm packages those sources need at the repository root |
| `koluSeeds` and `koluPins` | the kolu sources this plugin imports, and the pins that complete their dependency closure |
| `generated` | files written into the plugin's own tree. The path must contain `.generated.` |
| `npmTrees` | directories `just install` runs `npm ci` in, where a test needs a real `node_modules` |
| `knobs` | the environment variables the packaged wrapper sets with `--set-default` |
| `packages` | flake outputs this plugin contributes, such as `claude-agent` or `odu-bin` |
| `checks` | Nix checks of what the plugin builds, exposed as `checks.<system>.plugin-<name>-<check>`, each handed the built tree, which a check may ignore |

Where an ACP adapter olai ships lives, and what builds it, depends on the adapter:

| Adapter | Its files | What builds it |
| --- | --- | --- |
| pi | the plugin's own `acp/` directory: the npm shim, its patches and the test rigs for them | `@olai/plugin-kit`'s `npmAdapter`, called from the plugin's `default.nix` |
| Codex | the plugin's own `acp/` directory, with a lock file and derivation of its own, because Codex is released on its own schedule | that derivation |
| Claude Code | nothing under the plugin, because kolu ships the same adapter | kolu's own derivation, which the plugin's `default.nix` builds from the kolu pin |

## 9. If the plugin runs a coding agent: `e2e/fake/`

The scripted stand-in the browser tests run instead of the real agent lives at `packages/plugins/<name>/e2e/fake/`: an `index.ts` describing it, typed by `@olai/tests`' `./harness/fake.ts`, plus the executables the harness starts. `packages/tests/agent/` keeps only the part that is the same for every agent, and the harness finds the stand-ins through the generated `@olai/bundle/e2e-fakes` list rather than by name.

</details>

<details>
<summary>10: run the import check</summary>

```
bun test packages/bundle
```

It tells you what you got wrong, and it is specific: a subpath you imported past, a word a general package reserves, an environment variable your manifest and your module spell differently. [plugin-system.md](plugin-system.md) lists which file holds which rule.

</details>
