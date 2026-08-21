---
agent: claude-opus
owners: [alice, bob]
date: 2026-09-01
tags: '#swatches'
---

# Palette

No node attaches this one. It is a `.md` under the served directory, which is
the whole qualification: every document found gets a page and a place in the
sidebar, whether or not an outline names it.

Its picture is named through `../`, so it is resolved against this file's own
directory rather than the root.

![the handle again](../art/handle.png)

## What the block above has to do

It opens with frontmatter, and every line of that block is one this vault has
to get right: the page must not draw it, the contents must not list it, the
document must not be named by it, `#swatches` must not index as a tag somebody
wrote, `date:` must stay a property rather than becoming a day, and
`prop:agent=claude-opus` must find this file.
