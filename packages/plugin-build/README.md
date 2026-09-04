# @olai/plugin-build

Source somebody wrote, as a module olai can mount.

This package exists for one thing: a plugin that arrives from the **served directory** rather than from the build (phase 12 — [docs/dynamic-plugins.md](../../docs/dynamic-plugins.md)). Its source is a note on a node in somebody's vault; what has to come out the other end is a module the serve can `import()` and a chunk a tab can fetch, holding **this** binary's Effect and **this** app's Solid.

It knows nothing about vaults, rows, nodes, approval or the wire. Text in, text out, or a sentence saying why not — which is what makes the whole of it testable with two string constants and no serve. The vault half is `@olai/server`'s `src/dynamic/`, and the mounting is the bridge's.

## The three things it does

**Refuses what it cannot resolve** (`src/imports.ts`). A plugin may name `@olai/plugin-api`, `effect` and `solid-js`, by their bare names and whole. A vault has no `node_modules` and never will, so the value of the gate is not safety — the code runs with the process's authority either way, which is why a person approves it — it is a **sentence**, arriving when the plugin is defined rather than when it dies. The scan is `Bun.Transpiler.scan`, so a specifier in a comment is not an import and neither is a `import type` the emit erases.

**Compiles** (`src/build.ts`). The server half is `Bun.Transpiler`; the browser half is babel with `babel-preset-solid`, exactly as `@olai/web`'s own build compiles the app's faces and for the reason recorded there. Nothing is bundled, because there is nothing to bundle: a plugin is two files, relative imports are refused, and every remaining specifier is bound rather than resolved. So neither half touches a filesystem or reads a package tree, which is what lets this run in a serve whose own tree is a read-only store path.

**Binds** (`src/bind.ts`). `import { createSignal } from "solid-js"` becomes `const { createSignal } = globalThis.__olai_plugin_modules["solid-js"]`. Bundling the dependency in would give a second Solid — a second reactive runtime, whose components cannot read the app's contexts — and leaving it external would leave a bare specifier nothing resolves. So the specifier is never resolved anywhere: it is replaced by a read of a table the host filled from its own static imports, which is the only arrangement in which *the same copy* is true by construction. The rewrite does not trust its own regex — it asserts afterwards that no module syntax is left, and refuses in words naming the line if any is.

## The two doors

`.` is the compiler and carries babel. `./shared` is four string constants — the module names and the global they are bound through — and carries nothing, because a **tab** opens it: `@olai/web`'s entry fills that table out of its own static imports. Behind one door the browser bundle would carry the Solid JSX transform to read four strings.
