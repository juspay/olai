# The matcher

Search is a plugin. The trigram table the server keeps up to date, the walk over it that ranks and caps and situates a hit, and the box in the app header all arrive with one row in the build's plugin list. A serve that does not name that row still has the grammar, the tool and every box a person types into — and every one of them answers with the reason, naming the row: *the `search` plugin is not running on this serve*.

What search *does* has its own page: [search.md](../search.md) is the grammar, the five doors and what a query means. This page is about the row.

## What turns it on

Nothing. It is on by default, like chat, git and the journal. Two things take it away, and they answer two different questions.

`--plugins` decides what a serve **comes up with**:

```
olai web ~/outlines                                  # the box, as always
olai web ~/outlines --plugins=vault,chat,journal,git,ws,web-app,mcp,ui-renderer,layout       # every query answers with the reason
```

The plugins panel — `⧉` in the header — turns it off and on **while the serve runs**, and that lasts as long as the process: a restart comes back to the flag. Switched off at the panel, the header's box leaves while you are watching, and the ⌘K palette, the composer's `@` list, the edges panel and the move picker each draw the refusal on the next keystroke.

**Either way, no query finds anything, and nothing is silent about it.** The refusal is carried on the answer's `refusals`, which is the field every one of those doors already draws for a query the grammar could not read — and which an agent reads in the result of `search_nodes`. There is no empty list with nothing to say.

## The filter over a page is not on this row

Narrowing the rows in front of you — the filter bar over an outline, a day, the agenda, the trash — is a different question with a different answer: it is a reading of ONE page a browser already holds, asked as a standing view rather than as a call, and it never touched the index. It belongs to outlines and goes on working with search off. See [search.md](../search.md).

## On the wire

Search owns its procedure and query-stream descriptors, registered with the server by its activation. The browser calls that capability's client. MCP keeps the established `search_nodes` spelling while withdrawing it when its provider leaves.

## Where it hangs in the tab

| seat | what the shell keeps | what search brings |
| --- | --- | --- |
| `app.header` (`lead`) | the seat, and what it costs when the bar runs out of width | the box, and the phone's magnifier |

The `lead` word arrived with this row. It is the seat ahead of the pills — the one control in the bar that may shrink to nothing before any pill loses a character, and the one drawn on a phone too, where it is a 44px magnifier that opens the ⌘K palette. The panel of results portals against the viewport, the way the commit and preferences panels do.

The shortlist, result rows and count are search's public presentation contracts. Navigation, chat and outlines supply their own selection behavior and retain their own editing state. The generic cursor is a UI primitive.

Live queries arrive through the scoped `search.readings` service. Removing search disposes each query subscription, clears actionable results and shows an unavailable message in surviving pickers. Returning search starts a fresh query for the consumer's current input. No implementation is cached in a process-global handle, and no general web module imports a search implementation.

## Semantic recall

A second provider row, whenever it arrives ([#165](https://github.com/juspay/olai/issues/165)). Core's door takes a query and answers located nodes; what stands behind it is a row, and a different matcher is a different row rather than a mode of this one.
