# @olai/plugin-kit — a plugin's face in a conversation

What a plugin's sentence in chat is made of, without knowing which plugin. Two things, and they are one concern: a FACE (the mark) and a SUBJECT (the node it is ringing about).

A tenant **declares data**. This package is the mechanism, said once.

- **`BrandMark`** — the nested viewport around a generated SVG body. Core owns the `0 0 16 16` box; a real logo has a coordinate system of its own, so this opens a nested `<svg>` inside the `<g>` `PluginMark` returns. Per-instance ids via `createUniqueId`.
- **`nodeRef`** (`./ref`) — an olai node id, written as a code span. The panel already makes that pressable (`chat/quoted.ts`, `chat/refs.ts`). The HEAD of a wake carries it, so a collapsed line is a link and not a link behind the fold it is the reason to open. Its own door, because a doorbell lives on `./server` and the root carries SolidJS.
- **The SVG transform** (`src/mark/inline.ts`) — not a JavaScript export. A plugin's `default.nix` names the pin path; `packages/plugin-kit/default.nix` runs the transform. Bumping the pin is the whole of updating the logo. The generated module is gitignored.

It is a **sibling of `@olai/plugin-api`**, not a door of it — and a sibling of `@olai/bundle` for the sharper reason: THAT package imports every plugin, so a plugin importing it is a cycle the manifests cannot express. A third plugin imports this and is not browbeaten to copy a first tenant's internals.

No plugin's name is spelled here. Kolu's path is `packages/client/favicon.svg`; odu's is `logo.svg` at the repo root; a third tenant names its own.

## The `nix/` doors — the Nix mechanisms, said once

`nix/` holds the shared Nix machinery the plugins' `default.nix` files call
and the root's fold validates against. Four files:

- `mark.nix` — turn a tenant's npins-pinned logo file into a TypeScript module
  the plugin runs its SVG transform over (the mechanism the paragraphs above
  describe, which a tenant's `default.nix` names in its `generated` map).
- `npm-adapter.nix` — build one shipped ACP adapter from an npm shim's
  committed lockfile: one fixed-output derivation, patches applied with
  `patch -p1 -F0`, nothing fetched at build time and no `npx` at run time.
- `contract.nix` — the validator that knows what a plugin's `default.nix` may
  return and refuses anything else by name (the two doors `contract` and
  `contractProblems`, so `fold-check.nix` can assert a refusal names both
  sides without throwing).
- `knob-shell.nix` — one function, two renderings of a plugin's `knobs`: the
  makeWrapper `--set-default`/PATH-splice text the packaged `olai` uses, and
  the `export VAR="${VAR-default}"` snippet the dev shell sources, so the
  wrapper and `.#plugin-env` cannot say different things about a variable.
