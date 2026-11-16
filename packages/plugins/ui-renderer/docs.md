# UI renderer: starting the browser app and its named places

`ui-renderer` starts the browser app on the page, and keeps the list of named places where every other plugin puts what it draws.[^nothing]

## What has to be on for a page to appear

`root` is the one place this plugin always keeps open, and exactly one plugin may fill it: the frame around the whole app, which [layout.md](layout.md) draws. Both plugins have to be on. A serve started with no browser build switches both off and runs with no browser app at all.[^switching]

## When the browser part of one plugin fails to load

The failure is reported on that one plugin, and every other plugin that loaded still draws and keeps working. The **Plugins** panel files the failed plugin under **Needs attention** and offers **Try again**.[^retry]

## When nothing is drawn at all

If the app cannot start (the renderer itself would not load, or the request olai makes at startup failed), the page shows a short report named **olai couldn't start**, with the problem in a sentence and a button under it.

| Button | When | What it does |
| --- | --- | --- |
| **Try again** | the missing code may still load | asks for it again, using the plugins the server currently has switched on |
| **Reload page** | `Retry could not recover this browser module. Reload the page to recover its dependencies.` | only reloading the page will fix it |

The report disappears as soon as the app draws.[^guess]

> While the first list of plugins is still on its way, the app asks the server which browser-only plugins are switched on, so that it can draw the screen it shows while connecting. The list that arrives over the live connection wins: a late answer to that first question never replaces it.

[^nothing]: This plugin draws nothing of its own. With it switched off, olai still serves and writes your files, and no page is drawn to read them on.

[^switching]: Switching plugins on and off is [settings.md](settings.md) and the **Plugins** panel ([plugin-inspector.md](plugin-inspector.md)). The panel says separately whether a plugin loaded in the browser and whether the server has it switched on, because a plugin can be on at the server and still have failed to load in this tab.

[^retry]: Pressing **Try again** asks for that one plugin's browser code again. Code that already loaded, including code an earlier retry recovered, is kept when the list of plugins changes later.

[^guess]: Retry never guesses which app frame to draw; it asks the server which plugins are switched on.

<details>
<summary>For plugin authors: the registry and its services</summary>

`ui-renderer.slots` is both how a plugin puts something at a named place and how it reads what is there: `contribute(location, face, { children, activate })`. Name the service on the component that draws, not on the plugin as a whole, so that a plugin whose renderer is absent waits instead of failing.

| Service | Carries |
| --- | --- |
| `ui-renderer.slots` | putting something at a named place, reading what is there, and `inspect()` |
| `ui-renderer.faces`, `ui-renderer.legacy-slots` | the same registry under the older `Slots` and `Faces` names, in the order the plugin list gives |
| `ui-renderer.clocks` | the tab's one timer, and what day it is |

A place declared inside another place belongs to the entry that declared it, not to a plugin or a parent name. Such a name is reserved while that entry waits, and becomes available once the entry activates. Put subscriptions and listeners that depend on a place in the scoped `activate` effect: it starts when the place arrives, drains when the place leaves, and starts fresh when the owner comes back.

Declaring the same place twice, ownership that runs in a circle, and a count of contributions the place does not allow all fail with the owners responsible named, including registrations that are still waiting. `inspect()` tells active, waiting and failed apart; reserving a child name on its own never reports an integration as active. Withdrawing the renderer closes the whole registry.

The runtime underneath is [../architecture/plugin-system.md](../architecture/plugin-system.md), and the words a manifest uses are [../architecture/plugin-vocabulary.md](../architecture/plugin-vocabulary.md).

</details>
