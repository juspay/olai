# Properties that show what is happening now

Some property values name a terminal or a CI run that is still going on. olai shows what it is doing now.[^inert][^seam]

## What is live today

| The type | What the row shows | Whose page |
| --- | --- | --- |
| `kolu-terminal` | a row in kolu's Dock, and the read-only pane it opens | [plugins/kolu.md](plugins/kolu.md) |
| `odu-run` | a chip with the CI run's state, and the run matrix it opens | [plugins/odu.md](plugins/odu.md) |

## Switching one on

Switch the plugin on and its live properties work.[^default] Each plugin claims one key, the type's own word, which carries the plugin's name.[^names] So a row carrying a `kolu-terminal` property shows that terminal, with nothing declared anywhere.

## Pointing a type at one of your own keys

`_olai/Properties.olai` says which of your keys has which type, and it always wins ([properties.md](properties.md)):[^own][^away]

```jsonl
{"id":"prop-terminal","ord":"a0","title":"terminal","custom":{"type":"kolu-terminal"}}
{"id":"prop-run","ord":"aC","title":"run","custom":{"type":"odu-run"}}
```

## Blocks and chips

A live property is drawn as a block or as a chip.[^mechanism] A row with no live property looks like any other.

| Shape | Where it sits | When you see it |
| --- | --- | --- |
| a block | on a row of its own | always, even when all it can say is that the terminal has left kolu's fleet |
| a chip | beside the value | only while there is a state to show; a run it cannot find reads `unknown run` |

Clicking a chip opens a pane under the row's properties.[^pane] A live property only reads, and never changes what it watches.[^read][^connection] olai never shows a terminal or a run it cannot see as one that is simply idle.[^absence]

## When the plugin is off

You can run a server without any given plugin.[^leave] A value whose type no running plugin provides is read as plain text and is still valid.[^text] Switching a plugin off or on takes effect while you watch.[^switch][^judged]

[^inert]: Most of what a row stores just sits there: a title, a date, a path. A live property is the exception. The file goes on storing a name, and what the page draws for it looks up what that name is doing now.

[^seam]: This page covers what a live property is, how you switch one on, and the two shapes one takes on the page. What each one draws is on its plugin's own page.

[^mechanism]: One mechanism serves every live type, so a third kind of live thing needs its own drawing rather than its own machinery. Which of the two shapes a type uses depends on whether it is worth a row of its own when nothing is happening.

[^default]: Switching the plugin on is the whole setup: there is no file to edit first, and olai never writes anything into your directory to make it work ([settings.md](settings.md)).

[^names]: A type's name carries the plugin's own name on purpose. A key you call `terminal` is yours, and switching a plugin on can never take it over, which is why the type is called `kolu-terminal` and not `terminal`.

[^own]: A declaration is your key, the plugin's type, and your file. A key you call `pty` opens the terminal pane the same way.

[^away]: A declaration can also take the behaviour away: declare `kolu-terminal` as `text` and olai draws nothing for that key, because you have said what the key means and a default does not argue. Two layers, one rule: what your file says wins, and a plugin's claim applies only where your file said nothing.

[^pane]: A chip's pane opens one at a time per row, and runs only while it is open, so a page listing twelve rows with one live run among them is polling once.

[^read]: A live property only reads, and never changes anything: a live terminal pane is read-only, and a run matrix has no buttons in it, because watching something must not disturb it. The one exception is the [browser pane](plugins/browsing.md), which drives your own browser by design.

[^connection]: No browser tab connects to a terminal or a CI service itself. The server holds the one connection, or takes the one reading, and every browser is sent what it finds, so twelve tabs open on one outline are twelve readers of a single reading.

[^absence]: Not being able to see something is a state of its own, with its own wording, because it needs a different fix from a thing that is simply idle. Each plugin's page lists the sentences it says.

[^leave]: To run a serve without a plugin, leave it out of the plugin selection at startup, or switch it off in the **Plugins** panel while the server runs ([settings.md](settings.md)).

[^text]: A value whose type nothing provides still holds a name, the file is still fine, and nothing is drawn for it. That is the same state a directory that declared nothing is in.

[^switch]: Switch a plugin off and its types leave the running server with it. The values under them are read as plain text from the next reading on, and switching the plugin back on brings the types back, along with what they draw. The switch writes `on` or `off` to the settings file; your stored values never change.

[^judged]: A declaration is checked differently from a value, which is worth knowing before you go hunting for a bug. `{"type":"kolu-terminal"}` is a fine row on a server running only odu, because whether a file is valid may not depend on which plugins this machine happens to run. Only the drawing is missing.
