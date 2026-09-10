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
