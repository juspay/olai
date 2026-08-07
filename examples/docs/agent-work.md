# Agent work

Demo fiction: what a `@doc` document looks like when the node it hangs off is
zoomed. The outline shows one line of this; `/n/agent` shows all of it.

## Why a file

A node is a line. Some nodes are not a line — they are a page, and a page
wants headings, lists and code. Those live in a file next to the outline, so
`grep`, `git diff` and `$EDITOR` all keep working on them.

## Rules of the road

- The path is relative to the file that *defines* the node.
- Two extensions, and no third: `.md` and `.scrbl`.
- The string in the outline is data; the HTML is a reading of it.

```bash
$ olai tree examples/Example.jsonl | jq '.. | .doc? // empty'
"docs/agent-work.md"
```

> Nothing here is anyone's real plan. It is a sample.
