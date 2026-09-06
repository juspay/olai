# Navigation

Navigation owns browser addresses, history, open panes and focus. Its state
provider starts without a layout; replacing the layout preserves that state.
The provider owns scroll restoration and keyboard/IME observers and releases
them when navigation is disabled.

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
