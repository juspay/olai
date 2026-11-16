# Adding a plugin

The steps to add one plugin to olai. Two artefacts live outside `packages/` (a symlink and a line in the docs index), and no general package changes at all. The words each file uses are in [plugin-vocabulary.md](plugin-vocabulary.md).

Everything below except the name, and a surface where you compose one, is optional. A plugin that contributes one cell is a whole plugin: odu is.

## 1. The package: `packages/plugins/<name>/package.json`

The package is `olai-plugin-<name>`, unscoped, and the directory is the plugin's word. `@olai/*` is the scope for the packages that are olai; a plugin is named the way an out-of-tree one would be. It goes in `packages/plugins/` and nowhere else.

Copy another plugin's manifest: `main`, `types`, a `typecheck` script, and an `exports` map of the subpaths this plugin has.

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

- `./browser` is the one to get right: it is the subpath the generator emits the tab's dynamic `import()` against, so a manifest without it generates a browser row that will not resolve.
- A server-only plugin omits `./browser` and `./all.css`. No empty modules are needed, and the generator emits neither a chunk nor a stylesheet import.
- Declare `@olai/plugin-api`, `effect`, your appliance's client, `@olai/format` if you read the directory, `solid-js` if you draw, and everything else your own sources import. The linker gives a package exactly what its manifest names.
- Never declare `@olai/bundle`, which imports you, or `@olai/effect-cordis` and `cordis`, which are the engine's business.
- A plugin with slow tests records its share in its own `test-weights.json` at the package root, a map of repo-relative path to seconds, because the sharding is the harness's and the timings are the tests'.

## 2. The wire: `src/wire.ts`

Export `name`, a `defineSurface` and the `faces` map. This module may not import SolidJS, an appliance client or a `node:` builtin.

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

An engine has no such file. What an engine contributes to a tab already travels on the chat cell, so it composes no surface and puts its `name` in `src/index.ts`. See step 6.

## 3. The server half: `src/server.ts`

Export a `default` of `definePlugin({ name, needs, apply })`, where `apply` is one Effect. Yield each service you named; the compiler refuses one you did not.

- This is where the appliance's client is called, `Surfaces.register(…)` puts your surface on the wire, `Kinds.register(…)` teaches the directory a word, and `Deliveries` posts into a conversation.
- Register a `wake`, or the strip draws no picker for you and `chat.scope` refuses your name. That is the gate working.
- Register on `SessionStart` if you have a tool to probe for, and on `Agents` if you are adding an engine.
- Log with `Effect.logDebug` and `Effect.logWarning`, which arrive at the level the operator asked for.
- If your appliance calls you back from a timer or a socket, take `detached` once and start Effects through it: `ring(work)` where nobody needs the fiber, `ring.held(work)` where something of yours must interrupt or await it.
- Everything you register comes back out on unload, so write no teardown, unless you hold something the runtime cannot see. That is an `Effect.addFinalizer`, which is what `xyne-spaces` does for its mirrors.

> Use `addFinalizer` only when nothing was awaited to obtain the thing it releases. A fiber parked in `Effect.promise` unwinds where it stands, so anything you waited for belongs in `Effect.acquireRelease`, which cannot be interrupted between acquiring and registering the release.

## 4. The browser half: `src/browser.tsx`

Only if the plugin draws. Same shape: `name` and `surface` re-exported from `./wire.ts`, and a `default` `definePlugin` whose Effect registers your components into `Slots`. It is its own chunk, fetched only when the roster names your plugin.

- A plugin that owns a page registers `app.route` here. A page made of nodes uses `defineAppRoute` and `defineAppPage`; any other page uses `defineSelfDrawnRoute` and `defineSelfDrawnPage`. Both are in `olai-plugin-navigation/routes`, and [navigation.md](../plugins/navigation.md) describes what they draw.
- The slots you may hang a face in, and what each takes, are in [slot-ownership.md](slot-ownership.md).

> An `onCleanup` registered after an `await` inside `onMount` runs with a null owner, which Solid's production build compiles to nothing. Anything you load before you can build registers its cleanup before the load, over an empty slot, and guards the continuation against an owner that has gone.

## 5. The page: `packages/plugins/<name>/docs.md`

Write the plugin's page there, symlink it at `docs/plugins/<name>.md`, and add a line to `docs/index.md`. `packages/tests/plugin_docs.test.ts` fails if you skip either.

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
| `id` | the plugin's word: the sibling key, the settings namespace, the fiber's name and the address of its page |
| `name` | the module the loader mounts, as a specifier it resolves at mount rather than an import |
| `section` | required: the plugins panel group this row sits in, spelled as the screen says it |
| `label` | the name a person reads on that row, such as `Claude Code`. Absent draws the `id` |
| `disabled` | `true` for a plugin that is opt-in, such as one needing a secret this machine may not have |
| `profiles` | the extra profiles that select this row. The `web` profile takes the catalogue defaults |
| `switchHint` | the warning shown before somebody switches this row off |
| `quiet` | `true` lets its group start collapsed while every row in it is running with nothing to say |

Add one line to `packages/bundle/package.json`'s `dependencies`, without which the generated `import()` does not resolve. The generator writes the rest from the row: the browser's row table with a dynamic import per plugin, the stylesheet chain, the merged testid table, the asset and write-reservation tables, and the roster of engine fakes. All of them are produced by `just install` and by the Nix build in its own sandbox, so a packaged build cannot ship a stale copy.

## 7. If it is an engine

An engine is an ACP coding agent the chat panel seats, rather than an appliance olai has a judgement about. Smaller shape, same rules.

- No `./wire`, no surface, no `faces`: `src/index.ts` holds the plugin's word and nothing else.
- `src/leg.ts` is a `Leg` from `@kolu/acp/engine`: every assumption about that agent's wire, each a pure function with a unit test. An agent matching none of them means the person is asked.
- `src/server.ts` registers `{ name, leg, at, prompt }` on `Agents`: what a person reads, the leg, a probe answering `Adapter | NotHere` for this host, and the channel the standing prompt rides.
- `src/install.ts` holds the absence sentence the probe spends: a `NotHere` whose `why` is a whole sentence the reader does not compose. One shared component draws it in the disabled picker row, the no-agent face and the inspector row.
- `src/browser.tsx` registers the engine's mark in `delivery.mark` and may define its own `row` component, which it hands to `plugins.row` under the engine's own identity through the `chat.engines` service.
- Its `testids` table is legitimately empty: an engine draws inside core's elements, under core's identifiers, with `data-agent` carrying its word.
- The order of the engine rows in `olai.yml` is load-bearing: it is the order the picker draws and the install screen lists, and the first row is what a conversation naming no agent is read as being about.

There is no slot for picker words. The server supplies both the engine's name and its absence reason, so there is one author for that fact.

## 8. If it ships a binary, a pin or a generated file: `default.nix`

An optional `packages/plugins/<name>/default.nix` is the plugin's Nix half, folded by `packages/bundle/default.nix`. A plugin without one has no Nix half, which is the ordinary case. It is `{ pkgs, pins, kit, b2n ? null }:` and returns a contract attrset, every key optional and any other key refused by name.

| Key | Meaning |
| --- | --- |
| `hydrate` | sources copied into `node_modules/<dest>` after `bun install` |
| `externals` | the npm externals those sources need at the root |
| `koluSeeds` and `koluPins` | the kolu seeds this plugin's source imports, and their closure grafts |
| `generated` | files written into the plugin's own tree. The path must contain `.generated.` |
| `npmTrees` | directories `just install` runs `npm ci` in, for a `node_modules` a test resolves |
| `knobs` | the executable variables the packaged wrapper bakes as `--set-default` |
| `packages` | flake outputs this plugin contributes, such as `claude-agent` or `odu-bin` |
| `checks` | checks that need the built tree, exposed as `checks.<system>.plugin-<name>-<check>` |

A shipped ACP adapter is the plugin's own `acp/` directory, with its patches and their rigs, plus a standalone lock and derivation where the adapter has its own release clock, as Codex keeps. The plugin's `default.nix` declares it through `@olai/plugin-kit`'s `npmAdapter`, and nothing outside the plugin's directory names any of it.

## 9. If it is an engine: `e2e/fake/`

An engine's scripted browser-test fake lives at `packages/plugins/<name>/e2e/fake/`: an `index.ts` descriptor, typed by `@olai/tests`' `./harness/fake.ts`, plus the executables the harness spawns. `packages/tests/agent/` keeps only the engine-agnostic core, and the harness reaches the fakes through the generated `@olai/bundle/e2e-fakes` roster rather than by name.

## 10. Run the fence

```
bun test packages/bundle
```

It tells you what you got wrong, and it is specific: a door you reached past, a word a general package spells, a knob your manifest and your module disagree about. [plugin-system.md](plugin-system.md) lists which file holds which rule.
