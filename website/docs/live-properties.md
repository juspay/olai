# Live properties

A property whose value names something still going on, such as a terminal's id or a CI run's id, can wear a face that updates itself.[^inert][^seam]

## What is live today

| The kind | What it wears | Whose page |
| --- | --- | --- |
| `kolu-terminal` | kolu's Dock row, and the read-only pane it opens | [plugins/kolu.md](plugins/kolu.md) |
| `odu-run` | a CI chip for the named run, and the run matrix it opens | [plugins/odu.md](plugins/odu.md) |

They are one mechanism wearing different clothes.[^mechanism]

## Switching one on

Turn the plugin on and its faces work.[^default] Each plugin claims one key by convention, the kind's own word, which carries the plugin's name.[^names] So a row carrying `kolu-terminal 303dc985` gets the terminal door with nothing declared anywhere.

## Pointing a kind at your own key

`_olai/Properties.olai` says which of your own columns is which kind, and it always wins ([properties.md](properties.md)):[^own][^away]

```jsonl
{"id":"prop-terminal","ord":"a0","title":"terminal","custom":{"type":"kolu-terminal"}}
{"id":"prop-run","ord":"aC","title":"run","custom":{"type":"odu-run"}}
```

## Blocks and chips

The difference is whether the thing is worth a row when nothing is happening. A row with no live property looks unchanged.

| Shape | Where it sits | When it appears |
| --- | --- | --- |
| a block | owns its row | always: there is something to say, including that the terminal has left the fleet |
| a chip | beside the value | while there is something to say; a miss reads `unknown run` |

Pressing a chip opens a pane beneath the property run.[^pane] A face reads and never touches,[^read] no tab dials anything,[^connection] and "we cannot see" is never drawn as "we looked and it is quiet".[^absence]

## When the plugin is off

A serve can run without a plugin.[^leave] A kind whose plugin is not running validates as plain text.[^text] It happens while you watch.[^switch][^judged]

[^inert]: Most of what a row records is inert: a title, a date, a path. A live property is the exception. The file goes on storing the name; the face finds out what that name is doing.

[^seam]: This page is the seam: what a live property is, what switches one on, and the two shapes a face takes. What each face draws is on its plugin's own page.

[^mechanism]: One mechanism wears the clothes of every live kind, so a third kind of living thing is a third set of clothes rather than a third mechanism.

[^default]: Switching a plugin on is the whole of the default: there is no file to edit first, and olai never writes to your directory to make it so ([settings.md](settings.md)).

[^names]: A kind's name carries the plugin's own name on purpose. A column you call `terminal` is yours, and switching a plugin on can never take it over, which is why the claim is `kolu-terminal` rather than `terminal`.

[^own]: A declaration is your key, the plugin's kind, your file. A column called `pty` gets the terminal door the same way.

[^away]: A declaration can also take a face away: declare `kolu-terminal` as `text` and the door goes dark, because you have said what that column means and a default does not argue. Two layers, one rule: the file wins, and a plugin's claim applies where the file said nothing.

[^pane]: A chip's pane opens one at a time per node, mounted only while it is open, so a page of twelve lanes with one live run has one clock ticking on it.

[^read]: A live face reads and never touches: a live pane is read-only, and a run matrix has no buttons in it, because watching something must not perturb it. The one exception is the [browser pane](plugins/browsing.md), which is a hand on your own browser by design.

[^connection]: No tab dials anything itself. The server holds the one connection or takes the one reading, and every browser subscribes to it, so twelve tabs on a lanes outline are twelve readers of one sweep.

[^absence]: An absence is a state with its own words, because an absence and a quiet thing have opposite fixes. Each plugin's page lists the sentences it says.

[^leave]: To run a serve without a plugin, leave it out of the file's row selection at startup, or press its switch on the plugins panel while it runs ([settings.md](settings.md)).

[^text]: A kind read as plain text still holds a name, the file is still fine, and it wears no face — which is the state a directory that declared nothing is already in.

[^switch]: Switch a plugin off and its words leave the running serve with it, the values under them read as plain text on the next reading, and switching it back on brings both the words and the faces back. The switch writes `on` to the policy file; your stored values never change.

[^judged]: A declaration is judged differently from a value, which is worth knowing before you go hunting for a bug. `{"type":"kolu-terminal"}` is a clean row on a serve running only odu, because a file's verdict may not depend on which plugins this machine is running. Only the face is missing.
