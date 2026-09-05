# The matcher

Search is a plugin. The trigram table the server keeps up to date, the walk over it that ranks and caps and situates a hit, and the box in the app header all arrive with one row in the build's plugin list. A serve that does not name that row still has the grammar, the tool and every box a person types into — and every one of them answers *nobody is searching here*.

What search *does* has its own page: [search.md](../search.md) is the grammar, the five doors and what a query means. This page is about the row.

## What turns it on

Nothing. It is on by default, like chat, git and the journal. Two things take it away, and they answer two different questions.

`--plugins` decides what a serve **comes up with**:

```
olai web ~/outlines                                  # the box, as always
olai web ~/outlines --plugins=chat,journal,git       # every query answers with the reason
```

The plugins panel — `⧉` in the header — turns it off and on **while the serve runs**, and that lasts as long as the process: a restart comes back to the flag. Switched off at the panel, the header's box leaves while you are watching, and the ⌘K palette, the composer's `@` list, the edges panel and the move picker each draw the refusal on the next keystroke.

**Either way, no query finds anything, and nothing is silent about it.** The refusal is carried on the answer's `refusals`, which is the field every one of those doors already draws for a query the grammar could not read — and which an agent reads in the result of `search_nodes`. There is no empty list with nothing to say.

## The filter over a page is not on this row

Narrowing the rows in front of you — the filter bar over an outline, a day, the agenda, the trash — is a different question with a different answer: it is a reading of ONE page a browser already holds, asked as a standing view rather than as a call, and it never touched the index. It stays in core and goes on working with this row off. See [search.md](../search.md).

## On the wire

Nothing. This row composes no sibling surface, and that is a ruling rather than an omission: `search.nodes` is core's member — on the browser, MCP and agent faces — and the `search_nodes` tool an agent calls lands through it. A row that published `surface/search/` of its own would rename a tool agents already call, for nothing.

What this row contributes is the ANSWER behind that member. Core defines a `Search` door (`@olai/ops`); this plugin stands behind it, and `search.nodes` calls through it.

## Where it hangs in the tab

| seat | what the shell keeps | what search brings |
| --- | --- | --- |
| `app.header` (`lead`) | the seat, and what it costs when the bar runs out of width | the box, and the phone's magnifier |

The `lead` word arrived with this row. It is the seat ahead of the pills — the one control in the bar that may shrink to nothing before any pill loses a character, and the one drawn on a phone too, where it is a 44px magnifier that opens the ⌘K palette. The panel of results portals against the viewport, the way the commit and preferences panels do.

What did **not** move is the shortlist under every search box — the input, the rows, the cursor, the "8 of 90" count, the refusal line. Four core doors already shared it before this row existed, so it is the shell's furniture and this face draws with it, exactly as it did when it lived in the shell.

## Semantic recall

A second provider row, whenever it arrives ([#165](https://github.com/juspay/olai/issues/165)). Core's door takes a query and answers located nodes; what stands behind it is a row, and a different matcher is a different row rather than a mode of this one.
