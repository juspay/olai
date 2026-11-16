# UI renderer

`ui-renderer` draws nothing of its own. It owns the root the browser app is
mounted into, and the registry every other browser plugin hangs its faces off.
With it switched off, olai still serves and writes your files, and no page is
drawn to read them on.

## What has to be on for a page to appear

`root` is the only location this plugin keeps permanently, and it takes exactly
one contribution: the frame, which is [layout.md](layout.md)'s. Both rows must
be on. A serve with no browser bundle selects neither, and runs headless.

Switching rows on and off is [settings.md](settings.md) and the **Plugins**
panel ([plugin-inspector.md](plugin-inspector.md)); the panel reports browser
activation separately from the server's selection, because a row can be
selected on the server and still have failed to load in this tab.

## When one plugin's browser half fails

The failure is reported on that row alone. Every other loaded row still mounts
and keeps working. The **Plugins** panel files the failed row under **Needs
attention** and offers **Try again**, which re-fetches that entry only:
successfully loaded modules, including ones recovered by an earlier retry, are
kept through later roster changes.

## When nothing is drawn at all

If startup cannot render an application (the renderer itself would not load,
or the startup request failed), the page shows a small report named **olai
couldn't start**, with the problem in a sentence and a button under it.

| Button | When | What it does |
| --- | --- | --- |
| **Try again** | the module may still load | retries with the server's current selection |
| **Reload page** | `Retry could not recover this browser module. Reload the page to recover its dependencies.` | nothing short of a reload will fix it |

The report disappears as soon as an application renders. Retry never guesses a
default shell; it asks for whatever the server says is selected.

> While the first roster is still on its way, the shell asks the server which
> browser-only rows are selected so it can draw its connecting state. The live
> roster wins: a late answer to that first question cannot replace it.

## For plugin authors

`ui-renderer.slots` is both how a row contributes a face and how it reads one:
`contribute(location, face, { children, activate })`. Name the service on the
component that draws, not on the row, so a row whose renderer is absent waits
instead of failing.

| Service | Carries |
| --- | --- |
| `ui-renderer.slots` | contributing at a location, reading what is contributed at one, and `inspect()` |
| `ui-renderer.faces`, `ui-renderer.legacy-slots` | the same registry under the older `Slots` and `Faces` names, in the roster's own order |
| `ui-renderer.clocks` | the tab's one timer and what day it is |

Child locations belong to the entry that declared them, not to a plugin or a
parent name. Their names are reserved while the entry waits and become
available once it activates. Put location-dependent subscriptions and listeners
in the scoped `activate` effect: it starts when the location arrives, drains
when it leaves, and starts fresh when the owner returns.

Duplicate declarations, ownership cycles and incompatible cardinality fail with
the responsible owners named, registrations still waiting included. `inspect()`
tells active, waiting and failed apart; reserving a child name alone never
reports an integration active. Withdrawing the renderer closes the whole
registry.

The runtime underneath is
[../architecture/plugin-system.md](../architecture/plugin-system.md), and the
words a manifest uses are
[../architecture/plugin-vocabulary.md](../architecture/plugin-vocabulary.md).
