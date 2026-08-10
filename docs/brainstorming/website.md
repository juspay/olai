# website: static rendering of an olai web snapshot

Status: brainstorm (2026-08-10). Not scheduled. No roadmap entry.
The landing page is its own note now: landing-page.md.

Idea: publish `olai web docs/` as a static site -- the real client, this
repo's own corpus, no server. What the site IS is decided there (a
notebook with a front door); this note is only about HOW to render and
ship a static snapshot of it.

## the seam

wire.ts is the only file that knows a websocket exists. Static build
swaps that seam, keeps everything else. Honesty carries over:

- connection dot becomes `snapshot @ <sha>`, linking the commit
- chat panel explains itself ("public snapshot -- run olai web for the
  agent"), NoAgent-style
- `just check` gates deploy, so the published set always validates
- every Viewing PR upgrades the site without anyone thinking about it

Out: chat, live, editing. Each says so on screen.

## data: how the client gets the set without a server

Browser runs the codec fine (@olai/format is pure; derive already runs
client-side). Browser can't walk a directory on static hosting. So a
build step exists in every variant; pick how much it bakes:

1. manifest + raw files: bake the file list, client fetches + decodes.
   Every visitor pays decode.
2. snapshot.json: build runs the same store load the server runs, emits
   SetSnapshot + sha. One fetch; the build is itself a validation gate.
3. prerender: build runs the app over docs/ once, HTML falls out (below).

## SSG

Solid's server renderer runs the SAME components -- renderToString at
build, hydrate in browser. No second renderer, no drift. Options:

- SolidStart prerender (routes + crawlLinks): mature, but drags in
  vinxi/vite and displaces our bun build.ts that nix packaging wraps.
- bare renderToString + hydrate: build.ts already drives
  babel-preset-solid; the ssr / dom-hydratable pair is exactly the two
  builds SSG needs. Small driver enumerates routes from the derived set
  (files, node ids, days, docs), writes real files. No new build system.
  Cost: hydration discipline forever.
- vike-solid / Astro islands: vite-shaped; Astro's shell is a genuine
  second renderer. No.
- Effect: no SSG story, none needed; the driver is a normal Effect
  program.

Why bother over a snapshot-SPA: real files per route (deep links without
the 404.html hack), content before JS, view-source proves the site is the
app. Why not: hydration tax; route enumeration must stay complete or a
page silently isn't.

Leaning (not resolved): bare renderToString driver over the baked store
load. One bundler, SSG benefits, no framework adoption. The two compose:
snapshot-SPA first is the driver minus HTML emission -- loses nothing.

## deploy -- resolved 2026-08-10

- custom domain (CNAME) planned; no base-path work
- one deploy-only GHA workflow on master push. CI stays odu; this
  publishes, it doesn't check. Consumes just-built artifacts: one bundler.
- current Pages deployment is a racket-era orphan; nothing rebuilds it.

## open

1. snapshot-SPA first or SSG first?
2. hydrate everything, or only the interactive bits?
3. the domain (name, DNS, when CNAME lands)
4. /today is frozen at build time -- rebuild on push only, or scheduled
   rebuild so it stays honest across quiet days?
