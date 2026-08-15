# @olai/fonts — the typefaces, their words, and their build

A typeface in olai is a **pick with a name**, the same shape as a theme: the table is the source, and everything else about a font is derived from it. This package is that table plus everything derived from it, and the reason they are all here is that they were three different answers to one question in three different places — a nix file, a build script and a client directory — and only one of them could be read at a time.

| file | what it owns |
|---|---|
| `src/typefaces.ts` | the picks: every typeface a person can choose — name, label, group, hint, and the three stacks |
| `src/hosted.json` | the faces on disk: where each file comes from in nixpkgs, and the family, weight and style it carries. Read by `src/hosted.ts` AND by `default.nix` — one list, two languages |
| `src/hosted.ts` | that list, as the table the sheet generator reads |
| `src/css.ts` | the sheet the two become — one `@font-face` per hosted file, one `:root[data-font="…"]` block per pick |
| `default.nix` | the faces themselves: nixpkgs sources, converted to woff2 **once, in the Nix store** |

Two entry points, one per reader. `@olai/fonts` is what a PAGE reads — the picks, and nothing else, because a browser drawing a picker has no use for a filename. `@olai/fonts/build` is what a client BUILD takes: the generated sheet, and the list of woff2 files that sheet's `src: url(…)` needs under `/fonts/`. One entry rather than two, because they are one obligation — a build that took the sheet and not the files would ship a page whose every face 404s.

## The three tokens

`--font-sans` is the chrome (header, sidebar, notes, chat). `--font-serif` is the page (outline titles, a document). `--font-mono` is the furniture that has to be tabular (a SHA, a diff, a breadcrumb). A row answers all three, so picking a font is one decision and not three.

The default is **Atkinson Hyperlegible Next** — one voice, the way Workflowy's list is. The **Olai** row is the one that keeps the three jobs distinct (Literata / iA Writer Quattro / iA Writer Mono). Generics (System, Sans-serif, Terminal, …) name only what a browser already has and download nothing.

## Adding a typeface

1. A row in `TABLE` (`src/typefaces.ts`).
2. If it is hosted rather than generic: a group in `src/hosted.json` — the nixpkgs package its files come from, the directory under `share/fonts/`, the family the CSS will name, and one entry per file.

Two edits, and the second is one place rather than two: the derivation and the sheet read the same JSON, so there is no way to give a face to one and not the other. The picker then draws one option per row, and the sheet grows its `@font-face` and its block.

## Converted once, in the store

`default.nix` runs `woff2_compress` and outputs `.woff2`. It used to output raw TTFs and the client build converted them, which meant 70 identical compressions — half a minute of CPU and a fresh `/tmp` directory — on every `just build-client`, every `nix build` and every dev-shell rebuild, for bytes that were the same bytes every time. The conversion is a function of the font set, so it belongs where a function of its inputs is computed once and cached forever.

What is left in `@olai/web`'s build is a **copy**, one `HOSTED_WOFF2` name at a time out of `OLAI_FONTS_DIR` (`shell.nix` and the root `default.nix` both point at this derivation). The lookup stays by name rather than copying the directory wholesale, because that list is exactly what the generated sheet asks for: a face it names that the derivation does not convert has to fail the build rather than 404 in somebody's browser.

```sh
nix build .#olai-fonts   # the directory itself, if you want to look at it
```

## What is NOT here

**The pick.** Which typeface this browser is in, and what pressing an option does, is client state and lives in `@olai/web` (`theme/fontState.ts`, `theme/FontSelect.tsx`) — beside the theme's, because a font is the same kind of preference: written on `<html>` by the shell's boot script before the first paint, stored under `olai.font` in that browser, and never sent anywhere.

**The `@theme` block.** Tailwind can only generate `font-sans` for a `--font-sans` it has seen, so `@olai/web`'s `styles.css` spells the token names and the default row's stacks by hand. That is the one hand-copy, and `theme/fonts.test.ts` over there holds it to this table.

## Layering

No dependencies at all — two tables and the pure functions over them. Nothing here fails, does IO, or knows what a browser or a build is; the one thing that touches a disk is the derivation, which is not JavaScript. The one runtime check is `hosted.ts`'s: a `style` the JSON spells wrong is a face that would silently never apply, so it is parsed at import and thrown on.
