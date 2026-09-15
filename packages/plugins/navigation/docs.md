# Navigation

Navigation owns browser addresses, history, open panes and focus. Its state
provider starts without a layout; replacing the layout preserves that state.
The provider owns scroll restoration and keyboard/IME observers and releases
them when navigation is disabled.

The roster-dependent half of the URL grammar is on `Router.routes`, which
`navigation.state` carries: printing a plugin's URL, parsing one, finding the
mounted tenant behind one, and the three narrowing readings that ask a tenant
whether its page takes a filter. All four read the claim table this row's
`renderer` component settles out of `app.route`, so a row that spells an
address names this service and a route whose tenant has left still spells the
front page. The PURE grammar — the constructors, the address reading,
`hrefOfPlain` for a route no tenant owns — stays a static contract with no
roster in it.

Two more of this row's verbs cross the same way. `navigation.palette` is what
a sibling may do to the ⌘K box — open it, ask a question in it, put one down,
shut it, and the two readings behind them — which search's header control and
the pins rename both spend. `navigation.gestures` is the arbiter that eats the
synthetic click a touch browser makes after a long press, which the outline's
row menu asks for. Neither is on the row's own `needs`: history and focus
activate without a renderer, so what waits for one is the `renderer` component
and not this row.

Content handlers register in `navigation.content`. A route remains in browser
history when its provider disappears and can be handled again when it returns.
The public `page(index)` outlet lets another layout draw the same content
without importing the navigation implementation.

The command palette contributes to `layout.overlays`. Feature integrations
register contextual actions and prefix handlers in `navigation.palette-adapters`;
outline editing, pins and capture own the writes behind those actions. Sidebar
and layout geometry do not own navigation state.

Palette prefixes are scoped contributions. A provider supplies its character,
labels, execution, result and continuation; navigation parses only active
contributions. Disabling capture removes its command and makes `+` ordinary
query text. Duplicate prefixes are reported and resolved in contribution order.
The keyboard-settling observer belongs to navigation, so keyboard workflows and
their observable completion work with alternative layouts too.

Touch ghost-click suppression belongs to the navigation activation. Disabling
navigation removes its capture listener and clears an armed gesture; retained
gesture callbacks cannot rearm the departed owner.

The palette shortcut belongs to navigation's activation, not to the overlay
component. A shortcut received before layout renders is retained as palette
state and opens the focused input when its overlay arrives. Closing through
the shortcut, Escape or a command uses the same renderer cleanup for its query
and prior focus. Removing navigation releases the shortcut listener; changing
layout does not create a gap in keyboard handling.

File pages contribute to `navigation.pages`, keyed by row id or `holds`.
Navigation reads the current vault Claims cell and chooses the exact kind
before the `holds` fallback. Outlines contributes once for every node-holding
format. Ordinary computed routes continue through `navigation.content`.

An unclaimed file address says that the directory holds nothing by that name
and that no row claims its suffix. A held file with no page contribution names
the claiming row whose browser page is unavailable. Addresses do not remember
a departed suffix-to-row mapping. Trash and Agenda can name the configured
outline row when it is off; Inbox and Pins explain that state in their sidebar
entries while their files remain ordinary addresses.

Saved layouts use `WorkspaceRouting.layoutIn(href)` to read workspace addresses and `WorkspaceRouting.layoutHref(workspace)` to print only ordered pages, without widths or focus. `WorkspaceRouting` composes over the page grammar when navigation binds its live roster. The page parser remains unchanged and does not import the workspace codec; it still resolves files under `s/`. Shared title recognition tries workspace addresses before page addresses, and both outline titles and shelf rows draw the resulting page or layout face. Named layout faces navigate in place; ⌘/Ctrl-click and middle-click retain browser new-tab behavior. `Router.open(workspace)` replaces the entire workspace in one history push without landings. These operations are supplied through `navigation.state`. Its `info(index)` exposes the existing live pane report, withdrawn with the reporting owner, for consumers that need pane names.

Saved-layout normalization is the pure `savedLayout(workspace)` transformation. URL serialization and in-place opening both use that value; opening does not encode and reparse a URL to discard geometry. `followLayout`, exported through the static `layout-press` contract, owns layout-anchor gesture policy for both shelf and outline faces. It accepts the caller's existing router, respects already-consumed gestures and browser new-tab clicks, and holds no service or lifetime of its own.

## Lanes: history for one tab at a time

The browser keeps one history stack per window. A row that keeps several
workspaces open (the `tabs` row) names a **lane** for the one in front with
`Router.switchLane(lane, workspace, key?)`, and from then on Back and Forward
walk only that lane's entries. Every entry the router writes carries its key,
the lane in force and its position in the stack (a push is one further, a
replace keeps the position). A traversal that reaches another lane's entry
keeps travelling in the same direction without drawing anything, and when none
of this lane's entries lies beyond it, it returns to the entry it started from.
The decision is the pure `seek` in `src/lanes.ts`.

While a traversal travels, nothing on screen changes — no workspace, no landing,
no scroll — including when it bounces home. It counts the entries it has moved
past, so it can always return. An entry it cannot place — one the browser made
mid-travel, or one written by a build before positions, still in the stack after
an upgrade — is dead, and the traversal goes home from it rather than on past
it, because nothing says whether anything of the lane lies beyond. So a
traversal only ever moves toward a live entry it knows of or back to where it
started, and always finishes. A
`switchLane` asked for mid-travel updates the lane and the page at once, and
writes the entry once the browser is back on it.

`switchLane` replaces the entry under the reader; it is not a history event. It
reuses `key` when given, so the scroll memory returns the entry to where it was
left, and returns the key the entry carries now. When the address does not
change it leaves the landing and scroll alone. The first lane taken
where none was in force adopts the entries this document wrote without one.
`forgetLane(lane)` marks that lane's entries dead, so a closed tab's pages are skipped. Forgetting the lane in force keeps the entry under the reader alive until the next `switchLane`, so Back and Forward always have an entry to return to. `switchLane(null, …)`
restores window history: every entry matches again. `lane()` and `entryKey()`
read the lane in force and the name of the current entry.

History is per document. The router only knows the entries this document wrote,
so after a reload every entry before it is dead while a lane is in force, and
each tab's history starts empty. With no lane in force nothing reads the table
and the router behaves as it always did.

## Chords plugins register

The palette's key handler dispatches the chords other rows register in
`app.keys`, after the core table in `@olai/web`'s `client/keys.ts` and with the
same rule: ⌘ on Apple and Ctrl elsewhere, no Alt, Shift matched exactly. With
Shift held, `.` and `,` match by the key they are on. A chord whose key and
Shift the core table already answers is refused with a console warning naming
both, and between two plugins the first keeps it. Registered chords are listed
in the shortcuts sheet under "Added by plugins", in their `said` words. They are
answered only while the palette's component is active: it names `layout.shell`
and the renderer, so with the layout row off a registered chord does nothing.

`Routing.label(route)` is a page's short name — a node's id, a file's path, a
plugin page's breadcrumb — read by the pane header and the tab strip alike.
