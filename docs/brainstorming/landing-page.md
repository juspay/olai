# landing page: a notebook's front door

Status: brainstorm (2026-08-10). Not scheduled. No roadmap entry.

**index.md renders at `/`.** A notebook with an index.md gets a front
door on any olai — live server and published site alike. No config, no
new file kind: it's a doc at the one route nobody owns. The olai website
is exactly this — the racket-era landing copy rewritten as docs/index.md.
On the published site, the SSG build compiles it to index.html like every
other route (mechanics in website.md).

If plain markdown proves too weak for a landing, remark DIRECTIVES
(:::hero, :::install — a small olai-rendered block vocabulary, still
data, still sanitized, same pipeline) are the upgrade path. MDX is a
different, standalone conversation: see mdx.md.

## open

- does `/` with no index.md keep today's behavior (whatever the app
  default route shows)? Presumably yes; say so in the docs when this
  ships.
