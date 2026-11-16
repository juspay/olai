---
name: docs-writing
description: The writing standard for every docs page under website/docs/, including the plugin pages authored at packages/plugins/<name>/docs.md. Shape limits a test enforces, the review rules beside them, the reference-entry template, and two worked before/after samples. Load before writing or editing any page.
---

# Writing olai's docs

Every page under `website/docs/` is held to this standard, the plugin pages included: those are authored at `packages/plugins/<name>/docs.md` and read at `website/docs/plugins/<name>.md`, a symlink. The pages stay Markdown files in the repository. Most readers meet them on [olai.page](https://olai.page/docs/), which publishes `website/docs/<page>.md` at `/docs/<page>/`; some read them on GitHub, and `just serve` with no argument also serves the directory in olai itself. A page has to read well in all three. The rest of `website/` is the pitch, and none of this belongs there.

Rules marked **[lint]** are enforced by `packages/tests/docs_lint.test.ts`, one test per page, with no exemption list and no per-page override. If a rule is wrong, change it here and in `packages/tests/support/docs-rules.ts`, for every page at once. The site's build (`just website`) holds the rules marked **[site]**.

## When you change a page

Edit the page so it stays true. Do not append a paragraph describing your change, and do not grow a table cell. History belongs in the commit log. A new fact goes where a reader looks for it: a row in an existing table, an item in an existing list, or a sentence in the section that owns the topic.

## The reader

1. **One page, one reader, one job.** Every page is one of four kinds, and the group it sits in on `website/docs/index.md` says which:
   - **Tutorial**: one path from nothing to a visible result.
   - **How-to**: the steps of one task, for a reader who knows what they want.
   - **Reference**: every fact about one surface, in a fixed order, for looking up.
   - **Explanation**: why something works the way it does, for a reader who asks.

   Content for a different reader moves to the page that owns it, and is linked.
2. **Write for someone using olai, not someone who built it.** Keep what the reader can see, do, or must know to predict what happens, including limits and failure messages. Cut history, why a design was chosen (unless the reader has to choose something), how it is implemented, which pull request changed it, and descriptions of looks the screen already shows. Cut roadmap too: say what is true now.
3. **Order by the reader's questions:** what is it → how do I start → how do I use it → what can go wrong → reference detail. The first screen answers the first two.

## Shape

4. **Opening paragraph ≤ 50 words:** what this is and what you do with it. No history.
5. **Paragraphs and list items ≤ 80 words. [lint]**
6. **Table cells ≤ 40 words. [lint]** A cell that needs more becomes an entry under its own heading.
7. **≤ 300 words of running text under one heading. [lint]** Tables and code do not count.
8. **A page ≤ 2,500 words of running text. [lint]** A page that cannot fit is split. No page is exempt.
9. **Three or more parallel things with attributes go in a table or a list**, never inside one sentence. A sequence the reader performs is a numbered list.
10. **No paragraph opens with a bold run-in. [lint]** Use a heading, a list or a table. A list item may open with a bold term, not a bold sentence.
11. **Headings say what the reader finds or does** ("Serve a directory", "When an agent does not appear"), in words the reader would search for. The test: someone who reads only the index can say where each answer is.
12. **At most two cautions per page**, written as a blockquote, ≤ 50 words each, for cautions and limits only.

## Sentences and words

13. **No sentence over 40 words [lint]**; aim for an average under 20.
14. **At most one em-dash and one semicolon per sentence. [lint]** A pair of dashes around an aside counts as two: use parentheses or commas. The lint reads `--` as a dash too, since a page renders it as one.
15. **Second person, present tense, active voice.** "You press…", "olai writes…".
16. **Bold is for words the reader sees on screen** (button, tab, menu and field labels) and for a term at the point it is defined. Never for emphasis, and **no capitals for emphasis [lint]**. Quote a label exactly as the app renders it, and check it in the code (`packages/plugins/*/src/browser.tsx` and the faces beside it), not in an older page. An acronym the lint does not know goes in its list; a name the reader types goes in backticks.
17. **Plain words first.** An internal name (a package, a service, a module) appears only if the reader types it or sees it, and is explained once in a short clause. Pick one word per thing and keep it. These are olai's:

| Say | Means | Do not say |
| --- | --- | --- |
| the directory | the directory olai serves | "the vault", which no screen says. It stays in `olai surface --help`, in the `vault-plugins_*` tool names and on the vault plugin's own page |
| a row | one line of an outline | "a bullet", "an item", "a line" except where you are writing a new one |
| a node | a row, where an address, a tool or a property names one | "a record", which is the format's word for the stored shape |
| a page | what one file draws in the browser | "a view", "a screen" |
| a document | a `.md` file | "a note" for the file: a note is the text under a row |
| the sidebar | the left column of files, and the rail beside it | "the tree", "the left panel" |
| the palette | what `Cmd` + `K` opens, labelled **Command palette** | "the command bar", "the launcher" |
| the agent panel, a conversation | the right-hand panel, labelled **Agent panel**; one chat in it | "the dock", "a thread", "a session" outside an agent's own page |
| an agent | Claude Code, Codex, opencode, pi or Oh My Pi | "an engine", which is the plugin that runs one |
| a plugin | one of the parts the **Plugins** panel lists | "a row" for a plugin, "a capability", "a module" |
| a property | a key and a value on a row | "a field", "an attribute" |
| a mark | **To do**, **Doing**, **Done** or **Cancelled** on a row | "a status", "a checkbox", "a state" |
| the inbox, quick capture | where a captured row lands; the control that puts it there, labelled **Capture to the Inbox** | "the scratchpad" |
| the commit panel, the Commit readout | where you commit; the line in the header that says what is waiting | "the git pane" |
| an MCP tool | a name an agent calls, such as `outlines_add` | "a verb", "a procedure", "an endpoint" |

18. **No history words [lint]:** `used to`, `no longer`, `any more`, `previously`, `formerly`, `until now`, `as before`, `is gone`, `has since`. A renamed command or file a reader may still have in a script goes in a table of old and new names, not in a sentence.
19. **The first line of a page is its `# Title`, and `website/docs/index.md` lists it [site]**: one table row whose first cell links the page and whose second says what the reader finds there. The index is the site's page map. Its `##` and `###` headings are the sidebar's groups, the row's second cell is the summary under the page's title, and a page it does not list fails the build. `packages/tests/plugin_docs.test.ts` holds the index to every plugin.

## Facts

20. **One fact, one home.** Another page that needs it gets at most two sentences and a link.
21. **Nothing is invented.** Every sentence traces to the code or to what the page said before. Where the old text is unclear, read the code. If code and page disagree, the code wins. The second sources are `olai web --help` and `olai surface --help`, the plugin manifests (`packages/plugins/*/src/wire.ts`), and the MCP tool descriptions.

## House style

Small choices a reader notices when they change from page to page. Every page makes them the same way.

22. **Spelling is British, with -ize (Oxford):** colour, behaviour, centre, cancelled, labelled; organization, authorize, recognize. Identifiers, code, commands, product names, quoted messages and on-screen labels stay exactly as written, and so does Nix's own *realise*. A label GitHub or Google shows stays as shown.
23. **One verb per pointer.** You press a key, click a control (a button, a tab, a row, a link) and tap only where the text is about a touch screen. A control you can click is "clickable", never "pressable".
24. **One way to write a shortcut:** one code span per key, modifiers as words, joined by ` + ` — `Cmd` + `Shift` + `Enter`, never `⌘⇧↩` and never a bare "Cmd-K" in text. A `<kbd>` tag is not an option: olai's own sanitiser drops it, and a code span reads the same everywhere. A page that names a chord says once that it is `Cmd` on a Mac and `Ctrl` elsewhere, which is what the app's own shortcut list shows.
25. **olai is lower case**, also at the start of a sentence or a heading. A name the screen shows with a capital is quoted as it appears.
26. **One cast for examples:** the directory `~/notes`, the outline `house.olai`, the document `cabinets.md`, the day `2026-08-12`, the host `olai.example.com`, the login `alice`. Loopback examples stay `http://127.0.0.1:7714`.
27. **Links are relative and land on a page inside `website/docs/` [lint] [site].** A page is read at its address there, so a plugin page links a sibling as `odu.md` and a top-level page as `../format.md`. The site rewrites each link to the page's address, and a link whose words are the file's name (`[chat.md](chat.md)`) shows the page's title there. A relative link to anything but a page is refused, because the site publishes pages and the pictures they draw: show a picture with `![What it shows](images/…)`, which the site draws on the page. An address of the running app, such as `/agenda`, is written as code and never as a link. The lint checks every link and every `#anchor`, and the site's build checks them again in the built pages.

## Variants by kind

The lint thresholds apply to every page as they are. The other differences are review rules.

| Rule | Tutorial and how-to | Explanation | Reference |
| --- | --- | --- | --- |
| 5, 6, 7, 8, 10, 13, 14, 16, 18 [lint] | as written | as written | as written |
| 2: cut rationale and implementation | cut. Link to the explanation page. | keeps the "why" | no fact is cut. The argument for a design moves to an explanation page, and the entry links to it. |
| 3: order | tutorial: one path to a visible result. How-to: the task's steps. | the decision and its cost | one entry per command, tool, property, key or file kind |

A reference fact is a command, a flag, a key, an MCP tool, a property, a setting, an environment variable, a label, a log line, a route, a file kind or an error message.

### The reference entry

Rule 7 gives a reference page its shape: one `###` entry per command, tool, group of keys or kind. Each `##` group opens with an index table whose first column links to the entries. Every entry uses the same order, omitting parts that do not apply:

1. Heading: the thing itself, in code font where the reader types it.
2. One sentence: what it is.
3. Usage block, or the keys.
4. Fields, flags or properties: a table, one line each.
5. Behaviour: a list of facts.
6. What it refuses, and what the reader sees then.
7. "Why" as a link to an explanation page.

## Sample: a guide passage

**Before** (`docs/format.md`, under hypertext, one list item of 158 words):

> - **It is served at its own address**, `/media/<its path>`, and that is what makes everything relative in it correct: the vault's directory shape IS the URL space. `<img src="art/shot.png">` in `notes/report.html` is `/media/notes/art/shot.png` — the exact URL a markdown `![](art/shot.png)` beside it is rewritten to — and `<a href="other.html">` is the file next door (the old `<base>` at the route's directory made pictures work and left links 404ing). Everything that is not vault-relative resolves somewhere the policy refuses…

**After** (about 45 words and a table):

> ### What a saved page may load
>
> A `.html` file is served at `/media/<its path>`, so a relative address in it means the file next to it on disk. Anything else is refused.
>
> | In the file | Loads |
> | --- | --- |
> | `<img src="art/shot.png">` in `notes/report.html` | `notes/art/shot.png` |
> | `<a href="other.html">` | the page of the file next door |
> | a remote host, a `data:` URI, a path above the directory | nothing |

What changed: the bold run-in became a heading. The shouted word is gone, and so is the parenthesis about what an older version did. Three parallel resolutions became a table. The reason the policy is written that way moved to the explanation page and is linked from there.

A smaller case, showing rule 2. Before: "It used to be shown and never run: the seal admitted exactly one script by its hash and refused the file's. That rule is gone." After: "The file's own JavaScript runs."

## Sample: a reference entry

**Before** (`docs/architecture/e2e-coverage.md`, one table cell, 559 words, opening):

> | Covers multiple folds and tabs without eviction, bounded fold depth, and the panel open while outlines are switched off in another tab (2 scenarios)… |

**After**: one row in the index table, and an entry under its own heading.

> | [Folds and tabs](#folds-and-tabs) | 2 scenarios | What stays open, and what survives a plugin going off |
>
> ### Folds and tabs
>
> Several folds and several tabs stay open together; nothing is evicted. Fold depth is bounded.
>
> | Scenario | What it proves |
> | --- | --- |
> | `folds_and_tabs` | Opening a fold in a second tab leaves the first one as it was. |
> | `outlines_off_with_panel_open` | Switching the outlines plugin off in another tab leaves the open panel standing. |

Every fact of the old cell is still there, in a shape a reader can scan.

## Before you commit a page

- `bun test packages/tests/docs_lint.test.ts -t '<page>'`: the lint for that page. The name is the page's path under `website/docs/`, so `-t 'docs/chat.md'` runs one page and `-t 'plugins/'` runs the plugin pages.
- `bun test packages/tests/plugin_docs.test.ts`: every plugin still has a page, the index still opens it, and no link dangles.
- `just website-dev` shows the site as you write, and `just website` builds it the way it is published, with every link and anchor checked.
- Renamed a heading? The lint checks every `#anchor` under `website/docs/`, and the site's build checks the site's own pages, but a link from `README.md` or a package's own comments is outside both. Grep for the old anchor and update it in the same change.
